import { describe, expect, it } from "vitest";
import { benchmarkDeltaColor, benchmarkDeltaDirection, benchmarkDeltaTone } from "./benchmarkDeltaPresentation";
import type { PlotTheme } from "../../lib/dashboard-plotting";

const Plot_Theme: PlotTheme = {
  paper: "#111111",
  plot: "#222222",
  grid: "#333333",
  axis: "#444444",
  zero: "#555555",
  line: "#666666",
  areaGradientStart: "#777777",
  areaGradientEnd: "#888888",
  markerStrong: "#999999",
  marker: "#aaaaaa",
  markerMuted: "#bbbbbb",
  deltaUp: "#cc0000",
  deltaDown: "#00cc00",
  deltaNeutral: "#cccccc"
};

describe("benchmark delta presentation", () => {
  it("preserves raw direction for lower-is-better metrics", () => {
    expect(benchmarkDeltaDirection(12, "lower")).toBe("up");
    expect(benchmarkDeltaDirection(-12, "lower")).toBe("down");
    expect(benchmarkDeltaTone(12, "lower")).toBe("negative");
    expect(benchmarkDeltaTone(-12, "lower")).toBe("positive");
  });

  it("flips direction semantics for higher-is-better metrics", () => {
    expect(benchmarkDeltaDirection(12, "higher")).toBe("down");
    expect(benchmarkDeltaDirection(-12, "higher")).toBe("up");
    expect(benchmarkDeltaTone(12, "higher")).toBe("positive");
    expect(benchmarkDeltaTone(-12, "higher")).toBe("negative");
  });

  it("falls back to neutral tone and color", () => {
    expect(benchmarkDeltaDirection(Number.NaN, "neutral")).toBe("neutral");
    expect(benchmarkDeltaTone(0.001, "lower")).toBe("neutral");
    expect(benchmarkDeltaColor(0.001, "lower", Plot_Theme)).toBe("#cccccc");
  });

  it("selects plot colors from semantic direction", () => {
    expect(benchmarkDeltaColor(12, "lower", Plot_Theme)).toBe("#cc0000");
    expect(benchmarkDeltaColor(-12, "lower", Plot_Theme)).toBe("#00cc00");
    expect(benchmarkDeltaColor(12, "higher", Plot_Theme)).toBe("#00cc00");
  });
});
