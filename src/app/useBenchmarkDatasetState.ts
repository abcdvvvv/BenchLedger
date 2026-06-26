import { useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  buildRuns,
  databaseDescription,
  databaseTitle,
  metadataDescription,
  metadataTitle,
  plotThemeFor,
  type DatabaseCatalogEntry,
  type DatabaseCatalogStats,
  type RunPairSort
} from "../lib/dashboard";
import { unique } from "../lib/format";
import { useBenchmarkDataSource } from "../lib/useBenchmarkDataSource";
import { useBenchmarkViewSlice } from "../features/benchmarks/useBenchmarkViewSlice";
import { useOverviewModel } from "../features/overview/useOverviewModel";
import { useTrendBoardModel } from "../features/trend-board/useTrendBoardModel";
import { useStoredUISettings } from "./useStoredUISettings";
import type { BenchmarkRun, LoadedBenchmarkDataset } from "../lib/types";

type UseBenchmarkDataSourceRows = ReturnType<typeof useBenchmarkDataSource>["rows"];

export type BenchmarkDatasetState = {
  settings: ReturnType<typeof useStoredUISettings>["settings"];
  setSetting: ReturnType<typeof useStoredUISettings>["setSetting"];
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleLocalFileChange: ReturnType<typeof useBenchmarkDataSource>["handleLocalFileChange"];
  handleDatabaseSelection: ReturnType<typeof useBenchmarkDataSource>["handleDatabaseSelection"];
  phase: ReturnType<typeof useBenchmarkDataSource>["phase"];
  error: string;
  rows: UseBenchmarkDataSourceRows;
  dataset: LoadedBenchmarkDataset | null;
  sourceDatabases: NonNullable<ReturnType<typeof useBenchmarkDataSource>["manifest"]>["databases"];
  currentMetadata: LoadedBenchmarkDataset["metadata"] | null;
  siteTitle: string;
  siteDescription: string;
  plotTheme: ReturnType<typeof plotThemeFor>;
  allRuns: BenchmarkRun[];
  environmentOptions: { value: string; label: string }[];
  hasDataset: boolean;
  overviewSlice: ReturnType<typeof useBenchmarkViewSlice>;
  trendBoardSlice: ReturnType<typeof useBenchmarkViewSlice>;
  overviewModel: ReturnType<typeof useOverviewModel>;
  trendBoardModel: ReturnType<typeof useTrendBoardModel>;
  runPairSort: RunPairSort | null;
  setRunPairSort: React.Dispatch<React.SetStateAction<RunPairSort | null>>;
  databaseCatalog: DatabaseCatalogEntry[];
};

function buildEnvironmentOptions(runs: BenchmarkRun[]): { value: string; label: string }[] {
  const labelsByEnvironmentId = new Map(runs.map((run) => [run.environment_id, run.environment_label || run.environment_id]));
  const countsByLabel = new Map<string, number>();

  for (const label of labelsByEnvironmentId.values()) {
    countsByLabel.set(label, (countsByLabel.get(label) ?? 0) + 1);
  }

  return [{ value: "all", label: "All environments" }, ...Array.from(labelsByEnvironmentId.entries())
    .sort((left, right) => left[1].localeCompare(right[1]) || left[0].localeCompare(right[0]))
    .map(([value, label]) => ({
      value,
      label: (countsByLabel.get(label) ?? 0) > 1 ? `${label} · ${value.slice(0, 12)}` : label
    }))];
}

function buildLoadedDatabaseStats(
  dataset: LoadedBenchmarkDataset | null,
  rows: UseBenchmarkDataSourceRows,
  runs: BenchmarkRun[]
): DatabaseCatalogStats | null {
  if (!dataset) return null;
  return {
    rowCount: rows.length,
    runCount: runs.length,
    keyCount: unique(rows.map((row) => row.benchmark_id)).length,
    environmentCount: unique(rows.map((row) => row.environment_id)).length,
    metrics: unique(rows.map((row) => `${row.metric_name} ${row.statistic} ${row.unit}`)).sort(),
    latestRunDate: runs[0]?.measured_at ?? "",
    dirtyRunCount: runs.filter((run) => Boolean(run.code_state_metadata.source?.dirty)).length
  };
}

function buildDatabaseCatalog(options: {
  sourceDatabases: NonNullable<ReturnType<typeof useBenchmarkDataSource>["manifest"]>["databases"];
  dataset: LoadedBenchmarkDataset | null;
  currentMetadata: LoadedBenchmarkDataset["metadata"] | null;
  loadedDatabaseStats: DatabaseCatalogStats | null;
  selectedDatabaseId: string;
}): DatabaseCatalogEntry[] {
  const {
    sourceDatabases,
    dataset,
    currentMetadata,
    loadedDatabaseStats,
    selectedDatabaseId
  } = options;

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
  return [{
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
  }, ...manifestEntries];
}

export function useBenchmarkDatasetState(): BenchmarkDatasetState {
  const { settings, setSetting } = useStoredUISettings();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
    selectedDatabaseId: settings.selectedDatabaseId,
    onSelectedDatabaseIdChange: (databaseId) => setSetting("selectedDatabaseId", databaseId)
  });

  const allRuns = useMemo(() => buildRuns(rows), [rows]);
  const environmentOptions = useMemo(() => buildEnvironmentOptions(allRuns), [allRuns]);

  const overviewSlice = useBenchmarkViewSlice({
    rows,
    environmentOptions,
    environment: settings.environment,
    onEnvironmentChange: (environment) => setSetting("environment", environment),
    metricKind: settings.metricKind,
    onMetricKindChange: (metricKind) => setSetting("metricKind", metricKind),
    branch: settings.branch,
    onBranchChange: (branch) => setSetting("branch", branch),
    timeStart: settings.timeStart,
    timeEnd: settings.timeEnd,
    displayStrategy: settings.displayStrategy,
    group: settings.group,
    onGroupChange: (group) => setSetting("group", group)
  });

  const trendBoardSlice = useBenchmarkViewSlice({
    rows,
    environmentOptions,
    environment: settings.trendBoardEnvironment,
    onEnvironmentChange: (environment) => setSetting("trendBoardEnvironment", environment),
    metricKind: settings.trendBoardMetricKind,
    onMetricKindChange: (metricKind) => setSetting("trendBoardMetricKind", metricKind),
    branch: settings.trendBoardBranch,
    onBranchChange: (branch) => setSetting("trendBoardBranch", branch),
    timeStart: settings.trendBoardTimeStart,
    timeEnd: settings.trendBoardTimeEnd,
    displayStrategy: settings.trendBoardDisplayStrategy,
    group: settings.trendBoardGroup,
    onGroupChange: (group) => setSetting("trendBoardGroup", group)
  });

  const plotTheme = useMemo(() => plotThemeFor(settings.theme), [settings.theme]);
  const sourceDatabases = manifest?.databases ?? [];
  const currentMetadata = dataset?.metadata ?? null;
  const siteTitle = currentMetadata ? metadataTitle(currentMetadata) : manifest?.site?.title || "BenchLedger";
  const siteDescription = currentMetadata
    ? metadataDescription(currentMetadata)
    : manifest?.site?.description || "Load a benchmark SQLite database to inspect runs and trends.";

  const overviewModel = useOverviewModel({
    rows: overviewSlice.scopedRows,
    benchmarkOptions: overviewSlice.benchmarkOptions,
    selectedBenchmarkIds: settings.overviewSelectedBenchmarkIds,
    onSelectedBenchmarkIdsChange: (values) => setSetting("overviewSelectedBenchmarkIds", values),
    focusRunId: settings.focusRunId,
    onFocusRunIdChange: (runId) => setSetting("focusRunId", runId),
    baselineRunId: settings.baselineRunId,
    onBaselineRunIdChange: (runId) => setSetting("baselineRunId", runId),
    runPairSort,
    onRunPairSortChange: setRunPairSort,
    environment: settings.environment,
    metricKind: settings.metricKind,
    group: settings.group,
    branch: settings.branch,
    timeStart: settings.timeStart,
    timeEnd: settings.timeEnd,
    displayStrategy: settings.displayStrategy,
    trendAxisMode: settings.trendAxisMode,
    trendLineShape: settings.trendLineShape,
    trendMarkerSymbol: settings.trendMarkerSymbol,
    trendMarkerFillMode: settings.trendMarkerFillMode,
    plotTheme,
    theme: settings.theme
  });

  const trendBoardModel = useTrendBoardModel({
    rows: trendBoardSlice.scopedRows,
    benchmarkOptions: trendBoardSlice.benchmarkOptions,
    selectedBenchmarkIds: settings.trendBoardSelectedBenchmarkIds,
    onSelectedBenchmarkIdsChange: (values) => setSetting("trendBoardSelectedBenchmarkIds", values),
    metricKind: settings.trendBoardMetricKind,
    trendAxisMode: settings.trendAxisMode,
    trendLineShape: settings.trendLineShape,
    trendMarkerSymbol: settings.trendMarkerSymbol,
    trendMarkerFillMode: settings.trendMarkerFillMode,
    plotTheme,
    theme: settings.theme
  });

  const loadedDatabaseStats = useMemo(
    () => buildLoadedDatabaseStats(dataset, rows, allRuns),
    [allRuns, dataset, rows]
  );

  const databaseCatalog = useMemo(
    () => buildDatabaseCatalog({
      sourceDatabases,
      dataset,
      currentMetadata,
      loadedDatabaseStats,
      selectedDatabaseId: settings.selectedDatabaseId
    }),
    [currentMetadata, dataset, loadedDatabaseStats, settings.selectedDatabaseId, sourceDatabases]
  );

  return {
    settings,
    setSetting,
    fileInputRef,
    handleLocalFileChange,
    handleDatabaseSelection,
    phase,
    error,
    rows,
    dataset,
    sourceDatabases,
    currentMetadata,
    siteTitle,
    siteDescription,
    plotTheme,
    allRuns,
    environmentOptions,
    hasDataset: Boolean(dataset && rows.length),
    overviewSlice,
    trendBoardSlice,
    overviewModel,
    trendBoardModel,
    runPairSort,
    setRunPairSort,
    databaseCatalog
  };
}
