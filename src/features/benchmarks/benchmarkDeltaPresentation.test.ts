import { describe, expect, it } from "vitest";
import { benchmarkDeltaTone } from "./benchmarkDeltaPresentation";

describe("benchmark delta presentation", () => {
  it("maps raw deltas to metric-aware semantic tone", () => {
    const cases = [
      [12, "lower", "negative"],
      [-12, "lower", "positive"],
      [12, "higher", "positive"],
      [12, "neutral", "neutral"],
      [0.001, "lower", "neutral"]
    ] as const;

    for (const [value, better, tone] of cases) expect(benchmarkDeltaTone(value, better)).toBe(tone);
  });
});
