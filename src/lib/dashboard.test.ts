import { describe, expect, it } from "vitest";
import {
  clampTrendBoardColumns,
  commitAxisCategoryOrder,
  comparePath,
  databaseDescription,
  databaseTitle,
  defaultRunPairSortDirection,
  metricFamilyLabel,
  formatSchemaLabel,
  metricLabel,
  metadataDescription,
  metadataTitle,
  rowMatchesDisplayStrategy,
  splitTrendRowsByMachine,
  trendDisplayUnitContext,
  type TrendPlotRow
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

function makeTrendRow(overrides: Partial<TrendPlotRow>): TrendPlotRow {
  const row: TrendPlotRow = {
    ...Base_Row,
    date_value: new Date("2026-01-01T00:00:00Z"),
    run_axis_label: "2026-01-01",
    run_headline: "Run 1",
    run_tone: "branch",
    ...overrides
  };

  if (overrides.code_date && !overrides.date_value) {
    row.date_value = new Date(overrides.code_date);
  }

  return row;
}

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
    expect(context.scaleValue(2_500, "ns")).toBe(2.5);
    expect(context.formatMetricLabel("time median")).toBe("time median μs");
    expect(context.formatValue(2_500, "ns")).toContain("μs");
  });

  it("normalizes mixed time units into one display unit", () => {
    const mixedTime = trendDisplayUnitContext([
      { value: 2_000, unit: "ns" },
      { value: 0.000004, unit: "s" }
    ]);

    expect(mixedTime.unit).toBe("μs");
    expect(mixedTime.scaleValue(2_000, "ns")).toBe(2);
    expect(mixedTime.scaleValue(0.000004, "s")).toBe(4);
    expect(mixedTime.formatMetricLabel("time median")).toBe("time median μs");
  });

  it("falls back when units are mixed across incompatible dimensions or unknown", () => {
    const mixed = trendDisplayUnitContext([
      { value: 5, unit: "ns" },
      { value: 7, unit: "bytes" }
    ]);
    expect(mixed.unit).toBe("");
    expect(mixed.scaleValue(5, "ns")).toBe(5);

    const unknown = trendDisplayUnitContext([{ value: 5, unit: "widgets" }]);
    expect(unknown.unit).toBe("widgets");
    expect(unknown.formatMetricLabel("custom median")).toBe("custom median widgets");
  });

  it("builds base metric labels without unit classification", () => {
    expect(metricLabel(Base_Row)).toBe("time median");
  });

  it("builds metric family labels that only collapse compatible time units", () => {
    expect(metricFamilyLabel(Base_Row)).toBe("time median");
    expect(metricFamilyLabel({ ...Base_Row, metric_name: "memory", unit: "bytes" })).toBe("memory median bytes");
    expect(metricFamilyLabel({ ...Base_Row, metric_name: "throughput", unit: "ops/s" })).toBe("throughput median ops/s");
  });

  it("splits trend rows into independent machine series", () => {
    const series = splitTrendRowsByMachine([
      makeTrendRow({ machine_id: "machine-b", value: 2 }),
      makeTrendRow({
        run_id: "run-2",
        code_date: "2026-01-02T00:00:00Z",
        measured_at: "2026-01-02T00:00:00Z",
        machine_id: "machine-a",
        value: 3,
        run_axis_label: "2026-01-02",
        run_headline: "Run 2"
      }),
      makeTrendRow({
        run_id: "run-3",
        code_date: "2026-01-03T00:00:00Z",
        measured_at: "2026-01-03T00:00:00Z",
        machine_id: "machine-b",
        value: 4,
        run_axis_label: "2026-01-03",
        run_headline: "Run 3"
      })
    ]);

    expect(series.map((entry) => entry.machineId)).toEqual(["machine-a", "machine-b"]);
    expect(series[0].rows).toHaveLength(1);
    expect(series[1].rows).toHaveLength(2);
  });

  it("builds commit axis category order from code-date-sorted trend rows", () => {
    const rows = [
      makeTrendRow({
        run_id: "run-1",
        code_date: "2026-06-02T00:00:00Z",
        run_axis_label: "v0.6.25"
      }),
      makeTrendRow({
        run_id: "run-2",
        code_date: "2026-06-08T00:00:00Z",
        run_axis_label: "af73b09"
      }),
      makeTrendRow({
        run_id: "run-3",
        code_date: "2026-06-17T00:00:00Z",
        run_axis_label: "df357f6"
      }),
      makeTrendRow({
        run_id: "run-4",
        code_date: "2026-06-20T00:00:00Z",
        run_axis_label: "00a99b7"
      })
    ];

    expect(commitAxisCategoryOrder(rows)).toEqual({
      categoryorder: "array",
      categoryarray: ["v0.6.25", "af73b09", "df357f6", "00a99b7"]
    });
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
