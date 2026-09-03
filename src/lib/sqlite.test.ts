import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadDatabaseFileFromUrl,
  loadManifest,
  metadataFromRaw,
  normalizeBenchmarkCodeState,
  normalizeBenchmarkHardwareEnvironment,
  normalizeBenchmarkKey,
  normalizeBenchmarkRow,
  normalizeBenchmarkRunRecord,
  normalizeBenchmarkSoftwareEnvironment,
  normalizeManifest,
  refreshDatabaseFileFromUrl,
  validateManifestDatabaseBytes,
  validateSchemaVersion
} from "./sqlite";
import type { BenchLedgerManifestDatabase } from "./types";

const Valid_Sha256 = "a".repeat(64);
afterEach(() => vi.unstubAllGlobals());

function validManifestDatabase(overrides: Record<string, unknown> = {}) {
  return { id: "db-1", name: "Main DB", description: "primary", url: "./bench.sqlite", sha256: Valid_Sha256, size_bytes: 123, packed_at: "2026-07-18T00:00:00Z", metadata_preview: { description: "preview", project_url: null }, ...overrides };
}

describe("sqlite helpers", () => {
  it("parses canonical benchmark keys", () => {
    expect(normalizeBenchmarkKey('["suite","case"]')).toEqual({ key: '["suite","case"]', path: ["suite", "case"], label: "suite / case" });
    expect(() => normalizeBenchmarkKey('[ "suite", "case" ]')).toThrow("expected canonical JSON");
    expect(() => normalizeBenchmarkKey("not-json")).toThrow("Invalid benchmark_key");
  });

  it("accepts complete manifests and rejects invalid or duplicate database entries", () => {
    expect(normalizeManifest({ site: { title: "BenchLedger" }, databases: [validManifestDatabase({ sha256: Valid_Sha256.toUpperCase() })] }))
      .toMatchObject({ site: { title: "BenchLedger" }, databases: [{ id: "db-1", url: "./bench.sqlite", sha256: Valid_Sha256, size_bytes: 123 }] });
    expect(normalizeManifest({ databases: [validManifestDatabase({ sha256: "bad" })] })).toBeNull();
    expect(normalizeManifest({ databases: [validManifestDatabase(), validManifestDatabase({ url: "./other.sqlite" })] })).toBeNull();
  });

  it("accepts schema v6 and rejects unsupported versions", () => {
    const metadata = metadataFromRaw({ schema_version: "6", name: "Demo", notes: "hello" });
    expect(metadata).toMatchObject({ schema_version: 6, name: "Demo", notes: "hello" });
    expect(() => validateSchemaVersion(metadata)).not.toThrow();
    expect(() => validateSchemaVersion(metadataFromRaw({ schema_version: "5" }))).toThrow("Unsupported BenchLedger schema version: 5. Expected 6.");
  });

  it("treats the dev-server HTML fallback as an absent default manifest", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html; charset=utf-8" } })));
    await expect(loadManifest()).resolves.toBeNull();
  });

  it("forwards AbortSignal so obsolete network requests can be cancelled", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      expect(init?.signal).toBe(controller.signal);
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    vi.stubGlobal("fetch", fetchMock);
    const request = loadManifest(undefined, controller.signal);
    controller.abort();
    await expect(request).rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("validates raw result columns without coercion", () => {
    const row = { run_id: "run-1", benchmark_key: '["suite","case"]', metric_name: "time", statistic: "median", unit: "ns", value: 123, better: "lower" };
    expect(normalizeBenchmarkRow(row)).toMatchObject({ run_id: "run-1", value: 123 });
    expect(() => normalizeBenchmarkRow({ ...row, value: null })).toThrow("must be a finite number");
    expect(() => normalizeBenchmarkRow({ ...row, run_id: 1 })).toThrow("must be a string");
  });

  it("rejects invalid known fields inside stored JSON identities and metadata", () => {
    expect(() => normalizeBenchmarkRunRecord({ id: "run-1", code_state_id: "c", hardware_environment_id: "h", software_environment_id: "s", measured_at: "2026-01-01", metadata: '{"source":{"tags":["ok",1]}}' })).toThrow("tags");
    expect(() => normalizeBenchmarkCodeState({ id: "c", label: "C", code_date: "2026-01-01", identity: "{}", metadata: '{"source":{"dirty":"yes"}}' })).toThrow("dirty");
    expect(() => normalizeBenchmarkHardwareEnvironment({ id: "h", label: "H", identity: '{"cpu":{"model":123}}', metadata: "{}" })).toThrow("model");
    expect(() => normalizeBenchmarkSoftwareEnvironment({ id: "s", label: "S", identity: '{"execution":{"threads":"many"}}', metadata: "{}" })).toThrow("threads");
  });

  it("validates manifest database size and SHA-256", async () => {
    const bytes = new TextEncoder().encode("BenchLedger").buffer;
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const database: BenchLedgerManifestDatabase = { id: "db-1", url: "./bench.sqlite", size_bytes: bytes.byteLength, sha256 };
    await expect(validateManifestDatabaseBytes(database, bytes)).resolves.toBeUndefined();
    await expect(validateManifestDatabaseBytes({ ...database, size_bytes: bytes.byteLength + 1 }, bytes)).rejects.toThrow("Database size mismatch");
    await expect(validateManifestDatabaseBytes({ ...database, sha256: Valid_Sha256 }, bytes)).rejects.toThrow("Database SHA-256 mismatch");
  });

  it("rejects oversized remote databases before reading their body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 200, headers: { "content-length": String(513 * 1024 * 1024) } })));
    await expect(loadDatabaseFileFromUrl("https://example.test/huge.sqlite")).rejects.toThrow("512 MiB browser safety limit");
  });

  it("stops streaming a remote database as soon as the size limit is exceeded", async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const releaseLock = vi.fn();
    const read = vi.fn().mockResolvedValueOnce({ done: false, value: { byteLength: 513 * 1024 * 1024 } });
    const response = { ok: true, status: 200, headers: new Headers(), body: { getReader: () => ({ read, cancel, releaseLock }) } } as unknown as Response;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(loadDatabaseFileFromUrl("https://example.test/chunked-huge.sqlite")).rejects.toThrow("512 MiB browser safety limit");
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(releaseLock).toHaveBeenCalledTimes(1);
  });

  it("refreshes a database URL only after its HTTP validators change", async () => {
    const first = new Uint8Array([1, 2, 3]).buffer;
    const second = new Uint8Array([4, 5, 6]).buffer;
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(first, { status: 200, headers: { etag: '"v1"', "last-modified": "Wed, 02 Sep 2026 00:00:00 GMT" } }))
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { etag: '"v1"', "last-modified": "Wed, 02 Sep 2026 00:00:00 GMT" } }))
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { etag: '"v2"', "last-modified": "Wed, 02 Sep 2026 00:00:01 GMT" } }))
      .mockResolvedValueOnce(new Response(second, { status: 200, headers: { etag: '"v2"', "last-modified": "Wed, 02 Sep 2026 00:00:01 GMT" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(loadDatabaseFileFromUrl("https://example.test/bench.sqlite")).resolves.toMatchObject({ sourceUrl: "https://example.test/bench.sqlite" });
    await expect(refreshDatabaseFileFromUrl("https://example.test/bench.sqlite")).resolves.toBeNull();
    await expect(refreshDatabaseFileFromUrl("https://example.test/bench.sqlite")).resolves.toMatchObject({ sourceUrl: "https://example.test/bench.sqlite" });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://example.test/bench.sqlite", { method: "HEAD", cache: "no-store", signal: undefined });
    expect(fetchMock).toHaveBeenNthCalledWith(4, "https://example.test/bench.sqlite", { cache: "no-store", signal: undefined });
  });
});
