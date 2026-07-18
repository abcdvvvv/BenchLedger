import { describe, expect, it } from "vitest";
import {
  joinRelativeUrl,
  metadataFromRaw,
  normalizeBenchmarkCodeState,
  normalizeBenchmarkDefinition,
  normalizeBenchmarkEnvironment,
  normalizeBenchmarkRow,
  normalizeBenchmarkPath,
  normalizeBenchmarkRunRecord,
  normalizeManifest,
  normalizeManifestDatabase,
  validateSchemaVersion
} from "./sqlite";

describe("sqlite helpers", () => {
  it("normalizes benchmark paths from JSON arrays", () => {
    expect(normalizeBenchmarkPath('["suite","case"]')).toEqual(["suite", "case"]);
    expect(normalizeBenchmarkPath('["suite",1,""]')).toEqual(["suite"]);
    expect(normalizeBenchmarkPath("not-json")).toEqual([]);
    expect(normalizeBenchmarkPath(null)).toEqual([]);
  });

  it("normalizes manifest database entries with valid urls", () => {
    expect(normalizeManifestDatabase({
      id: "db-1",
      name: "Main DB",
      description: "primary",
      url: "./bench.sqlite",
      schema_version: 5,
      metadata_preview: { description: "preview" }
    })).toEqual({
      id: "db-1",
      name: "Main DB",
      description: "primary",
      url: "./bench.sqlite",
      schema_version: 5,
      metadata_preview: { description: "preview" }
    });

    expect(normalizeManifestDatabase({ url: "./bench.sqlite" })?.id).toBe("./bench.sqlite");
    expect(normalizeManifestDatabase({ id: "missing-url" })).toBeNull();
  });

  it("normalizes manifests and filters invalid database entries", () => {
    expect(normalizeManifest({
      manifest_version: 2,
      site: { title: "BenchLedger" },
      databases: [
        { id: "ok", url: "./ok.sqlite" },
        { id: "bad" }
      ]
    })).toEqual({
      manifest_version: 2,
      benchledger_web_version: undefined,
      generated_at: undefined,
      site: { title: "BenchLedger", description: undefined },
      databases: [{ id: "ok", url: "./ok.sqlite" }]
    });

    expect(normalizeManifest({ databases: "bad" })).toBeNull();
  });

  it("builds metadata with defaults and validates schema versions", () => {
    const metadata = metadataFromRaw({
      schema_version: "5",
      name: "Demo",
      notes: "hello"
    });

    expect(metadata).toMatchObject({
      schema_version: 5,
      name: "Demo",
      description: "",
      notes: "hello"
    });
    expect(() => validateSchemaVersion(metadata)).not.toThrow();
    expect(() => validateSchemaVersion(metadataFromRaw({ schema_version: "4" }))).toThrow(
      "Unsupported BenchLedger schema version: 4. Expected 5."
    );
    expect(() => validateSchemaVersion(metadataFromRaw({}))).toThrow(
      "Unsupported BenchLedger schema version: missing. Expected 5."
    );
    expect(() => validateSchemaVersion(metadataFromRaw({ schema_version: "99" }))).toThrow(
      "Unsupported BenchLedger schema version: 99. Expected 5."
    );
  });

  it("joins relative urls against a manifest path", () => {
    expect(joinRelativeUrl("https://example.com/catalog/benchledger.json", "./data.sqlite")).toBe(
      "https://example.com/catalog/data.sqlite"
    );
    expect(joinRelativeUrl("https://example.com/catalog/benchledger.json", "assets/data.sqlite")).toBe(
      "https://example.com/catalog/assets/data.sqlite"
    );
  });

  it("normalizes v5 results and entity metadata separately", () => {
    const definition = normalizeBenchmarkDefinition({
      benchmark_path: "[\"suite\",\"case\"]",
      benchmark_id: "bench-1",
      benchmark_label: "suite/case"
    });
    const row = normalizeBenchmarkRow({
      run_id: "run-5",
      benchmark_id: "bench-1",
      metric_name: "time",
      statistic: "median",
      unit: "ns",
      value: 123,
      better: "lower"
    });
    const run = normalizeBenchmarkRunRecord({
      id: "run-5",
      code_state_id: "code-abc",
      environment_id: "env-5",
      measured_at: "2026-07-18T00:10:00Z",
      notes: "",
      metadata: "{\"source\":{\"branch\":\"main\"}}"
    });
    const codeState = normalizeBenchmarkCodeState({
      id: "code-abc",
      label: "abc1234",
      code_date: "2026-07-18T00:00:00Z",
      identity: "{\"source\":{\"kind\":\"git\",\"revision\":\"abc\"}}",
      metadata: "{\"source\":{\"dirty\":false}}"
    });
    const environment = normalizeBenchmarkEnvironment({
      id: "env-5",
      label: "linux-host",
      identity: "{\"runtime\":{\"name\":\"Julia\",\"version\":\"1.12\"},\"hardware\":{\"cpu\":{\"model\":\"CPU\"}}}",
      metadata: "{\"benchmark\":{\"framework\":{\"name\":\"BenchmarkTools.jl\",\"version\":\"1.6\"}}}"
    });

    expect(definition).toEqual({ id: "bench-1", path: ["suite", "case"], label: "suite/case" });
    expect(row).toMatchObject({ run_id: "run-5", benchmark_id: "bench-1" });
    expect(run.metadata.source?.branch).toBe("main");
    expect(codeState.identity.source?.revision).toBe("abc");
    expect(codeState.metadata.source?.dirty).toBe(false);
    expect(environment.identity.runtime?.name).toBe("Julia");
    expect(environment.metadata.benchmark?.framework?.name).toBe("BenchmarkTools.jl");
  });

  it("throws a clear error for invalid entity metadata JSON", () => {
    expect(() => normalizeBenchmarkCodeState({
      id: "code-abc",
      label: "local",
      code_date: "2026-06-26T00:00:00Z",
      identity: "{\"source\":{\"kind\":\"git\",\"revision\":\"abc\"}}",
      metadata: "{bad json"
    })).toThrow("Invalid code-state metadata in code-abc");
  });
});
