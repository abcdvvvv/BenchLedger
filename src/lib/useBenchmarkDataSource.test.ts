import { describe, expect, it } from "vitest";
import { selectInitialManifestDatabase } from "./useBenchmarkDataSource";
import type { BenchLedgerManifestDatabase } from "./types";

const databases: BenchLedgerManifestDatabase[] = [
  { id: "db-a", url: "./db-a.sqlite" },
  { id: "db-b", url: "./db-b.sqlite" }
];

describe("benchmark data source selection", () => {
  it("restores a valid saved database", () => {
    expect(selectInitialManifestDatabase(databases, "db-b")?.id).toBe("db-b");
  });

  it("loads the first manifest database when no saved ID matches", () => {
    expect(selectInitialManifestDatabase(databases, "")?.id).toBe("db-a");
    expect(selectInitialManifestDatabase(databases, "missing")?.id).toBe("db-a");
  });

  it("returns null for an empty manifest", () => {
    expect(selectInitialManifestDatabase([], "db-a")).toBeNull();
  });
});
