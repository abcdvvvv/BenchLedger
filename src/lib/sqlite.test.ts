import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import initSqlJs, { type Database } from "sql.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadManifest,
  metadataFromRaw,
  normalizeBenchmarkKey,
  normalizeBenchmarkRow,
  normalizeManifest,
  readBenchmarkDataset,
  validateManifestDatabaseBytes,
  validateSchemaVersion
} from "./sqlite";
import type { BenchLedgerManifestDatabase } from "./types";

const Valid_Sha256 = "a".repeat(64);
const nodeRequire = createRequire(import.meta.url);
const sqlWasmPath = join(dirname(nodeRequire.resolve("sql.js")), "sql-wasm.wasm");
let sqlJsPromise: ReturnType<typeof initSqlJs> | null = null;

function loadTestSqlJs() {
  return sqlJsPromise ??= initSqlJs({ locateFile: () => sqlWasmPath });
}

afterEach(() => vi.unstubAllGlobals());

function validManifestDatabase(overrides: Record<string, unknown> = {}) {
  return {
    id: "db-1",
    name: "Main DB",
    description: "primary",
    url: "./bench.sqlite",
    sha256: Valid_Sha256,
    size_bytes: 123,
    packed_at: "2026-07-18T00:00:00Z",
    metadata_preview: { description: "preview", project_url: null },
    ...overrides
  };
}

function createV6Tables(db: Database) {
  db.run(`
    CREATE TABLE benchledger_metadata (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE code_states (id TEXT PRIMARY KEY, label TEXT, code_date TEXT, identity TEXT, metadata TEXT);
    CREATE TABLE hardware_environments (id TEXT PRIMARY KEY, label TEXT, identity TEXT, metadata TEXT);
    CREATE TABLE software_environments (id TEXT PRIMARY KEY, label TEXT, identity TEXT, metadata TEXT);
    CREATE TABLE runs (
      id TEXT PRIMARY KEY, code_state_id TEXT, hardware_environment_id TEXT,
      software_environment_id TEXT, measured_at TEXT, metadata TEXT
    );
    CREATE TABLE benchmark_results (
      run_id TEXT, benchmark_key TEXT, metric_name TEXT, statistic TEXT, unit TEXT, value REAL, better TEXT,
      PRIMARY KEY (run_id, benchmark_key, metric_name, statistic)
    );
  `);
}

function insertMinimalEntities(db: Database) {
  db.run(`
    INSERT INTO benchledger_metadata VALUES ('schema_version', '6');
    INSERT INTO benchledger_metadata VALUES ('name', 'Integration fixture');
    INSERT INTO code_states VALUES (
      'code-1', 'main@abc', '2026-07-01T00:00:00Z',
      '{"source":{"kind":"git","revision":"abc"}}', '{}'
    );
    INSERT INTO hardware_environments VALUES (
      'hardware-1', 'Synthetic CPU · 32 GiB',
      '{"architecture":"x86_64","cpu":{"model":"Synthetic CPU","physical_cores":8},"gpu":[{"model":"GPU","type":"discrete"}]}', '{}'
    );
    INSERT INTO software_environments VALUES (
      'software-1', 'Julia 1.12 · Linux',
      '{"runtime":{"name":"Julia","version":"1.12"},"platform":{"os":{"name":"linux"}},"gpu":{"interface":{"name":"CUDA.jl","version":"5"}},"math_libraries":{"blas":{"threads":8}},"dependencies":{"kind":"lockfile","digest":"abc"}}', '{}'
    );
    INSERT INTO runs VALUES (
      'run-1', 'code-1', 'hardware-1', 'software-1', '2026-07-01T01:00:00Z',
      '{"writer":{"name":"BenchLedger Julia template","schema_version":6}}'
    );
  `);
}

describe("sqlite helpers", () => {
  it("parses canonical benchmark keys", () => {
    expect(normalizeBenchmarkKey('["suite","case"]')).toEqual({
      key: '["suite","case"]',
      path: ["suite", "case"],
      label: "suite / case"
    });
    expect(() => normalizeBenchmarkKey('[ "suite", "case" ]')).toThrow("expected canonical JSON");
    expect(() => normalizeBenchmarkKey("not-json")).toThrow("Invalid benchmark_key");
  });

  it("accepts complete manifests and rejects invalid or duplicate database entries", () => {
    expect(normalizeManifest({
      site: { title: "BenchLedger" },
      databases: [validManifestDatabase({ sha256: Valid_Sha256.toUpperCase() })]
    })).toMatchObject({
      site: { title: "BenchLedger" },
      databases: [{ id: "db-1", url: "./bench.sqlite", sha256: Valid_Sha256, size_bytes: 123 }]
    });
    expect(normalizeManifest({ databases: [validManifestDatabase({ sha256: "bad" })] })).toBeNull();
    expect(normalizeManifest({
      databases: [validManifestDatabase(), validManifestDatabase({ url: "./other.sqlite" })]
    })).toBeNull();
  });

  it("accepts schema v6 and rejects unsupported versions", () => {
    const metadata = metadataFromRaw({ schema_version: "6", name: "Demo", notes: "hello" });
    expect(metadata).toMatchObject({ schema_version: 6, name: "Demo", notes: "hello" });
    expect(() => validateSchemaVersion(metadata)).not.toThrow();
    expect(() => validateSchemaVersion(metadataFromRaw({ schema_version: "5" })))
      .toThrow("Unsupported BenchLedger schema version: 5. Expected 6.");
  });

  it("treats the dev-server HTML fallback as an absent default manifest", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<!doctype html>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" }
    })));
    await expect(loadManifest()).resolves.toBeNull();
  });

  it("does not coerce result values or IDs", () => {
    const row = {
      run_id: "run-1",
      benchmark_key: '["suite","case"]',
      metric_name: "time",
      statistic: "median",
      unit: "ns",
      value: 123,
      better: "lower"
    };
    expect(normalizeBenchmarkRow(row)).toMatchObject({ run_id: "run-1", value: 123 });
    expect(() => normalizeBenchmarkRow({ ...row, value: null })).toThrow("must be a finite number");
    expect(() => normalizeBenchmarkRow({ ...row, run_id: 1 })).toThrow("must be a string");
  });

  it("validates manifest database size and SHA-256", async () => {
    const bytes = new TextEncoder().encode("BenchLedger").buffer;
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    const sha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const database: BenchLedgerManifestDatabase = {
      id: "db-1",
      url: "./bench.sqlite",
      size_bytes: bytes.byteLength,
      sha256
    };

    await expect(validateManifestDatabaseBytes(database, bytes)).resolves.toBeUndefined();
    await expect(validateManifestDatabaseBytes({ ...database, size_bytes: bytes.byteLength + 1 }, bytes))
      .rejects.toThrow("Database size mismatch");
    await expect(validateManifestDatabaseBytes({ ...database, sha256: Valid_Sha256 }, bytes))
      .rejects.toThrow("Database SHA-256 mismatch");
  });

  it("reads current identities and aggregates a v6 database from physical tables", async () => {
    const SQL = await loadTestSqlJs();
    const db = new SQL.Database();
    try {
      createV6Tables(db);
      insertMinimalEntities(db);
      db.run(`
        INSERT INTO runs VALUES ('run-2', 'code-1', 'hardware-1', 'software-1', '2026-07-01T02:00:00Z', '{}');
        INSERT INTO runs VALUES ('run-3', 'code-1', 'hardware-1', 'software-1', '2026-07-01T03:00:00Z', '{}');
        INSERT INTO benchmark_results VALUES ('run-1', '["suite","case"]', 'time', 'median', 'ns', 1000, 'lower');
        INSERT INTO benchmark_results VALUES ('run-2', '["suite","case"]', 'time', 'median', 'μs', 2, 'lower');
        INSERT INTO benchmark_results VALUES ('run-3', '["suite","other"]', 'time', 'median', 'ns', 99, 'lower');
      `);

      const dataset = readBenchmarkDataset(db, "integration.sqlite", null);

      expect(dataset.rows).toHaveLength(3);
      expect(Array.from(dataset.benchmarksByKey.keys())).toEqual([
        '["suite","case"]',
        '["suite","other"]'
      ]);
      expect(dataset.runsById.get("run-1")?.metadata.writer?.schema_version).toBe(6);
      expect(dataset.hardwareEnvironmentsById.get("hardware-1")?.identity.gpu?.[0].type).toBe("discrete");
      expect(dataset.softwareEnvironmentsById.get("software-1")?.identity.math_libraries?.blas?.threads).toBe(8);
      expect(dataset.aggregateRows).toEqual([
        expect.objectContaining({ benchmark_key: '["suite","case"]', value: 1500, unit: "ns", run_count: 2 }),
        expect.objectContaining({ benchmark_key: '["suite","other"]', value: 99, run_count: 1 })
      ]);
    } finally {
      db.close();
    }
  });
});
