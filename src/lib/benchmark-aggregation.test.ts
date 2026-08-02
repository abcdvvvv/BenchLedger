import { describe, expect, it } from "vitest";
import { aggregateBenchmarkRows } from "./benchmark-aggregation";
import type { BenchmarkRow, BenchmarkRunRecord } from "./types";

const Key = '["suite","case"]';

function run(id: string, code = "code-1", hardware = "hardware-1", software = "software-1"): BenchmarkRunRecord {
  return {
    id,
    code_state_id: code,
    hardware_environment_id: hardware,
    software_environment_id: software,
    measured_at: `2026-01-0${id.slice(-1)}T00:00:00Z`,
    metadata: {}
  };
}

function row(runId: string, value: number, benchmarkKey = Key, unit = "ns"): BenchmarkRow {
  return {
    run_id: runId,
    benchmark_key: benchmarkKey,
    metric_name: "time",
    statistic: "median",
    unit,
    value,
    better: "lower"
  };
}

describe("benchmark aggregation", () => {
  it("averages repeated runs of the same configuration", () => {
    const runs = new Map([["run-1", run("run-1")], ["run-2", run("run-2")], ["run-3", run("run-3")]]);
    expect(aggregateBenchmarkRows([row("run-1", 10), row("run-2", 20), row("run-3", 30)], runs)).toEqual([
      expect.objectContaining({ value: 20, run_count: 3 })
    ]);
  });

  it("normalizes compatible time units without changing raw rows", () => {
    const runs = new Map([["run-1", run("run-1")], ["run-2", run("run-2")]]);
    const rows = [row("run-1", 1_000), row("run-2", 2, Key, "μs")];
    const result = aggregateBenchmarkRows(rows, runs);

    expect(rows).toEqual([
      expect.objectContaining({ value: 1_000, unit: "ns" }),
      expect.objectContaining({ value: 2, unit: "μs" })
    ]);
    expect(result).toEqual([expect.objectContaining({ value: 1_500, unit: "ns", run_count: 2 })]);
    expect(aggregateBenchmarkRows([row("run-1", 2, Key, "us")], runs)).toEqual([
      expect.objectContaining({ value: 2, unit: "μs", run_count: 1 })
    ]);
  });

  it("keeps missing benchmarks separate instead of treating them as zero", () => {
    const otherKey = '["suite","other"]';
    const runs = new Map([["run-1", run("run-1")], ["run-2", run("run-2")]]);
    const result = aggregateBenchmarkRows([row("run-1", 12), row("run-2", 50, otherKey)], runs);
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ benchmark_key: Key, value: 12, run_count: 1 }),
      expect.objectContaining({ benchmark_key: otherKey, value: 50, run_count: 1 })
    ]));
  });

  it("keeps code, hardware, and software axes independent", () => {
    const runs = new Map([
      ["run-1", run("run-1")],
      ["run-2", run("run-2", "code-2")],
      ["run-3", run("run-3", "code-1", "hardware-2")],
      ["run-4", run("run-4", "code-1", "hardware-1", "software-2")]
    ]);
    const result = aggregateBenchmarkRows(
      [row("run-1", 10), row("run-2", 20), row("run-3", 30), row("run-4", 40)],
      runs
    );
    expect(new Set(result.map((entry) => entry.configuration_key)).size).toBe(4);
  });

  it("rejects malformed aggregation input", () => {
    const runs = new Map([["run-1", run("run-1")], ["run-2", run("run-2")]]);
    expect(() => aggregateBenchmarkRows([row("missing", 1)], runs)).toThrow("unknown run_id=missing");
    expect(() => aggregateBenchmarkRows([row("run-1", 1), row("run-1", 2)], runs)).toThrow("duplicate result");
    expect(() => aggregateBenchmarkRows([row("run-1", 1), row("run-2", 2, Key, "bytes")], runs))
      .toThrow("conflicting units");
  });
});
