import { schemeTableau10 } from "d3-scale-chromatic";
import { formatDate, formatMetricValue, parseDate, shortCommit } from "./format";
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
export type TrendAxisMode = "commit" | "time";
export type DisplayStrategy = "all" | "tagged-only" | "tagged-main";
export type ActivePage = "overview" | "trend-board" | "benchmark-keys" | "chart-tuning" | "database-catalog";
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
  machineCount: number;
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
  machine: string;
  metricKind: string;
  trendBoardMachine: string;
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

export const UI_SETTINGS_STORAGE_KEY = "benchledger-ui-settings";
export const Trend_Y_Padding_Ratio = 0.08;
export const Trend_Board_Default_Columns = 3;
export const Trend_Board_Min_Columns = 1;
export const Trend_Board_Max_Columns = 10;
export const Trend_Board_Plot_Height = 280;
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

export function colorForBenchmark(index: number): string {
  return _Trend_Categorical_Colors[index % _Trend_Categorical_Colors.length];
}

export function metricKey(row: Pick<BenchmarkRow, "metric_name" | "statistic" | "unit">): string {
  return `${row.metric_name}::${row.statistic}::${row.unit}`;
}

export function isPrimaryMetric(row: Pick<BenchmarkRow, "metric_name" | "statistic" | "unit">): boolean {
  return row.metric_name === "time" &&
    row.statistic === "median" &&
    row.unit === "ns";
}

export function metricLabel(row: Pick<BenchmarkRow, "metric_name" | "statistic" | "unit">): string {
  return `${row.metric_name} ${row.statistic} ${row.unit}`;
}

export function buildTrendTrace(
  rows: TrendPlotRow[],
  options: {
    axisMode: TrendAxisMode;
    lineShape: TrendLineShape;
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
  const y = rows.map((row) => row.value);
  const unit = rows[0]?.unit ?? "";
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
      customdata: rows.map((row) => [row.code_date, row.measured_at, formatMetricValue(row.value, row.unit)]),
      line: {
        color,
        width: 2.5,
        shape: lineShape === "curve" ? "spline" : "linear",
        smoothing: lineShape === "curve" ? 0.75 : 0
      },
      marker: {
        size: 8,
        color: plotTheme.plot,
        line: { color, width: 2.5 }
      },
      fill: "tonexty",
      fillgradient: {
        type: "vertical",
        colorscale
      },
      hovertemplate: `%{x}<br>Code date: %{customdata[0]}<br>Measured: %{customdata[1]}<br>Value: %{customdata[2]}<br>Unit: ${unit || "n/a"}<extra></extra>`,
      showlegend: showLegend
    }
  ];
}

export function readUISettings(): UISettings {
  const defaults: UISettings = {
    activePage: "overview",
    theme: systemTheme(),
    selectedDatabaseId: "",
    machine: "all",
    metricKind: "",
    trendBoardMachine: "all",
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
        parsedSettings.activePage === "chart-tuning" ||
        parsedSettings.activePage === "database-catalog"
          ? parsedSettings.activePage
          : defaults.activePage,
      theme: parsedSettings.theme === "light" || parsedSettings.theme === "dark" ? parsedSettings.theme : defaults.theme,
      selectedDatabaseId: stringSetting(parsedSettings, "selectedDatabaseId"),
      machine: stringSetting(parsedSettings, "machine"),
      metricKind: stringSetting(parsedSettings, "metricKind"),
      trendBoardMachine: stringSetting(parsedSettings, "trendBoardMachine"),
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
  if (run.tag) return run.tag;
  if (run.label) return run.label;
  if (run.commit_sha) return shortCommit(run.commit_sha);
  return run.branch || "local";
}

export function runTone(run: BenchmarkRun): "tag" | "master" | "branch" {
  if (run.tag) return "tag";
  if (run.branch === "master") return "master";
  return "branch";
}

export function runAxisLabel(row: BenchmarkRow): string {
  if (row.tag) return row.tag;
  if (row.commit_sha) return shortCommit(row.commit_sha);
  return "local";
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
  if (row.tag) return true;
  return strategy === "tagged-main" && (row.branch === "main" || row.branch === "master");
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
      branch: row.branch,
      tag: row.tag,
      label: row.label,
      commit_sha: row.commit_sha,
      code_date: row.code_date,
      measured_at: row.measured_at,
      machine_id: row.machine_id,
      cpu_model: row.cpu_model,
      cpu_threads: row.cpu_threads,
      arch: row.arch,
      os: row.os,
      julia_version: row.julia_version,
      is_dirty: row.is_dirty,
      notes: row.notes,
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
