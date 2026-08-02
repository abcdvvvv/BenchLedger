import initSqlJs, { type Database } from "sql.js";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { aggregateBenchmarkRows } from "./benchmark-aggregation";
import type {
  BenchmarkCodeState,
  BenchmarkCodeStateIdentity,
  BenchmarkCodeStateMetadata,
  BenchmarkDefinition,
  BenchmarkEnvironmentMetadata,
  BenchmarkHardwareEnvironment,
  BenchmarkHardwareEnvironmentIdentity,
  BenchmarkRunMetadata,
  BenchmarkRunRecord,
  BenchmarkRow,
  BenchmarkSoftwareEnvironment,
  BenchmarkSoftwareEnvironmentIdentity,
  BenchLedgerManifest,
  BenchLedgerManifestDatabase,
  BenchLedgerMetadata,
  LoadedBenchmarkDataset
} from "./types";

const _Default_Manifest_Url = "./benchledger.json";
const _Supported_Schema_Version = 6;
const _Canonical_Integer_Text = /^(0|[1-9]\d*)$/;
const _Sha256_Hex = /^[0-9a-f]{64}$/i;
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
  if (!sqlPromise) sqlPromise = initSqlJs({ locateFile: () => sqlWasmUrl });
  return sqlPromise;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function errorWithCause(message: string, cause: unknown): Error {
  const error = new Error(message);
  (error as Error & { cause?: unknown }).cause = cause;
  return error;
}

function stringValue(value: unknown, fieldName: string, context: string): string {
  if (typeof value !== "string") {
    throw new Error(`Invalid ${fieldName} in ${context}: must be a string.`);
  }
  return value;
}

function nonemptyString(value: unknown, fieldName: string, context: string): string {
  const text = stringValue(value, fieldName, context);
  if (!text.trim()) throw new Error(`Invalid ${fieldName} in ${context}: must not be empty.`);
  return text;
}

function parseJsonRecord(value: unknown, fieldName: string, context: string): Record<string, unknown> {
  if (typeof value !== "string") {
    throw new Error(`Invalid ${fieldName} in ${context}: must be JSON object text.`);
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) throw new Error("must be a JSON object");
    return parsed;
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : "invalid JSON";
    throw errorWithCause(`Invalid ${fieldName} in ${context}: ${detail}.`, error);
  }
}

export function normalizeBenchmarkKey(value: unknown, context = "benchmark result"): BenchmarkDefinition {
  if (typeof value !== "string") {
    throw new Error(`Invalid benchmark_key in ${context}: must be canonical JSON string text.`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : "invalid JSON";
    throw errorWithCause(`Invalid benchmark_key in ${context}: ${detail}.`, error);
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`Invalid benchmark_key in ${context}: expected a nonempty JSON string array.`);
  }
  if (!parsed.every((segment) => typeof segment === "string" && segment.trim().length > 0)) {
    throw new Error(`Invalid benchmark_key in ${context}: every segment must be a nonempty string.`);
  }

  const path = parsed as string[];
  const key = JSON.stringify(path);
  if (value !== key) {
    throw new Error(`Invalid benchmark_key in ${context}: expected canonical JSON ${key}.`);
  }
  return { key, path, label: path.join(" / ") };
}

export function normalizeBenchmarkRow(values: Record<string, unknown>): BenchmarkRow {
  const runId = nonemptyString(values.run_id, "run_id", "benchmark result");
  const benchmark = normalizeBenchmarkKey(values.benchmark_key, `run_id=${runId}`);
  const metricName = nonemptyString(values.metric_name, "metric_name", `run_id=${runId}`);
  const statistic = nonemptyString(values.statistic, "statistic", `run_id=${runId}`);
  const unit = nonemptyString(values.unit, "unit", `run_id=${runId}`);
  if (typeof values.value !== "number" || !Number.isFinite(values.value)) {
    throw new Error(`Invalid value in run_id=${runId}, benchmark_key=${benchmark.key}: must be a finite number.`);
  }
  if (values.better !== "lower" && values.better !== "higher" && values.better !== "neutral") {
    throw new Error(`Invalid better in run_id=${runId}, benchmark_key=${benchmark.key}.`);
  }
  return {
    run_id: runId,
    benchmark_key: benchmark.key,
    metric_name: metricName,
    statistic,
    unit,
    value: values.value,
    better: values.better
  };
}

function normalizeBenchmarkRunRecord(values: Record<string, unknown>): BenchmarkRunRecord {
  const id = nonemptyString(values.id, "run id", "runs");
  return {
    id,
    code_state_id: nonemptyString(values.code_state_id, "code_state_id", id),
    hardware_environment_id: nonemptyString(values.hardware_environment_id, "hardware_environment_id", id),
    software_environment_id: nonemptyString(values.software_environment_id, "software_environment_id", id),
    measured_at: nonemptyString(values.measured_at, "measured_at", id),
    metadata: parseJsonRecord(values.metadata, "run metadata", id) as BenchmarkRunMetadata
  };
}

function normalizeBenchmarkCodeState(values: Record<string, unknown>): BenchmarkCodeState {
  const id = nonemptyString(values.id, "code-state id", "code_states");
  return {
    id,
    label: stringValue(values.label, "label", id),
    code_date: nonemptyString(values.code_date, "code_date", id),
    identity: parseJsonRecord(values.identity, "code-state identity", id) as BenchmarkCodeStateIdentity,
    metadata: parseJsonRecord(values.metadata, "code-state metadata", id) as BenchmarkCodeStateMetadata
  };
}

function normalizeBenchmarkHardwareEnvironment(values: Record<string, unknown>): BenchmarkHardwareEnvironment {
  const id = nonemptyString(values.id, "hardware-environment id", "hardware_environments");
  return {
    id,
    label: stringValue(values.label, "label", id),
    identity: parseJsonRecord(values.identity, "hardware-environment identity", id) as BenchmarkHardwareEnvironmentIdentity,
    metadata: parseJsonRecord(values.metadata, "hardware-environment metadata", id) as BenchmarkEnvironmentMetadata
  };
}

function normalizeBenchmarkSoftwareEnvironment(values: Record<string, unknown>): BenchmarkSoftwareEnvironment {
  const id = nonemptyString(values.id, "software-environment id", "software_environments");
  return {
    id,
    label: stringValue(values.label, "label", id),
    identity: parseJsonRecord(values.identity, "software-environment identity", id) as BenchmarkSoftwareEnvironmentIdentity,
    metadata: parseJsonRecord(values.metadata, "software-environment metadata", id) as BenchmarkEnvironmentMetadata
  };
}

function forEachQueryRow(db: Database, query: string, visit: (row: Record<string, unknown>) => void) {
  const statement = db.prepare(query);
  try {
    while (statement.step()) visit(statement.getAsObject() as Record<string, unknown>);
  } finally {
    statement.free();
  }
}

function rowsFromQuery(db: Database, query: string): BenchmarkRow[] {
  const rows: BenchmarkRow[] = [];
  forEachQueryRow(db, query, (row) => rows.push(normalizeBenchmarkRow(row)));
  return rows;
}

function mapFromQuery<T extends { id: string }>(
  db: Database,
  query: string,
  relationName: string,
  normalize: (row: Record<string, unknown>) => T
): ReadonlyMap<string, T> {
  const values = new Map<string, T>();
  forEachQueryRow(db, query, (row) => {
    const value = normalize(row);
    if (values.has(value.id)) throw new Error(`Invalid ${relationName}: duplicate id=${value.id}.`);
    values.set(value.id, value);
  });
  return values;
}

function benchmarkDefinitionsFromRows(rows: readonly BenchmarkRow[]): ReadonlyMap<string, BenchmarkDefinition> {
  const definitions = new Map<string, BenchmarkDefinition>();
  for (const row of rows) {
    if (!definitions.has(row.benchmark_key)) {
      const definition = normalizeBenchmarkKey(row.benchmark_key, `run_id=${row.run_id}`);
      definitions.set(definition.key, definition);
    }
  }
  return new Map(Array.from(definitions.entries()).sort(([left], [right]) => left.localeCompare(right)));
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined | null {
  if (!hasOwn(record, key)) return undefined;
  return typeof record[key] === "string" ? record[key] : null;
}

function normalizeManifestDatabase(entry: Record<string, unknown>): BenchLedgerManifestDatabase | null {
  if (typeof entry.id !== "string" || !entry.id.trim()) return null;
  if (typeof entry.url !== "string" || !entry.url.trim()) return null;

  const name = optionalString(entry, "name");
  const description = optionalString(entry, "description");
  const packedAt = optionalString(entry, "packed_at");
  if (name === null || description === null || packedAt === null) return null;

  let sha256: string | undefined;
  if (hasOwn(entry, "sha256")) {
    if (typeof entry.sha256 !== "string" || !_Sha256_Hex.test(entry.sha256)) return null;
    sha256 = entry.sha256.toLowerCase();
  }

  let sizeBytes: number | undefined;
  if (hasOwn(entry, "size_bytes")) {
    if (
      typeof entry.size_bytes !== "number" ||
      !Number.isSafeInteger(entry.size_bytes) ||
      entry.size_bytes <= 0
    ) return null;
    sizeBytes = entry.size_bytes;
  }

  let metadataPreview: Record<string, string | null> | undefined;
  if (hasOwn(entry, "metadata_preview")) {
    if (!isRecord(entry.metadata_preview)) return null;
    if (!Object.values(entry.metadata_preview).every((item) => typeof item === "string" || item === null)) return null;
    metadataPreview = entry.metadata_preview as Record<string, string | null>;
  }

  return {
    id: entry.id,
    name,
    description,
    url: entry.url,
    sha256,
    size_bytes: sizeBytes,
    packed_at: packedAt,
    metadata_preview: metadataPreview
  };
}

export function normalizeManifest(json: unknown): BenchLedgerManifest | null {
  if (!isRecord(json) || !Array.isArray(json.databases)) return null;

  const benchledgerWebVersion = optionalString(json, "benchledger_web_version");
  const generatedAt = optionalString(json, "generated_at");
  if (benchledgerWebVersion === null || generatedAt === null) return null;

  let site: BenchLedgerManifest["site"];
  if (hasOwn(json, "site")) {
    if (!isRecord(json.site)) return null;
    const title = optionalString(json.site, "title");
    const description = optionalString(json.site, "description");
    if (title === null || description === null) return null;
    site = { title, description };
  }

  const databases: BenchLedgerManifestDatabase[] = [];
  const databaseIds = new Set<string>();
  for (const value of json.databases) {
    if (!isRecord(value)) return null;
    const database = normalizeManifestDatabase(value);
    if (!database || databaseIds.has(database.id)) return null;
    databaseIds.add(database.id);
    databases.push(database);
  }

  return {
    benchledger_web_version: benchledgerWebVersion,
    generated_at: generatedAt,
    site,
    databases
  };
}

function relationExists(db: Database, relationName: string): boolean {
  const statement = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ? LIMIT 1");
  try {
    statement.bind([relationName]);
    return statement.step();
  } finally {
    statement.free();
  }
}

function validateReferences(dataset: Pick<LoadedBenchmarkDataset,
  "rows" | "runsById" | "codeStatesById" | "hardwareEnvironmentsById" | "softwareEnvironmentsById"
>) {
  for (const run of dataset.runsById.values()) {
    if (!dataset.codeStatesById.has(run.code_state_id)) {
      throw new Error(`Invalid run ${run.id}: unknown code_state_id=${run.code_state_id}.`);
    }
    if (!dataset.hardwareEnvironmentsById.has(run.hardware_environment_id)) {
      throw new Error(`Invalid run ${run.id}: unknown hardware_environment_id=${run.hardware_environment_id}.`);
    }
    if (!dataset.softwareEnvironmentsById.has(run.software_environment_id)) {
      throw new Error(`Invalid run ${run.id}: unknown software_environment_id=${run.software_environment_id}.`);
    }
  }
  for (const row of dataset.rows) {
    if (!dataset.runsById.has(row.run_id)) {
      throw new Error(`Invalid benchmark result: unknown run_id=${row.run_id}.`);
    }
  }
}

function parseCanonicalIntegerText(value: string | undefined): number | null {
  if (value === undefined || !_Canonical_Integer_Text.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export function metadataFromRaw(raw: Record<string, string>): BenchLedgerMetadata {
  return {
    schema_version: parseCanonicalIntegerText(raw.schema_version),
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
      const key = nonemptyString(row.key, "metadata key", "benchledger_metadata");
      const value = stringValue(row.value, `metadata value for key=${key}`, "benchledger_metadata");
      if (hasOwn(raw, key)) throw new Error(`Invalid benchledger_metadata: duplicate key=${key}.`);
      raw[key] = value;
    });
  }
  return metadataFromRaw(raw);
}

export function validateSchemaVersion(metadata: BenchLedgerMetadata) {
  if (metadata.schema_version === _Supported_Schema_Version) return;
  const actual = hasOwn(metadata.raw, "schema_version") ? metadata.raw.schema_version : "missing";
  throw new Error(`Unsupported BenchLedger schema version: ${actual}. Expected ${_Supported_Schema_Version}.`);
}

export function readBenchmarkDataset(
  db: Database,
  sourceLabel: string,
  sourceUrl: string | null
): LoadedBenchmarkDataset {
  const metadata = readMetadata(db);
  validateSchemaVersion(metadata);

  const rows = rowsFromQuery(db, `
    SELECT run_id, benchmark_key, metric_name, statistic, unit, value, better
    FROM benchmark_results
    ORDER BY run_id, benchmark_key, metric_name, statistic
  `);
  const benchmarksByKey = benchmarkDefinitionsFromRows(rows);
  const runsById = mapFromQuery(
    db,
    `SELECT id, code_state_id, hardware_environment_id, software_environment_id, measured_at, metadata
     FROM runs`,
    "runs",
    normalizeBenchmarkRunRecord
  );
  const codeStatesById = mapFromQuery(
    db,
    "SELECT id, label, code_date, identity, metadata FROM code_states",
    "code_states",
    normalizeBenchmarkCodeState
  );
  const hardwareEnvironmentsById = mapFromQuery(
    db,
    "SELECT id, label, identity, metadata FROM hardware_environments",
    "hardware_environments",
    normalizeBenchmarkHardwareEnvironment
  );
  const softwareEnvironmentsById = mapFromQuery(
    db,
    "SELECT id, label, identity, metadata FROM software_environments",
    "software_environments",
    normalizeBenchmarkSoftwareEnvironment
  );

  const datasetWithoutAggregates = {
    rows,
    runsById,
    codeStatesById,
    hardwareEnvironmentsById,
    softwareEnvironmentsById
  };
  validateReferences(datasetWithoutAggregates);

  return {
    ...datasetWithoutAggregates,
    aggregateRows: aggregateBenchmarkRows(rows, runsById),
    benchmarksByKey,
    metadata,
    source_label: sourceLabel,
    source_url: sourceUrl
  };
}

export async function loadBenchmarkDataset(
  bytes: Uint8Array,
  sourceLabel: string,
  sourceUrl: string | null
): Promise<LoadedBenchmarkDataset> {
  const SQL = await loadSqlJs();
  const db = new SQL.Database(bytes);
  try {
    return readBenchmarkDataset(db, sourceLabel, sourceUrl);
  } finally {
    db.close();
  }
}

function joinRelativeUrl(basePath: string, target: string): string {
  return new URL(target, basePath).toString();
}

function sourceLabelFromUrl(url: string): string {
  const parts = url.split("/");
  return parts[parts.length - 1] || url;
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function validateManifestDatabaseBytes(
  database: BenchLedgerManifestDatabase,
  bytes: ArrayBuffer
): Promise<void> {
  if (database.size_bytes !== undefined && bytes.byteLength !== database.size_bytes) {
    throw new Error(
      `Database size mismatch for ${database.id}: received ${bytes.byteLength} bytes, ` +
      `expected ${database.size_bytes}.`
    );
  }
  if (database.sha256 !== undefined) {
    const actualSha256 = await sha256Hex(bytes);
    if (actualSha256 !== database.sha256.toLowerCase()) {
      throw new Error(
        `Database SHA-256 mismatch for ${database.id}: received ${actualSha256}, expected ${database.sha256}.`
      );
    }
  }
}

export async function loadManifest(manifestUrl?: string): Promise<{ manifest: BenchLedgerManifest; url: string } | null> {
  const url = manifestUrl ?? _Default_Manifest_Url;
  const response = await fetch(url, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to load benchledger.json: ${response.status}`);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (manifestUrl === undefined && contentType.includes("text/html")) return null;
  const manifest = normalizeManifest(await response.json());
  if (!manifest) throw new Error("benchledger.json format is invalid.");
  return { manifest, url };
}

export async function loadBenchmarkDatasetFromUrl(
  url: string,
  sourceLabel = sourceLabelFromUrl(url)
): Promise<LoadedBenchmarkDataset> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load SQLite file: ${response.status}`);
  return loadBenchmarkDataset(new Uint8Array(await response.arrayBuffer()), sourceLabel, url);
}

export async function loadBenchmarkDatasetFromFile(file: File): Promise<LoadedBenchmarkDataset> {
  return loadBenchmarkDataset(new Uint8Array(await file.arrayBuffer()), file.name, null);
}

export async function loadBenchmarkDatasetFromManifestDatabase(
  database: BenchLedgerManifestDatabase,
  manifestUrl = _Default_Manifest_Url
): Promise<LoadedBenchmarkDataset> {
  const manifestPath = new URL(manifestUrl, window.location.href).toString();
  const databaseUrl = joinRelativeUrl(manifestPath, database.url);
  const response = await fetch(databaseUrl, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to load SQLite file: ${response.status}`);

  const bytes = await response.arrayBuffer();
  await validateManifestDatabaseBytes(database, bytes);
  const dataset = await loadBenchmarkDataset(
    new Uint8Array(bytes),
    database.name || database.id,
    databaseUrl
  );

  return dataset;
}
