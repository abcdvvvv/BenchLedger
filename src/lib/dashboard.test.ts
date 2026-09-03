import { describe, expect, it } from "vitest";
import {
  buildTrendTrace,
  metricFamilyLabel,
  trendDisplayUnitContext,
  type TrendPlotRow
} from "./dashboard-plotting";
import {
  buildDatabaseCatalogStats,
  buildRuns,
  buildBenchmarkPairComparisons,
  runAxisLabel,
  runHeadline,
  runIdentityTitle
} from "./dashboard-data";
import type {
  BenchmarkCodeState,
  BenchmarkHardwareEnvironment,
  BenchmarkRow,
  BenchmarkRun,
  BenchmarkRunRecord,
  BenchmarkSoftwareEnvironment,
  LoadedBenchmarkDatabase
} from "./types";

const Base_Key = '["suite","case"]';
const Base_Row: BenchmarkRow = {
  run_id: "run-1",
  benchmark_key: Base_Key,
  metric_name: "time",
  statistic: "median",
  unit: "ns",
  value: 1000,
  better: "lower"
};

function makeRun(overrides: Partial<BenchmarkRun> = {}): BenchmarkRun {
  return {
    run_id: "run-1",
    code_state_id: "state-1",
    code_label: "",
    code_date: "2026-01-01T00:00:00Z",
    hardware_environment_id: "hardware-1",
    hardware_environment_label: "Hardware 1",
    software_environment_id: "software-1",
    software_environment_label: "Software 1",
    environment_pair_key: '["hardware-1","software-1"]',
    environment_pair_label: "Hardware 1 · Software 1",
    configuration_key: '["state-1","hardware-1","software-1"]',
    configuration_label: "State 1 · Hardware 1 · Software 1",
    measured_at: "2026-01-01T00:00:00Z",
    notes: "",
    code_state_identity: { source: { kind: "git", revision: "abcdef1234567890" } },
    code_state_metadata: { source: { dirty: false } },
    hardware_environment_identity: {},
    hardware_environment_metadata: {},
    software_environment_identity: {},
    software_environment_metadata: {},
    run_metadata: { source: { branch: "main", tags: [] } },
    benchmark_count: 1,
    ...overrides
  };
}

function makeTrendRow(overrides: Partial<TrendPlotRow> = {}): TrendPlotRow {
  return {
    ...Base_Row,
    code_date: "2026-01-01T00:00:00Z",
    measured_at: "2026-01-01T00:00:00Z",
    date_value: new Date("2026-01-01T00:00:00Z"),
    run_axis_label: "2026-01-01",
    run_identity_title: "Run: Run 1",
    run_count: 1,
    x_key: "state-1",
    x_label: "State 1",
    ...overrides
  };
}

describe("dashboard helpers", () => {
  it("formats dirty tagged run identities", () => {
    const run = makeRun({
      code_state_identity: { source: { kind: "git", revision: "abcdef1234567890", diff_digest: "4f2a9c8e1234" } },
      code_state_metadata: { source: { dirty: true } },
      run_metadata: { source: { branch: "main", tags: ["v0.1.6"] } }
    });
    expect(runHeadline(run)).toBe("v0.1.6 (4f2a9c)");
    expect(runAxisLabel(run)).toBe("v0.1.6 (4f2a9c)");
    expect(runIdentityTitle(run)).toContain("Diff digest: 4f2a9c8e1234");
  });

  it("keeps matched, added, and removed benchmark keys in run diffs", () => {
    const pairBase = { benchmark_key: Base_Key, metric_name: Base_Row.metric_name, statistic: Base_Row.statistic, unit: Base_Row.unit, value: Base_Row.value, better: Base_Row.better };
    const rows = buildBenchmarkPairComparisons(
      [
        { ...pairBase, benchmark_key: '["shared"]', value: 84.2 },
        { ...pairBase, benchmark_key: '["added"]', value: 68.3 }
      ],
      [
        { ...pairBase, benchmark_key: '["shared"]', value: 91.4 },
        { ...pairBase, benchmark_key: '["removed"]', value: 73.1 }
      ],
      new Map([
        ['["shared"]', { key: '["shared"]', path: ["shared"], label: "shared" }],
        ['["added"]', { key: '["added"]', path: ["added"], label: "added" }],
        ['["removed"]', { key: '["removed"]', path: ["removed"], label: "removed" }]
      ])
    );
    expect(rows.map((row) => row.status)).toEqual(["matched", "focus-only", "baseline-only"]);
  });

  it("normalizes compatible metric units", () => {
    const context = trendDisplayUnitContext([
      { value: 2_000, unit: "ns" },
      { value: 0.000004, unit: "s" }
    ]);
    expect([context.unit, context.scaleValue(2_000, "ns"), context.scaleValue(0.000004, "s")])
      .toEqual(["μs", 2, 4]);
    expect(metricFamilyLabel({ ...Base_Row, metric_name: "memory", unit: "bytes" }))
      .toBe("memory median bytes");

  });

  it("sorts runs by code date while catalog latest-run uses measurement time", () => {
    const runsById = new Map<string, BenchmarkRunRecord>([
      ["run-old", {
        id: "run-old", code_state_id: "state-old", hardware_environment_id: "hardware-1",
        software_environment_id: "software-1", measured_at: "2026-06-20T00:00:00Z", metadata: { notes: "old" }
      }],
      ["run-new", {
        id: "run-new", code_state_id: "state-new", hardware_environment_id: "hardware-1",
        software_environment_id: "software-1", measured_at: "2026-06-19T00:00:00Z", metadata: {}
      }]
    ]);
    const codeStatesById = new Map<string, BenchmarkCodeState>([
      ["state-old", { id: "state-old", label: "Old", code_date: "2026-06-10T00:00:00Z", identity: {}, metadata: {} }],
      ["state-new", { id: "state-new", label: "New", code_date: "2026-06-11T00:00:00Z", identity: {}, metadata: {} }]
    ]);
    const hardwareEnvironmentsById = new Map<string, BenchmarkHardwareEnvironment>([
      ["hardware-1", { id: "hardware-1", label: "Hardware", identity: { cpu: { model: "AMD EPYC 9V74 80-Core Processor", physical_cores: 2 } }, metadata: {} }]
    ]);
    const softwareEnvironmentsById = new Map<string, BenchmarkSoftwareEnvironment>([
      ["software-1", { id: "software-1", label: "Software", identity: {}, metadata: {} }]
    ]);
    const database: LoadedBenchmarkDatabase = {
      benchmarksByKey: new Map([
        ['["old"]', { key: '["old"]', path: ["old"], label: "old" }],
        ['["new"]', { key: '["new"]', path: ["new"], label: "new" }]
      ]),
      runsById,
      codeStatesById,
      hardwareEnvironmentsById,
      softwareEnvironmentsById,
      configurations: [
        { code_state_id: "state-old", hardware_environment_id: "hardware-1", software_environment_id: "software-1" },
        { code_state_id: "state-new", hardware_environment_id: "hardware-1", software_environment_id: "software-1" }
      ],
      benchmarkCountByRun: new Map([["run-old", 1], ["run-new", 1]]),
      viewCatalog: { metricOptions: [], metricSourcesByLabel: new Map(), branchOptions: ["all"], databaseTimeStart: "2026-06-10", databaseTimeEnd: "2026-06-11" },
      stats: { rowCount: 2, runCount: 2, keyCount: 2, hardwareEnvironmentCount: 1, softwareEnvironmentCount: 1, configurationCount: 2, metrics: ["time median"], latestRunDate: "2026-06-20T00:00:00Z", dirtyRunCount: 0 },
      metadata: {
        schema_version: 6, name: "", description: "", project_url: "", logo_url: "", logo_url_dark: "",
        created_at: "", updated_at: "", notes: "", raw: {}
      },
      source_label: "test.sqlite",
      source_url: null
    };
    const runs = buildRuns(database);

    expect(runs.map((run) => run.run_id)).toEqual(["run-new", "run-old"]);
    expect(runs[0]?.environment_pair_label).toBe("AMD EPYC 9V74 80-Core / Software");
    expect(buildDatabaseCatalogStats(database)!.latestRunDate).toBe("2026-06-20T00:00:00Z");
  });

  it("uses the resolved varying-dimension labels on trend traces", () => {
    const rows = [
      makeTrendRow({ run_id: "a", code_date: "2026-06-02", value: 20, x_key: "a", x_label: "A" }),
      makeTrendRow({ run_id: "b", code_date: "2026-06-03", value: 10, x_key: "b", x_label: "B" })
    ];
    const traces = buildTrendTrace(rows, {
      lineShape: "line", markerSymbol: "circle", markerFillMode: "hollow", displayUnitContext: trendDisplayUnitContext(rows), color: "#000000", label: "Series",
      plotTheme: { paper: "transparent", plot: "transparent", grid: "#ccc", axis: "#333", zero: "#999", line: "#000", areaGradientStart: "rgba(0,0,0,0)", areaGradientEnd: "rgba(0,0,0,0.2)", markerStrong: "#000", marker: "#000", markerMuted: "#666", deltaUp: "#f00", deltaDown: "#0f0", deltaNeutral: "#999" },
      theme: "light", yMin: 0, yPadding: 1, showLegend: true
    });
    expect(traces[1]?.x).toEqual(["A", "B"]);
  });
});
