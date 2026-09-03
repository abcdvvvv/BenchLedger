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
import { useStoredUISettings } from "./useStoredUISettings";
import { useBenchmarkDimensionSelector, type BenchmarkDimensionSelection } from "./useBenchmarkDimensionSelector";
import type { BenchmarkDefinition, BenchmarkRun, BenchmarkViewCatalog, LoadedBenchmarkDatabase } from "../lib/types";
import type { BenchmarkDatabaseSession } from "../lib/benchmark-database";

const Empty_Benchmarks_By_Key: ReadonlyMap<string, BenchmarkDefinition> = new Map();
const Empty_View_Catalog: BenchmarkViewCatalog = { metricOptions: [], metricSourcesByLabel: new Map(), branchOptions: ["all"], databaseTimeStart: "", databaseTimeEnd: "" };

export type BenchmarkDatabaseState = {
  settings: ReturnType<typeof useStoredUISettings>["settings"];
  setSetting: ReturnType<typeof useStoredUISettings>["setSetting"];
  navigateToPage: ReturnType<typeof useStoredUISettings>["navigateToPage"];
  fileInputRef: RefObject<HTMLInputElement | null>;
  handleLocalFileChange: ReturnType<typeof useBenchmarkDataSource>["handleLocalFileChange"];
  handleDatabaseSelection: ReturnType<typeof useBenchmarkDataSource>["handleDatabaseSelection"];
  phase: ReturnType<typeof useBenchmarkDataSource>["phase"];
  error: string;
  session: BenchmarkDatabaseSession | null;
  database: LoadedBenchmarkDatabase | null;
  benchmarksByKey: ReadonlyMap<string, BenchmarkDefinition>;
  benchmarkDefinitions: BenchmarkDefinition[];
  sourceDatabases: NonNullable<ReturnType<typeof useBenchmarkDataSource>["manifest"]>["databases"];
  currentMetadata: LoadedBenchmarkDatabase["metadata"] | null;
  siteTitle: string;
  siteDescription: string;
  plotTheme: ReturnType<typeof plotThemeFor>;
  allRuns: BenchmarkRun[];
  runsById: ReadonlyMap<string, BenchmarkRun>;
  dimensionSelection: BenchmarkDimensionSelection;
  hasDatabase: boolean;
  benchmarkViewIndex: BenchmarkViewCatalog;
  latestRun: BenchmarkRun | null;
  databaseCatalog: DatabaseCatalogEntry[];
  databaseSourceRevision: number;
};

function buildDatabaseCatalog(options: {
  sourceDatabases: NonNullable<ReturnType<typeof useBenchmarkDataSource>["manifest"]>["databases"];
  database: LoadedBenchmarkDatabase | null;
  currentMetadata: LoadedBenchmarkDatabase["metadata"] | null;
  loadedDatabaseStats: DatabaseCatalogStats | null;
  selectedDatabaseId: string;
}): DatabaseCatalogEntry[] {
  const { sourceDatabases, database, currentMetadata, loadedDatabaseStats, selectedDatabaseId } = options;

  const manifestEntries = sourceDatabases.map((manifestDatabase) => {
    const isActive = Boolean(database?.source_url && selectedDatabaseId === manifestDatabase.id);
    const metadata = isActive ? currentMetadata : null;
    return {
      id: manifestDatabase.id,
      title: metadata ? metadataTitle(metadata) : databaseTitle(manifestDatabase),
      source: "Manifest",
      description: metadata ? metadataDescription(metadata) : databaseDescription(manifestDatabase),
      url: isActive ? database?.source_url ?? manifestDatabase.url : manifestDatabase.url,
      sha256: manifestDatabase.sha256 ?? "",
      sizeBytes: manifestDatabase.size_bytes ?? null,
      packedAt: manifestDatabase.packed_at ?? "",
      schemaVersion: metadata?.schema_version ?? null,
      metadataPreview: metadata?.raw ?? manifestDatabase.metadata_preview ?? {},
      isActive,
      stats: isActive ? loadedDatabaseStats : null
    };
  });

  if (!database || database.source_url) return manifestEntries;
  return [{
    id: "local-sqlite",
    title: metadataTitle(database.metadata),
    source: "Local SQLite",
    description: metadataDescription(database.metadata),
    url: database.source_label,
    sha256: "",
    sizeBytes: null,
    packedAt: "",
    schemaVersion: database.metadata.schema_version,
    metadataPreview: database.metadata.raw,
    isActive: true,
    stats: loadedDatabaseStats
  }, ...manifestEntries];
}

export function useBenchmarkDatabaseState(): BenchmarkDatabaseState {
  const { settings, setSetting, navigateToPage, setDatabaseSource } = useStoredUISettings();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handleSourceStateChange = useCallback(
    (databaseId: string, resetDatabaseScope: boolean) => setDatabaseSource(databaseId, resetDatabaseScope),
    [setDatabaseSource]
  );
  const {
    database,
    session,
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

  const benchmarksByKey = database?.benchmarksByKey ?? Empty_Benchmarks_By_Key;
  const benchmarkDefinitions = useMemo(() => Array.from(benchmarksByKey.values()), [benchmarksByKey]);
  const allRuns = useMemo(() => database ? buildRuns(database) : [], [database]);
  const runsById = useMemo(() => new Map(allRuns.map((run) => [run.run_id, run])), [allRuns]);
  const benchmarkViewIndex = database?.viewCatalog ?? Empty_View_Catalog;
  const dimensionSelection = useBenchmarkDimensionSelector(database, settings, setSetting);

  const plotTheme = useMemo(() => plotThemeFor(settings.theme), [settings.theme]);
  const sourceDatabases = manifest?.databases ?? [];
  const currentMetadata = database?.metadata ?? null;
  const siteTitle = currentMetadata ? metadataTitle(currentMetadata) : manifest?.site?.title || "BenchLedger";
  const siteDescription = currentMetadata
    ? metadataDescription(currentMetadata)
    : manifest?.site?.description || "Load a benchmark SQLite database to inspect runs and trends.";

  const loadedDatabaseStats = useMemo(
    () => buildDatabaseCatalogStats(database),
    [database]
  );

  const databaseCatalog = useMemo(
    () => buildDatabaseCatalog({
      sourceDatabases,
      database,
      currentMetadata,
      loadedDatabaseStats,
      selectedDatabaseId: settings.selectedDatabaseId
    }),
    [currentMetadata, database, loadedDatabaseStats, settings.selectedDatabaseId, sourceDatabases]
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
    session,
    database,
    benchmarksByKey,
    benchmarkDefinitions,
    sourceDatabases,
    currentMetadata,
    siteTitle,
    siteDescription,
    plotTheme,
    allRuns,
    runsById,
    dimensionSelection,
    hasDatabase: Boolean(database && database.stats.rowCount),
    benchmarkViewIndex,
    latestRun: allRuns[0] ?? null,
    databaseCatalog,
    databaseSourceRevision: sourceRevision
  };
}
