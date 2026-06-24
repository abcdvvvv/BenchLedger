import { describe, expect, it } from "vitest";
import { filterRowsByViewState } from "./benchmark-view";
import type { BenchmarkRow } from "./types";

const Base_Row: BenchmarkRow = {
  run_id: "run-1",
  branch: "main",
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

describe("benchmark view filtering", () => {
  it("treats time metrics with different units as one metric family", () => {
    const rows: BenchmarkRow[] = [
      { ...Base_Row, run_id: "run-1", unit: "ns", value: 2_000 },
      { ...Base_Row, run_id: "run-2", unit: "s", value: 0.002 },
      { ...Base_Row, run_id: "run-3", metric_name: "memory", unit: "bytes", value: 512 }
    ];

    const filtered = filterRowsByViewState(rows, {
      machine: "all",
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
      machine: "all",
      metricKind: "memory median bytes",
      branch: "all",
      timeStartValue: null,
      timeEndValue: null,
      displayStrategy: "all"
    });

    expect(filtered.map((row) => row.unit)).toEqual(["bytes", "bytes"]);
  });
});
