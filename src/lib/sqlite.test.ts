import { describe, expect, it } from "vitest";
import {
  joinRelativeUrl,
  metadataFromRaw,
  normalizeBenchmarkRow,
  normalizeBenchmarkPath,
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
      schema_version: 4,
      metadata_preview: { description: "preview" }
    })).toEqual({
      id: "db-1",
      name: "Main DB",
      description: "primary",
      url: "./bench.sqlite",
      schema_version: 4,
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
      schema_version: "4",
      name: "Demo",
      notes: "hello"
    });

    expect(metadata).toMatchObject({
      schema_version: 4,
      name: "Demo",
      description: "",
      notes: "hello"
    });
    expect(() => validateSchemaVersion(metadata)).not.toThrow();
    expect(() => validateSchemaVersion(metadataFromRaw({ schema_version: "99" }))).toThrow(
      "Unsupported BenchLedger schema version: 99. Expected 4."
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

  it("normalizes schema-v4 rows and preserves unknown metadata fields", () => {
    const row = normalizeBenchmarkRow({
      run_id: "run-1",
      code_state_id: "state-1",
      code_label: "abc1234",
      code_date: "2026-06-26T00:00:00Z",
      environment_id: "env-python",
      environment_label: "Python 3.12 / Linux",
      measured_at: "2026-06-26T00:10:00Z",
      notes: "note",
      code_state_metadata: "{\"source\":{\"kind\":\"git\",\"revision\":\"abc\",\"branch\":\"main\"},\"unknown_code\":42}",
      environment_metadata: "{\"runtime\":{\"name\":\"Python\",\"version\":\"3.12\"},\"unknown_env\":{\"toolchain\":\"gcc\"}}",
      run_metadata: "{\"source\":{\"branch\":\"main\"},\"unknown_run\":{\"ci\":\"custom\"}}",
      benchmark_path: "[\"suite\",\"case\"]",
      benchmark_id: "bench-1",
      benchmark_label: "suite/case",
      metric_name: "time",
      statistic: "median",
      unit: "ns",
      value: 123,
      better: "lower"
    });

    expect(row.environment_metadata.runtime?.name).toBe("Python");
    expect(row.code_state_metadata.unknown_code).toBe(42);
    expect(row.environment_metadata.unknown_env).toEqual({ toolchain: "gcc" });
    expect(row.run_metadata.unknown_run).toEqual({ ci: "custom" });
  });

  it("throws a clear error for invalid metadata JSON", () => {
    expect(() => normalizeBenchmarkRow({
      run_id: "run-1",
      code_state_id: "state-1",
      code_label: "local",
      code_date: "2026-06-26T00:00:00Z",
      environment_id: "env-1",
      environment_label: "C++ native",
      measured_at: "2026-06-26T00:10:00Z",
      notes: "",
      code_state_metadata: "{bad json",
      environment_metadata: "{}",
      run_metadata: "{}",
      benchmark_path: "[\"suite\"]",
      benchmark_id: "bench-1",
      benchmark_label: "suite",
      metric_name: "time",
      statistic: "median",
      unit: "ns",
      value: 1,
      better: "lower"
    })).toThrow("Invalid code_state_metadata in run-1");
  });
});
