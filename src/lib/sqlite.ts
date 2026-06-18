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
const _Compatible_Schema_Versions = new Set([3]);
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
    sqlPromise = initSqlJs({
      locateFile: () => sqlWasmUrl
    });
  }
  return sqlPromise;
}

function normalizeBenchmarkPath(value: unknown): string[] {
  if (typeof value !== "string" || !value) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const path = parsed.filter((entry): entry is string => typeof entry === "string" && entry.length > 0);
  return path;
}

function normalizeRow(values: Record<string, unknown>): BenchmarkRow {
  const benchmark_path = normalizeBenchmarkPath(values.benchmark_path);
  return {
    run_id: String(values.run_id ?? ""),
    branch: String(values.branch ?? ""),
    tag: String(values.tag ?? ""),
    code_state_id: String(values.code_state_id ?? ""),
    label: String(values.label ?? ""),
    commit_sha: String(values.commit_sha ?? ""),
    code_date: String(values.code_date ?? ""),
    measured_at: String(values.measured_at ?? ""),
    benchmark_path,
    benchmark_id: String(values.benchmark_id ?? ""),
    benchmark_label: String(values.benchmark_label ?? ""),
    metric_name: String(values.metric_name ?? ""),
    statistic: String(values.statistic ?? ""),
    unit: String(values.unit ?? ""),
    value: Number(values.value ?? 0),
    better: values.better === "higher" || values.better === "neutral" ? values.better : "lower",
    machine_id: String(values.machine_id ?? ""),
    cpu_model: String(values.cpu_model ?? ""),
    cpu_threads: Number(values.cpu_threads ?? 0),
    arch: String(values.arch ?? ""),
    os: String(values.os ?? ""),
    julia_version: String(values.julia_version ?? ""),
    is_dirty: Boolean(values.is_dirty),
    notes: String(values.notes ?? ""),
    group: benchmark_path[0] || "other"
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

function selectMeasurementsQuery(db: Database): string {
  if (!relationExists(db, "benchmark_results_latest")) {
    throw new Error("No supported benchmark table was found in this SQLite database.");
  }

  const columns = relationColumns(db, "benchmark_results_latest");
  const requiredColumns = [
    "run_id",
    "branch",
    "tag",
    "code_state_id",
    "label",
    "commit",
    "code_date",
    "measured_at",
    "benchmark_path",
    "benchmark_id",
    "benchmark_label",
    "metric_name",
    "statistic",
    "unit",
    "value",
    "better",
    "machine_id",
    "cpu_model",
    "cpu_threads",
    "arch",
    "os",
    "julia_version",
    "is_dirty",
    "notes"
  ];
  for (const column of requiredColumns) {
    if (!columns.has(column)) {
      throw new Error(`Unsupported benchmark_results_latest schema: missing ${column}.`);
    }
  }

  return `
    SELECT
      run_id,
      branch,
      tag,
      code_state_id,
      label,
      "commit" AS commit_sha,
      code_date,
      measured_at,
      benchmark_path,
      benchmark_id,
      benchmark_label,
      metric_name,
      statistic,
      unit,
      value,
      better,
      machine_id,
      cpu_model,
      cpu_threads,
      arch,
      os,
      julia_version,
      is_dirty,
      notes
    FROM benchmark_results_latest
    ORDER BY code_date, measured_at, benchmark_label, metric_name, statistic
  `;
}

function readMetadata(db: Database): BenchLedgerMetadata {
  const raw: Record<string, string> = {};
  if (relationExists(db, "benchledger_metadata")) {
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
    logo_url_dark: raw.logo_url_dark ?? _Metadata_Defaults.logo_url_dark,
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
  const response = await fetch(url, { cache: "no-store" });
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
