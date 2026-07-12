import { describe, expect, it } from "vitest";
import {
  buildBenchmarkOptions,
  buildBenchmarkViewIndex,
  buildGroupOptions,
  createLRUCache,
  filterRowsByViewState,
  resolveBenchmarkViewSlice
} from "./benchmark-view";
import { dateRangeEnd, dateRangeStart } from "./dashboard";
import type { BenchmarkRow } from "./types";

const Base_Row: BenchmarkRow = {
  run_id: "run-1",
  code_state_id: "state-1",
  code_label: "Run 1",
  code_date: "2026-01-01T00:00:00Z",
  environment_id: "env-1",
  environment_label: "Env 1",
  measured_at: "2026-01-01T00:00:00Z",
  notes: "",
  code_state_metadata: { source: { branch: "main", tags: [], revision: "abcdef123456", dirty: false } },
  environment_metadata: { runtime: { name: "Julia", version: "1.10" } },
  run_metadata: {},
  benchmark_path: ["suite", "case"],
  benchmark_id: "bench-1",
  benchmark_label: "bench-1",
  metric_name: "time",
  statistic: "median",
  unit: "ns",
  value: 1000,
  better: "lower",
  group: "suite"
};

describe("benchmark view filtering", () => {
  it("treats time metrics with different units as one metric family", () => {
    const rows: BenchmarkRow[] = [
      { ...Base_Row, run_id: "run-1", unit: "ns", value: 2_000 },
      { ...Base_Row, run_id: "run-2", unit: "s", value: 0.002 },
      { ...Base_Row, run_id: "run-3", metric_name: "memory", unit: "bytes", value: 512 }
    ];

    const filtered = filterRowsByViewState(rows, {
      environment: "all",
      metricKind: "time median",
      branch: "all",
      timeStartValue: null,
      timeEndValue: null,
      displayStrategy: "all"
    });

    expect(filtered.map((row) => row.unit)).toEqual(["ns", "s"]);
  });

  it("keeps non-convertible unit families separate", () => {
    const rows: BenchmarkRow[] = [
      { ...Base_Row, run_id: "run-1", metric_name: "memory", unit: "bytes", value: 512 },
      { ...Base_Row, run_id: "run-2", metric_name: "memory", unit: "count", value: 12 },
      { ...Base_Row, run_id: "run-3", metric_name: "memory", unit: "bytes", value: 1024 }
    ];

    const filtered = filterRowsByViewState(rows, {
      environment: "all",
      metricKind: "memory median bytes",
      branch: "all",
      timeStartValue: null,
      timeEndValue: null,
      displayStrategy: "all"
    });

    expect(filtered.map((row) => row.unit)).toEqual(["bytes", "bytes"]);
  });

  it("builds environment buckets and metric options once per dataset", () => {
    const rows: BenchmarkRow[] = [
      { ...Base_Row, run_id: "run-1", environment_id: "env-1", code_date: "2026-01-01T00:00:00Z", unit: "ns" },
      { ...Base_Row, run_id: "run-2", environment_id: "env-1", metric_name: "memory", unit: "bytes", value: 512 },
      { ...Base_Row, run_id: "run-3", environment_id: "env-2", code_date: "2026-01-03T00:00:00Z", metric_name: "memory", unit: "bytes", value: 1024, code_state_metadata: { source: { ...Base_Row.code_state_metadata.source, branch: "feature" } } }
    ];

    const index = buildBenchmarkViewIndex(rows);

    expect(index.rowsByEnvironment.get("all")?.map((entry) => entry.row.run_id)).toEqual(["run-1", "run-2", "run-3"]);
    expect(index.rowsByEnvironment.get("env-1")?.map((entry) => entry.row.run_id)).toEqual(["run-1", "run-2"]);
    expect(index.metricOptionsByEnvironment.get("env-1")).toEqual(["memory median bytes", "time median"]);
    expect(index.metricOptionsByEnvironment.get("env-2")).toEqual(["memory median bytes"]);
    expect(index.branchOptions).toEqual(["all", "feature", "main"]);
    expect(index.datasetTimeStart).toBe("2026-01-01");
    expect(index.datasetTimeEnd).toBe("2026-01-03");
  });

  it("keeps indexed slice results aligned with previous filtering semantics", () => {
    const rows: BenchmarkRow[] = [
      { ...Base_Row, run_id: "run-1", benchmark_id: "bench-1", benchmark_label: "bench-1", code_date: "2026-01-01T00:00:00Z", code_state_metadata: { source: { ...Base_Row.code_state_metadata.source, branch: "main" } } },
      { ...Base_Row, run_id: "run-2", benchmark_id: "bench-2", benchmark_label: "bench-2", code_date: "2026-01-02T00:00:00Z", code_state_metadata: { source: { ...Base_Row.code_state_metadata.source, branch: "main" } } },
      { ...Base_Row, run_id: "run-3", benchmark_id: "bench-3", benchmark_label: "bench-3", code_date: "2026-01-03T00:00:00Z", metric_name: "memory", unit: "bytes", value: 512 },
      { ...Base_Row, run_id: "run-4", benchmark_id: "bench-4", benchmark_label: "bench-4", environment_id: "env-2", environment_label: "Env 2", code_date: "2026-01-02T00:00:00Z" }
    ];
    const state = {
      environment: "env-1",
      metricKind: "time median",
      branch: "main",
      timeStartValue: dateRangeStart("2026-01-01"),
      timeEndValue: dateRangeEnd("2026-01-02"),
      displayStrategy: "all" as const,
      group: "all"
    };
    const expectedFilteredRows = filterRowsByViewState(rows, state);
    const resolved = resolveBenchmarkViewSlice(buildBenchmarkViewIndex(rows), state);

    expect(resolved.filteredRows).toEqual(expectedFilteredRows);
    expect(resolved.groupOptions).toEqual(buildGroupOptions(expectedFilteredRows));
    expect(resolved.scopedRows).toEqual(expectedFilteredRows);
    expect(resolved.benchmarkOptions).toEqual(buildBenchmarkOptions(expectedFilteredRows));
  });

  it("falls back to the first valid metric immediately when the environment changes", () => {
    const rows: BenchmarkRow[] = [
      { ...Base_Row, run_id: "run-1", environment_id: "env-1", environment_label: "Env 1", metric_name: "time", unit: "ns" },
      { ...Base_Row, run_id: "run-2", environment_id: "env-2", environment_label: "Env 2", metric_name: "memory", unit: "bytes", value: 512 }
    ];

    const resolved = resolveBenchmarkViewSlice(buildBenchmarkViewIndex(rows), {
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

  it("evicts least recently used entries from the slice cache", () => {
    const cache = createLRUCache<string, number>(2);

    cache.set("a", 1);
    cache.set("b", 2);
    expect(cache.keys()).toEqual(["a", "b"]);

    expect(cache.get("a")).toBe(1);
    expect(cache.keys()).toEqual(["b", "a"]);

    cache.set("c", 3);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.keys()).toEqual(["a", "c"]);
  });
});
