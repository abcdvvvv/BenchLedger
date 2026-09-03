import { formatMetricValue, unique } from "./format";
import { metricUnitFamily, timeUnitNanoseconds, Time_Metric_Units } from "./metric-units";
import type { TrendMarkerSymbol } from "./trend-marker-symbols";
import type { BenchmarkRow } from "./types";
import type { ThemeMode, TrendLineShape, TrendMarkerFillMode } from "./dashboard-settings";

export type TrendPlotRow = Pick<BenchmarkRow, "run_id" | "benchmark_key" | "metric_name" | "statistic" | "unit" | "value" | "better"> & { code_date: string; measured_at: string; date_value: Date | null; run_axis_label: string; run_identity_title: string; run_count: number; x_key: string; x_label: string; };

export type PlotTheme = {
  paper: string;
  plot: string;
  grid: string;
  axis: string;
  zero: string;
  line: string;
  areaGradientStart: string;
  areaGradientEnd: string;
  markerStrong: string;
  marker: string;
  markerMuted: string;
  deltaUp: string;
  deltaDown: string;
  deltaNeutral: string;
};

export type TrendDisplayUnitContext = {
  unit: string;
  scaleValue: (value: number, unit: string) => number;
  formatValue: (value: number, unit: string) => string;
  formatMetricLabel: (label: string) => string;
};

export const Trend_Y_Padding_Ratio = 0.08;
export const Trend_Board_Plot_Height = 280;

const _Trend_Categorical_Colors = ["#4e79a7", "#f28e2c", "#e15759", "#76b7b2", "#59a14f", "#edc949", "#af7aa1", "#ff9da7", "#9c755f", "#bab0ab"] as const;
const _Trend_Time_Display_Units = Time_Metric_Units;
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
  if (theme === "dark") {
    return {
      paper: "transparent",
      plot: "transparent",
      grid: "#2F2F33",
      axis: "#A8A29E",
      zero: "#44403C",
      line: "#F59E0B",
      areaGradientStart: "rgba(245, 158, 11, 0)",
      areaGradientEnd: "rgba(245, 158, 11, 0.35)",
      markerStrong: "#FBBF24",
      marker: "#F59E0B",
      markerMuted: "#78716C",
      deltaUp: "#DC2626",
      deltaDown: "#059669",
      deltaNeutral: "#78716C"
    };
  }
  return {
    paper: "transparent",
    plot: "transparent",
    grid: "#E7E5E4",
    axis: "#78716C",
    zero: "#D6D3D1",
    line: "#B45309",
    areaGradientStart: "rgba(180, 83, 9, 0)",
    areaGradientEnd: "rgba(180, 83, 9, 0.28)",
    markerStrong: "#18181B",
    marker: "#B45309",
    markerMuted: "#A8A29E",
    deltaUp: "#DC2626",
    deltaDown: "#059669",
    deltaNeutral: "#78716C"
  };
}

export function colorForBenchmark(index: number): string {
  return _Trend_Categorical_Colors[index % _Trend_Categorical_Colors.length];
}

export function metricKey(row: Pick<BenchmarkRow, "metric_name" | "statistic">): string {
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
  const sourceUnitNs = timeUnitNanoseconds(sourceUnit);
  const allTimeUnits = sourceUnits.every((unit) => timeUnitNanoseconds(unit) !== null);

  if (allTimeUnits) {
    const maxNs = rows.reduce((maxValue, row) => {
      const unitNs = timeUnitNanoseconds(row.unit);
      if (!Number.isFinite(row.value) || unitNs === null) return maxValue;
      return Math.max(maxValue, Math.abs(row.value) * unitNs);
    }, 0);
    const displayUnit = _Trend_Time_Display_Units.reduce((currentUnit, candidateUnit) => {
      if (maxNs / candidateUnit.nanoseconds >= 1) return candidateUnit;
      return currentUnit;
    }, _Trend_Time_Display_Units[0]);

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

  if (sourceUnits.length !== 1 || sourceUnitNs === null) {
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

  return {
    unit: sourceUnit,
    scaleValue: (value, unit) => {
      const unitNs = timeUnitNanoseconds(unit);
      return unitNs === null ? value : value * unitNs / sourceUnitNs;
    },
    formatValue: (value, unit) => {
      const unitNs = timeUnitNanoseconds(unit);
      if (unitNs === null) return formatMetricValue(value, unit);
      return `${_formatScaledNumber(value * unitNs / sourceUnitNs)} ${sourceUnit}`;
    },
    formatMetricLabel: (label) => _formatMetricLabelUnit(label, sourceUnit, sourceUnit)
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
    plotTheme: PlotTheme;
    theme: ThemeMode;
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
    plotTheme,
    theme,
    yMin,
    yPadding,
    showLegend,
    fillGradientScale
  } = options;
  const x = rows.map((row) => row.x_label);
  const y = rows.map((row) => displayUnitContext.scaleValue(row.value, row.unit));
  const gradientStart = colorWithAlpha(color, 0);
  const gradientEnd = colorWithAlpha(color, theme === "dark" ? 0.2 : 0.2);
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
        color: markerFillMode === "filled" ? color : plotTheme.plot,
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

