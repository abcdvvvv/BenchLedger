import { describe, expect, it } from "vitest";
import {
  clampTrendBoardColumns,
  comparePath,
  databaseDescription,
  databaseTitle,
  defaultRunPairSortDirection,
  formatSchemaLabel,
  metadataDescription,
  metadataTitle,
  rowMatchesDisplayStrategy,
  trendDisplayUnitContext
} from "./dashboard";
import type { BenchmarkRow } from "./types";

const Base_Row: BenchmarkRow = {
  run_id: "run-1",
  branch: "feature",
  tag: "",
  code_state_id: "state-1",
  label: "Run 1",
  commit_sha: "abcdef123456",
  code_date: "2026-01-01T00:00:00Z",
  measured_at: "2026-01-01T00:00:00Z",
  benchmark_path: ["suite", "case"],
  benchmark_id: "bench-1",
  benchmark_label: "bench-1",
  metric_name: "time",
  statistic: "median",
  unit: "ns",
  value: 1000,
  better: "lower",
  machine_id: "machine-1",
  cpu_model: "cpu",
  cpu_threads: 8,
  arch: "x64",
  os: "linux",
  julia_version: "1.10",
  is_dirty: false,
  notes: "",
  group: "suite"
};

describe("dashboard helpers", () => {
  it("clamps trend board columns", () => {
    expect(clampTrendBoardColumns(Number.NaN)).toBe(3);
    expect(clampTrendBoardColumns(0)).toBe(1);
    expect(clampTrendBoardColumns(3.6)).toBe(4);
    expect(clampTrendBoardColumns(99)).toBe(10);
  });

  it("compares benchmark paths lexicographically", () => {
    expect(comparePath(["a"], ["b"])).toBeLessThan(0);
    expect(comparePath(["a"], ["a", "b"])).toBeLessThan(0);
    expect(comparePath(["b"], ["a", "z"])).toBeGreaterThan(0);
    expect(comparePath(["a", "b"], ["a", "b"])).toBe(0);
  });

  it("matches rows against display strategies", () => {
    expect(rowMatchesDisplayStrategy(Base_Row, "all")).toBe(true);
    expect(rowMatchesDisplayStrategy({ ...Base_Row, tag: "v1.0.0" }, "tagged-only")).toBe(true);
    expect(rowMatchesDisplayStrategy({ ...Base_Row, branch: "main" }, "tagged-main")).toBe(true);
    expect(rowMatchesDisplayStrategy(Base_Row, "tagged-main")).toBe(false);
  });

  it("chooses a readable display unit for trend values", () => {
    const context = trendDisplayUnitContext([
      { value: 2_500, unit: "ns" },
      { value: 9_500, unit: "ns" }
    ]);

    expect(context.unit).toBe("μs");
    expect(context.scaleValue(2_500)).toBe(2.5);
    expect(context.formatMetricLabel("time median ns")).toBe("time median μs");
    expect(context.formatValue(2_500, "ns")).toContain("μs");
  });

  it("falls back when units are mixed or unknown", () => {
    const mixed = trendDisplayUnitContext([
      { value: 5, unit: "ns" },
      { value: 7, unit: "bytes" }
    ]);
    expect(mixed.unit).toBe("ns");
    expect(mixed.scaleValue(5)).toBe(5);

    const unknown = trendDisplayUnitContext([{ value: 5, unit: "widgets" }]);
    expect(unknown.unit).toBe("widgets");
    expect(unknown.formatMetricLabel("")).toBe("Metric value");
  });

  it("formats catalog metadata helpers", () => {
    expect(databaseTitle({ id: "db-1", url: "./db.sqlite" })).toBe("db-1");
    expect(databaseTitle({ id: "db-1", name: "Primary", url: "./db.sqlite" })).toBe("Primary");
    expect(databaseDescription({ id: "db-1", url: "./db.sqlite" })).toBe("No description provided.");
    expect(databaseDescription({
      id: "db-1",
      url: "./db.sqlite",
      metadata_preview: { description: "Preview text" }
    })).toBe("Preview text");
    expect(metadataTitle({
      schema_version: 3,
      name: "BenchLedger Demo",
      description: "",
      project_url: "",
      logo_url: "",
      logo_url_dark: "",
      created_at: "",
      updated_at: "",
      notes: "",
      raw: {}
    })).toBe("BenchLedger Demo");
    expect(metadataDescription({
      schema_version: 3,
      name: "",
      description: "",
      project_url: "",
      logo_url: "",
      logo_url_dark: "",
      created_at: "",
      updated_at: "",
      notes: "Fallback notes",
      raw: {}
    })).toBe("Fallback notes");
    expect(formatSchemaLabel(null)).toBe("n/a");
    expect(formatSchemaLabel(3)).toBe("v3");
  });

  it("uses expected default sort directions", () => {
    expect(defaultRunPairSortDirection("benchmark")).toBe("asc");
    expect(defaultRunPairSortDirection("delta")).toBe("desc");
  });
});
