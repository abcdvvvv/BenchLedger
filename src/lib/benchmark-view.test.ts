import { describe, expect, it } from "vitest";
import { filterRowsByViewState } from "./benchmark-view";
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
});
