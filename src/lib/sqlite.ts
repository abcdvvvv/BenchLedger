import initSqlJs, { type Database, type QueryExecResult } from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import type {
  BenchmarkRow,
  BenchLedgerManifest,
  BenchLedgerManifestDatabase,
  BenchLedgerMetadata,
  LoadedBenchmarkDataset
} from "./types";

const _Default_Manifest_Url = "./benchledger.json";
const _Compatible_Schema_Versions = new Set([1]);
const _Metadata_Defaults = {
  name: "",
  description: "",
  project_url: "",
  logo_url: "",
  created_at: "",
  updated_at: "",
  notes: ""
} as const;

let sqlPromise: Promise<Awaited<ReturnType<typeof initSqlJs>>> | null = null;

async function loadSqlJs() {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: () => sqlWasmUrl
    });
  }
  return sqlPromise;
}

function normalizeRow(values: Record<string, unknown>): BenchmarkRow {
  return {
    branch: String(values.branch ?? ""),
    tag: String(values.tag ?? ""),
    code_state_id: String(values.code_state_id ?? ""),
    label: String(values.label ?? ""),
    commit_sha: String(values.commit_sha ?? ""),
    date: String(values.date ?? ""),
    benchmark_key: String(values.benchmark_key ?? ""),
    metric_kind: String(values.metric_kind ?? ""),
    time_ns_median: Number(values.time_ns_median ?? 0),
    time_ns_min: Number(values.time_ns_min ?? 0),
    memory_bytes_min: Number(values.memory_bytes_min ?? 0),
    allocs_min: Number(values.allocs_min ?? 0),
    machine_id: String(values.machine_id ?? ""),
    cpu_model: String(values.cpu_model ?? ""),
    cpu_threads: Number(values.cpu_threads ?? 0),
    arch: String(values.arch ?? ""),
    os: String(values.os ?? ""),
    julia_version: String(values.julia_version ?? ""),
    is_dirty: Boolean(values.is_dirty),
    notes: String(values.notes ?? ""),
    group: String(values.benchmark_key ?? "").split("/")[0] || "other"
  };
}

function rowsFromResult(result: QueryExecResult | undefined): BenchmarkRow[] {
  if (!result) return [];
  return result.values.map((row: unknown[]) => {
    const entry = Object.fromEntries(result.columns.map((column: string, index: number) => [column, row[index]]));
    return normalizeRow(entry);
  });
}

function singleResultRows(result: QueryExecResult | undefined): Record<string, unknown>[] {
  if (!result) return [];
  return result.values.map((row: unknown[]) => {
    return Object.fromEntries(result.columns.map((column: string, index: number) => [column, row[index]]));
  });
}

function normalizeManifestDatabase(entry: Record<string, unknown>): BenchLedgerManifestDatabase | null {
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
    metadata_preview: isStringRecord(entry.metadata_preview) ? entry.metadata_preview : undefined
  };
}

function isStringRecord(value: unknown): value is Record<string, string | null> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((entry) => typeof entry === "string" || entry === null);
}

function normalizeManifest(json: unknown): BenchLedgerManifest | null {
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

function getResultColumns(result: QueryExecResult | undefined): Set<string> {
  return new Set(result?.columns ?? []);
}

function tableExists(db: Database, tableName: string): boolean {
  const result = db.exec(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table' AND name = '${tableName}'
  `)[0];
  return Boolean(result?.values.length);
}

function selectMeasurementsQuery(db: Database): string {
  if (tableExists(db, "measurements")) {
    const measurementsResult = db.exec("SELECT * FROM measurements LIMIT 1")[0];
    const columns = getResultColumns(measurementsResult);
    const benchmarkKeyColumn = columns.has("benchmark_key") ? "benchmark_key" : "benchmark_path";
    const commitColumn = columns.has("commit_sha") ? "commit_sha" : columns.has("commit") ? "\"commit\"" : "''";
    const dateColumn = columns.has("date") ? "date" : columns.has("date_utc") ? "date_utc" : "''";
    const timeMedianColumn = columns.has("time_ns_median") ? "time_ns_median" : "median_time_ns";
    const timeMinColumn = columns.has("time_ns_min") ? "time_ns_min" : columns.has("min_time_ns") ? "min_time_ns" : "0";
    const memoryColumn = columns.has("memory_bytes_min") ? "memory_bytes_min" : columns.has("memory_bytes") ? "memory_bytes" : "0";
    const allocsColumn = columns.has("allocs_min") ? "allocs_min" : columns.has("allocs") ? "allocs" : "0";
    const juliaVersionColumn = columns.has("julia_version") ? "julia_version" : "''";
    return `
      SELECT
        COALESCE(branch, '') AS branch,
        COALESCE(tag, '') AS tag,
        COALESCE(code_state_id, run_id, '') AS code_state_id,
        COALESCE(label, '') AS label,
        COALESCE(${commitColumn}, '') AS commit_sha,
        COALESCE(${dateColumn}, '') AS date,
        COALESCE(${benchmarkKeyColumn}, '') AS benchmark_key,
        COALESCE(metric_kind, '') AS metric_kind,
        COALESCE(${timeMedianColumn}, 0) AS time_ns_median,
        COALESCE(${timeMinColumn}, 0) AS time_ns_min,
        COALESCE(${memoryColumn}, 0) AS memory_bytes_min,
        COALESCE(${allocsColumn}, 0) AS allocs_min,
        COALESCE(machine_id, '') AS machine_id,
        COALESCE(cpu_model, '') AS cpu_model,
        COALESCE(cpu_threads, 0) AS cpu_threads,
        COALESCE(arch, '') AS arch,
        COALESCE(os, '') AS os,
        COALESCE(${juliaVersionColumn}, '') AS julia_version,
        COALESCE(is_dirty, 0) AS is_dirty,
        COALESCE(notes, '') AS notes
      FROM measurements
      ORDER BY ${dateColumn}, ${benchmarkKeyColumn}
    `;
  }

  if (!tableExists(db, "benchmark_results")) {
    throw new Error("No supported benchmark table was found in this SQLite database.");
  }

  return `
    SELECT
      branch,
      tag,
      code_state_id,
      label,
      "commit" AS commit_sha,
      date,
      benchmark_key,
      metric_kind,
      time_ns_median,
      time_ns_min,
      memory_bytes_min,
      allocs_min,
      machine_id,
      cpu_model,
      cpu_threads,
      arch,
      os,
      julia_version,
      is_dirty,
      notes
    FROM benchmark_results
    ORDER BY date, benchmark_key
  `;
}

function readMetadata(db: Database): BenchLedgerMetadata {
  const raw: Record<string, string> = {};
  if (tableExists(db, "benchledger_metadata")) {
    const metadataResult = db.exec("SELECT key, value FROM benchledger_metadata")[0];
    for (const row of singleResultRows(metadataResult)) {
      const key = String(row.key ?? "");
      if (!key) continue;
      raw[key] = String(row.value ?? "");
    }
  }

  const schemaValue = raw.schema_version ?? "";
  const schemaVersion = schemaValue ? Number(schemaValue) : null;
  return {
    schema_version: Number.isFinite(schemaVersion) ? schemaVersion : null,
    name: raw.name ?? _Metadata_Defaults.name,
    description: raw.description ?? _Metadata_Defaults.description,
    project_url: raw.project_url ?? _Metadata_Defaults.project_url,
    logo_url: raw.logo_url ?? _Metadata_Defaults.logo_url,
    created_at: raw.created_at ?? _Metadata_Defaults.created_at,
    updated_at: raw.updated_at ?? _Metadata_Defaults.updated_at,
    notes: raw.notes ?? _Metadata_Defaults.notes,
    raw
  };
}

function validateSchemaVersion(metadata: BenchLedgerMetadata) {
  if (metadata.schema_version === null) return;
  if (_Compatible_Schema_Versions.has(metadata.schema_version)) return;
  throw new Error(`Unsupported BenchLedger schema version: ${metadata.schema_version}`);
}

async function loadDataset(bytes: Uint8Array, sourceLabel: string, sourceUrl: string | null): Promise<LoadedBenchmarkDataset> {
  const SQL = await loadSqlJs();
  const db = new SQL.Database(bytes);
  try {
    const metadata = readMetadata(db);
    validateSchemaVersion(metadata);
    const query = selectMeasurementsQuery(db);
    const result = db.exec(query);
    return {
      rows: rowsFromResult(result[0]),
      metadata,
      source_label: sourceLabel,
      source_url: sourceUrl
    };
  } finally {
    db.close();
  }
}

function joinRelativeUrl(basePath: string, target: string): string {
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
  if (!response.ok) {
    throw new Error(`Failed to load benchledger.json: ${response.status}`);
  }
  const json = await response.json();
  const manifest = normalizeManifest(json);
  if (!manifest) {
    throw new Error("benchledger.json format is invalid.");
  }
  return { manifest, url };
}

export async function loadBenchmarkRowsFromUrl(url: string, sourceLabel = sourceLabelFromUrl(url)): Promise<LoadedBenchmarkDataset> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load SQLite file: ${response.status}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  return loadDataset(bytes, sourceLabel, url);
}

export async function loadBenchmarkRowsFromFile(file: File): Promise<LoadedBenchmarkDataset> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return loadDataset(bytes, file.name, null);
}

export async function loadBenchmarkRowsFromManifestDatabase(
  database: BenchLedgerManifestDatabase,
  manifestUrl = _Default_Manifest_Url
): Promise<LoadedBenchmarkDataset> {
  const manifestPath = new URL(manifestUrl, window.location.href).toString();
  const databaseUrl = joinRelativeUrl(manifestPath, database.url);
  return loadBenchmarkRowsFromUrl(databaseUrl, database.name || database.id);
}
