import { describe, expect, it } from "vitest";
import {
  buildBenchmarkOptions,
  buildBenchmarkViewIndex,
  buildGroupOptions,
  resolveBenchmarkViewBaseSlice,
  resolveBenchmarkViewGroupSlice,
  resolveBenchmarkViewSlice
} from "./benchmark-view";
import { dateRangeEnd, dateRangeStart } from "./dashboard-settings";
import type { BenchmarkDefinition, BenchmarkRow, BenchmarkRun } from "./types";

const Base_Row: BenchmarkRow = {
  run_id: "run-1",
  benchmark_id: "bench-1",
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
  environment_id: "env-1",
  environment_label: "Env 1",
  measured_at: "2026-01-01T00:00:00Z",
  notes: "",
  code_state_identity: { source: { kind: "git", revision: "abcdef123456" } },
  code_state_metadata: { source: { dirty: false } },
  environment_identity: { runtime: { name: "Julia", version: "1.10" } },
  environment_metadata: {},
  run_metadata: { source: { branch: "main", tags: [] } },
  benchmark_count: 1
};

function makeRuns(...runs: BenchmarkRun[]): ReadonlyMap<string, BenchmarkRun> {
  return new Map(runs.map((run) => [run.run_id, run]));
}

function makeBenchmarks(...benchmarks: BenchmarkDefinition[]): ReadonlyMap<string, BenchmarkDefinition> {
  return new Map(benchmarks.map((benchmark) => [benchmark.id, benchmark]));
}

function benchmarkMapForRows(rows: BenchmarkRow[]): ReadonlyMap<string, BenchmarkDefinition> {
  return new Map(Array.from(new Set(rows.map((row) => row.benchmark_id))).map((id) => [id, {
    id,
    path: ["suite", id],
    label: id
  }]));
}

function resolve(rows: BenchmarkRow[], runsById: ReadonlyMap<string, BenchmarkRun>, metricKind: string) {
  return resolveBenchmarkViewSlice(buildBenchmarkViewIndex(rows, runsById, benchmarkMapForRows(rows)), {
    environment: "all",
    metricKind,
    branch: "all",
    timeStartValue: null,
    timeEndValue: null,
    displayStrategy: "all",
    group: "all"
  });
}

describe("benchmark view filtering", () => {
  it("treats time metrics with different units as one metric family", () => {
    const rows: BenchmarkRow[] = [
      { ...Base_Row, run_id: "run-1", unit: "ns", value: 2_000 },
      { ...Base_Row, run_id: "run-2", unit: "s", value: 0.002 },
      { ...Base_Row, run_id: "run-3", metric_name: "memory", unit: "bytes", value: 512 }
    ];
    const runs = makeRuns(
      Base_Run,
      { ...Base_Run, run_id: "run-2" },
      { ...Base_Run, run_id: "run-3" }
    );

    expect(resolve(rows, runs, "time median").filteredRows.map((row) => row.unit)).toEqual(["ns", "s"]);
  });

  it("keeps non-convertible unit families separate", () => {
    const rows: BenchmarkRow[] = [
      { ...Base_Row, run_id: "run-1", metric_name: "memory", unit: "bytes", value: 512 },
      { ...Base_Row, run_id: "run-2", metric_name: "memory", unit: "count", value: 12 },
      { ...Base_Row, run_id: "run-3", metric_name: "memory", unit: "bytes", value: 1024 }
    ];
    const runs = makeRuns(Base_Run, { ...Base_Run, run_id: "run-2" }, { ...Base_Run, run_id: "run-3" });

    expect(resolve(rows, runs, "memory median bytes").filteredRows.map((row) => row.unit)).toEqual(["bytes", "bytes"]);
  });

  it("builds environment buckets and metric options once per dataset", () => {
    const rows: BenchmarkRow[] = [
      { ...Base_Row, run_id: "run-1", unit: "ns" },
      { ...Base_Row, run_id: "run-2", metric_name: "memory", unit: "bytes", value: 512 },
      { ...Base_Row, run_id: "run-3", metric_name: "memory", unit: "bytes", value: 1024 }
    ];
    const runs = makeRuns(
      Base_Run,
      { ...Base_Run, run_id: "run-2" },
      { ...Base_Run, run_id: "run-3", environment_id: "env-2", environment_label: "Env 2", code_date: "2026-01-03T00:00:00Z", run_metadata: { source: { branch: "feature" } } }
    );

    const index = buildBenchmarkViewIndex(rows, runs, benchmarkMapForRows(rows));

    expect(index.rowsByEnvironment.get("all")?.map((entry) => entry.row.run_id)).toEqual(["run-1", "run-2", "run-3"]);
    expect(index.rowsByEnvironment.get("env-1")?.map((entry) => entry.row.run_id)).toEqual(["run-1", "run-2"]);
    expect(index.metricOptionsByEnvironment.get("env-1")).toEqual(["memory median bytes", "time median"]);
    expect(index.metricOptionsByEnvironment.get("env-2")).toEqual(["memory median bytes"]);
    expect(index.branchOptions).toEqual(["all", "feature", "main"]);
    expect(index.datasetTimeStart).toBe("2026-01-01");
    expect(index.datasetTimeEnd).toBe("2026-01-03");
  });

  it("resolves indexed slices from normalized run context", () => {
    const rows: BenchmarkRow[] = [
      { ...Base_Row, run_id: "run-1", benchmark_id: "bench-1" },
      { ...Base_Row, run_id: "run-2", benchmark_id: "bench-2" },
      { ...Base_Row, run_id: "run-3", benchmark_id: "bench-3", metric_name: "memory", unit: "bytes", value: 512 },
      { ...Base_Row, run_id: "run-4", benchmark_id: "bench-4" }
    ];
    const runs = makeRuns(
      Base_Run,
      { ...Base_Run, run_id: "run-2", code_date: "2026-01-02T00:00:00Z" },
      { ...Base_Run, run_id: "run-3", code_date: "2026-01-03T00:00:00Z" },
      { ...Base_Run, run_id: "run-4", environment_id: "env-2", environment_label: "Env 2", code_date: "2026-01-02T00:00:00Z" }
    );
    const state = {
      environment: "env-1",
      metricKind: "time median",
      branch: "main",
      timeStartValue: dateRangeStart("2026-01-01"),
      timeEndValue: dateRangeEnd("2026-01-02"),
      displayStrategy: "all" as const,
      group: "all"
    };
    const resolved = resolveBenchmarkViewSlice(buildBenchmarkViewIndex(rows, runs, benchmarkMapForRows(rows)), state);
    const expected = rows.slice(0, 2);

    expect(resolved.filteredRows).toEqual(expected);
    const expectedBenchmarks = [
      benchmarkMapForRows(rows).get("bench-1")!,
      benchmarkMapForRows(rows).get("bench-2")!
    ];
    expect(resolved.groupOptions).toEqual(buildGroupOptions(expectedBenchmarks));
    expect(resolved.scopedRows).toEqual(expected);
    expect(resolved.benchmarkOptions).toEqual(buildBenchmarkOptions(expectedBenchmarks));
  });

  it("falls back to the first valid metric immediately when the environment changes", () => {
    const rows: BenchmarkRow[] = [
      { ...Base_Row, run_id: "run-1", metric_name: "time", unit: "ns" },
      { ...Base_Row, run_id: "run-2", metric_name: "memory", unit: "bytes", value: 512 }
    ];
    const runs = makeRuns(Base_Run, { ...Base_Run, run_id: "run-2", environment_id: "env-2", environment_label: "Env 2" });

    const resolved = resolveBenchmarkViewSlice(buildBenchmarkViewIndex(rows, runs, benchmarkMapForRows(rows)), {
      environment: "env-2",
      metricKind: "time median",
      branch: "all",
      timeStartValue: null,
      timeEndValue: null,
      displayStrategy: "all",
      group: "all"
    });

    expect(resolved.effectiveMetricKind).toBe("memory median bytes");
    expect(resolved.filteredRows.map((row) => row.run_id)).toEqual(["run-2"]);
    expect(resolved.metricOptions).toEqual(["memory median bytes"]);
  });

  it("resolves group scope independently from the base filters", () => {
    const rows: BenchmarkRow[] = [
      { ...Base_Row, benchmark_id: "bench-1" },
      { ...Base_Row, benchmark_id: "bench-2" }
    ];
    const benchmarks = makeBenchmarks(
      { id: "bench-1", path: ["suite", "group-a", "case-1"], label: "case-1" },
      { id: "bench-2", path: ["suite", "group-b", "case-2"], label: "case-2" }
    );
    const index = buildBenchmarkViewIndex(rows, makeRuns(Base_Run), benchmarks);
    const baseSlice = resolveBenchmarkViewBaseSlice(index, {
      environment: "all",
      metricKind: "time median",
      branch: "all",
      timeStartValue: null,
      timeEndValue: null,
      displayStrategy: "all"
    });
    const group = JSON.stringify(["suite", "group-a"]);
    const groupedSlice = resolveBenchmarkViewGroupSlice(baseSlice, group);

    expect(groupedSlice.filteredRows).toBe(baseSlice.filteredRows);
    expect(groupedSlice.scopedRows.map((row) => row.benchmark_id)).toEqual(["bench-1"]);
    expect(groupedSlice.effectiveGroup).toBe(group);
  });
});
