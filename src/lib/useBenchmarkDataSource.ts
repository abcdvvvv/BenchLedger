import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { BenchmarkDatabaseSession } from "./benchmark-database";
import { assertLocalDatabaseSize, loadManifest, loadManifestDatabaseFile, refreshDatabaseFileFromUrl } from "./sqlite";
import type { BenchLedgerManifest, BenchLedgerManifestDatabase, LoadedBenchmarkDatabase } from "./types";
import type { AppPhase } from "./dashboard-settings";

type UseBenchmarkDataSourceOptions = { selectedDatabaseId: string; onSourceStateChange: (databaseId: string, resetDatabaseScope: boolean) => void; };
type UseBenchmarkDataSourceResult = {
  database: LoadedBenchmarkDatabase | null;
  session: BenchmarkDatabaseSession | null;
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

function selectInitialManifestDatabase(databases: readonly BenchLedgerManifestDatabase[], selectedDatabaseId: string): BenchLedgerManifestDatabase | null {
  return databases.find((database) => database.id === selectedDatabaseId) ?? databases[0] ?? null;
}

export function useBenchmarkDataSource(options: UseBenchmarkDataSourceOptions): UseBenchmarkDataSourceResult {
  const { selectedDatabaseId, onSourceStateChange } = options;
  const [database, setDatabase] = useState<LoadedBenchmarkDatabase | null>(null);
  const [session, setSession] = useState<BenchmarkDatabaseSession | null>(null);
  const [manifest, setManifest] = useState<BenchLedgerManifest | null>(null);
  const [manifestUrl, setManifestUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<AppPhase>("booting");
  const [sourceRevision, setSourceRevision] = useState(0);
  const sessionRef = useRef<BenchmarkDatabaseSession | null>(null);
  const loadGenerationRef = useRef(0);
  const loadAbortControllerRef = useRef<AbortController | null>(null);
  const loadedSourceKeyRef = useRef(selectedDatabaseId ? `manifest:${selectedDatabaseId}` : "");

  function getSession(): BenchmarkDatabaseSession {
    if (sessionRef.current) return sessionRef.current;
    const created = new BenchmarkDatabaseSession();
    sessionRef.current = created;
    setSession(created);
    return created;
  }

  function beginLoadRequest(): number {
    loadAbortControllerRef.current?.abort();
    loadAbortControllerRef.current = new AbortController();
    loadGenerationRef.current += 1;
    return loadGenerationRef.current;
  }

  function isCurrentLoadRequest(generation: number): boolean {
    return generation === loadGenerationRef.current;
  }

  async function selectManifestDatabase(databaseEntry: BenchLedgerManifestDatabase, activeManifestUrl: string, generation = beginLoadRequest()) {
    setPhase("loading-database");
    setError("");
    try {
      const source = await loadManifestDatabaseFile(databaseEntry, activeManifestUrl, loadAbortControllerRef.current?.signal);
      if (!isCurrentLoadRequest(generation)) return;
      const loadedDatabase = await getSession().replaceDatabaseFile(source.bytes, source.sourceLabel, source.sourceUrl);
      if (!isCurrentLoadRequest(generation)) return;
      const sourceKey = `manifest:${databaseEntry.id}`;
      const sourceChanged = loadedSourceKeyRef.current !== sourceKey;
      loadedSourceKeyRef.current = sourceKey;
      onSourceStateChange(databaseEntry.id, sourceChanged);
      setDatabase(loadedDatabase);
      setSourceRevision((current) => current + 1);
      setPhase("ready");
    } catch (loadError: unknown) {
      if (!isCurrentLoadRequest(generation)) return;
      setError(loadError instanceof Error ? loadError.message : "Failed to load the selected database.");
      if (database) setPhase("ready");
      else { onSourceStateChange("", false); setPhase("select-source"); }
    }
  }

  async function handleDatabaseSelection(databaseId: string) {
    if (!manifest || !manifestUrl) return;
    const databaseEntry = manifest.databases.find((entry) => entry.id === databaseId);
    if (!databaseEntry) return;
    await selectManifestDatabase(databaseEntry, manifestUrl, beginLoadRequest());
  }

  async function handleLocalFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const generation = beginLoadRequest();
    setPhase("loading-database");
    setError("");
    try {
      assertLocalDatabaseSize(file);
      const loadedDatabase = await getSession().replaceDatabaseFile(file, file.name, null);
      if (!isCurrentLoadRequest(generation)) return;
      loadedSourceKeyRef.current = `local:${generation}`;
      onSourceStateChange("", true);
      setDatabase(loadedDatabase);
      setSourceRevision((current) => current + 1);
      setPhase("ready");
    } catch (loadError: unknown) {
      if (!isCurrentLoadRequest(generation)) return;
      setError(loadError instanceof Error ? loadError.message : "Failed to load the selected SQLite file.");
      setPhase(database ? "ready" : "select-source");
    } finally {
      event.target.value = "";
    }
  }

  useEffect(() => {
    const generation = beginLoadRequest();
    async function boot() {
      setPhase("booting"); setError("");
      try {
        const manifestEntry = await loadManifest(undefined, loadAbortControllerRef.current?.signal);
        if (!isCurrentLoadRequest(generation)) return;
        if (!manifestEntry) { setManifest(null); setManifestUrl(null); onSourceStateChange("", false); setPhase("select-source"); return; }
        setManifest(manifestEntry.manifest); setManifestUrl(manifestEntry.url);
        const initialDatabase = selectInitialManifestDatabase(manifestEntry.manifest.databases, selectedDatabaseId);
        if (!initialDatabase) { onSourceStateChange("", false); setPhase("select-source"); return; }
        await selectManifestDatabase(initialDatabase, manifestEntry.url, generation);
      } catch (loadError: unknown) {
        if (!isCurrentLoadRequest(generation)) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to initialize BenchLedger.");
        setPhase("select-source");
      }
    }
    void boot();
    return () => {
      if (isCurrentLoadRequest(generation)) { loadAbortControllerRef.current?.abort(); loadGenerationRef.current += 1; }
      const activeSession = sessionRef.current;
      sessionRef.current = null;
      if (activeSession) void activeSession.destroy().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (!database?.source_url || !session || phase !== "ready" || !isLocalHost()) return;
    let cancelled = false;
    let refreshing = false;
    const refreshAbortController = new AbortController();
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const source = await refreshDatabaseFileFromUrl(database.source_url!, database.source_label, refreshAbortController.signal);
        if (!source) return;
        const refreshed = await session.replaceDatabaseFile(source.bytes, source.sourceLabel, source.sourceUrl);
        if (!cancelled) { setDatabase(refreshed); setSourceRevision((current) => current + 1); setError(""); }
      } catch (refreshError) {
        if (!cancelled && !refreshAbortController.signal.aborted) console.warn("BenchLedger auto-refresh failed:", refreshError);
      } finally { refreshing = false; }
    };
    const refreshInterval = window.setInterval(() => void refresh(), 10000);
    return () => { cancelled = true; refreshAbortController.abort(); window.clearInterval(refreshInterval); };
  }, [database, phase, session]);

  return { database, session, manifest, phase, error, handleDatabaseSelection, handleLocalFileChange, sourceRevision };
}
