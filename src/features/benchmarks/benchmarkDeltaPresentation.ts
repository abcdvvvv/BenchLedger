import type { SemanticTone } from "../../components/common/semanticTone";
import { deltaColorKey, type PlotTheme } from "../../lib/dashboard";
import { metricDeltaClass } from "../../lib/format";
import type { PairComparison } from "../../lib/types";

export type BenchmarkDeltaTone = Extract<SemanticTone, "positive" | "negative" | "neutral">;

type BenchmarkBetter = PairComparison["better"];

export function benchmarkDeltaDirection(value: number, better: BenchmarkBetter) {
  return metricDeltaClass(value, better);
}

export function benchmarkDeltaTone(value: number, better: BenchmarkBetter): BenchmarkDeltaTone {
  const direction = benchmarkDeltaDirection(value, better);
  if (direction === "down") return "positive";
  if (direction === "up") return "negative";
  return "neutral";
}

export function benchmarkDeltaColor(value: number, better: BenchmarkBetter, plotTheme: PlotTheme): string {
  return plotTheme[deltaColorKey[benchmarkDeltaDirection(value, better)]];
}
