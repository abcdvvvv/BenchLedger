import { schemeTableau10 } from "d3-scale-chromatic";
import { formatDate, formatMetricValue, parseDate, shortCommit, unique } from "./format";
import { Trend_Marker_Symbol_Options, type TrendMarkerSymbol } from "./trend-marker-symbols";
import type {
  BenchmarkRow,
  BenchmarkRun,
  BenchLedgerManifestDatabase,
  BenchLedgerMetadata,
  LoadedBenchmarkDataset,
  PairComparison
} from "./types";

export type ThemeMode = "light" | "dark";
export type TrendLineShape = "line" | "curve";
export type TrendMarkerFillMode = "hollow" | "filled";
export type TrendAxisMode = "commit" | "time";
export type DisplayStrategy = "all" | "tagged-only" | "tagged-main";
export type ActivePage = "overview" | "trend-board" | "benchmark-keys" | "settings" | "database-catalog" | "about";
export type AppPhase = "booting" | "select-source" | "loading-database" | "ready";
export type RunPairSortKey = "benchmark" | "focus" | "baseline" | "delta" | "unit";
export type SortDirection = "asc" | "desc";
export type RunPairSort = {
  key: RunPairSortKey;
  direction: SortDirection;
};

export type DatabaseCatalogStats = {
  rowCount: number;
  runCount: number;
  keyCount: number;
  environmentCount: number;
  metrics: string[];
  latestRunDate: string;
  dirtyRunCount: number;
};

export type DatabaseCatalogEntry = {
  id: string;
  title: string;
  source: string;
  description: string;
  url: string;
  sha256: string;
  sizeBytes: number | null;
  packedAt: string;
  schemaVersion: number | null;
  metadataPreview: Record<string, string | null>;
  isActive: boolean;
  stats: DatabaseCatalogStats | null;
};

export type UISettings = {
  activePage: ActivePage;
  theme: ThemeMode;
  selectedDatabaseId: string;
  environment: string;
  metricKind: string;
  trendBoardEnvironment: string;
  trendBoardMetricKind: string;
  trendBoardDisplayStrategy: DisplayStrategy;
  focusRunId: string;
  baselineRunId: string;
  group: string;
  trendBoardGroup: string;
  branch: string;
  trendBoardBranch: string;
  timeStart: string;
  timeEnd: string;
  trendBoardTimeStart: string;
  trendBoardTimeEnd: string;
  displayStrategy: DisplayStrategy;
  overviewSelectedBenchmarkIds: string[];
  trendBoardSelectedBenchmarkIds: string[];
  trendLineShape: TrendLineShape;
  trendMarkerSymbol: TrendMarkerSymbol;
  trendMarkerFillMode: TrendMarkerFillMode;
  trendAxisMode: TrendAxisMode;
  trendBoardColumns: number;
};

export type TrendPlotRow = BenchmarkRow & {
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
  rows: TrendPlotRow[];
};

export type PlotAxisCategoryOrder = {
  categoryorder: "array";
  categoryarray: string[];
};

export const UI_SETTINGS_STORAGE_KEY = "benchledger-ui-settings";
export const Trend_Y_Padding_Ratio = 0.08;
export const Trend_Board_Default_Columns = 3;
export const Trend_Board_Min_Columns = 1;
export const Trend_Board_Max_Columns = 10;
export const Trend_Board_Plot_Height = 280;
export const Largest_Deltas_Bar_Width = 0.5;
export const Asset_Base_URL = import.meta.env.BASE_URL;

export const deltaColorKey = {
  up: "deltaUp",
  down: "deltaDown",
  neutral: "deltaNeutral"
} as const;

export const statDeltaTone = {
  up: "negative",
  down: "positive",
  neutral: "neutral"
} as const;

export const runPairTableColumns: { key: RunPairSortKey; label: string }[] = [
  { key: "benchmark", label: "Benchmark" },
  { key: "focus", label: "Focus" },
  { key: "baseline", label: "Baseline" },
  { key: "delta", label: "Delta" },
  { key: "unit", label: "Unit" }
];

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

function systemTheme(): ThemeMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringSetting(settings: Record<string, unknown>, key: keyof UISettings): string {
  const value = settings[key];
  return typeof value === "string" ? value : "";
}

function stringArraySetting(settings: Record<string, unknown>, key: keyof UISettings): string[] {
  const value = settings[key];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

export function clampTrendBoardColumns(value: number): number {
  if (!Number.isFinite(value)) return Trend_Board_Default_Columns;
  return Math.min(Trend_Board_Max_Columns, Math.max(Trend_Board_Min_Columns, Math.round(value)));
}

export function comparePath(left: string[], right: string[]): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const order = left[index].localeCompare(right[index]);
    if (order !== 0) return order;
  }
  return left.length - right.length;
}

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

function _metadataRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function _metadataString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function _metadataStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0) : [];
}

function _codeStateSource(row: Pick<BenchmarkRow, "code_state_metadata">): Record<string, unknown> {
  return _metadataRecord(row.code_state_metadata.source);
}

function _runSource(row: Pick<BenchmarkRow, "run_metadata">): Record<string, unknown> {
  return _metadataRecord(row.run_metadata.source);
}

function _codeStateBranch(row: Pick<BenchmarkRow, "code_state_metadata" | "run_metadata">): string {
  return _metadataString(_codeStateSource(row), "branch") || _metadataString(_runSource(row), "branch");
}

function _codeStateTags(row: Pick<BenchmarkRow, "code_state_metadata" | "run_metadata">): string[] {
  return _metadataStringArray(_codeStateSource(row), "tags").length
    ? _metadataStringArray(_codeStateSource(row), "tags")
    : _metadataStringArray(_runSource(row), "tags");
}

function _codeStateRevision(row: Pick<BenchmarkRow, "code_state_metadata" | "run_metadata">): string {
  return _metadataString(_codeStateSource(row), "revision");
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
    .map(([environmentId, environmentRows]) => ({ environmentId, rows: environmentRows }));
}

export function commitAxisCategoryOrder(rows: TrendPlotRow[]): PlotAxisCategoryOrder | undefined {
  if (!rows.length) return undefined;
  const categoryarray = unique(rows.map((row) => row.run_axis_label));
  return categoryarray.length ? { categoryorder: "array", categoryarray } : undefined;
}

export function buildTrendTrace(
  rows: TrendPlotRow[],
  options: {
    axisMode: TrendAxisMode;
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
  const x = rows.map((row) => axisMode === "commit" ? row.run_axis_label : row.code_date);
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
        row.environment_id,
        row.environment_label,
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
      hovertemplate: `%{x}<br>Environment: %{customdata[1]} (%{customdata[0]})<br>Code date: %{customdata[2]}<br>Measured: %{customdata[3]}<br>Value: %{customdata[4]}<br>Unit: ${unit || "n/a"}<extra></extra>`,
      showlegend: showLegend
    }
  ];
}

export function readUISettings(): UISettings {
  const defaults: UISettings = {
    activePage: "overview",
    theme: systemTheme(),
    selectedDatabaseId: "",
    environment: "all",
    metricKind: "",
    trendBoardEnvironment: "all",
    trendBoardMetricKind: "",
    trendBoardDisplayStrategy: "all",
    focusRunId: "",
    baselineRunId: "",
    group: "all",
    trendBoardGroup: "all",
    branch: "all",
    trendBoardBranch: "all",
    timeStart: "",
    timeEnd: "",
    trendBoardTimeStart: "",
    trendBoardTimeEnd: "",
    displayStrategy: "all",
    overviewSelectedBenchmarkIds: [],
    trendBoardSelectedBenchmarkIds: [],
    trendLineShape: "curve",
    trendMarkerSymbol: "circle",
    trendMarkerFillMode: "hollow",
    trendAxisMode: "commit",
    trendBoardColumns: Trend_Board_Default_Columns
  };
  const rawSettings = window.localStorage.getItem(UI_SETTINGS_STORAGE_KEY);
  if (!rawSettings) return defaults;

  try {
    const parsedSettings: unknown = JSON.parse(rawSettings);
    if (!isRecord(parsedSettings)) return defaults;
    const overviewSelectedBenchmarkIds = stringArraySetting(parsedSettings, "overviewSelectedBenchmarkIds").length
      ? stringArraySetting(parsedSettings, "overviewSelectedBenchmarkIds")
      : defaults.overviewSelectedBenchmarkIds;
    const trendBoardSelectedBenchmarkIds = stringArraySetting(parsedSettings, "trendBoardSelectedBenchmarkIds").length
      ? stringArraySetting(parsedSettings, "trendBoardSelectedBenchmarkIds")
      : defaults.trendBoardSelectedBenchmarkIds;
    return {
      activePage:
        parsedSettings.activePage === "overview" ||
        parsedSettings.activePage === "trend-board" ||
        parsedSettings.activePage === "benchmark-keys" ||
        parsedSettings.activePage === "settings" ||
        parsedSettings.activePage === "database-catalog" ||
        parsedSettings.activePage === "about"
          ? parsedSettings.activePage
          : defaults.activePage,
      theme: parsedSettings.theme === "light" || parsedSettings.theme === "dark" ? parsedSettings.theme : defaults.theme,
      selectedDatabaseId: stringSetting(parsedSettings, "selectedDatabaseId"),
      environment: stringSetting(parsedSettings, "environment"),
      metricKind: stringSetting(parsedSettings, "metricKind"),
      trendBoardEnvironment: stringSetting(parsedSettings, "trendBoardEnvironment"),
      trendBoardMetricKind: stringSetting(parsedSettings, "trendBoardMetricKind"),
      trendBoardDisplayStrategy:
        parsedSettings.trendBoardDisplayStrategy === "all" ||
        parsedSettings.trendBoardDisplayStrategy === "tagged-only" ||
        parsedSettings.trendBoardDisplayStrategy === "tagged-main"
          ? parsedSettings.trendBoardDisplayStrategy
          : defaults.trendBoardDisplayStrategy,
      focusRunId: stringSetting(parsedSettings, "focusRunId"),
      baselineRunId: stringSetting(parsedSettings, "baselineRunId"),
      group: stringSetting(parsedSettings, "group") || defaults.group,
      trendBoardGroup: stringSetting(parsedSettings, "trendBoardGroup") || defaults.trendBoardGroup,
      branch: stringSetting(parsedSettings, "branch") || defaults.branch,
      trendBoardBranch: stringSetting(parsedSettings, "trendBoardBranch") || defaults.trendBoardBranch,
      timeStart: stringSetting(parsedSettings, "timeStart"),
      timeEnd: stringSetting(parsedSettings, "timeEnd"),
      trendBoardTimeStart: stringSetting(parsedSettings, "trendBoardTimeStart"),
      trendBoardTimeEnd: stringSetting(parsedSettings, "trendBoardTimeEnd"),
      displayStrategy:
        parsedSettings.displayStrategy === "all" ||
        parsedSettings.displayStrategy === "tagged-only" ||
        parsedSettings.displayStrategy === "tagged-main"
          ? parsedSettings.displayStrategy
          : defaults.displayStrategy,
      overviewSelectedBenchmarkIds,
      trendBoardSelectedBenchmarkIds,
      trendLineShape:
        parsedSettings.trendLineShape === "line" || parsedSettings.trendLineShape === "curve"
          ? parsedSettings.trendLineShape
          : defaults.trendLineShape,
      trendMarkerSymbol:
        Trend_Marker_Symbol_Options.some((option) => option.value === parsedSettings.trendMarkerSymbol)
          ? parsedSettings.trendMarkerSymbol as TrendMarkerSymbol
          : defaults.trendMarkerSymbol,
      trendMarkerFillMode:
        parsedSettings.trendMarkerFillMode === "hollow" || parsedSettings.trendMarkerFillMode === "filled"
          ? parsedSettings.trendMarkerFillMode
          : defaults.trendMarkerFillMode,
      trendAxisMode:
        parsedSettings.trendAxisMode === "commit" || parsedSettings.trendAxisMode === "time"
          ? parsedSettings.trendAxisMode
          : defaults.trendAxisMode,
      trendBoardColumns: clampTrendBoardColumns(
        typeof parsedSettings.trendBoardColumns === "number"
          ? parsedSettings.trendBoardColumns
          : defaults.trendBoardColumns
      )
    };
  } catch {
    return defaults;
  }
}

export function runId(row: Pick<BenchmarkRow, "run_id">): string {
  return row.run_id;
}

export function runHeadline(run: BenchmarkRun): string {
  const tags = _codeStateTags(run);
  if (tags.length) return tags[0];
  if (run.code_label) return run.code_label;
  const revision = _codeStateRevision(run);
  if (revision) return shortCommit(revision);
  const branch = _codeStateBranch(run);
  if (branch) return branch;
  return run.environment_label || "local";
}

export function runTone(run: BenchmarkRun): "tag" | "master" | "branch" {
  if (_codeStateTags(run).length) return "tag";
  const branch = _codeStateBranch(run);
  if (branch === "master" || branch === "main") return "master";
  return "branch";
}

export function runAxisLabel(row: BenchmarkRow): string {
  const tags = _codeStateTags(row);
  if (tags.length) return tags[0];
  if (row.code_label) return row.code_label;
  const revision = _codeStateRevision(row);
  if (revision) return shortCommit(revision);
  return row.environment_label || "local";
}

export function dateInputValue(value: string): string {
  const date = parseDate(value);
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function todayDateInput(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDateRangePart(value: string, fallback: string): string {
  if (!value) return fallback;
  const date = parseDate(`${value}T00:00:00`);
  if (!date) return value;
  return date.toLocaleDateString();
}

export function openNativeDatePicker(input: HTMLInputElement | null) {
  if (!input) return;
  input.focus();
  if ("showPicker" in input) input.showPicker();
}

export function dateRangeStart(value: string): number | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? null : date.valueOf();
}

export function dateRangeEnd(value: string): number | null {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.valueOf()) ? null : date.valueOf();
}

export function rowMatchesDisplayStrategy(row: BenchmarkRow, strategy: DisplayStrategy): boolean {
  if (strategy === "all") return true;
  if (_codeStateTags(row).length) return true;
  const branch = _codeStateBranch(row);
  return strategy === "tagged-main" && (branch === "main" || branch === "master");
}

export function runPairSortValue(row: PairComparison, key: RunPairSortKey): string | number {
  if (key === "benchmark") return row.benchmark_label;
  if (key === "focus") return row.focus_value;
  if (key === "baseline") return row.baseline_value;
  if (key === "unit") return row.unit;
  return row.delta;
}

export function defaultRunPairSortDirection(key: RunPairSortKey): SortDirection {
  return key === "benchmark" ? "asc" : "desc";
}

function compareRuns(left: BenchmarkRun, right: BenchmarkRun): number {
  const leftMeasuredAt = parseDate(left.measured_at)?.valueOf() ?? 0;
  const rightMeasuredAt = parseDate(right.measured_at)?.valueOf() ?? 0;
  if (leftMeasuredAt !== rightMeasuredAt) return rightMeasuredAt - leftMeasuredAt;
  const leftCodeDate = parseDate(left.code_date)?.valueOf() ?? 0;
  const rightCodeDate = parseDate(right.code_date)?.valueOf() ?? 0;
  if (leftCodeDate !== rightCodeDate) return rightCodeDate - leftCodeDate;
  return right.run_id.localeCompare(left.run_id);
}

export function buildRuns(rows: BenchmarkRow[]): BenchmarkRun[] {
  const runsById = new Map<string, BenchmarkRun>();
  const benchmarkIdsByRun = new Map<string, Set<string>>();
  for (const row of rows) {
    const id = runId(row);
    const existing = runsById.get(id);
    if (existing) {
      const benchmarkIds = benchmarkIdsByRun.get(id)!;
      if (!benchmarkIds.has(row.benchmark_id)) {
        benchmarkIds.add(row.benchmark_id);
        existing.benchmark_count += 1;
      }
      continue;
    }
    benchmarkIdsByRun.set(id, new Set([row.benchmark_id]));
    runsById.set(id, {
      run_id: id,
      code_state_id: row.code_state_id,
      code_label: row.code_label,
      code_date: row.code_date,
      environment_id: row.environment_id,
      environment_label: row.environment_label,
      measured_at: row.measured_at,
      notes: row.notes,
      code_state_metadata: row.code_state_metadata,
      environment_metadata: row.environment_metadata,
      run_metadata: row.run_metadata,
      benchmark_count: 1
    });
  }
  return Array.from(runsById.values()).sort(compareRuns);
}

export function databaseTitle(database: BenchLedgerManifestDatabase): string {
  return database.name || database.id;
}

function databasePreviewValue(database: BenchLedgerManifestDatabase, key: string): string {
  return database.metadata_preview?.[key] ?? "";
}

export function databaseDescription(database: BenchLedgerManifestDatabase): string {
  return database.description || databasePreviewValue(database, "description") || "No description provided.";
}

export function formatOptionalDate(value: string): string {
  return value ? formatDate(value) : "n/a";
}

export function formatSchemaLabel(value: number | null | undefined): string {
  return value === null || value === undefined ? "n/a" : `v${value}`;
}

export function metadataTitle(metadata: BenchLedgerMetadata): string {
  return metadata.name || "BenchLedger";
}

export function metadataDescription(metadata: BenchLedgerMetadata): string {
  return metadata.description || metadata.notes || "Performance tracking for benchmark datasets.";
}

export function sourceSummary(dataset: LoadedBenchmarkDataset | null): string {
  if (!dataset) return "No benchmark database loaded";
  return dataset.source_url ? `Serving ${dataset.source_label}` : `Loaded local file ${dataset.source_label}`;
}
