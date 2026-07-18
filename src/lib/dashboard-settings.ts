import { parseDate } from "./format";
import { Trend_Marker_Symbol_Options, type TrendMarkerSymbol } from "./trend-marker-symbols";

export type ThemeMode = "light" | "dark";
export type TrendLineShape = "line" | "curve";
export type TrendMarkerFillMode = "hollow" | "filled";
export type TrendAxisMode = "commit" | "time";
export type TrendBoardViewMode = "separate" | "combined";
export type DisplayStrategy = "all" | "tagged-only" | "tagged-main";
export type ActivePage = "overview" | "trend-board" | "benchmark-keys" | "settings" | "database-catalog" | "about";
export type AppPhase = "booting" | "select-source" | "loading-database" | "ready";
export type RunPairSortKey = "benchmark" | "focus" | "baseline" | "delta";
export type SortDirection = "asc" | "desc";
export type RunPairSort = {
  key: RunPairSortKey;
  direction: SortDirection;
};
export const Benchmark_Diff_Page_Size_Options = [25, 50, 100] as const;
export type BenchmarkDiffPageSize = typeof Benchmark_Diff_Page_Size_Options[number];


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
  trendBoardSelectedBenchmarkIds: string[];
  trendLineShape: TrendLineShape;
  trendMarkerSymbol: TrendMarkerSymbol;
  trendMarkerFillMode: TrendMarkerFillMode;
  trendAxisMode: TrendAxisMode;
  trendBoardColumns: number;
  trendBoardViewMode: TrendBoardViewMode;
  benchmarkDiffPageSize: BenchmarkDiffPageSize;
};

export const UI_SETTINGS_STORAGE_KEY = "benchledger-ui-settings";
export const Trend_Board_Default_Columns = 3;
export const Trend_Board_Min_Columns = 1;
export const Trend_Board_Max_Columns = 10;

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

export function clampBenchmarkDiffPageSize(value: number): BenchmarkDiffPageSize {
  return Benchmark_Diff_Page_Size_Options.includes(value as BenchmarkDiffPageSize)
    ? value as BenchmarkDiffPageSize
    : 50;
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
    trendBoardSelectedBenchmarkIds: [],
    trendLineShape: "curve",
    trendMarkerSymbol: "circle",
    trendMarkerFillMode: "hollow",
    trendAxisMode: "commit",
    trendBoardColumns: Trend_Board_Default_Columns,
    trendBoardViewMode: "separate",
    benchmarkDiffPageSize: 50
  };
  const rawSettings = window.localStorage.getItem(UI_SETTINGS_STORAGE_KEY);
  if (!rawSettings) return defaults;

  try {
    const parsedSettings: unknown = JSON.parse(rawSettings);
    if (!isRecord(parsedSettings)) return defaults;
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
      ),
      trendBoardViewMode:
        parsedSettings.trendBoardViewMode === "combined" || parsedSettings.trendBoardViewMode === "separate"
          ? parsedSettings.trendBoardViewMode
          : defaults.trendBoardViewMode,
      benchmarkDiffPageSize: clampBenchmarkDiffPageSize(
        typeof parsedSettings.benchmarkDiffPageSize === "number"
          ? parsedSettings.benchmarkDiffPageSize
          : defaults.benchmarkDiffPageSize
      )
    };
  } catch {
    return defaults;
  }
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
