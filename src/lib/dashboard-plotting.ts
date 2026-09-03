import { formatMetricValue, unique } from "./format";
import { metricUnitFamily, timeUnitNanoseconds, Time_Metric_Units } from "./metric-units";
import type { TrendMarkerSymbol } from "./trend-marker-symbols";
import type { BenchmarkRow } from "./types";
import type { ThemeMode, TrendLineShape, TrendMarkerFillMode } from "./dashboard-settings";

export type TrendPlotRow = Pick<BenchmarkRow, "unit" | "value"> & { code_date: string; measured_at: string; run_axis_label: string; run_identity_title: string; x_label: string; };

export type PlotTheme = { grid: string; axis: string; line: string; };

type TrendDisplayUnitContext = {
  unit: string;
  scaleValue: (value: number, unit: string) => number;
  formatValue: (value: number, unit: string) => string;
  formatMetricLabel: (label: string) => string;
};

export const Trend_Y_Padding_Ratio = 0.08;
export const Trend_Board_Plot_Height = 280;

const _Trend_Categorical_Colors = ["#4e79a7", "#f28e2c", "#e15759", "#76b7b2", "#59a14f", "#edc949", "#af7aa1", "#ff9da7", "#9c755f", "#bab0ab"] as const;
const _Trend_Default_Display_Context: TrendDisplayUnitContext = {
  unit: "",
  scaleValue: (value) => value,
  formatValue: (value, unit) => formatMetricValue(value, unit),
  formatMetricLabel: (label) => label || "Metric value"
};

export function colorWithAlpha(color: string, alpha: number): string {
  if (!color.startsWith("#")) return color;
  const hex = color.slice(1);
  const normalized = hex.length === 3
    ? hex.split("").map((entry) => `${entry}${entry}`).join("")
    : hex;
  if (normalized.length !== 6) return color;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function plotThemeFor(theme: ThemeMode): PlotTheme {
  return theme === "dark" ? { grid: "#2F2F33", axis: "#A8A29E", line: "#F59E0B" } : { grid: "#E7E5E4", axis: "#78716C", line: "#B45309" };
}

export function colorForBenchmark(index: number): string {
  return _Trend_Categorical_Colors[index % _Trend_Categorical_Colors.length];
}

function metricKey(row: Pick<BenchmarkRow, "metric_name" | "statistic">): string {
  return `${row.metric_name}::${row.statistic}`;
}

export function metricFamilyKey(row: Pick<BenchmarkRow, "metric_name" | "statistic" | "unit">): string {
  return `${metricKey(row)}::${metricUnitFamily(row.unit)}`;
}

export function metricLabel(row: Pick<BenchmarkRow, "metric_name" | "statistic">): string {
  return `${row.metric_name} ${row.statistic}`;
}

export function metricFamilyLabel(row: Pick<BenchmarkRow, "metric_name" | "statistic" | "unit">): string {
  const label = metricLabel(row);
  const family = metricUnitFamily(row.unit);
  return family === "time" || !family ? label : `${label} ${family}`;
}

function _formatScaledNumber(value: number): string {
  if (!Number.isFinite(value)) return "n/a";
  if (Math.abs(value) >= 100) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  }
  if (Math.abs(value) >= 10) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function _formatMetricLabelUnit(label: string, displayUnit: string, sourceUnit = ""): string {
  if (!label) return "Metric value";
  if (!displayUnit) return label;
  if (sourceUnit && label.endsWith(` ${sourceUnit}`)) return `${label.slice(0, -sourceUnit.length)}${displayUnit}`;
  if (label.endsWith(` ${displayUnit}`)) return label;
  return `${label} ${displayUnit}`;
}


export function trendDisplayUnitContext(
  rows: Array<Pick<BenchmarkRow, "value" | "unit">>
): TrendDisplayUnitContext {
  const sourceUnits = unique(
    rows
      .map((row) => row.unit)
      .filter((unit): unit is string => typeof unit === "string" && unit.length > 0)
  );
  if (!sourceUnits.length) return _Trend_Default_Display_Context;

  const sourceUnit = sourceUnits[0];
  const allTimeUnits = sourceUnits.every((unit) => timeUnitNanoseconds(unit) !== null);

  if (allTimeUnits) {
    const maxNs = rows.reduce((maxValue, row) => {
      const unitNs = timeUnitNanoseconds(row.unit);
      if (!Number.isFinite(row.value) || unitNs === null) return maxValue;
      return Math.max(maxValue, Math.abs(row.value) * unitNs);
    }, 0);
    const displayUnit = Time_Metric_Units.reduce((currentUnit, candidateUnit) => {
      if (maxNs / candidateUnit.nanoseconds >= 1) return candidateUnit;
      return currentUnit;
    }, Time_Metric_Units[0]);

    return {
      unit: displayUnit.unit,
      scaleValue: (value, unit) => {
        const unitNs = timeUnitNanoseconds(unit);
        return unitNs === null ? value : value * unitNs / displayUnit.nanoseconds;
      },
      formatValue: (value, unit) => {
        const unitNs = timeUnitNanoseconds(unit);
        if (unitNs === null) return formatMetricValue(value, unit);
        return `${_formatScaledNumber(value * unitNs / displayUnit.nanoseconds)} ${displayUnit.unit}`;
      },
      formatMetricLabel: (label) => _formatMetricLabelUnit(label, displayUnit.unit, sourceUnits.length === 1 ? sourceUnit : "")
    };
  }

  if (sourceUnits.length === 1) {
    return {
      unit: sourceUnit,
      scaleValue: (value) => value,
      formatValue: (value, unit) => formatMetricValue(value, unit),
      formatMetricLabel: (label) => _formatMetricLabelUnit(label, sourceUnit)
    };
  }
  return {
    unit: "",
    scaleValue: (value) => value,
    formatValue: (value, unit) => formatMetricValue(value, unit),
    formatMetricLabel: (label) => label || "Metric value"
  };
}

export function trendValueExtent(
  rows: readonly Pick<TrendPlotRow, "value" | "unit">[],
  displayUnitContext: TrendDisplayUnitContext
): { min: number; max: number } | null {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const row of rows) {
    const value = displayUnitContext.scaleValue(row.value, row.unit);
    if (!Number.isFinite(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }

  return min === Number.POSITIVE_INFINITY ? null : { min, max };
}

export function buildTrendTrace(
  rows: TrendPlotRow[],
  options: {
    lineShape: TrendLineShape;
    markerSymbol: TrendMarkerSymbol;
    markerFillMode: TrendMarkerFillMode;
    displayUnitContext: TrendDisplayUnitContext;
    color: string;
    label: string;
    yMin: number;
    yPadding: number;
    showLegend: boolean;
    fillGradientScale?: Array<[number, string]>;
  }
): Array<Record<string, unknown>> {
  if (!rows.length) return [];
  const {
    lineShape,
    markerSymbol,
    markerFillMode,
    displayUnitContext,
    color,
    label,
    yMin,
    yPadding,
    showLegend,
    fillGradientScale
  } = options;
  const x = rows.map((row) => row.x_label);
  const y = rows.map((row) => displayUnitContext.scaleValue(row.value, row.unit));
  const gradientStart = colorWithAlpha(color, 0);
  const gradientEnd = colorWithAlpha(color, 0.2);
  const colorscale = fillGradientScale ?? [
    [0, gradientStart],
    [0.4, gradientStart],
    [1, gradientEnd]
  ];

  return [
    {
      type: "scatter",
      mode: "lines",
      x,
      y: rows.map(() => yMin - yPadding),
      line: { color: "rgba(0, 0, 0, 0)", width: 0 },
      hoverinfo: "skip",
      showlegend: false
    },
    {
      type: "scatter",
      mode: "lines+markers",
      name: label,
      x,
      y,
      customdata: rows.map((row) => [
        row.run_axis_label,
        row.code_date,
        row.measured_at,
        displayUnitContext.formatValue(row.value, row.unit),
        row.run_identity_title
      ]),
      line: {
        color,
        width: 2.5,
        shape: lineShape === "curve" ? "spline" : "linear",
        smoothing: lineShape === "curve" ? 0.75 : 0
      },
      marker: {
        size: 8,
        color: markerFillMode === "filled" ? color : "transparent",
        symbol: markerSymbol,
        line: { color, width: 2.5 }
      },
      fill: "tonexty",
      fillgradient: {
        type: "vertical",
        colorscale
      },
      hovertemplate: `%{customdata[4]}<br>Code date: %{customdata[1]}<br>Latest measured: %{customdata[2]}<br>Value: %{customdata[3]}<extra></extra>`,
      showlegend: showLegend
    }
  ];
}

