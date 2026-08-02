import { useCallback, useMemo, useRef } from "react";
import type { RefObject } from "react";
import {
  buildDatabaseCatalogStats,
  buildRuns,
  databaseDescription,
  databaseTitle,
  metadataDescription,
  metadataTitle,
  type DatabaseCatalogEntry,
  type DatabaseCatalogStats
} from "../lib/dashboard-data";
import { plotThemeFor } from "../lib/dashboard-plotting";
import { useBenchmarkDataSource } from "../lib/useBenchmarkDataSource";
import { buildBenchmarkViewIndex } from "../lib/benchmark-view";
import { useStoredUISettings } from "./useStoredUISettings";
import type { BenchmarkAggregateRow, BenchmarkDefinition, BenchmarkRun, LoadedBenchmarkDataset } from "../lib/types";

const Empty_Benchmarks_By_Key: ReadonlyMap<string, BenchmarkDefinition> = new Map();
const Empty_Aggregate_Rows: BenchmarkAggregateRow[] = [];

type UseBenchmarkDataSourceRows = ReturnType<typeof useBenchmarkDataSource>["rows"];

export type BenchmarkDatasetState = {
  settings: ReturnType<typeof useStoredUISettings>["settings"];
  setSetting: ReturnType<typeof useStoredUISettings>["setSetting"];
  navigateToPage: ReturnType<typeof useStoredUISettings>["navigateToPage"];
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleLocalFileChange: ReturnType<typeof useBenchmarkDataSource>["handleLocalFileChange"];
  handleDatabaseSelection: ReturnType<typeof useBenchmarkDataSource>["handleDatabaseSelection"];
  phase: ReturnType<typeof useBenchmarkDataSource>["phase"];
  error: string;
  rows: UseBenchmarkDataSourceRows;
  aggregateRows: BenchmarkAggregateRow[];
  dataset: LoadedBenchmarkDataset | null;
  benchmarksByKey: ReadonlyMap<string, BenchmarkDefinition>;
  benchmarkDefinitions: BenchmarkDefinition[];
  sourceDatabases: NonNullable<ReturnType<typeof useBenchmarkDataSource>["manifest"]>["databases"];
  currentMetadata: LoadedBenchmarkDataset["metadata"] | null;
  siteTitle: string;
  siteDescription: string;
  plotTheme: ReturnType<typeof plotThemeFor>;
  allRuns: BenchmarkRun[];
  runsById: ReadonlyMap<string, BenchmarkRun>;
  environmentPairOptions: { value: string; label: string }[];
  hasDataset: boolean;
  benchmarkViewIndex: ReturnType<typeof buildBenchmarkViewIndex>;
  latestRun: BenchmarkRun | null;
  databaseCatalog: DatabaseCatalogEntry[];
  datasetSourceRevision: number;
};

function buildEnvironmentPairOptions(runs: BenchmarkRun[]): { value: string; label: string }[] {
  const entries = Array.from(new Map(
    runs.map((run) => [run.environment_pair_key, run.environment_pair_label])
  ).entries()).sort((left, right) => left[1].localeCompare(right[1]) || left[0].localeCompare(right[0]));
  return [
    { value: "all", label: "All hardware + software pairs" },
    ...entries.map(([value, label]) => ({ value, label }))
  ];
}

function buildDatabaseCatalog(options: {
  sourceDatabases: NonNullable<ReturnType<typeof useBenchmarkDataSource>["manifest"]>["databases"];
  dataset: LoadedBenchmarkDataset | null;
  currentMetadata: LoadedBenchmarkDataset["metadata"] | null;
  loadedDatabaseStats: DatabaseCatalogStats | null;
  selectedDatabaseId: string;
}): DatabaseCatalogEntry[] {
  const { sourceDatabases, dataset, currentMetadata, loadedDatabaseStats, selectedDatabaseId } = options;

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
      schemaVersion: metadata?.schema_version ?? null,
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
  const { settings, setSetting, navigateToPage, setDatasetSource } = useStoredUISettings();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handleSourceStateChange = useCallback(
    (databaseId: string, resetDatasetScope: boolean) => setDatasetSource(databaseId, resetDatasetScope),
    [setDatasetSource]
  );
  const {
    rows,
    dataset,
    manifest,
    phase,
    error,
    handleDatabaseSelection,
    handleLocalFileChange,
    sourceRevision
  } = useBenchmarkDataSource({
    selectedDatabaseId: settings.selectedDatabaseId,
    onSourceStateChange: handleSourceStateChange
  });

  const benchmarksByKey = dataset?.benchmarksByKey ?? Empty_Benchmarks_By_Key;
  const aggregateRows = dataset?.aggregateRows ?? Empty_Aggregate_Rows;
  const benchmarkDefinitions = useMemo(() => Array.from(benchmarksByKey.values()), [benchmarksByKey]);
  const allRuns = useMemo(() => dataset ? buildRuns(dataset) : [], [dataset]);
  const runsById = useMemo(() => new Map(allRuns.map((run) => [run.run_id, run])), [allRuns]);
  const benchmarkViewIndex = useMemo(
    () => buildBenchmarkViewIndex(rows, runsById, benchmarksByKey),
    [benchmarksByKey, rows, runsById]
  );
  const environmentPairOptions = useMemo(() => buildEnvironmentPairOptions(allRuns), [allRuns]);

  const plotTheme = useMemo(() => plotThemeFor(settings.theme), [settings.theme]);
  const sourceDatabases = manifest?.databases ?? [];
  const currentMetadata = dataset?.metadata ?? null;
  const siteTitle = currentMetadata ? metadataTitle(currentMetadata) : manifest?.site?.title || "BenchLedger";
  const siteDescription = currentMetadata
    ? metadataDescription(currentMetadata)
    : manifest?.site?.description || "Load a benchmark SQLite database to inspect runs and trends.";

  const loadedDatabaseStats = useMemo(
    () => buildDatabaseCatalogStats(dataset, rows, allRuns),
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
    navigateToPage,
    fileInputRef,
    handleLocalFileChange,
    handleDatabaseSelection,
    phase,
    error,
    rows,
    aggregateRows,
    dataset,
    benchmarksByKey,
    benchmarkDefinitions,
    sourceDatabases,
    currentMetadata,
    siteTitle,
    siteDescription,
    plotTheme,
    allRuns,
    runsById,
    environmentPairOptions,
    hasDataset: Boolean(dataset && rows.length),
    benchmarkViewIndex,
    latestRun: allRuns[0] ?? null,
    databaseCatalog,
    datasetSourceRevision: sourceRevision
  };
}
