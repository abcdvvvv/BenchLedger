import packageJson from "../../package.json";
import { Asset_Base_URL } from "../lib/dashboard";
import type { BenchLedgerAppPages, BenchLedgerAppModel } from "./appModelTypes";
import type { BenchmarkDatasetState } from "./useBenchmarkDatasetState";

export function buildAppPages(state: BenchmarkDatasetState, openLocalFilePicker: () => void): BenchLedgerAppPages {
  const {
    settings,
    setSetting,
    error,
    dataset,
    rows,
    siteTitle,
    siteDescription,
    plotTheme,
    environmentOptions,
    hasDataset,
    overviewSlice,
    trendBoardSlice,
    overviewModel,
    trendBoardModel,
    runPairSort,
    databaseCatalog
  } = state;

  return {
    overview: {
      header: {
        siteTitle,
        siteDescription,
        focusRunId: settings.focusRunId,
        baselineRunId: settings.baselineRunId,
        filteredRuns: overviewModel.filteredRuns,
        onFocusRunChange: (runId) => setSetting("focusRunId", runId),
        onBaselineRunChange: (runId) => setSetting("baselineRunId", runId),
        onOpenLocalFilePicker: openLocalFilePicker,
        downloadUrl: dataset?.source_url ?? null,
        downloadLabel: dataset?.source_label ?? "benchledger.sqlite"
      },
      datasetState: {
        hasLoadedDatabase: Boolean(dataset),
        hasDataset,
        error
      },
      filters: {
        environment: settings.environment,
        environmentOptions,
        onEnvironmentChange: (environment) => setSetting("environment", environment),
        metricKind: settings.metricKind,
        metricOptions: overviewSlice.metricOptions,
        onMetricKindChange: (metricKind) => setSetting("metricKind", metricKind),
        group: settings.group,
        groupOptions: overviewSlice.groupOptions,
        selectedGroupLabel: overviewSlice.selectedGroupLabel,
        onGroupChange: (group) => setSetting("group", group),
        branch: settings.branch,
        branchOptions: overviewSlice.branchOptions,
        onBranchChange: (branch) => setSetting("branch", branch),
        timeRangeLabel: overviewSlice.runsEmptyTimeRangeLabel,
        timeStart: settings.timeStart,
        timeEnd: settings.timeEnd,
        datasetTimeStart: overviewSlice.datasetTimeStart,
        datasetTimeEnd: overviewSlice.datasetTimeEnd,
        onTimeStartChange: (value) => setSetting("timeStart", value),
        onTimeEndChange: (value) => setSetting("timeEnd", value),
        displayStrategy: settings.displayStrategy,
        onDisplayStrategyChange: (strategy) => setSetting("displayStrategy", strategy)
      },
      stats: overviewModel.stats,
      comparison: {
        focusRun: overviewModel.focusRun,
        baselineRun: overviewModel.baselineRun,
        environmentMismatch: overviewModel.environmentMismatch,
        sortedComparisonRows: overviewModel.sortedComparisonRows,
        benchmarkDiffPageSize: settings.benchmarkDiffPageSize,
        onBenchmarkDiffPageSizeChange: (value) => setSetting("benchmarkDiffPageSize", value),
        runPairSort,
        onToggleRunPairSort: overviewModel.toggleRunPairSort
      }
    },
    trendBoard: {
      header: {
        benchmarkOptions: trendBoardSlice.benchmarkOptions,
        selectedBenchmarkIds: settings.trendBoardSelectedBenchmarkIds,
        onSelectedBenchmarkIdsChange: (values) => setSetting("trendBoardSelectedBenchmarkIds", values),
        hasDataset,
        trendBoardColumns: settings.trendBoardColumns,
        onTrendBoardColumnsChange: (value) => setSetting("trendBoardColumns", value),
        trendBoardViewMode: settings.trendBoardViewMode,
        onToggleTrendBoardViewMode: () => setSetting("trendBoardViewMode", settings.trendBoardViewMode === "combined" ? "separate" : "combined"),
        trendAxisMode: settings.trendAxisMode,
        onToggleTrendAxisMode: () => setSetting("trendAxisMode", settings.trendAxisMode === "commit" ? "time" : "commit")
      },
      filters: {
        environment: settings.trendBoardEnvironment,
        environmentOptions,
        onEnvironmentChange: (environment) => setSetting("trendBoardEnvironment", environment),
        metricKind: settings.trendBoardMetricKind,
        metricOptions: trendBoardSlice.metricOptions,
        onMetricKindChange: (metricKind) => setSetting("trendBoardMetricKind", metricKind),
        displayStrategy: settings.trendBoardDisplayStrategy,
        onDisplayStrategyChange: (strategy) => setSetting("trendBoardDisplayStrategy", strategy),
        group: settings.trendBoardGroup,
        groupOptions: trendBoardSlice.groupOptions,
        selectedGroupLabel: trendBoardSlice.selectedGroupLabel,
        onGroupChange: (group) => setSetting("trendBoardGroup", group),
        branch: settings.trendBoardBranch,
        branchOptions: trendBoardSlice.branchOptions,
        onBranchChange: (branch) => setSetting("trendBoardBranch", branch),
        timeRangeLabel: trendBoardSlice.runsEmptyTimeRangeLabel,
        timeStart: settings.trendBoardTimeStart,
        timeEnd: settings.trendBoardTimeEnd,
        datasetTimeStart: trendBoardSlice.datasetTimeStart,
        datasetTimeEnd: trendBoardSlice.datasetTimeEnd,
        onTimeStartChange: (value) => setSetting("trendBoardTimeStart", value),
        onTimeEndChange: (value) => setSetting("trendBoardTimeEnd", value)
      },
      trend: {
        selectedMetricLabel: settings.trendBoardMetricKind,
        trendBoardCards: trendBoardModel.trendBoardCards,
        combinedTrendChart: trendBoardModel.combinedTrendChart,
        showCombinedTrendChart: settings.trendBoardViewMode === "combined",
        trendPlotMargin: trendBoardModel.trendPlotMargin,
        plotTheme
      }
    },
    benchmarkKeys: {
      rows,
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
    overviewModel,
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
    latestRun: overviewModel.latestRun,
    assetBaseUrl: Asset_Base_URL,
    siteTitle
  };
}
