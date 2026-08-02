import { describe, expect, it } from "vitest";
import { comparisonResultIncompatibility } from "./comparison-results";
import type { BenchmarkAggregateRow } from "./types";

function aggregate(overrides: Partial<BenchmarkAggregateRow> = {}): BenchmarkAggregateRow {
  return {
    configuration_key: "configuration",
    code_state_id: "code",
    hardware_environment_id: "hardware",
    software_environment_id: "software",
    benchmark_key: '["suite","case"]',
    metric_name: "time",
    statistic: "median",
    unit: "ns",
    value: 1,
    better: "lower",
    run_count: 1,
    ...overrides
  };
}

describe("comparison result compatibility", () => {
  it("accepts compatible results and explains rejected candidates", () => {
    expect(comparisonResultIncompatibility(aggregate(), aggregate({ unit: "μs" }))).toBe("");
    expect(comparisonResultIncompatibility(aggregate(), null)).toBe("No result");
    expect(comparisonResultIncompatibility(aggregate(), aggregate({ unit: "bytes" })))
      .toBe("Incompatible units (bytes vs ns)");
    expect(comparisonResultIncompatibility(aggregate(), aggregate({ better: "higher" })))
      .toBe("Incompatible better direction (higher vs lower)");
  });
});
