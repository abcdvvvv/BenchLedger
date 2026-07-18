import initSqlJs, { type Database } from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import type {
  BenchmarkCodeState,
  BenchmarkCodeStateIdentity,
  BenchmarkDefinition,
  BenchmarkCodeStateMetadata,
  BenchmarkEnvironment,
  BenchmarkEnvironmentIdentity,
  BenchmarkEnvironmentMetadata,
  BenchmarkRunMetadata,
  BenchmarkRunRecord,
  BenchmarkRow,
  BenchLedgerManifest,
  BenchLedgerManifestDatabase,
  BenchLedgerMetadata,
  LoadedBenchmarkDataset
} from "./types";

const _Default_Manifest_Url = "./benchledger.json";
const _Supported_Schema_Version = 5;
const _Metadata_Defaults = {
  name: "",
  description: "",
  project_url: "",
  logo_url: "",
  logo_url_dark: "",
  created_at: "",
  updated_at: "",
  notes: ""
} as const;

let sqlPromise: Promise<Awaited<ReturnType<typeof initSqlJs>>> | null = null;

async function loadSqlJs() {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({ locateFile: () => sqlWasmUrl });
  }
  return sqlPromise;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseJsonRecord(value: unknown, fieldName: string, context: string): Record<string, unknown> {
  if (value === null || value === undefined || value === "") return {};
  try {
    const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
    if (!isRecord(parsed)) throw new Error("must be a JSON object");
    return parsed;
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : "invalid JSON";
    const wrappedError = new Error(`Invalid ${fieldName} in ${context}: ${detail}.`);
    (wrappedError as Error & { cause?: unknown }).cause = error;
    throw wrappedError;
  }
}

export function normalizeBenchmarkPath(value: unknown): string[] {
  const parsed: unknown = typeof value === "string"
    ? (() => {
        try {
          return JSON.parse(value);
        } catch {
          return null;
        }
      })()
    : value;
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
}

export function normalizeBenchmarkDefinition(values: Record<string, unknown>): BenchmarkDefinition {
  const id = String(values.benchmark_id ?? "");
  const label = String(values.benchmark_label ?? "");
  const path = normalizeBenchmarkPath(values.benchmark_path);
  return {
    id,
    path: path.length ? path : (label ? [label] : []),
    label
  };
}

export function normalizeBenchmarkRow(values: Record<string, unknown>): BenchmarkRow {
  return {
    run_id: String(values.run_id ?? ""),
    benchmark_id: String(values.benchmark_id ?? ""),
    metric_name: String(values.metric_name ?? ""),
    statistic: String(values.statistic ?? ""),
    unit: String(values.unit ?? ""),
    value: Number(values.value ?? 0),
    better: values.better === "higher" || values.better === "neutral" ? values.better : "lower"
  };
}

export function normalizeBenchmarkRunRecord(values: Record<string, unknown>): BenchmarkRunRecord {
  const id = String(values.id ?? "");
  return {
    id,
    code_state_id: String(values.code_state_id ?? ""),
    environment_id: String(values.environment_id ?? ""),
    measured_at: String(values.measured_at ?? ""),
    notes: String(values.notes ?? ""),
    metadata: parseJsonRecord(values.metadata, "run metadata", id || "benchmark run") as BenchmarkRunMetadata
  };
}

export function normalizeBenchmarkCodeState(values: Record<string, unknown>): BenchmarkCodeState {
  const id = String(values.id ?? "");
  return {
    id,
    label: String(values.label ?? ""),
    code_date: String(values.code_date ?? ""),
    identity: parseJsonRecord(values.identity, "code-state identity", id || "code state") as BenchmarkCodeStateIdentity,
    metadata: parseJsonRecord(values.metadata, "code-state metadata", id || "code state") as BenchmarkCodeStateMetadata
  };
}

export function normalizeBenchmarkEnvironment(values: Record<string, unknown>): BenchmarkEnvironment {
  const id = String(values.id ?? "");
  return {
    id,
    label: String(values.label ?? ""),
    identity: parseJsonRecord(values.identity, "environment identity", id || "environment") as BenchmarkEnvironmentIdentity,
    metadata: parseJsonRecord(values.metadata, "environment metadata", id || "environment") as BenchmarkEnvironmentMetadata
  };
}

function forEachQueryRow(db: Database, query: string, visit: (row: Record<string, unknown>) => void) {
  const statement = db.prepare(query);
  try {
    while (statement.step()) {
      visit(statement.getAsObject() as Record<string, unknown>);
    }
  } finally {
    statement.free();
  }
}

function rowsFromQuery(db: Database, query: string): BenchmarkRow[] {
  const rows: BenchmarkRow[] = [];
  forEachQueryRow(db, query, (row) => rows.push(normalizeBenchmarkRow(row)));
  return rows;
}

function mapFromQuery<T extends { id: string }>(db: Database, query: string, normalize: (row: Record<string, unknown>) => T): ReadonlyMap<string, T> {
  const values = new Map<string, T>();
  forEachQueryRow(db, query, (row) => {
    const value = normalize(row);
    values.set(value.id, value);
  });
  return values;
}

function benchmarkDefinitionsFromQuery(db: Database, query: string): ReadonlyMap<string, BenchmarkDefinition> {
  const definitions = new Map<string, BenchmarkDefinition>();
  forEachQueryRow(db, query, (row) => {
    const definition = normalizeBenchmarkDefinition(row);
    if (!definition.id) throw new Error("Invalid benchmark definition: benchmark_id must not be empty.");
    const existing = definitions.get(definition.id);
    if (!existing) {
      definitions.set(definition.id, definition);
      return;
    }
    if (existing.label !== definition.label || existing.path.length !== definition.path.length || existing.path.some((segment, index) => segment !== definition.path[index])) {
      throw new Error(`Conflicting benchmark definition for benchmark_id=${definition.id}.`);
    }
  });
  return definitions;
}

export function normalizeManifestDatabase(entry: Record<string, unknown>): BenchLedgerManifestDatabase | null {
  if (typeof entry.url !== "string" || !entry.url) return null;
  const id = typeof entry.id === "string" && entry.id ? entry.id : entry.url;
  return {
    id,
    name: typeof entry.name === "string" ? entry.name : undefined,
    description: typeof entry.description === "string" ? entry.description : undefined,
    url: entry.url,
    sha256: typeof entry.sha256 === "string" ? entry.sha256 : undefined,
    size_bytes: typeof entry.size_bytes === "number" ? entry.size_bytes : undefined,
    packed_at: typeof entry.packed_at === "string" ? entry.packed_at : undefined,
    schema_version: typeof entry.schema_version === "number" ? entry.schema_version : undefined,
    metadata_preview: isRecord(entry.metadata_preview) && Object.values(entry.metadata_preview).every((item) => typeof item === "string" || item === null)
      ? entry.metadata_preview as Record<string, string | null>
      : undefined
  };
}

export function normalizeManifest(json: unknown): BenchLedgerManifest | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const entry = json as Record<string, unknown>;
  if (!Array.isArray(entry.databases)) return null;
  const databases = entry.databases
    .map((database) => normalizeManifestDatabase(database as Record<string, unknown>))
    .filter((database): database is BenchLedgerManifestDatabase => database !== null);
  return {
    manifest_version: typeof entry.manifest_version === "number" ? entry.manifest_version : 1,
    benchledger_web_version: typeof entry.benchledger_web_version === "string" ? entry.benchledger_web_version : undefined,
    generated_at: typeof entry.generated_at === "string" ? entry.generated_at : undefined,
    site: entry.site && typeof entry.site === "object" && !Array.isArray(entry.site)
      ? {
          title: typeof (entry.site as Record<string, unknown>).title === "string" ? (entry.site as Record<string, unknown>).title as string : undefined,
          description: typeof (entry.site as Record<string, unknown>).description === "string" ? (entry.site as Record<string, unknown>).description as string : undefined
        }
      : undefined,
    databases
  };
}

function relationExists(db: Database, relationName: string): boolean {
  const result = db.exec(`
    SELECT name
    FROM sqlite_master
    WHERE type IN ('table', 'view') AND name = '${relationName}'
  `)[0];
  return Boolean(result?.values.length);
}

function relationColumns(db: Database, relationName: string): Set<string> {
  const result = db.exec(`PRAGMA table_info(${relationName})`)[0];
  if (!result) return new Set();
  return new Set(
    result.values
      .map((row) => row[result.columns.indexOf("name")])
      .filter((value): value is string => typeof value === "string" && value.length > 0)
  );
}

function requireRelationColumns(db: Database, relationName: string, requiredColumns: string[]) {
  if (!relationExists(db, relationName)) {
    throw new Error(`Unsupported BenchLedger database: missing ${relationName}.`);
  }
  const columns = relationColumns(db, relationName);
  for (const column of requiredColumns) {
    if (!columns.has(column)) throw new Error(`Unsupported ${relationName} schema: missing ${column}.`);
  }
}

function validateDataRelations(db: Database) {
  requireRelationColumns(db, "benchmark_results_latest", [
    "run_id", "benchmark_path", "benchmark_id", "benchmark_label", "metric_name", "statistic", "unit", "value", "better"
  ]);
  requireRelationColumns(db, "benchmark_runs", ["id", "code_state_id", "environment_id", "measured_at", "notes", "metadata"]);
  requireRelationColumns(db, "benchmark_code_states", ["id", "label", "code_date", "identity", "metadata"]);
  requireRelationColumns(db, "benchmark_environments", ["id", "label", "identity", "metadata"]);
}

function selectMeasurementsQuery(): string {
  return `
    SELECT run_id, benchmark_id, metric_name, statistic, unit, value, better
    FROM benchmark_results_latest
    ORDER BY run_id, benchmark_id, metric_name, statistic
  `;
}

function selectBenchmarkDefinitionsQuery(): string {
  return `
    SELECT DISTINCT benchmark_id, benchmark_path, benchmark_label
    FROM benchmark_results_latest
    ORDER BY benchmark_id, benchmark_path, benchmark_label
  `;
}

export function metadataFromRaw(raw: Record<string, string>): BenchLedgerMetadata {
  const schemaValue = raw.schema_version ?? "";
  const schemaVersion = schemaValue ? Number(schemaValue) : null;
  return {
    schema_version: Number.isFinite(schemaVersion) ? schemaVersion : null,
    name: raw.name ?? _Metadata_Defaults.name,
    description: raw.description ?? _Metadata_Defaults.description,
    project_url: raw.project_url ?? _Metadata_Defaults.project_url,
    logo_url: raw.logo_url ?? _Metadata_Defaults.logo_url,
    logo_url_dark: raw.logo_url_dark ?? _Metadata_Defaults.logo_url_dark,
    created_at: raw.created_at ?? _Metadata_Defaults.created_at,
    updated_at: raw.updated_at ?? _Metadata_Defaults.updated_at,
    notes: raw.notes ?? _Metadata_Defaults.notes,
    raw
  };
}

function readMetadata(db: Database): BenchLedgerMetadata {
  const raw: Record<string, string> = {};
  if (relationExists(db, "benchledger_metadata")) {
    forEachQueryRow(db, "SELECT key, value FROM benchledger_metadata", (row) => {
      const key = String(row.key ?? "");
      if (key) raw[key] = String(row.value ?? "");
    });
  }
  return metadataFromRaw(raw);
}

export function validateSchemaVersion(metadata: BenchLedgerMetadata) {
  if (metadata.schema_version === _Supported_Schema_Version) return;
  const actual = metadata.schema_version === null ? "missing" : String(metadata.schema_version);
  throw new Error(`Unsupported BenchLedger schema version: ${actual}. Expected ${_Supported_Schema_Version}.`);
}

async function loadDataset(bytes: Uint8Array, sourceLabel: string, sourceUrl: string | null): Promise<LoadedBenchmarkDataset> {
  const SQL = await loadSqlJs();
  const db = new SQL.Database(bytes);
  try {
    const metadata = readMetadata(db);
    validateSchemaVersion(metadata);
    validateDataRelations(db);

    const rows = rowsFromQuery(db, selectMeasurementsQuery());
    const benchmarksById = benchmarkDefinitionsFromQuery(db, selectBenchmarkDefinitionsQuery());
    const runsById = mapFromQuery(
      db,
      "SELECT id, code_state_id, environment_id, measured_at, notes, metadata FROM benchmark_runs",
      normalizeBenchmarkRunRecord
    );
    const codeStatesById = mapFromQuery(
      db,
      "SELECT id, label, code_date, identity, metadata FROM benchmark_code_states",
      normalizeBenchmarkCodeState
    );
    const environmentsById = mapFromQuery(
      db,
      "SELECT id, label, identity, metadata FROM benchmark_environments",
      normalizeBenchmarkEnvironment
    );

    return {
      rows,
      benchmarksById,
      runsById,
      codeStatesById,
      environmentsById,
      metadata,
      source_label: sourceLabel,
      source_url: sourceUrl
    };
  } finally {
    db.close();
  }
}

export function joinRelativeUrl(basePath: string, target: string): string {
  try {
    return new URL(target, basePath).toString();
  } catch {
    if (target.startsWith("./")) return `${basePath}${target.slice(1)}`;
    return `${basePath}/${target}`.replace(/\/+/g, "/");
  }
}

function sourceLabelFromUrl(url: string): string {
  const parts = url.split("/");
  return parts[parts.length - 1] || url;
}

export async function loadManifest(manifestUrl?: string): Promise<{ manifest: BenchLedgerManifest; url: string } | null> {
  const url = manifestUrl ?? _Default_Manifest_Url;
  const response = await fetch(url, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to load benchledger.json: ${response.status}`);
  const manifest = normalizeManifest(await response.json());
  if (!manifest) throw new Error("benchledger.json format is invalid.");
  return { manifest, url };
}

export async function loadBenchmarkRowsFromUrl(url: string, sourceLabel = sourceLabelFromUrl(url)): Promise<LoadedBenchmarkDataset> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load SQLite file: ${response.status}`);
  return loadDataset(new Uint8Array(await response.arrayBuffer()), sourceLabel, url);
}

export async function loadBenchmarkRowsFromFile(file: File): Promise<LoadedBenchmarkDataset> {
  return loadDataset(new Uint8Array(await file.arrayBuffer()), file.name, null);
}

export async function loadBenchmarkRowsFromManifestDatabase(
  database: BenchLedgerManifestDatabase,
  manifestUrl = _Default_Manifest_Url
): Promise<LoadedBenchmarkDataset> {
  const manifestPath = new URL(manifestUrl, window.location.href).toString();
  const databaseUrl = joinRelativeUrl(manifestPath, database.url);
  return loadBenchmarkRowsFromUrl(databaseUrl, database.name || database.id);
}
