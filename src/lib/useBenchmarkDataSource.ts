import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  loadBenchmarkRowsFromFile,
  loadBenchmarkRowsFromManifestDatabase,
  loadBenchmarkRowsFromUrl,
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
  onSelectedDatabaseIdChange: (databaseId: string) => void;
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
};

function isLocalHost(): boolean {
  const hostname = window.location.hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function datasetSignature(sourceDataset: LoadedBenchmarkDataset): string {
  const lastRow = sourceDataset.rows[sourceDataset.rows.length - 1];
  return [
    sourceDataset.metadata.updated_at,
    sourceDataset.rows.length,
    lastRow?.run_id ?? "",
    lastRow ? sourceDataset.runsById.get(lastRow.run_id)?.measured_at ?? "" : "",
    lastRow?.benchmark_id ?? "",
    lastRow?.value ?? ""
  ].join("|");
}

export function useBenchmarkDataSource(
  options: UseBenchmarkDataSourceOptions
): UseBenchmarkDataSourceResult {
  const { selectedDatabaseId, onSelectedDatabaseIdChange } = options;
  const [dataset, setDataset] = useState<LoadedBenchmarkDataset | null>(null);
  const [manifest, setManifest] = useState<BenchLedgerManifest | null>(null);
  const [manifestUrl, setManifestUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<AppPhase>("booting");
  const loadGenerationRef = useRef(0);

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
      const loadedDataset = await loadBenchmarkRowsFromManifestDatabase(database, activeManifestUrl);
      if (!isCurrentLoadRequest(generation)) return;
      setDataset(loadedDataset);
      onSelectedDatabaseIdChange(database.id);
      setPhase("ready");
    } catch (loadError: unknown) {
      if (!isCurrentLoadRequest(generation)) return;
      setDataset(null);
      setError(loadError instanceof Error ? loadError.message : "Failed to load the selected database.");
      setPhase("select-source");
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
      const loadedDataset = await loadBenchmarkRowsFromFile(file);
      if (!isCurrentLoadRequest(generation)) return;
      setDataset(loadedDataset);
      setPhase("ready");
    } catch (loadError: unknown) {
      if (!isCurrentLoadRequest(generation)) return;
      setDataset(null);
      setError(loadError instanceof Error ? loadError.message : "Failed to load the selected SQLite file.");
      setPhase("select-source");
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
          setPhase("select-source");
          return;
        }
        setManifest(manifestEntry.manifest);
        setManifestUrl(manifestEntry.url);
        const databases = manifestEntry.manifest.databases;
        if (!databases.length) {
          setPhase("select-source");
          return;
        }
        const savedDatabase = databases.find((database) => database.id === selectedDatabaseId);
        if (savedDatabase) {
          await selectManifestDatabase(savedDatabase, manifestEntry.url, generation);
          return;
        }
        if (databases.length === 1) {
          await selectManifestDatabase(databases[0], manifestEntry.url, generation);
          return;
        }
        onSelectedDatabaseIdChange(databases[0].id);
        setPhase("select-source");
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
    if (!dataset?.source_url) return;
    if (phase !== "ready") return;
    if (!isLocalHost()) return;

    let cancelled = false;
    let refreshGeneration = 0;
    const sourceGeneration = loadGenerationRef.current;

    const refreshInterval = window.setInterval(() => {
      const currentRefreshGeneration = ++refreshGeneration;
      void (async () => {
        try {
          const loadedDataset = await loadBenchmarkRowsFromUrl(dataset.source_url!, dataset.source_label);
          if (cancelled) return;
          if (!isCurrentLoadRequest(sourceGeneration)) return;
          if (currentRefreshGeneration !== refreshGeneration) return;
          if (datasetSignature(loadedDataset) === datasetSignature(dataset)) return;
          setDataset(loadedDataset);
          setError("");
        } catch (refreshError) {
          if (
            !cancelled &&
            isCurrentLoadRequest(sourceGeneration) &&
            currentRefreshGeneration === refreshGeneration
          ) {
            console.warn("BenchLedger auto-refresh failed:", refreshError);
          }
        }
      })();
    }, 10000);

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
    handleLocalFileChange
  };
}
