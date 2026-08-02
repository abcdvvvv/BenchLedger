import { describe, expect, it } from "vitest";
import { benchmarkDeltaColor, benchmarkDeltaDirection, benchmarkDeltaTone } from "./benchmarkDeltaPresentation";
import type { PlotTheme } from "../../lib/dashboard-plotting";

const Plot_Theme: PlotTheme = {
  paper: "", plot: "", grid: "", axis: "", zero: "", line: "",
  areaGradientStart: "", areaGradientEnd: "", markerStrong: "", marker: "", markerMuted: "",
  deltaUp: "red", deltaDown: "green", deltaNeutral: "gray"
};

describe("benchmark delta presentation", () => {
  it("maps raw deltas to metric-aware direction, tone, and color", () => {
    const cases = [
      [12, "lower", "up", "negative", "red"],
      [-12, "lower", "down", "positive", "green"],
      [12, "higher", "down", "positive", "green"],
      [12, "neutral", "neutral", "neutral", "gray"],
      [0.001, "lower", "neutral", "neutral", "gray"]
    ] as const;

    for (const [value, better, direction, tone, color] of cases) {
      expect(benchmarkDeltaDirection(value, better)).toBe(direction);
      expect(benchmarkDeltaTone(value, better)).toBe(tone);
      expect(benchmarkDeltaColor(value, better, Plot_Theme)).toBe(color);
    }
  });
});
