import type {
  BenchmarkCodeState, BenchmarkCodeStateIdentity, BenchmarkCodeStateMetadata, BenchmarkDefinition, BenchmarkEnvironmentMetadata,
  BenchmarkHardwareEnvironment, BenchmarkHardwareEnvironmentIdentity, BenchmarkRunMetadata, BenchmarkRunRecord, BenchmarkRow,
  BenchmarkSoftwareEnvironment, BenchmarkSoftwareEnvironmentIdentity, BenchLedgerManifest, BenchLedgerManifestDatabase, BenchLedgerMetadata
} from "./types";
import { hasOwn, isRecord } from "./object";

const _Default_Manifest_Url = "./benchledger.json";
const _Supported_Schema_Version = 6;
const _Maximum_Database_Bytes = 512 * 1024 * 1024;
const _Maximum_Database_Size_Label = "512 MiB";
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

const databaseResponseRevisions = new Map<string, string>();

function errorWithCause(message: string, cause: unknown): Error {
  const error = new Error(message);
  (error as Error & { cause?: unknown }).cause = cause;
  return error;
}

function assertDatabaseSize(sizeBytes: number, sourceLabel: string) {
  if (sizeBytes > _Maximum_Database_Bytes) throw new Error(`SQLite database ${sourceLabel} is ${sizeBytes.toLocaleString()} bytes, exceeding BenchLedger's ${_Maximum_Database_Size_Label} browser safety limit.`);
}

async function databaseBytesFromResponse(response: Response, sourceLabel: string, expectedSizeBytes?: number): Promise<ArrayBuffer> {
  const contentLength = response.headers.get("content-length");
  const responseSize = contentLength && /^\d+$/.test(contentLength) ? Number(contentLength) : null;
  if (responseSize !== null) assertDatabaseSize(responseSize, sourceLabel);
  if (expectedSizeBytes !== undefined) assertDatabaseSize(expectedSizeBytes, sourceLabel);
  if (!response.body) {
    const bytes = await response.arrayBuffer();
    assertDatabaseSize(bytes.byteLength, sourceLabel);
    return bytes;
  }

  const expectedSize = expectedSizeBytes ?? responseSize;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] | null = expectedSize === null ? [] : null;
  let bytes = expectedSize === null ? null : new Uint8Array(expectedSize);
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const nextTotal = totalBytes + value.byteLength;
      if (nextTotal > _Maximum_Database_Bytes) {
        try { await reader.cancel(); } catch { /* Keep the size-limit error. */ }
        assertDatabaseSize(nextTotal, sourceLabel);
      }
      if (bytes) {
        if (nextTotal > bytes.byteLength) { const next = new Uint8Array(Math.min(_Maximum_Database_Bytes, Math.max(nextTotal, Math.ceil(Math.max(bytes.byteLength, 1) * 1.5)))); next.set(bytes); bytes = next; }
        bytes.set(value, totalBytes);
      } else chunks!.push(value);
      totalBytes = nextTotal;
    }
  } finally {
    reader.releaseLock();
  }

  if (bytes) return totalBytes === bytes.byteLength ? bytes.buffer : bytes.slice(0, totalBytes).buffer;
  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks!) { combined.set(chunk, offset); offset += chunk.byteLength; }
  return combined.buffer;
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

type JsonShape = Record<string, JsonRule>;
type JsonRule = "string" | "number" | "integer" | "boolean" | { object: JsonShape } | { array: JsonRule } | { oneOf: readonly string[] };

const _Named_Version_Shape = { name: "string", version: "string" } as const satisfies JsonShape;
const _Code_State_Identity_Shape = { source: { object: { kind: "string", revision: "string", diff_digest: "string" } } } as const satisfies JsonShape;
const _Code_State_Metadata_Shape = { source: { object: { dirty: "boolean" } } } as const satisfies JsonShape;
const _Run_Metadata_Shape = {
  notes: "string",
  writer: { object: { name: "string", schema_version: "integer" } },
  source: { object: { branch: "string", tags: { array: "string" } } },
  ci: { object: { provider: "string", workflow: "string", job: "string", run_id: "string", event: "string", runner_name: "string", run_attempt: "integer", run_url: "string" } }
} as const satisfies JsonShape;
const _Hardware_Identity_Shape = {
  architecture: "string",
  cpu: { object: { model: "string", vendor: "string", physical_cores: "number", logical_threads: "number", packages: "number", microarchitecture: "string", numa_nodes: "number" } },
  memory: { object: { total_bytes: "number" } },
  gpu: { array: { object: { vendor: "string", model: "string", type: { oneOf: ["integrated", "discrete", "unknown"] }, memory_bytes: "number", count: "number" } } }
} as const satisfies JsonShape;
const _Software_Identity_Shape = {
  platform: { object: { os: { object: _Named_Version_Shape }, kernel: { object: _Named_Version_Shape } } },
  runtime: { object: _Named_Version_Shape },
  gpu_drivers: { array: { object: { vendor: "string", name: "string", variant: "string", version: "string", device_count: "number" } } },
  gpu: { object: { interface: { object: _Named_Version_Shape } } },
  gpu_runtime: { object: { backend: "string", runtime: { object: _Named_Version_Shape } } },
  execution: { object: { processes: "number", threads: "number" } },
  math_libraries: { object: { blas: { object: { libraries: { array: { object: { implementation: "string", interface: "string" } } }, threads: "number" } } } },
  benchmark: { object: { framework: { object: _Named_Version_Shape } } },
  dependencies: { object: { kind: "string", format: "string", digest: "string" } }
} as const satisfies JsonShape;

function invalidJsonValue(context: string, expected: string): never {
  throw new Error(`Invalid ${context}: must be ${expected}.`);
}

function validateJsonRule(value: unknown, rule: JsonRule, context: string) {
  if (rule === "string") { if (typeof value !== "string") invalidJsonValue(context, "a string"); return; }
  if (rule === "number") { if (typeof value !== "number" || !Number.isFinite(value)) invalidJsonValue(context, "a finite number"); return; }
  if (rule === "integer") { if (typeof value !== "number" || !Number.isSafeInteger(value)) invalidJsonValue(context, "a safe integer"); return; }
  if (rule === "boolean") { if (typeof value !== "boolean") invalidJsonValue(context, "a boolean"); return; }
  if ("object" in rule) {
    if (!isRecord(value)) invalidJsonValue(context, "an object");
    validateJsonShape(value, rule.object, context);
    return;
  }
  if ("array" in rule) {
    if (!Array.isArray(value)) invalidJsonValue(context, "an array");
    value.forEach((item, index) => validateJsonRule(item, rule.array, `${context}[${index}]`));
    return;
  }
  if (typeof value !== "string" || !rule.oneOf.includes(value)) invalidJsonValue(context, rule.oneOf.map((item) => `"${item}"`).join(", "));
}

function validateJsonShape(record: Record<string, unknown>, shape: JsonShape, context: string) {
  for (const [key, rule] of Object.entries(shape)) if (hasOwn(record, key)) validateJsonRule(record[key], rule, `${context}.${key}`);
}

function parseValidatedJsonRecord<T>(value: unknown, fieldName: string, context: string, shape: JsonShape): T {
  const record = parseJsonRecord(value, fieldName, context);
  validateJsonShape(record, shape, `${fieldName} in ${context}`);
  return record as T;
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

export function normalizeBenchmarkRunRecord(values: Record<string, unknown>): BenchmarkRunRecord {
  const id = nonemptyString(values.id, "run id", "runs");
  return {
    id,
    code_state_id: nonemptyString(values.code_state_id, "code_state_id", id),
    hardware_environment_id: nonemptyString(values.hardware_environment_id, "hardware_environment_id", id),
    software_environment_id: nonemptyString(values.software_environment_id, "software_environment_id", id),
    measured_at: nonemptyString(values.measured_at, "measured_at", id),
    metadata: parseValidatedJsonRecord<BenchmarkRunMetadata>(values.metadata, "run metadata", id, _Run_Metadata_Shape)
  };
}

export function normalizeBenchmarkCodeState(values: Record<string, unknown>): BenchmarkCodeState {
  const id = nonemptyString(values.id, "code-state id", "code_states");
  return {
    id,
    label: stringValue(values.label, "label", id),
    code_date: nonemptyString(values.code_date, "code_date", id),
    identity: parseValidatedJsonRecord<BenchmarkCodeStateIdentity>(values.identity, "code-state identity", id, _Code_State_Identity_Shape),
    metadata: parseValidatedJsonRecord<BenchmarkCodeStateMetadata>(values.metadata, "code-state metadata", id, _Code_State_Metadata_Shape)
  };
}

export function normalizeBenchmarkHardwareEnvironment(values: Record<string, unknown>): BenchmarkHardwareEnvironment {
  const id = nonemptyString(values.id, "hardware-environment id", "hardware_environments");
  return {
    id,
    label: stringValue(values.label, "label", id),
    identity: parseValidatedJsonRecord<BenchmarkHardwareEnvironmentIdentity>(values.identity, "hardware-environment identity", id, _Hardware_Identity_Shape),
    metadata: parseJsonRecord(values.metadata, "hardware-environment metadata", id) as BenchmarkEnvironmentMetadata
  };
}

export function normalizeBenchmarkSoftwareEnvironment(values: Record<string, unknown>): BenchmarkSoftwareEnvironment {
  const id = nonemptyString(values.id, "software-environment id", "software_environments");
  return {
    id,
    label: stringValue(values.label, "label", id),
    identity: parseValidatedJsonRecord<BenchmarkSoftwareEnvironmentIdentity>(values.identity, "software-environment identity", id, _Software_Identity_Shape),
    metadata: parseJsonRecord(values.metadata, "software-environment metadata", id) as BenchmarkEnvironmentMetadata
  };
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

export function validateSchemaVersion(metadata: BenchLedgerMetadata) {
  if (metadata.schema_version === _Supported_Schema_Version) return;
  const actual = hasOwn(metadata.raw, "schema_version") ? metadata.raw.schema_version : "missing";
  throw new Error(`Unsupported BenchLedger schema version: ${actual}. Expected ${_Supported_Schema_Version}.`);
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

export async function loadManifest(manifestUrl?: string, signal?: AbortSignal): Promise<{ manifest: BenchLedgerManifest; url: string } | null> {
  const url = manifestUrl ?? _Default_Manifest_Url;
  const response = await fetch(url, { cache: "no-store", signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Failed to load benchledger.json: ${response.status}`);
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (manifestUrl === undefined && contentType.includes("text/html")) return null;
  const manifest = normalizeManifest(await response.json());
  if (!manifest) throw new Error("benchledger.json format is invalid.");
  return { manifest, url };
}

function databaseResponseRevision(response: Response): string | null {
  const etag = response.headers.get("etag")?.trim() ?? "";
  const lastModified = response.headers.get("last-modified")?.trim() ?? "";
  if (!etag && !lastModified) return null;
  return JSON.stringify([etag, lastModified, response.headers.get("content-length")?.trim() ?? ""]);
}

function rememberDatabaseResponseRevision(url: string, response: Response) {
  const revision = databaseResponseRevision(response);
  if (revision !== null) databaseResponseRevisions.set(url, revision);
}

export async function databaseUrlHasChanged(url: string, signal?: AbortSignal): Promise<boolean> {
  const response = await fetch(url, { method: "HEAD", cache: "no-store", signal });
  if (response.status === 405 || response.status === 501) return true;
  if (!response.ok) throw new Error(`Failed to check SQLite file: ${response.status}`);
  const revision = databaseResponseRevision(response);
  const previousRevision = databaseResponseRevisions.get(url);
  return revision === null || previousRevision === undefined || revision !== previousRevision;
}

export type LoadedDatabaseFile = { bytes: ArrayBuffer; sourceLabel: string; sourceUrl: string | null; };

export async function loadDatabaseFileFromUrl(url: string, sourceLabel = sourceLabelFromUrl(url), signal?: AbortSignal): Promise<LoadedDatabaseFile> {
  const response = await fetch(url, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Failed to load SQLite file: ${response.status}`);
  rememberDatabaseResponseRevision(url, response);
  return { bytes: await databaseBytesFromResponse(response, sourceLabel), sourceLabel, sourceUrl: url };
}

export async function refreshDatabaseFileFromUrl(url: string, sourceLabel = sourceLabelFromUrl(url), signal?: AbortSignal): Promise<LoadedDatabaseFile | null> {
  if (!await databaseUrlHasChanged(url, signal)) return null;
  return loadDatabaseFileFromUrl(url, sourceLabel, signal);
}

export async function loadManifestDatabaseFile(database: BenchLedgerManifestDatabase, manifestUrl = _Default_Manifest_Url, signal?: AbortSignal): Promise<LoadedDatabaseFile> {
  if (database.size_bytes !== undefined) assertDatabaseSize(database.size_bytes, database.name || database.id);
  const manifestPath = new URL(manifestUrl, window.location.href).toString();
  const databaseUrl = joinRelativeUrl(manifestPath, database.url);
  const response = await fetch(databaseUrl, { cache: "no-store", signal });
  if (!response.ok) throw new Error(`Failed to load SQLite file: ${response.status}`);
  rememberDatabaseResponseRevision(databaseUrl, response);
  const bytes = await databaseBytesFromResponse(response, database.name || database.id, database.size_bytes);
  await validateManifestDatabaseBytes(database, bytes);
  return { bytes, sourceLabel: database.name || database.id, sourceUrl: databaseUrl };
}

export function assertLocalDatabaseSize(file: File) { assertDatabaseSize(file.size, file.name); }
