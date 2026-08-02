import { describe, expect, it } from "vitest";
import {
  buildBenchmarkViewIndex,
  buildTrendRowsByBenchmark,
  normalizeSelectedBenchmarkKeys,
  resolveBenchmarkViewBaseSlice,
  resolveBenchmarkViewGroupSlice
} from "./benchmark-view";
import { dateRangeEnd, dateRangeStart } from "./dashboard-settings";
import type { BenchmarkDefinition, BenchmarkRow, BenchmarkRun, BenchmarkRunRecord } from "./types";

const Key_1 = '["suite","group-a","case-1"]';
const Key_2 = '["suite","group-b","case-2"]';

const Base_Row: BenchmarkRow = {
  run_id: "run-1",
  benchmark_key: Key_1,
  metric_name: "time",
  statistic: "median",
  unit: "ns",
  value: 1000,
  better: "lower"
};

const Base_Run: BenchmarkRun = {
  run_id: "run-1",
  code_state_id: "state-1",
  code_label: "Run 1",
  code_date: "2026-01-01T00:00:00Z",
  hardware_environment_id: "hardware-1",
  hardware_environment_label: "CPU A",
  software_environment_id: "software-1",
  software_environment_label: "Julia 1.12 · Linux",
  environment_pair_key: '["hardware-1","software-1"]',
  environment_pair_label: "CPU A · Julia 1.12 · Linux",
  configuration_key: '["state-1","hardware-1","software-1"]',
  configuration_label: "Run 1 · CPU A · Julia 1.12 · Linux",
  measured_at: "2026-01-01T00:00:00Z",
  notes: "",
  code_state_identity: { source: { kind: "git", revision: "abcdef123456" } },
  code_state_metadata: { source: { dirty: false } },
  hardware_environment_identity: { architecture: "x86_64", cpu: { model: "CPU A" } },
  hardware_environment_metadata: {},
  software_environment_identity: { runtime: { name: "Julia", version: "1.12" } },
  software_environment_metadata: {},
  run_metadata: { source: { branch: "main", tags: [] } },
  benchmark_count: 1
};

function makeRuns(...runs: BenchmarkRun[]): ReadonlyMap<string, BenchmarkRun> {
  return new Map(runs.map((run) => [run.run_id, run]));
}

function makeRunRecords(...runs: BenchmarkRun[]): ReadonlyMap<string, BenchmarkRunRecord> {
  return new Map(runs.map((run) => [run.run_id, {
    id: run.run_id,
    code_state_id: run.code_state_id,
    hardware_environment_id: run.hardware_environment_id,
    software_environment_id: run.software_environment_id,
    measured_at: run.measured_at,
    metadata: run.run_metadata
  }]));
}

function benchmarkDefinition(key: string): BenchmarkDefinition {
  const path = JSON.parse(key) as string[];
  return { key, path, label: path.join(" / ") };
}

function benchmarkMapForRows(rows: BenchmarkRow[]): ReadonlyMap<string, BenchmarkDefinition> {
  return new Map(Array.from(new Set(rows.map((row) => row.benchmark_key))).map((key) => [key, benchmarkDefinition(key)]));
}

function alternatePair(runId: string): BenchmarkRun {
  return {
    ...Base_Run,
    run_id: runId,
    hardware_environment_id: "hardware-2",
    hardware_environment_label: "CPU B",
    environment_pair_key: '["hardware-2","software-1"]',
    environment_pair_label: "CPU B · Julia 1.12 · Linux",
    configuration_key: '["state-1","hardware-2","software-1"]',
    configuration_label: "Run 1 · CPU B · Julia 1.12 · Linux"
  };
}

describe("benchmark view filtering", () => {
  it("indexes hardware/software pairs, metrics, and branches", () => {
    const rows: BenchmarkRow[] = [
      Base_Row,
      { ...Base_Row, run_id: "run-2", metric_name: "memory", unit: "bytes", value: 512 },
      { ...Base_Row, run_id: "run-3", metric_name: "memory", unit: "bytes", value: 1024 }
    ];
    const pair2 = alternatePair("run-3");
    const runs = makeRuns(
      Base_Run,
      { ...Base_Run, run_id: "run-2" },
      { ...pair2, code_date: "2026-01-03T00:00:00Z", run_metadata: { source: { branch: "feature" } } }
    );
    const index = buildBenchmarkViewIndex(rows, runs, benchmarkMapForRows(rows));

    expect(index.rowsByEnvironmentPair.get(Base_Run.environment_pair_key)?.map((entry) => entry.row.run_id))
      .toEqual(["run-1", "run-2"]);
    expect(index.metricOptionsByEnvironmentPair.get(Base_Run.environment_pair_key))
      .toEqual(["memory median bytes", "time median"]);
    expect(index.metricOptionsByEnvironmentPair.get(pair2.environment_pair_key)).toEqual(["memory median bytes"]);
    expect(index.branchOptions).toEqual(["all", "feature", "main"]);
  });

  it("resolves pair, metric, branch, time, and group filters", () => {
    const rows: BenchmarkRow[] = [
      Base_Row,
      { ...Base_Row, run_id: "run-2", benchmark_key: Key_2 },
      { ...Base_Row, run_id: "run-3", benchmark_key: Key_2, metric_name: "memory", unit: "bytes", value: 512 },
      { ...Base_Row, run_id: "run-4", benchmark_key: Key_2 }
    ];
    const runs = makeRuns(
      Base_Run,
      { ...Base_Run, run_id: "run-2", code_date: "2026-01-02T00:00:00Z" },
      { ...Base_Run, run_id: "run-3", code_date: "2026-01-03T00:00:00Z" },
      { ...alternatePair("run-4"), code_date: "2026-01-02T00:00:00Z" }
    );
    const base = resolveBenchmarkViewBaseSlice(
      buildBenchmarkViewIndex(rows, runs, benchmarkMapForRows(rows)),
      {
        environmentPair: Base_Run.environment_pair_key,
        metricKind: "time median",
        branch: "main",
        timeStartValue: dateRangeStart("2026-01-01"),
        timeEndValue: dateRangeEnd("2026-01-02"),
        displayStrategy: "all"
      }
    );
    const resolved = resolveBenchmarkViewGroupSlice(base, JSON.stringify(["suite", "group-a"]));

    expect(base.filteredRows).toEqual(rows.slice(0, 2));
    expect(base.groupOptions.map((option) => option.value)).toEqual([
      '["suite"]',
      '["suite","group-a"]',
      '["suite","group-b"]'
    ]);
    expect(resolved.scopedRows.map((row) => row.benchmark_key)).toEqual([Key_1]);
    expect(resolved.benchmarkOptions.map((option) => option.value)).toEqual([Key_1]);
  });

  it("falls back to the first metric available for the selected pair", () => {
    const rows: BenchmarkRow[] = [
      Base_Row,
      { ...Base_Row, run_id: "run-2", metric_name: "memory", unit: "bytes", value: 512 }
    ];
    const pair2 = alternatePair("run-2");
    const base = resolveBenchmarkViewBaseSlice(
      buildBenchmarkViewIndex(rows, makeRuns(Base_Run, pair2), benchmarkMapForRows(rows)),
      {
        environmentPair: pair2.environment_pair_key,
        metricKind: "time median",
        branch: "all",
        timeStartValue: null,
        timeEndValue: null,
        displayStrategy: "all"
      }
    );

    expect(base.effectiveMetricKind).toBe("memory median bytes");
    expect(base.filteredRows.map((row) => row.run_id)).toEqual(["run-2"]);
  });

  it("normalizes selections and averages repeated runs for trend points", () => {
    expect(normalizeSelectedBenchmarkKeys([Key_1, Key_2], [
      { value: Key_1, label: "case-1", path: ["suite", "group-a", "case-1"] }
    ])).toEqual([Key_1]);

    const latestRun = { ...Base_Run, run_id: "run-2", measured_at: "2026-01-02T00:00:00Z" };
    const rows = buildTrendRowsByBenchmark(
      [
        { ...Base_Row, run_id: "run-1", value: 1_000, unit: "ns" },
        { ...Base_Row, run_id: "run-2", value: 2, unit: "μs" }
      ],
      makeRunRecords(Base_Run, latestRun),
      makeRuns(Base_Run, latestRun),
      [Key_1]
    );

    expect(rows.get(Key_1)).toEqual([expect.objectContaining({
      value: 1_500,
      unit: "ns",
      run_count: 2,
      measured_at: latestRun.measured_at,
      environment_pair_key: Base_Run.environment_pair_key
    })]);
  });
});
