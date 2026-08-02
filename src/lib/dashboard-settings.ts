import { parseDate } from "./format";
import { Trend_Marker_Symbol_Options, type TrendMarkerSymbol } from "./trend-marker-symbols";

export type ThemeMode = "light" | "dark";
export type TrendLineShape = "line" | "curve";
export type TrendMarkerFillMode = "hollow" | "filled";
export type TrendAxisMode = "commit" | "time";
export type TrendBoardViewMode = "separate" | "combined";
export type DisplayStrategy = "all" | "tagged-only" | "tagged-main";
export const Active_Pages = [
  "overview",
  "trend-board",
  "compare",
  "benchmark-keys",
  "settings",
  "database-catalog",
  "about"
] as const;
export type ActivePage = typeof Active_Pages[number];
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
  environmentPair: string;
  metricKind: string;
  trendBoardEnvironmentPair: string;
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
  trendBoardSelectedBenchmarkKeys: string[];
  trendLineShape: TrendLineShape;
  trendMarkerSymbol: TrendMarkerSymbol;
  trendMarkerFillMode: TrendMarkerFillMode;
  trendAxisMode: TrendAxisMode;
  trendBoardColumns: number;
  trendBoardViewMode: TrendBoardViewMode;
  benchmarkDiffPageSize: BenchmarkDiffPageSize;
  compareBaselineConfigurationKey: string;
  compareVariableCategory: "" | "code" | "hardware" | "software";
  compareVariableFieldPathIds: string[];
  compareBenchmarkKey: string;
  compareMetricKey: string;
};

export type PersistedUISettings = Omit<
  UISettings,
  | "activePage"
  | "compareBaselineConfigurationKey"
  | "compareVariableCategory"
  | "compareVariableFieldPathIds"
  | "compareBenchmarkKey"
  | "compareMetricKey"
>;

export const UI_SETTINGS_STORAGE_KEY = "benchledger-ui-settings";
export const Trend_Board_Default_Columns = 3;
export const Trend_Board_Min_Columns = 1;
export const Trend_Board_Max_Columns = 10;

const Compare_URL_Keys = [
  "compareBaseline",
  "compareCategory",
  "compareField",
  "compareBenchmark",
  "compareMetric"
] as const;

const URL_Owned_Settings = new Set<keyof UISettings>([
  "activePage",
  "compareBaselineConfigurationKey",
  "compareVariableCategory",
  "compareVariableFieldPathIds",
  "compareBenchmarkKey",
  "compareMetricKey"
]);

function systemTheme(): ThemeMode {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isActivePage(value: unknown): value is ActivePage {
  return typeof value === "string" && Active_Pages.includes(value as ActivePage);
}

function compareCategory(value: unknown): UISettings["compareVariableCategory"] {
  return value === "code" || value === "hardware" || value === "software" ? value : "";
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

export function defaultUISettings(theme: ThemeMode = systemTheme()): UISettings {
  return {
    activePage: "overview",
    theme,
    selectedDatabaseId: "",
    environmentPair: "all",
    metricKind: "",
    trendBoardEnvironmentPair: "all",
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
    trendBoardSelectedBenchmarkKeys: [],
    trendLineShape: "curve",
    trendMarkerSymbol: "circle",
    trendMarkerFillMode: "hollow",
    trendAxisMode: "commit",
    trendBoardColumns: Trend_Board_Default_Columns,
    trendBoardViewMode: "separate",
    benchmarkDiffPageSize: 50,
    compareBaselineConfigurationKey: "",
    compareVariableCategory: "",
    compareVariableFieldPathIds: [],
    compareBenchmarkKey: "",
    compareMetricKey: ""
  };
}

function enumSetting<T extends string>(value: T, options: readonly T[], fallback: T): T {
  return options.includes(value) ? value : fallback;
}

function restoreStoredUISettings(parsed: Record<string, unknown>, defaults: UISettings): UISettings {
  const restored = { ...defaults } as Record<string, unknown>;
  for (const [key, fallback] of Object.entries(defaults)) {
    if (URL_Owned_Settings.has(key as keyof UISettings)) continue;
    const value = parsed[key];
    if (Array.isArray(fallback)) {
      if (Array.isArray(value)) restored[key] = Array.from(new Set(value.filter((item) => typeof item === "string" && item)));
    } else if (typeof value === typeof fallback) {
      restored[key] = value;
    }
  }

  const settings = restored as UISettings;
  return {
    ...settings,
    theme: enumSetting(settings.theme, ["light", "dark"], defaults.theme),
    displayStrategy: enumSetting(settings.displayStrategy, ["all", "tagged-only", "tagged-main"], defaults.displayStrategy),
    trendBoardDisplayStrategy: enumSetting(settings.trendBoardDisplayStrategy, ["all", "tagged-only", "tagged-main"], defaults.trendBoardDisplayStrategy),
    trendLineShape: enumSetting(settings.trendLineShape, ["line", "curve"], defaults.trendLineShape),
    trendMarkerSymbol: Trend_Marker_Symbol_Options.some(({ value }) => value === settings.trendMarkerSymbol)
      ? settings.trendMarkerSymbol
      : defaults.trendMarkerSymbol,
    trendMarkerFillMode: enumSetting(settings.trendMarkerFillMode, ["hollow", "filled"], defaults.trendMarkerFillMode),
    trendAxisMode: enumSetting(settings.trendAxisMode, ["commit", "time"], defaults.trendAxisMode),
    trendBoardViewMode: enumSetting(settings.trendBoardViewMode, ["separate", "combined"], defaults.trendBoardViewMode),
    trendBoardColumns: clampTrendBoardColumns(settings.trendBoardColumns),
    benchmarkDiffPageSize: clampBenchmarkDiffPageSize(settings.benchmarkDiffPageSize)
  };
}

export function settingsWithURLState(settings: UISettings, search: string): UISettings {
  const params = new URLSearchParams(search);
  const pageValue = params.get("page");
  const activePage = pageValue === null || pageValue === "" ? "overview" : isActivePage(pageValue) ? pageValue : "overview";
  if (activePage !== "compare") {
    return activePage === settings.activePage ? settings : { ...settings, activePage };
  }

  return {
    ...settings,
    activePage,
    compareBaselineConfigurationKey: params.get("compareBaseline") ?? "",
    compareVariableCategory: compareCategory(params.get("compareCategory")),
    compareVariableFieldPathIds: Array.from(new Set(params.getAll("compareField").filter(Boolean))),
    compareBenchmarkKey: params.get("compareBenchmark") ?? "",
    compareMetricKey: params.get("compareMetric") ?? ""
  };
}

export function buildUISettingsURL(settings: UISettings, currentHref: string): string {
  const url = new URL(currentHref, "https://benchledger.invalid/");
  if (settings.activePage === "overview") url.searchParams.delete("page");
  else url.searchParams.set("page", settings.activePage);

  for (const key of Compare_URL_Keys) url.searchParams.delete(key);
  if (settings.activePage === "compare") {
    if (settings.compareBaselineConfigurationKey) {
      url.searchParams.set("compareBaseline", settings.compareBaselineConfigurationKey);
    }
    if (settings.compareVariableCategory) {
      url.searchParams.set("compareCategory", settings.compareVariableCategory);
    }
    for (const pathId of Array.from(new Set(settings.compareVariableFieldPathIds.filter(Boolean)))) {
      url.searchParams.append("compareField", pathId);
    }
    if (settings.compareBenchmarkKey) {
      url.searchParams.set("compareBenchmark", settings.compareBenchmarkKey);
    }
    if (settings.compareMetricKey) {
      url.searchParams.set("compareMetric", settings.compareMetricKey);
    }
  }

  return `${url.pathname}${url.search}${url.hash}`;
}

export function persistedUISettings(settings: UISettings): PersistedUISettings {
  return Object.fromEntries(
    Object.entries(settings).filter(([key]) => !URL_Owned_Settings.has(key as keyof UISettings))
  ) as PersistedUISettings;
}

export function settingsForDatasetSource(settings: UISettings, selectedDatabaseId: string): UISettings {
  return {
    ...settings,
    selectedDatabaseId,
    environmentPair: "all",
    metricKind: "",
    focusRunId: "",
    baselineRunId: "",
    group: "all",
    branch: "all",
    timeStart: "",
    timeEnd: "",
    trendBoardEnvironmentPair: "all",
    trendBoardMetricKind: "",
    trendBoardGroup: "all",
    trendBoardBranch: "all",
    trendBoardTimeStart: "",
    trendBoardTimeEnd: "",
    trendBoardSelectedBenchmarkKeys: [],
    compareBaselineConfigurationKey: "",
    compareVariableCategory: "",
    compareVariableFieldPathIds: [],
    compareBenchmarkKey: "",
    compareMetricKey: ""
  };
}

export function readUISettings(): UISettings {
  const defaults = defaultUISettings();
  let restored = defaults;
  if (typeof window !== "undefined") {
    try {
      const parsed: unknown = JSON.parse(window.localStorage.getItem(UI_SETTINGS_STORAGE_KEY) ?? "null");
      if (isRecord(parsed)) restored = restoreStoredUISettings(parsed, defaults);
    } catch {
      // Storage is optional; malformed or blocked data falls back to defaults.
    }
    return settingsWithURLState(restored, window.location.search);
  }
  return restored;
}

export function dateInputValue(value: string): string {
  const date = parseDate(value);
  if (!date) return "";
  return date.toISOString().slice(0, 10);
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
