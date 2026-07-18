import packageJson from "../../package.json";
import { Asset_Base_URL } from "../lib/dashboard-data";
import type { BenchLedgerAppPages, BenchLedgerAppModel } from "./appModelTypes";
import type { BenchmarkDatasetState } from "./useBenchmarkDatasetState";

export function buildAppPages(state: BenchmarkDatasetState, openLocalFilePicker: () => void): BenchLedgerAppPages {
  const {
    settings,
    setSetting,
    benchmarkDefinitions,
    plotTheme,
    databaseCatalog
  } = state;

  return {
    benchmarkKeys: {
      benchmarks: benchmarkDefinitions,
      plotTheme,
      theme: settings.theme
    },
    settings: {
      trendLineShape: settings.trendLineShape,
      trendMarkerSymbol: settings.trendMarkerSymbol,
      trendMarkerFillMode: settings.trendMarkerFillMode,
      onTrendLineShapeChange: (shape) => setSetting("trendLineShape", shape),
      onTrendMarkerSymbolChange: (symbol) => setSetting("trendMarkerSymbol", symbol),
      onTrendMarkerFillModeChange: (mode) => setSetting("trendMarkerFillMode", mode)
    },
    databases: {
      databaseCatalog,
      onOpenLocalFilePicker: openLocalFilePicker
    },
    about: {
      applicationName: "BenchLedger",
      version: packageJson.version,
      repositoryUrl: "https://github.com/abcdvvvv/BenchLedger"
    }
  };
}

export function buildSidebarProps(state: BenchmarkDatasetState): BenchLedgerAppModel["sidebarProps"] {
  const {
    settings,
    setSetting,
    sourceDatabases,
    dataset,
    currentMetadata,
    latestRun,
    handleDatabaseSelection,
    siteTitle
  } = state;

  return {
    activePage: settings.activePage,
    onPageChange: (page) => setSetting("activePage", page),
    sourceDatabases,
    selectedDatabaseId: settings.selectedDatabaseId,
    onDatabaseChange: handleDatabaseSelection,
    dataset,
    currentMetadata,
    theme: settings.theme,
    onThemeToggle: () => setSetting("theme", settings.theme === "dark" ? "light" : "dark"),
    latestRun,
    assetBaseUrl: Asset_Base_URL,
    siteTitle
  };
}
