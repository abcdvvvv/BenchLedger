import { useEffect, useState, type ChangeEvent } from "react";
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
import type { AppPhase } from "./dashboard";

type UseBenchmarkDataSourceOptions = {
  selectedDatabaseId: string;
  onSelectedDatabaseIdChange: (databaseId: string) => void;
};

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
    lastRow?.measured_at ?? "",
    lastRow?.benchmark_id ?? "",
    lastRow?.value ?? ""
  ].join("|");
}

export function useBenchmarkDataSource(
  options: UseBenchmarkDataSourceOptions
): UseBenchmarkDataSourceResult {
  const { selectedDatabaseId, onSelectedDatabaseIdChange } = options;
  const [rows, setRows] = useState<BenchmarkRow[]>([]);
  const [dataset, setDataset] = useState<LoadedBenchmarkDataset | null>(null);
  const [manifest, setManifest] = useState<BenchLedgerManifest | null>(null);
  const [manifestUrl, setManifestUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<AppPhase>("booting");

  async function selectManifestDatabase(
    database: BenchLedgerManifestDatabase,
    activeManifestUrl: string,
    cancelled = false
  ) {
    setPhase("loading-database");
    setError("");
    try {
      const loadedDataset = await loadBenchmarkRowsFromManifestDatabase(database, activeManifestUrl);
      if (cancelled) return;
      setDataset(loadedDataset);
      setRows(loadedDataset.rows);
      onSelectedDatabaseIdChange(database.id);
      setPhase("ready");
    } catch (loadError: unknown) {
      if (cancelled) return;
      setRows([]);
      setDataset(null);
      setError(loadError instanceof Error ? loadError.message : "Failed to load the selected database.");
      setPhase("select-source");
    }
  }

  async function handleDatabaseSelection(databaseId: string) {
    if (!manifest || !manifestUrl) return;
    const database = manifest.databases.find((entry) => entry.id === databaseId);
    if (!database) return;
    await selectManifestDatabase(database, manifestUrl);
  }

  async function handleLocalFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhase("loading-database");
    setError("");
    try {
      const loadedDataset = await loadBenchmarkRowsFromFile(file);
      setDataset(loadedDataset);
      setRows(loadedDataset.rows);
      setPhase("ready");
    } catch (loadError: unknown) {
      setRows([]);
      setDataset(null);
      setError(loadError instanceof Error ? loadError.message : "Failed to load the selected SQLite file.");
      setPhase("select-source");
    } finally {
      event.target.value = "";
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setPhase("booting");
      setError("");
      try {
        const manifestEntry = await loadManifest();
        if (cancelled) return;
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
          await selectManifestDatabase(savedDatabase, manifestEntry.url, cancelled);
          return;
        }
        if (databases.length === 1) {
          await selectManifestDatabase(databases[0], manifestEntry.url, cancelled);
          return;
        }
        onSelectedDatabaseIdChange(databases[0].id);
        setPhase("select-source");
      } catch (loadError: unknown) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to initialize BenchLedger.");
        setPhase("select-source");
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!dataset?.source_url) return;
    if (phase !== "ready") return;
    if (!isLocalHost()) return;

    let cancelled = false;

    const refreshInterval = window.setInterval(() => {
      void (async () => {
        try {
          const loadedDataset = await loadBenchmarkRowsFromUrl(dataset.source_url!, dataset.source_label);
          if (cancelled) return;
          if (datasetSignature(loadedDataset) === datasetSignature(dataset)) return;
          setDataset(loadedDataset);
          setRows(loadedDataset.rows);
          setError("");
        } catch (refreshError) {
          if (!cancelled) console.warn("BenchLedger auto-refresh failed:", refreshError);
        }
      })();
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
    };
  }, [dataset, phase]);

  return {
    rows,
    dataset,
    manifest,
    phase,
    error,
    handleDatabaseSelection,
    handleLocalFileChange
  };
}
