import { schemeTableau10 } from "d3-scale-chromatic";
import { formatMetricValue, parseDate, unique } from "./format";
import type { TrendMarkerSymbol } from "./trend-marker-symbols";
import type { BenchmarkRow } from "./types";
import type { ThemeMode, TrendAxisMode, TrendLineShape, TrendMarkerFillMode } from "./dashboard-settings";

export type TrendPlotRow = BenchmarkRow & {
  code_state_id: string;
  code_date: string;
  environment_id: string;
  environment_label: string;
  measured_at: string;
  date_value: Date | null;
  run_axis_label: string;
  run_headline: string;
  run_tone: "tag" | "master" | "branch";
};

export type MetricDescriptor = {
  metric_name: string;
  statistic: string;
  unit: string;
};

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

export type TrendEnvironmentSeries = {
  environmentId: string;
  environmentLabel: string;
  rows: TrendPlotRow[];
};

export type PlotAxisTickLabels = {
  type?: "date" | "linear";
  tickmode: "array";
  tickvals: Array<string | number>;
  ticktext: string[];
};

export type CommitAxisLayout = {
  positionsByCodeStateId: ReadonlyMap<string, number>;
  tickLabels: PlotAxisTickLabels;
};

export const Trend_Y_Padding_Ratio = 0.08;
export const Trend_Board_Plot_Height = 280;

const _Trend_Categorical_Colors = schemeTableau10;
const _Trend_Time_Units = [
  { unit: "ns", ns: 1 },
  { unit: "μs", ns: 1_000 },
  { unit: "us", ns: 1_000 },
  { unit: "ms", ns: 1_000_000 },
  { unit: "s", ns: 1_000_000_000 },
  { unit: "min", ns: 60 * 1_000_000_000 },
  { unit: "h", ns: 60 * 60 * 1_000_000_000 }
] as const;
const _Trend_Time_Display_Units = [
  { unit: "ns", ns: 1 },
  { unit: "μs", ns: 1_000 },
  { unit: "ms", ns: 1_000_000 },
  { unit: "s", ns: 1_000_000_000 },
  { unit: "min", ns: 60 * 1_000_000_000 },
  { unit: "h", ns: 60 * 60 * 1_000_000_000 }
] as const;
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

function _metricUnitFamily(unit: string): string {
  return _timeUnitNs(unit) === null ? unit : "time";
}

export function metricKey(row: Pick<BenchmarkRow, "metric_name" | "statistic">): string {
  return `${row.metric_name}::${row.statistic}`;
}

export function metricFamilyKey(row: Pick<BenchmarkRow, "metric_name" | "statistic" | "unit">): string {
  return `${metricKey(row)}::${_metricUnitFamily(row.unit)}`;
}

export function isPrimaryMetric(row: Pick<BenchmarkRow, "metric_name" | "statistic" | "unit">): boolean {
  return row.metric_name === "time" &&
    row.statistic === "median" &&
    row.unit === "ns";
}

export function metricLabel(row: Pick<BenchmarkRow, "metric_name" | "statistic">): string {
  return `${row.metric_name} ${row.statistic}`;
}

export function metricFamilyLabel(row: Pick<BenchmarkRow, "metric_name" | "statistic" | "unit">): string {
  const label = metricLabel(row);
  const family = _metricUnitFamily(row.unit);
  return family === "time" || !family ? label : `${label} ${family}`;
}

function _timeUnitNs(unit: string): number | null {
  const match = _Trend_Time_Units.find((entry) => entry.unit === unit);
  return match ? match.ns : null;
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
  const sourceUnitNs = _timeUnitNs(sourceUnit);
  const allTimeUnits = sourceUnits.every((unit) => _timeUnitNs(unit) !== null);

  if (allTimeUnits) {
    const maxNs = rows.reduce((maxValue, row) => {
      const unitNs = _timeUnitNs(row.unit);
      if (!Number.isFinite(row.value) || unitNs === null) return maxValue;
      return Math.max(maxValue, Math.abs(row.value) * unitNs);
    }, 0);
    const displayUnit = _Trend_Time_Display_Units.reduce((currentUnit, candidateUnit) => {
      if (maxNs / candidateUnit.ns >= 1) return candidateUnit;
      return currentUnit;
    }, _Trend_Time_Display_Units[0]);

    return {
      unit: displayUnit.unit,
      scaleValue: (value, unit) => {
        const unitNs = _timeUnitNs(unit);
        return unitNs === null ? value : value * unitNs / displayUnit.ns;
      },
      formatValue: (value, unit) => {
        const unitNs = _timeUnitNs(unit);
        if (unitNs === null) return formatMetricValue(value, unit);
        return `${_formatScaledNumber(value * unitNs / displayUnit.ns)} ${displayUnit.unit}`;
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
      const unitNs = _timeUnitNs(unit);
      return unitNs === null ? value : value * unitNs / sourceUnitNs;
    },
    formatValue: (value, unit) => {
      const unitNs = _timeUnitNs(unit);
      if (unitNs === null) return formatMetricValue(value, unit);
      return `${_formatScaledNumber(value * unitNs / sourceUnitNs)} ${sourceUnit}`;
    },
    formatMetricLabel: (label) => _formatMetricLabelUnit(label, sourceUnit, sourceUnit)
  };
}

export function splitTrendRowsByEnvironment(rows: TrendPlotRow[]): TrendEnvironmentSeries[] {
  const rowsByEnvironment = new Map<string, TrendPlotRow[]>();

  for (const row of rows) {
    const environmentId = row.environment_id || "unknown";
    const bucket = rowsByEnvironment.get(environmentId);
    if (bucket) {
      bucket.push(row);
      continue;
    }
    rowsByEnvironment.set(environmentId, [row]);
  }

  return Array.from(rowsByEnvironment.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([environmentId, environmentRows]) => ({
      environmentId,
      environmentLabel: environmentRows[0]?.environment_label || environmentId,
      rows: environmentRows
    }));
}

type CommitAxisState = {
  codeStateId: string;
  label: string;
  isTag: boolean;
};

function _commitAxisStates(rows: TrendPlotRow[]): CommitAxisState[] {
  const statesById = new Map<string, CommitAxisState>();

  for (const row of [...rows].sort((left, right) => {
    const leftValue = parseDate(left.code_date)?.valueOf() ?? 0;
    const rightValue = parseDate(right.code_date)?.valueOf() ?? 0;
    if (leftValue !== rightValue) return leftValue - rightValue;
    return left.code_state_id.localeCompare(right.code_state_id);
  })) {
    if (statesById.has(row.code_state_id)) continue;
    statesById.set(row.code_state_id, {
      codeStateId: row.code_state_id,
      label: row.run_axis_label,
      isTag: row.run_tone === "tag"
    });
  }

  return Array.from(statesById.values());
}

function _commitAxisAnchorIndices(states: CommitAxisState[]): number[] {
  if (!states.length) return [];
  if (states.length === 1) return [0];

  const anchors = states.flatMap((state, index) => state.isTag ? [index] : []);

  if (!anchors.length) return [0, states.length - 1];
  if (anchors[0] !== 0) anchors.unshift(0);
  if (anchors[anchors.length - 1] !== states.length - 1) anchors.push(states.length - 1);
  return anchors;
}

export function commitAxisLayout(rows: TrendPlotRow[]): CommitAxisLayout | undefined {
  const states = _commitAxisStates(rows);
  if (!states.length) return undefined;

  const anchors = _commitAxisAnchorIndices(states);
  const positionsByCodeStateId = new Map<string, number>();

  if (anchors.length === 1) {
    positionsByCodeStateId.set(states[0].codeStateId, 0);
  } else {
    for (let anchorIndex = 0; anchorIndex < anchors.length - 1; anchorIndex += 1) {
      const startStateIndex = anchors[anchorIndex];
      const endStateIndex = anchors[anchorIndex + 1];
      const startPosition = anchorIndex / (anchors.length - 1);
      const endPosition = (anchorIndex + 1) / (anchors.length - 1);
      const stateCount = endStateIndex - startStateIndex;

      for (let offset = 0; offset <= stateCount; offset += 1) {
        const state = states[startStateIndex + offset];
        const position = stateCount === 0
          ? startPosition
          : startPosition + ((endPosition - startPosition) * offset) / stateCount;
        positionsByCodeStateId.set(state.codeStateId, position);
      }
    }
  }

  return {
    positionsByCodeStateId,
    tickLabels: {
      type: "linear",
      tickmode: "array",
      tickvals: states.map((state) => positionsByCodeStateId.get(state.codeStateId) ?? 0),
      ticktext: states.map((state) => state.label)
    }
  };
}

export function buildTrendTrace(
  rows: TrendPlotRow[],
  options: {
    axisMode: TrendAxisMode;
    commitAxisPositions?: ReadonlyMap<string, number>;
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
    axisMode,
    commitAxisPositions,
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
  const x = axisMode === "commit"
    ? rows.map((row, index) => commitAxisPositions?.get(row.code_state_id) ?? index)
    : rows.map((row) => row.code_date);
  const y = rows.map((row) => displayUnitContext.scaleValue(row.value, row.unit));
  const unit = displayUnitContext.unit || (rows[0]?.unit ?? "");
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
        displayUnitContext.formatValue(row.value, row.unit)
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
      hovertemplate: axisMode === "commit"
        ? `%{customdata[0]}<br>Code date: %{customdata[1]}<br>Measured: %{customdata[2]}<br>Value: %{customdata[3]}<br>Unit: ${unit || "n/a"}<extra></extra>`
        : `%{x}<br>Measured: %{customdata[2]}<br>Value: %{customdata[3]}<br>Unit: ${unit || "n/a"}<extra></extra>`,
      showlegend: showLegend
    }
  ];
}

