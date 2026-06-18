import { describe, expect, it } from "vitest";
import {
  joinRelativeUrl,
  metadataFromRaw,
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
      schema_version: 3,
      metadata_preview: { description: "preview" }
    })).toEqual({
      id: "db-1",
      name: "Main DB",
      description: "primary",
      url: "./bench.sqlite",
      schema_version: 3,
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
      schema_version: "3",
      name: "Demo",
      notes: "hello"
    });

    expect(metadata).toMatchObject({
      schema_version: 3,
      name: "Demo",
      description: "",
      notes: "hello"
    });
    expect(() => validateSchemaVersion(metadata)).not.toThrow();
    expect(() => validateSchemaVersion(metadataFromRaw({ schema_version: "99" }))).toThrow(
      "Unsupported BenchLedger schema version: 99"
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
});
