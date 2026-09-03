import type { SemanticTone } from "../../components/common/semanticTone";
import { metricDeltaClass } from "../../lib/format";
import type { PairComparison } from "../../lib/types";

type BenchmarkDeltaTone = Extract<SemanticTone, "positive" | "negative" | "neutral">;

type BenchmarkBetter = PairComparison["better"];

export function benchmarkDeltaTone(value: number, better: BenchmarkBetter): BenchmarkDeltaTone {
  const direction = metricDeltaClass(value, better);
  if (direction === "down") return "positive";
  if (direction === "up") return "negative";
  return "neutral";
}
