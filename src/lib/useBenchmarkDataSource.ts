import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  loadBenchmarkDatasetFromFile,
  loadBenchmarkDatasetFromManifestDatabase,
  loadBenchmarkDatasetFromUrl,
  loadManifest
} from "./sqlite";
import type {
  BenchmarkRow,
  BenchLedgerManifest,
  BenchLedgerManifestDatabase,
  LoadedBenchmarkDataset
} from "./types";
import type { AppPhase } from "./dashboard-settings";

type UseBenchmarkDataSourceOptions = {
  selectedDatabaseId: string;
  onSourceStateChange: (databaseId: string, resetDatasetScope: boolean) => void;
};

const EMPTY_BENCHMARK_ROWS: BenchmarkRow[] = [];

type UseBenchmarkDataSourceResult = {
  rows: BenchmarkRow[];
  dataset: LoadedBenchmarkDataset | null;
  manifest: BenchLedgerManifest | null;
  phase: AppPhase;
  error: string;
  handleDatabaseSelection: (databaseId: string) => Promise<void>;
  handleLocalFileChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  sourceRevision: number;
};

function isLocalHost(): boolean {
  const hostname = window.location.hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function selectInitialManifestDatabase(
  databases: readonly BenchLedgerManifestDatabase[],
  selectedDatabaseId: string
): BenchLedgerManifestDatabase | null {
  return databases.find((database) => database.id === selectedDatabaseId) ?? databases[0] ?? null;
}

function datasetSignature(sourceDataset: LoadedBenchmarkDataset): string {
  const lastRow = sourceDataset.rows[sourceDataset.rows.length - 1];
  return [
    sourceDataset.metadata.updated_at,
    sourceDataset.rows.length,
    lastRow?.run_id ?? "",
    lastRow ? sourceDataset.runsById.get(lastRow.run_id)?.measured_at ?? "" : "",
    lastRow?.benchmark_key ?? "",
    lastRow?.value ?? ""
  ].join("|");
}

export function useBenchmarkDataSource(
  options: UseBenchmarkDataSourceOptions
): UseBenchmarkDataSourceResult {
  const { selectedDatabaseId, onSourceStateChange } = options;
  const [dataset, setDataset] = useState<LoadedBenchmarkDataset | null>(null);
  const [manifest, setManifest] = useState<BenchLedgerManifest | null>(null);
  const [manifestUrl, setManifestUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<AppPhase>("booting");
  const [sourceRevision, setSourceRevision] = useState(0);
  const loadGenerationRef = useRef(0);
  const loadedSourceKeyRef = useRef(selectedDatabaseId ? `manifest:${selectedDatabaseId}` : "");

  function beginLoadRequest(): number {
    loadGenerationRef.current += 1;
    return loadGenerationRef.current;
  }

  function isCurrentLoadRequest(generation: number): boolean {
    return generation === loadGenerationRef.current;
  }

  async function selectManifestDatabase(
    database: BenchLedgerManifestDatabase,
    activeManifestUrl: string,
    generation = beginLoadRequest()
  ) {
    setPhase("loading-database");
    setError("");
    try {
      const loadedDataset = await loadBenchmarkDatasetFromManifestDatabase(database, activeManifestUrl);
      if (!isCurrentLoadRequest(generation)) return;
      const sourceKey = `manifest:${database.id}`;
      const sourceChanged = loadedSourceKeyRef.current !== sourceKey;
      loadedSourceKeyRef.current = sourceKey;
      onSourceStateChange(database.id, sourceChanged);
      setDataset(loadedDataset);
      setSourceRevision((current) => current + 1);
      setPhase("ready");
    } catch (loadError: unknown) {
      if (!isCurrentLoadRequest(generation)) return;
      setError(loadError instanceof Error ? loadError.message : "Failed to load the selected database.");
      if (dataset) setPhase("ready");
      else {
        onSourceStateChange("", false);
        setPhase("select-source");
      }
    }
  }

  async function handleDatabaseSelection(databaseId: string) {
    if (!manifest || !manifestUrl) return;
    const database = manifest.databases.find((entry) => entry.id === databaseId);
    if (!database) return;
    const generation = beginLoadRequest();
    await selectManifestDatabase(database, manifestUrl, generation);
  }

  async function handleLocalFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const generation = beginLoadRequest();
    setPhase("loading-database");
    setError("");
    try {
      const loadedDataset = await loadBenchmarkDatasetFromFile(file);
      if (!isCurrentLoadRequest(generation)) return;
      loadedSourceKeyRef.current = `local:${generation}`;
      onSourceStateChange("", true);
      setDataset(loadedDataset);
      setSourceRevision((current) => current + 1);
      setPhase("ready");
    } catch (loadError: unknown) {
      if (!isCurrentLoadRequest(generation)) return;
      setError(loadError instanceof Error ? loadError.message : "Failed to load the selected SQLite file.");
      setPhase(dataset ? "ready" : "select-source");
    } finally {
      event.target.value = "";
    }
  }

  useEffect(() => {
    const generation = beginLoadRequest();

    async function boot() {
      setPhase("booting");
      setError("");
      try {
        const manifestEntry = await loadManifest();
        if (!isCurrentLoadRequest(generation)) return;
        if (!manifestEntry) {
          setManifest(null);
          setManifestUrl(null);
          onSourceStateChange("", false);
          setPhase("select-source");
          return;
        }
        setManifest(manifestEntry.manifest);
        setManifestUrl(manifestEntry.url);
        const databases = manifestEntry.manifest.databases;
        if (!databases.length) {
          onSourceStateChange("", false);
          setPhase("select-source");
          return;
        }
        const initialDatabase = selectInitialManifestDatabase(databases, selectedDatabaseId);
        if (!initialDatabase) {
          setPhase("select-source");
          return;
        }
        await selectManifestDatabase(initialDatabase, manifestEntry.url, generation);
      } catch (loadError: unknown) {
        if (!isCurrentLoadRequest(generation)) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to initialize BenchLedger.");
        setPhase("select-source");
      }
    }

    void boot();
    return () => {
      if (isCurrentLoadRequest(generation)) beginLoadRequest();
    };
  }, []);

  useEffect(() => {
    if (!dataset?.source_url || phase !== "ready" || !isLocalHost()) return;

    let cancelled = false;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const loadedDataset = await loadBenchmarkDatasetFromUrl(dataset.source_url!, dataset.source_label);
        if (!cancelled && datasetSignature(loadedDataset) !== datasetSignature(dataset)) {
          setDataset(loadedDataset);
          setError("");
        }
      } catch (refreshError) {
        if (!cancelled) console.warn("BenchLedger auto-refresh failed:", refreshError);
      } finally {
        refreshing = false;
      }
    };
    const refreshInterval = window.setInterval(() => void refresh(), 10000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
    };
  }, [dataset, phase]);

  return {
    rows: dataset?.rows ?? EMPTY_BENCHMARK_ROWS,
    dataset,
    manifest,
    phase,
    error,
    handleDatabaseSelection,
    handleLocalFileChange,
    sourceRevision
  };
}
