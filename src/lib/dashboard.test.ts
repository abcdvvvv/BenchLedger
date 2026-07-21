import { describe, expect, it } from "vitest";
import {
  buildRuns,
  buildRunPairComparisons,
  clampTrendBoardColumns,
  buildTrendTrace,
  commitAxisLayout,
  comparePath,
  databaseDescription,
  databaseTitle,
  defaultRunPairSortDirection,
  metricFamilyLabel,
  formatSchemaLabel,
  metricLabel,
  metadataDescription,
  metadataTitle,
  runAxisLabel,
  runHeadline,
  runIdentityTitle,
  splitTrendRowsByEnvironment,
  trendDisplayUnitContext,
  type TrendPlotRow
} from "./dashboard";
import type {
  BenchmarkCodeState,
  BenchmarkEnvironment,
  BenchmarkRow,
  BenchmarkRun,
  BenchmarkRunRecord,
  LoadedBenchmarkDataset
} from "./types";

const Base_Row: BenchmarkRow = {
  run_id: "run-1",
  benchmark_id: "bench-1",
  metric_name: "time",
  statistic: "median",
  unit: "ns",
  value: 1000,
  better: "lower"
};

function makeTrendRow(overrides: Partial<TrendPlotRow>): TrendPlotRow {
  return {
    ...Base_Row,
    code_state_id: "state-1",
    code_date: "2026-01-01T00:00:00Z",
    environment_id: "env-1",
    environment_label: "Environment 1",
    measured_at: "2026-01-01T00:00:00Z",
    date_value: new Date("2026-01-01T00:00:00Z"),
    run_axis_label: "2026-01-01",
    run_headline: "Run 1",
    run_tone: "branch",
    run_identity_title: "Run: Run 1",
    ...overrides
  };
}

function makeRun(overrides: Partial<BenchmarkRun> = {}): BenchmarkRun {
  return {
    run_id: "run-1",
    code_state_id: "state-1",
    code_label: "",
    code_date: "2026-01-01T00:00:00Z",
    environment_id: "env-1",
    environment_label: "Environment 1",
    measured_at: "2026-01-01T00:00:00Z",
    notes: "",
    code_state_identity: { source: { kind: "git", revision: "abcdef1234567890" } },
    code_state_metadata: { source: { dirty: false } },
    environment_identity: {},
    environment_metadata: {},
    run_metadata: { source: { branch: "main", tags: [] } },
    benchmark_count: 1,
    ...overrides
  };
}

describe("dashboard helpers", () => {
  it("distinguishes dirty code states with a short diff digest", () => {
    const dirtyTagged = makeRun({
      code_state_identity: { source: { kind: "git", revision: "abcdef1234567890", diff_digest: "4f2a9c8e1234" } },
      code_state_metadata: { source: { dirty: true } },
      run_metadata: { source: { branch: "main", tags: ["v0.1.6"] } }
    });
    const dirtyUntagged = makeRun({
      code_state_identity: { source: { kind: "git", revision: "abcdef1234567890", diff_digest: "9b8c7d6e5432" } },
      code_state_metadata: { source: { dirty: true } }
    });

    expect(runHeadline(dirtyTagged)).toBe("v0.1.6 (4f2a9c)");
    expect(runAxisLabel(dirtyTagged)).toBe("v0.1.6 (4f2a9c)");
    expect(runHeadline(dirtyUntagged)).toBe("abcdef1 (9b8c7d)");
    expect(runIdentityTitle(dirtyTagged)).toContain("Revision: abcdef1234567890");
    expect(runIdentityTitle(dirtyTagged)).toContain("Diff digest: 4f2a9c8e1234");
  });

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

  it("keeps focus-only and baseline-only benchmarks in run diffs", () => {
    const focusRows: BenchmarkRow[] = [
      { ...Base_Row, benchmark_id: "shared", value: 84.2 },
      { ...Base_Row, benchmark_id: "added", value: 68.3 }
    ];
    const baselineRows: BenchmarkRow[] = [
      { ...Base_Row, run_id: "run-2", benchmark_id: "shared", value: 91.4 },
      { ...Base_Row, run_id: "run-2", benchmark_id: "removed", value: 73.1 }
    ];
    const benchmarksById = new Map([
      ["shared", { id: "shared", path: ["enabled", "clog"], label: "enabled / clog" }],
      ["added", { id: "added", path: ["registry", "get_logger"], label: "registry / get_logger" }],
      ["removed", { id: "removed", path: ["filtered", "old_path"], label: "filtered / old_path" }]
    ]);

    const rows = buildRunPairComparisons(focusRows, baselineRows, benchmarksById);

    expect(rows).toHaveLength(3);
    expect(rows.find((row) => row.benchmark_id === "shared")).toEqual(
      expect.objectContaining({ status: "matched", baseline_value: 91.4, focus_value: 84.2 })
    );
    expect(rows.find((row) => row.benchmark_id === "added")).toEqual(
      expect.objectContaining({ status: "focus-only", baseline_value: null, focus_value: 68.3, delta: null })
    );
    expect(rows.find((row) => row.benchmark_id === "removed")).toEqual(
      expect.objectContaining({ status: "baseline-only", baseline_value: 73.1, focus_value: null, delta: null })
    );
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

  it("splits trend rows into independent environment series", () => {
    const series = splitTrendRowsByEnvironment([
      makeTrendRow({ environment_id: "env-b", environment_label: "Env B", value: 2 }),
      makeTrendRow({
        run_id: "run-2",
        code_date: "2026-01-02T00:00:00Z",
        measured_at: "2026-01-02T00:00:00Z",
        environment_id: "env-a",
        environment_label: "Env A",
        value: 3,
        run_axis_label: "2026-01-02",
        run_headline: "Run 2"
      }),
      makeTrendRow({
        run_id: "run-3",
        code_date: "2026-01-03T00:00:00Z",
        measured_at: "2026-01-03T00:00:00Z",
        environment_id: "env-b",
        environment_label: "Env B",
        value: 4,
        run_axis_label: "2026-01-03",
        run_headline: "Run 3"
      })
    ]);

    expect(series.map((entry) => entry.environmentId)).toEqual(["env-a", "env-b"]);
    expect(series[0].rows).toHaveLength(1);
    expect(series[1].rows).toHaveLength(2);
  });

  it("sorts runs by code date before measured time", () => {
    const rows: BenchmarkRow[] = [
      { ...Base_Row, run_id: "run-older-measured-later", benchmark_id: "bench-a" },
      { ...Base_Row, run_id: "run-newer-measured-earlier", benchmark_id: "bench-b" }
    ];
    const runsById = new Map<string, BenchmarkRunRecord>([
      ["run-older-measured-later", {
        id: "run-older-measured-later",
        code_state_id: "state-older",
        environment_id: "env-1",
        measured_at: "2026-06-20T00:00:00Z",
        notes: "",
        metadata: {}
      }],
      ["run-newer-measured-earlier", {
        id: "run-newer-measured-earlier",
        code_state_id: "state-newer",
        environment_id: "env-1",
        measured_at: "2026-06-19T00:00:00Z",
        notes: "",
        metadata: {}
      }]
    ]);
    const codeStatesById = new Map<string, BenchmarkCodeState>([
      ["state-older", {
        id: "state-older",
        label: "Older",
        code_date: "2026-06-10T00:00:00Z",
        identity: {},
        metadata: {}
      }],
      ["state-newer", {
        id: "state-newer",
        label: "Newer",
        code_date: "2026-06-11T00:00:00Z",
        identity: {},
        metadata: {}
      }]
    ]);
    const environmentsById = new Map<string, BenchmarkEnvironment>([
      ["env-1", {
        id: "env-1",
        label: "Env 1",
        identity: {},
        metadata: {}
      }]
    ]);
    const dataset: LoadedBenchmarkDataset = {
      rows,
      benchmarksById: new Map([
        ["bench-a", { id: "bench-a", path: ["suite", "bench-a"], label: "bench-a" }],
        ["bench-b", { id: "bench-b", path: ["suite", "bench-b"], label: "bench-b" }]
      ]),
      runsById,
      codeStatesById,
      environmentsById,
      metadata: {
        schema_version: 5,
        name: "",
        description: "",
        project_url: "",
        logo_url: "",
        logo_url_dark: "",
        created_at: "",
        updated_at: "",
        notes: "",
        raw: {}
      },
      source_label: "test.sqlite",
      source_url: null
    };

    expect(buildRuns(dataset).map((run) => run.run_id)).toEqual([
      "run-newer-measured-earlier",
      "run-older-measured-later"
    ]);
  });

  it("builds commit axis category order from code-date-sorted trend rows", () => {
    const rows = [
      makeTrendRow({
        code_state_id: "state-1",
        run_id: "run-1",
        code_date: "2026-06-02T00:00:00Z",
        run_axis_label: "v0.6.25",
        run_tone: "tag"
      }),
      makeTrendRow({
        code_state_id: "state-2",
        run_id: "run-2",
        code_date: "2026-06-08T00:00:00Z",
        run_axis_label: "af73b09"
      }),
      makeTrendRow({
        code_state_id: "state-3",
        run_id: "run-3",
        code_date: "2026-06-17T00:00:00Z",
        run_axis_label: "df357f6"
      }),
      makeTrendRow({
        code_state_id: "state-4",
        run_id: "run-4",
        code_date: "2026-06-20T00:00:00Z",
        run_axis_label: "00a99b7",
        run_tone: "tag"
      })
    ];

    expect(commitAxisLayout(rows)?.tickLabels).toEqual({
      type: "linear",
      tickmode: "array",
      tickvals: [0, 1 / 3, 2 / 3, 1],
      ticktext: ["v0.6.25", "af73b09", "df357f6", "00a99b7"]
    });
  });

  it("uses synthetic commit positions as x values while preserving commit labels", () => {
    const rows = [
      makeTrendRow({
        code_state_id: "state-2",
        run_id: "run-early",
        code_date: "2026-06-08T00:00:00Z",
        measured_at: "2026-06-20T00:00:00Z",
        run_axis_label: "af73b09",
        value: 20
      }),
      makeTrendRow({
        code_state_id: "state-4",
        run_id: "run-late",
        code_date: "2026-06-20T00:00:00Z",
        measured_at: "2026-06-21T00:00:00Z",
        run_axis_label: "00a99b7",
        value: 10,
        run_tone: "tag"
      })
    ];
    const context = trendDisplayUnitContext(rows);
    const commitAxis = commitAxisLayout([
      makeTrendRow({
        code_state_id: "state-1",
        run_id: "run-tag-1",
        code_date: "2026-06-02T00:00:00Z",
        run_axis_label: "v0.6.25",
        run_tone: "tag"
      }),
      ...rows
    ]);
    const traces = buildTrendTrace(rows, {
      axisMode: "commit",
      commitAxisPositions: commitAxis?.positionsByCodeStateId,
      lineShape: "line",
      markerSymbol: "circle",
      markerFillMode: "hollow",
      displayUnitContext: context,
      color: "#000000",
      label: "Series",
      plotTheme: {
        paper: "transparent",
        plot: "transparent",
        grid: "#ccc",
        axis: "#333",
        zero: "#999",
        line: "#000",
        areaGradientStart: "rgba(0,0,0,0)",
        areaGradientEnd: "rgba(0,0,0,0.2)",
        markerStrong: "#000",
        marker: "#000",
        markerMuted: "#666",
        deltaUp: "#f00",
        deltaDown: "#0f0",
        deltaNeutral: "#999"
      },
      theme: "light",
      yMin: 0,
      yPadding: 1,
      showLegend: true
    });

    expect(traces[1]?.x).toEqual([0.5, 1]);
    expect(traces[1]?.customdata).toEqual([
      ["af73b09", "2026-06-08T00:00:00Z", "2026-06-20T00:00:00Z", "20 ns", "Run: Run 1"],
      ["00a99b7", "2026-06-20T00:00:00Z", "2026-06-21T00:00:00Z", "10 ns", "Run: Run 1"]
    ]);
  });

  it("builds globally time-sorted commit ticks even when labels first appear out of order across series", () => {
    const rows = [
      makeTrendRow({
        code_state_id: "state-24",
        run_id: "run-24",
        code_date: "2026-06-24T00:00:00Z",
        run_axis_label: "5681ad0",
        benchmark_id: "bench-a"
      }),
      makeTrendRow({
        code_state_id: "state-08",
        run_id: "run-08",
        code_date: "2025-01-03T00:00:00Z",
        run_axis_label: "v0.6.8",
        benchmark_id: "bench-b",
        run_tone: "tag"
      }),
      makeTrendRow({
        code_state_id: "state-09",
        run_id: "run-09",
        code_date: "2025-01-29T00:00:00Z",
        run_axis_label: "v0.6.9",
        benchmark_id: "bench-b",
        run_tone: "tag"
      })
    ];

    expect(commitAxisLayout(rows)?.tickLabels).toEqual({
      type: "linear",
      tickmode: "array",
      tickvals: [0, 0.5, 1],
      ticktext: ["v0.6.8", "v0.6.9", "5681ad0"]
    });
  });

  it("evenly spaces commits inside each tagged segment while keeping every commit label visible", () => {
    const rows = [
      makeTrendRow({
        code_state_id: "state-v1",
        run_id: "run-v1",
        code_date: "2026-06-01T00:00:00Z",
        run_axis_label: "v1.0.0",
        run_tone: "tag"
      }),
      makeTrendRow({
        code_state_id: "state-a",
        run_id: "run-a",
        code_date: "2026-06-02T00:00:00Z",
        run_axis_label: "aaaaaaa"
      }),
      makeTrendRow({
        code_state_id: "state-b",
        run_id: "run-b",
        code_date: "2026-06-03T00:00:00Z",
        run_axis_label: "bbbbbbb"
      }),
      makeTrendRow({
        code_state_id: "state-v2",
        run_id: "run-v2",
        code_date: "2026-06-04T00:00:00Z",
        run_axis_label: "v2.0.0",
        run_tone: "tag"
      }),
      makeTrendRow({
        code_state_id: "state-c",
        run_id: "run-c",
        code_date: "2026-06-05T00:00:00Z",
        run_axis_label: "ccccccc"
      }),
      makeTrendRow({
        code_state_id: "state-v3",
        run_id: "run-v3",
        code_date: "2026-06-06T00:00:00Z",
        run_axis_label: "v3.0.0",
        run_tone: "tag"
      })
    ];

    expect(commitAxisLayout(rows)?.tickLabels).toEqual({
      type: "linear",
      tickmode: "array",
      tickvals: [0, 1 / 6, 1 / 3, 0.5, 0.75, 1],
      ticktext: ["v1.0.0", "aaaaaaa", "bbbbbbb", "v2.0.0", "ccccccc", "v3.0.0"]
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
      schema_version: 5,
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
      schema_version: 5,
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
    expect(formatSchemaLabel(5)).toBe("v5");
  });

  it("uses expected default sort directions", () => {
    expect(defaultRunPairSortDirection("benchmark")).toBe("asc");
    expect(defaultRunPairSortDirection("delta")).toBe("desc");
  });
});
