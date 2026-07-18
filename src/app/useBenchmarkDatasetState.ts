import { useMemo, useRef } from "react";
import type { RefObject } from "react";
import {
  buildRuns,
  databaseDescription,
  databaseTitle,
  metadataDescription,
  metadataTitle,
  type DatabaseCatalogEntry,
  type DatabaseCatalogStats
} from "../lib/dashboard-data";
import { plotThemeFor } from "../lib/dashboard-plotting";
import { unique } from "../lib/format";
import { useBenchmarkDataSource } from "../lib/useBenchmarkDataSource";
import { buildBenchmarkViewIndex } from "../lib/benchmark-view";
import { useStoredUISettings } from "./useStoredUISettings";
import type { BenchmarkDefinition, BenchmarkRun, LoadedBenchmarkDataset } from "../lib/types";


const Empty_Benchmarks_By_Id: ReadonlyMap<string, BenchmarkDefinition> = new Map();

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
  benchmarksById: ReadonlyMap<string, BenchmarkDefinition>;
  benchmarkDefinitions: BenchmarkDefinition[];
  sourceDatabases: NonNullable<ReturnType<typeof useBenchmarkDataSource>["manifest"]>["databases"];
  currentMetadata: LoadedBenchmarkDataset["metadata"] | null;
  siteTitle: string;
  siteDescription: string;
  plotTheme: ReturnType<typeof plotThemeFor>;
  allRuns: BenchmarkRun[];
  runsById: ReadonlyMap<string, BenchmarkRun>;
  environmentOptions: { value: string; label: string }[];
  hasDataset: boolean;
  benchmarkViewIndex: ReturnType<typeof buildBenchmarkViewIndex>;
  latestRun: BenchmarkRun | null;
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
    keyCount: dataset.benchmarksById.size,
    environmentCount: unique(runs.map((run) => run.environment_id)).length,
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

  const benchmarksById = dataset?.benchmarksById ?? Empty_Benchmarks_By_Id;
  const benchmarkDefinitions = useMemo(() => Array.from(benchmarksById.values()), [benchmarksById]);
  const allRuns = useMemo(() => dataset ? buildRuns(dataset) : [], [dataset]);
  const runsById = useMemo(() => new Map(allRuns.map((run) => [run.run_id, run])), [allRuns]);
  const benchmarkViewIndex = useMemo(
    () => buildBenchmarkViewIndex(rows, runsById, benchmarksById),
    [benchmarksById, rows, runsById]
  );
  const environmentOptions = useMemo(() => buildEnvironmentOptions(allRuns), [allRuns]);

  const plotTheme = useMemo(() => plotThemeFor(settings.theme), [settings.theme]);
  const sourceDatabases = manifest?.databases ?? [];
  const currentMetadata = dataset?.metadata ?? null;
  const siteTitle = currentMetadata ? metadataTitle(currentMetadata) : manifest?.site?.title || "BenchLedger";
  const siteDescription = currentMetadata
    ? metadataDescription(currentMetadata)
    : manifest?.site?.description || "Load a benchmark SQLite database to inspect runs and trends.";

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
    benchmarksById,
    benchmarkDefinitions,
    sourceDatabases,
    currentMetadata,
    siteTitle,
    siteDescription,
    plotTheme,
    allRuns,
    runsById,
    environmentOptions,
    hasDataset: Boolean(dataset && rows.length),
    benchmarkViewIndex,
    latestRun: allRuns[0] ?? null,
    databaseCatalog
  };
}
