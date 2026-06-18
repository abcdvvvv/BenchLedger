import { useEffect, useMemo, useRef, useState } from "react";
import { AppSidebar } from "./components/AppSidebar";
import { BenchmarkKeysPage } from "./components/BenchmarkKeysPage";
import { ChartTuningPage } from "./components/ChartTuningPage";
import { DatabaseCatalogPage } from "./components/DatabaseCatalogPage";
import { OverviewPage } from "./components/OverviewPage";
import { TrendBoardPage } from "./components/TrendBoardPage";
import { unique } from "./lib/format";
import type { TrendMarkerSymbol } from "./lib/trend-marker-symbols";
import {
  Asset_Base_URL,
  buildRuns,
  databaseDescription,
  databaseTitle,
  metadataDescription,
  metadataTitle,
  readUISettings,
  type ActivePage,
  type DatabaseCatalogEntry,
  type DatabaseCatalogStats,
  type DisplayStrategy,
  type PlotTheme,
  type RunPairSort,
  type ThemeMode,
  type TrendAxisMode,
  type TrendLineShape,
  type TrendMarkerFillMode,
  type UISettings
} from "./lib/dashboard";
import { useBenchmarkDataSource } from "./lib/useBenchmarkDataSource";
import { useBenchmarkViewSlice } from "./lib/useBenchmarkViewSlice";
import { useOverviewModel } from "./lib/useOverviewModel";
import { useTrendBoardModel } from "./lib/useTrendBoardModel";

function App() {
  const initialSettings = useMemo(readUISettings, []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activePage, setActivePage] = useState<ActivePage>(initialSettings.activePage);
  const [selectedDatabaseId, setSelectedDatabaseId] = useState(initialSettings.selectedDatabaseId);
  const [theme, setTheme] = useState<ThemeMode>(initialSettings.theme);
  const [machine, setMachine] = useState(initialSettings.machine);
  const [metricKind, setMetricKind] = useState(initialSettings.metricKind);
  const [trendBoardMachine, setTrendBoardMachine] = useState(initialSettings.trendBoardMachine);
  const [trendBoardMetricKind, setTrendBoardMetricKind] = useState(initialSettings.trendBoardMetricKind);
  const [trendBoardDisplayStrategy, setTrendBoardDisplayStrategy] = useState<DisplayStrategy>(initialSettings.trendBoardDisplayStrategy);
  const [focusRunId, setFocusRunId] = useState(initialSettings.focusRunId);
  const [baselineRunId, setBaselineRunId] = useState(initialSettings.baselineRunId);
  const [group, setGroup] = useState(initialSettings.group);
  const [trendBoardGroup, setTrendBoardGroup] = useState(initialSettings.trendBoardGroup);
  const [branch, setBranch] = useState(initialSettings.branch);
  const [trendBoardBranch, setTrendBoardBranch] = useState(initialSettings.trendBoardBranch);
  const [timeStart, setTimeStart] = useState(initialSettings.timeStart);
  const [timeEnd, setTimeEnd] = useState(initialSettings.timeEnd);
  const [trendBoardTimeStart, setTrendBoardTimeStart] = useState(initialSettings.trendBoardTimeStart);
  const [trendBoardTimeEnd, setTrendBoardTimeEnd] = useState(initialSettings.trendBoardTimeEnd);
  const [displayStrategy, setDisplayStrategy] = useState<DisplayStrategy>(initialSettings.displayStrategy);
  const [overviewSelectedBenchmarkIds, setOverviewSelectedBenchmarkIds] = useState(initialSettings.overviewSelectedBenchmarkIds);
  const [trendBoardSelectedBenchmarkIds, setTrendBoardSelectedBenchmarkIds] = useState(initialSettings.trendBoardSelectedBenchmarkIds);
  const [trendLineShape, setTrendLineShape] = useState<TrendLineShape>(initialSettings.trendLineShape);
  const [trendMarkerSymbol, setTrendMarkerSymbol] = useState<TrendMarkerSymbol>(initialSettings.trendMarkerSymbol);
  const [trendMarkerFillMode, setTrendMarkerFillMode] = useState<TrendMarkerFillMode>(initialSettings.trendMarkerFillMode);
  const [trendAxisMode, setTrendAxisMode] = useState<TrendAxisMode>(initialSettings.trendAxisMode);
  const [trendBoardColumns, setTrendBoardColumns] = useState(initialSettings.trendBoardColumns);
  const [runPairSort, setRunPairSort] = useState<RunPairSort | null>(null);
  const {
    rows,
    dataset,
    manifest,
    phase,
    error,
    handleDatabaseSelection,
    handleLocalFileChange
  } = useBenchmarkDataSource({
    selectedDatabaseId,
    onSelectedDatabaseIdChange: setSelectedDatabaseId
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    const settings: UISettings = {
      activePage,
      theme,
      selectedDatabaseId,
      machine,
      metricKind,
      trendBoardMachine,
      trendBoardMetricKind,
      trendBoardDisplayStrategy,
      focusRunId,
      baselineRunId,
      group,
      trendBoardGroup,
      branch,
      trendBoardBranch,
      timeStart,
      timeEnd,
      trendBoardTimeStart,
      trendBoardTimeEnd,
      displayStrategy,
      overviewSelectedBenchmarkIds,
      trendBoardSelectedBenchmarkIds,
      trendLineShape,
      trendMarkerSymbol,
      trendMarkerFillMode,
      trendAxisMode,
      trendBoardColumns
    };
    window.localStorage.setItem("benchledger-ui-settings", JSON.stringify(settings));
  }, [
    activePage,
    baselineRunId,
    branch,
    displayStrategy,
    focusRunId,
    group,
    machine,
    metricKind,
    trendBoardBranch,
    trendBoardDisplayStrategy,
    trendBoardGroup,
    trendBoardMachine,
    trendBoardMetricKind,
    overviewSelectedBenchmarkIds,
    selectedDatabaseId,
    theme,
    timeEnd,
    timeStart,
    trendBoardTimeEnd,
    trendBoardTimeStart,
    trendBoardSelectedBenchmarkIds,
    trendBoardColumns,
    trendAxisMode,
    trendLineShape,
    trendMarkerSymbol,
    trendMarkerFillMode
  ]);

  const allRuns = useMemo(() => buildRuns(rows), [rows]);
  const latestDatabaseRun = allRuns[0] ?? null;
  const machineOptions = useMemo(() => ["all", ...unique(allRuns.map((run) => run.machine_id)).sort()], [allRuns]);
  const overviewSlice = useBenchmarkViewSlice({
    rows,
    machineOptions,
    machine,
    onMachineChange: setMachine,
    metricKind,
    onMetricKindChange: setMetricKind,
    branch,
    onBranchChange: setBranch,
    timeStart,
    timeEnd,
    displayStrategy,
    group,
    onGroupChange: setGroup
  });
  const trendBoardSlice = useBenchmarkViewSlice({
    rows,
    machineOptions,
    machine: trendBoardMachine,
    onMachineChange: setTrendBoardMachine,
    metricKind: trendBoardMetricKind,
    onMetricKindChange: setTrendBoardMetricKind,
    branch: trendBoardBranch,
    onBranchChange: setTrendBoardBranch,
    timeStart: trendBoardTimeStart,
    timeEnd: trendBoardTimeEnd,
    displayStrategy: trendBoardDisplayStrategy,
    group: trendBoardGroup,
    onGroupChange: setTrendBoardGroup
  });

  const plotTheme = useMemo<PlotTheme>(() => {
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
  }, [theme]);

  const sourceDatabases = manifest?.databases ?? [];
  const currentMetadata = dataset?.metadata ?? null;
  const siteTitle = currentMetadata ? metadataTitle(currentMetadata) : manifest?.site?.title || "BenchLedger";
  const siteDescription = currentMetadata ? metadataDescription(currentMetadata) : manifest?.site?.description || "Load a benchmark SQLite database to inspect runs and trends.";

  const overviewModel = useOverviewModel({
    rows: overviewSlice.scopedRows,
    benchmarkOptions: overviewSlice.benchmarkOptions,
    selectedBenchmarkIds: overviewSelectedBenchmarkIds,
    onSelectedBenchmarkIdsChange: setOverviewSelectedBenchmarkIds,
    focusRunId,
    onFocusRunIdChange: setFocusRunId,
    baselineRunId,
    onBaselineRunIdChange: setBaselineRunId,
    runPairSort,
    onRunPairSortChange: setRunPairSort,
    machine,
    metricKind,
    trendAxisMode,
    trendLineShape,
    trendMarkerSymbol,
    trendMarkerFillMode,
    plotTheme,
    theme
  });
  const trendBoardModel = useTrendBoardModel({
    rows: trendBoardSlice.scopedRows,
    benchmarkOptions: trendBoardSlice.benchmarkOptions,
    selectedBenchmarkIds: trendBoardSelectedBenchmarkIds,
    onSelectedBenchmarkIdsChange: setTrendBoardSelectedBenchmarkIds,
    metricKind: trendBoardMetricKind,
    trendAxisMode,
    trendLineShape,
    trendMarkerSymbol,
    trendMarkerFillMode,
    plotTheme,
    theme
  });

  const loadedDatabaseStats = useMemo<DatabaseCatalogStats | null>(() => {
    if (!dataset) return null;
    return {
      rowCount: rows.length,
      runCount: allRuns.length,
      keyCount: unique(rows.map((row) => row.benchmark_id)).length,
      machineCount: unique(rows.map((row) => row.machine_id)).length,
      metrics: unique(rows.map((row) => `${row.metric_name} ${row.statistic} ${row.unit}`)).sort(),
      latestRunDate: latestDatabaseRun?.measured_at ?? "",
      dirtyRunCount: allRuns.filter((run) => run.is_dirty).length
    };
  }, [allRuns, dataset, latestDatabaseRun?.measured_at, rows]);

  const databaseCatalog = useMemo<DatabaseCatalogEntry[]>(() => {
    const manifestEntries = sourceDatabases.map((database) => {
      const isActive = Boolean(dataset?.source_url && selectedDatabaseId === database.id);
      const metadata = isActive ? currentMetadata : null;
      return {
        id: database.id,
        title: metadata ? metadataTitle(metadata) : databaseTitle(database),
        source: "Manifest",
        description: metadata ? metadataDescription(metadata) : databaseDescription(database),
        url: isActive ? dataset?.source_url ?? database.url : database.url,
        sha256: database.sha256 ?? "",
        sizeBytes: database.size_bytes ?? null,
        packedAt: database.packed_at ?? "",
        schemaVersion: metadata?.schema_version ?? database.schema_version ?? null,
        metadataPreview: metadata?.raw ?? database.metadata_preview ?? {},
        isActive,
        stats: isActive ? loadedDatabaseStats : null
      };
    });

    if (!dataset || dataset.source_url) return manifestEntries;
    return [
      {
        id: "local-sqlite",
        title: metadataTitle(dataset.metadata),
        source: "Local SQLite",
        description: metadataDescription(dataset.metadata),
        url: dataset.source_label,
        sha256: "",
        sizeBytes: null,
        packedAt: "",
        schemaVersion: dataset.metadata.schema_version,
        metadataPreview: dataset.metadata.raw,
        isActive: true,
        stats: loadedDatabaseStats
      },
      ...manifestEntries
    ];
  }, [currentMetadata, dataset, loadedDatabaseStats, selectedDatabaseId, sourceDatabases]);

  const hasDataset = Boolean(dataset && rows.length);

  function openLocalFilePicker() {
    fileInputRef.current?.click();
  }

  if (phase === "booting" || phase === "loading-database") {
    return <div className="state-shell">{phase === "booting" ? "Discovering benchmark sources..." : "Loading benchmark database..."}</div>;
  }

  return (
    <div className="dashboard-app">
      <input
        ref={fileInputRef}
        type="file"
        accept=".db,.sqlite,.sqlite3,application/vnd.sqlite3"
        className="visually-hidden"
        onChange={(event) => {
          void handleLocalFileChange(event);
        }}
      />
      <AppSidebar
        activePage={activePage}
        onPageChange={setActivePage}
        sourceDatabases={sourceDatabases}
        selectedDatabaseId={selectedDatabaseId}
        onDatabaseChange={handleDatabaseSelection}
        dataset={dataset}
        currentMetadata={currentMetadata}
        theme={theme}
        onThemeToggle={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        latestRun={overviewModel.latestRun}
        assetBaseUrl={Asset_Base_URL}
        siteTitle={siteTitle}
      />
      <main className="main">
        {activePage === "overview" ? (
          <OverviewPage
            header={{
              siteTitle,
              siteDescription,
              focusRunId,
              baselineRunId,
              filteredRuns: overviewModel.filteredRuns,
              onFocusRunChange: setFocusRunId,
              onBaselineRunChange: setBaselineRunId,
              onOpenLocalFilePicker: openLocalFilePicker,
              downloadUrl: dataset?.source_url ?? null,
              downloadLabel: dataset?.source_label ?? "benchledger.sqlite"
            }}
            datasetState={{
              hasLoadedDatabase: Boolean(dataset),
              hasDataset,
              error
            }}
            filters={{
              machine,
              machineOptions,
              onMachineChange: setMachine,
              metricKind,
              metricOptions: overviewSlice.metricOptions,
              onMetricKindChange: setMetricKind,
              group,
              groupOptions: overviewSlice.groupOptions,
              selectedGroupLabel: overviewSlice.selectedGroupLabel,
              onGroupChange: setGroup,
              branch,
              branchOptions: overviewSlice.branchOptions,
              onBranchChange: setBranch,
              timeRangeLabel: overviewSlice.runsEmptyTimeRangeLabel,
              timeStart,
              timeEnd,
              datasetTimeStart: overviewSlice.datasetTimeStart,
              datasetTimeEnd: overviewSlice.datasetTimeEnd,
              onTimeStartChange: setTimeStart,
              onTimeEndChange: setTimeEnd,
              displayStrategy,
              onDisplayStrategyChange: setDisplayStrategy
            }}
            stats={overviewModel.stats}
            trend={{
              benchmarkOptions: overviewSlice.benchmarkOptions,
              selectedBenchmarkIds: overviewSelectedBenchmarkIds,
              onSelectedBenchmarkIdsChange: setOverviewSelectedBenchmarkIds,
              selectedMetricLabel: overviewModel.trendMetricLabel,
              trendAxisMode,
              onToggleTrendAxisMode: () => setTrendAxisMode((current) => (current === "commit" ? "time" : "commit")),
              trendTraces: overviewModel.trendTraces,
              trendPlotMargin: overviewModel.trendPlotMargin,
              plotTheme
            }}
            comparison={{
              focusRun: overviewModel.focusRun,
              comparisonRows: overviewModel.comparisonRows,
              deltaPlotMargin: overviewModel.deltaPlotMargin,
              sortedComparisonRows: overviewModel.sortedComparisonRows,
              runPairSort,
              onToggleRunPairSort: overviewModel.toggleRunPairSort
            }}
          />
        ) : activePage === "trend-board" ? (
          <TrendBoardPage
            topbar={{
              benchmarkOptions: trendBoardSlice.benchmarkOptions,
              selectedBenchmarkIds: trendBoardSelectedBenchmarkIds,
              onSelectedBenchmarkIdsChange: setTrendBoardSelectedBenchmarkIds,
              hasDataset,
              trendBoardColumns,
              onTrendBoardColumnsChange: setTrendBoardColumns,
              trendAxisMode,
              onToggleTrendAxisMode: () => setTrendAxisMode((current) => (current === "commit" ? "time" : "commit"))
            }}
            filters={{
              machine: trendBoardMachine,
              machineOptions,
              onMachineChange: setTrendBoardMachine,
              metricKind: trendBoardMetricKind,
              metricOptions: trendBoardSlice.metricOptions,
              onMetricKindChange: setTrendBoardMetricKind,
              displayStrategy: trendBoardDisplayStrategy,
              onDisplayStrategyChange: setTrendBoardDisplayStrategy,
              group: trendBoardGroup,
              groupOptions: trendBoardSlice.groupOptions,
              selectedGroupLabel: trendBoardSlice.selectedGroupLabel,
              onGroupChange: setTrendBoardGroup,
              branch: trendBoardBranch,
              branchOptions: trendBoardSlice.branchOptions,
              onBranchChange: setTrendBoardBranch,
              timeRangeLabel: trendBoardSlice.runsEmptyTimeRangeLabel,
              timeStart: trendBoardTimeStart,
              timeEnd: trendBoardTimeEnd,
              datasetTimeStart: trendBoardSlice.datasetTimeStart,
              datasetTimeEnd: trendBoardSlice.datasetTimeEnd,
              onTimeStartChange: setTrendBoardTimeStart,
              onTimeEndChange: setTrendBoardTimeEnd
            }}
            trend={{
              selectedMetricLabel: trendBoardMetricKind,
              trendBoardCards: trendBoardModel.trendBoardCards,
              trendPlotMargin: trendBoardModel.trendPlotMargin,
              plotTheme
            }}
          />
        ) : activePage === "benchmark-keys" ? (
          <BenchmarkKeysPage
            rows={rows}
            plotTheme={plotTheme}
            theme={theme}
          />
        ) : activePage === "settings" ? (
          <ChartTuningPage
            trendLineShape={trendLineShape}
            trendMarkerSymbol={trendMarkerSymbol}
            trendMarkerFillMode={trendMarkerFillMode}
            onTrendLineShapeChange={setTrendLineShape}
            onTrendMarkerSymbolChange={setTrendMarkerSymbol}
            onTrendMarkerFillModeChange={setTrendMarkerFillMode}
          />
        ) : (
          <DatabaseCatalogPage
            databaseCatalog={databaseCatalog}
            onOpenLocalFilePicker={openLocalFilePicker}
          />
        )}
      </main>
    </div>
  );
}

export default App;
