import { parseDate } from "./format";
import { isRecord } from "./object";
import { Trend_Marker_Symbol_Options, type TrendMarkerSymbol } from "./trend-marker-symbols";
import { normalizeDimensionValueSelections, type DimensionValueSelection } from "./dimension-selector";

export type ThemeMode = "light" | "dark";
export type TrendLineShape = "line" | "curve";
export type TrendMarkerFillMode = "hollow" | "filled";
export type TrendBoardViewMode = "separate" | "combined";
export type DisplayStrategy = "all" | "tagged-only" | "tagged-main";
export const Active_Pages = [
  "overview",
  "trend-board",
  "dimension-selector",
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
  varyingDimensionKeys: string[] | null;
  dimensionValueSelections: DimensionValueSelection[];
  yAxis: string;
  selectedBenchmarkKeys: string[];
  trendBoardDisplayStrategy: DisplayStrategy;
  focusPointKey: string;
  baselinePointKey: string;
  branch: string;
  trendBoardBranch: string;
  timeStart: string;
  timeEnd: string;
  trendBoardTimeStart: string;
  trendBoardTimeEnd: string;
  displayStrategy: DisplayStrategy;
  trendLineShape: TrendLineShape;
  trendMarkerSymbol: TrendMarkerSymbol;
  trendMarkerFillMode: TrendMarkerFillMode;
  trendBoardColumns: number;
  trendBoardViewMode: TrendBoardViewMode;
  benchmarkDiffPageSize: BenchmarkDiffPageSize;
};

export type PersistedUISettings = Omit<UISettings, "activePage">;

export const UI_SETTINGS_STORAGE_KEY = "benchledger-ui-settings";
export const Trend_Board_Default_Columns = 3;
export const Trend_Board_Min_Columns = 1;
export const Trend_Board_Max_Columns = 10;

const URL_Owned_Settings = new Set<keyof UISettings>(["activePage"]);

function systemTheme(): ThemeMode {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function isActivePage(value: unknown): value is ActivePage {
  return typeof value === "string" && Active_Pages.includes(value as ActivePage);
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
    varyingDimensionKeys: null,
    dimensionValueSelections: [],
    yAxis: "",
    selectedBenchmarkKeys: [],
    trendBoardDisplayStrategy: "all",
    focusPointKey: "",
    baselinePointKey: "",
    branch: "all",
    trendBoardBranch: "all",
    timeStart: "",
    timeEnd: "",
    trendBoardTimeStart: "",
    trendBoardTimeEnd: "",
    displayStrategy: "all",
    trendLineShape: "curve",
    trendMarkerSymbol: "circle",
    trendMarkerFillMode: "hollow",
    trendBoardColumns: Trend_Board_Default_Columns,
    trendBoardViewMode: "separate",
    benchmarkDiffPageSize: 50
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
    if (key === "varyingDimensionKeys") {
      if (Array.isArray(value)) restored[key] = Array.from(new Set(value.filter((item): item is string => typeof item === "string" && item.length > 0)));
      else if (typeof parsed.varyingDimensionKey === "string" && parsed.varyingDimensionKey) restored[key] = [parsed.varyingDimensionKey];
    } else if (Array.isArray(fallback)) {
      if (Array.isArray(value)) restored[key] = key === "dimensionValueSelections" ? normalizeDimensionValueSelections(value) : Array.from(new Set(value.filter((item) => typeof item === "string" && item.length > 0)));
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
    trendBoardViewMode: enumSetting(settings.trendBoardViewMode, ["separate", "combined"], defaults.trendBoardViewMode),
    trendBoardColumns: clampTrendBoardColumns(settings.trendBoardColumns),
    benchmarkDiffPageSize: clampBenchmarkDiffPageSize(settings.benchmarkDiffPageSize)
  };
}

export function settingsWithURLState(settings: UISettings, search: string): UISettings {
  const params = new URLSearchParams(search);
  const pageValue = params.get("page");
  const activePage = pageValue === null || pageValue === "" ? "overview" : isActivePage(pageValue) ? pageValue : "overview";
  return activePage === settings.activePage ? settings : { ...settings, activePage };
}

export function buildUISettingsURL(settings: UISettings, currentHref: string): string {
  const url = new URL(currentHref, "https://benchledger.invalid/");
  if (settings.activePage === "overview") url.searchParams.delete("page");
  else url.searchParams.set("page", settings.activePage);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function persistedUISettings(settings: UISettings): PersistedUISettings {
  return Object.fromEntries(
    Object.entries(settings).filter(([key]) => !URL_Owned_Settings.has(key as keyof UISettings))
  ) as PersistedUISettings;
}

export function settingsForDatabaseSource(settings: UISettings, selectedDatabaseId: string): UISettings {
  return { ...settings, selectedDatabaseId, dimensionValueSelections: [], yAxis: "", selectedBenchmarkKeys: [], focusPointKey: "", baselinePointKey: "", branch: "all", timeStart: "", timeEnd: "", trendBoardBranch: "all", trendBoardTimeStart: "", trendBoardTimeEnd: "" };
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
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) ? null : date.valueOf();
}

export function dateRangeEnd(value: string): number | null {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(date.valueOf()) ? null : date.valueOf();
}
