import { metricFamilyKey } from "./dashboard-plotting";
import type { BenchmarkAggregateRow } from "./types";

export function comparisonResultIncompatibility(
  baseline: BenchmarkAggregateRow | null,
  candidate: BenchmarkAggregateRow | null
): string {
  if (!candidate) return "No result";
  if (!baseline) return "Baseline result unavailable";
  if (metricFamilyKey(candidate) !== metricFamilyKey(baseline)) {
    return `Incompatible units (${candidate.unit} vs ${baseline.unit})`;
  }
  if (candidate.better !== baseline.better) {
    return `Incompatible better direction (${candidate.better} vs ${baseline.better})`;
  }
  return "";
}
