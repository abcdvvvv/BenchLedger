import { formatDate, parseDate, shortCommit } from "./format";
import type { RunPairSortKey, SortDirection } from "./dashboard-settings";
import type {
  BenchmarkRow,
  BenchmarkRun,
  BenchLedgerManifestDatabase,
  BenchLedgerMetadata,
  LoadedBenchmarkDataset,
  PairComparison
} from "./types";

export type DatabaseCatalogStats = {
  rowCount: number;
  runCount: number;
  keyCount: number;
  environmentCount: number;
  metrics: string[];
  latestRunDate: string;
  dirtyRunCount: number;
};

export type DatabaseCatalogEntry = {
  id: string;
  title: string;
  source: string;
  description: string;
  url: string;
  sha256: string;
  sizeBytes: number | null;
  packedAt: string;
  schemaVersion: number | null;
  metadataPreview: Record<string, string | null>;
  isActive: boolean;
  stats: DatabaseCatalogStats | null;
};

export const Asset_Base_URL = import.meta.env.BASE_URL;

export const deltaColorKey = {
  up: "deltaUp",
  down: "deltaDown",
  neutral: "deltaNeutral"
} as const;

export const statDeltaTone = {
  up: "negative",
  down: "positive",
  neutral: "neutral"
} as const;

export const runPairTableColumns: { key: RunPairSortKey; label: string }[] = [
  { key: "benchmark", label: "Benchmark" },
  { key: "baseline", label: "Baseline" },
  { key: "focus", label: "Focus" },
  { key: "delta", label: "Delta" }
];

export function comparePath(left: string[], right: string[]): number {
  const length = Math.min(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const order = left[index].localeCompare(right[index]);
    if (order !== 0) return order;
  }
  return left.length - right.length;
}

function _metadataRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function _metadataString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function _metadataStringArray(record: Record<string, unknown>, key: string): string[] {
  const value = record[key];
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string" && entry.length > 0) : [];
}

function _codeStateIdentitySource(run: Pick<BenchmarkRun, "code_state_identity">): Record<string, unknown> {
  return _metadataRecord(run.code_state_identity.source);
}

function _runSource(run: Pick<BenchmarkRun, "run_metadata">): Record<string, unknown> {
  return _metadataRecord(run.run_metadata.source);
}

function _runBranch(run: Pick<BenchmarkRun, "run_metadata">): string {
  return _metadataString(_runSource(run), "branch");
}

function _runTags(run: Pick<BenchmarkRun, "run_metadata">): string[] {
  return _metadataStringArray(_runSource(run), "tags");
}

function _codeStateRevision(run: Pick<BenchmarkRun, "code_state_identity">): string {
  return _metadataString(_codeStateIdentitySource(run), "revision");
}

export function runId(row: Pick<BenchmarkRow, "run_id">): string {
  return row.run_id;
}

export function runHeadline(run: BenchmarkRun): string {
  const tags = _runTags(run);
  if (tags.length) return tags[0];
  if (run.code_label) return run.code_label;
  const revision = _codeStateRevision(run);
  if (revision) return shortCommit(revision);
  const branch = _runBranch(run);
  if (branch) return branch;
  return run.environment_label || "local";
}

export function runTone(run: BenchmarkRun): "tag" | "master" | "branch" {
  if (_runTags(run).length) return "tag";
  const branch = _runBranch(run);
  if (branch === "master" || branch === "main") return "master";
  return "branch";
}

export function runAxisLabel(run: BenchmarkRun): string {
  const tags = _runTags(run);
  if (tags.length) return tags[0];
  if (run.code_label) return run.code_label;
  const revision = _codeStateRevision(run);
  if (revision) return shortCommit(revision);
  return run.environment_label || "local";
}


export function runPairSortValue(row: PairComparison, key: RunPairSortKey): string | number {
  if (key === "benchmark") return row.benchmark_label;
  if (key === "focus") return row.focus_value;
  if (key === "baseline") return row.baseline_value;
  return row.delta;
}

export function defaultRunPairSortDirection(key: RunPairSortKey): SortDirection {
  return key === "benchmark" ? "asc" : "desc";
}

function compareRuns(left: BenchmarkRun, right: BenchmarkRun): number {
  const leftMeasuredAt = parseDate(left.measured_at)?.valueOf() ?? 0;
  const rightMeasuredAt = parseDate(right.measured_at)?.valueOf() ?? 0;
  if (leftMeasuredAt !== rightMeasuredAt) return rightMeasuredAt - leftMeasuredAt;
  const leftCodeDate = parseDate(left.code_date)?.valueOf() ?? 0;
  const rightCodeDate = parseDate(right.code_date)?.valueOf() ?? 0;
  if (leftCodeDate !== rightCodeDate) return rightCodeDate - leftCodeDate;
  return right.run_id.localeCompare(left.run_id);
}

export function buildRuns(dataset: LoadedBenchmarkDataset): BenchmarkRun[] {
  const benchmarkIdsByRun = new Map<string, Set<string>>();
  for (const row of dataset.rows) {
    const benchmarkIds = benchmarkIdsByRun.get(row.run_id);
    if (benchmarkIds) benchmarkIds.add(row.benchmark_id);
    else benchmarkIdsByRun.set(row.run_id, new Set([row.benchmark_id]));
  }

  const runs: BenchmarkRun[] = [];
  for (const [runId, benchmarkIds] of benchmarkIdsByRun) {
    const run = dataset.runsById.get(runId);
    if (!run) continue;
    const codeState = dataset.codeStatesById.get(run.code_state_id);
    const environment = dataset.environmentsById.get(run.environment_id);
    runs.push({
      run_id: run.id,
      code_state_id: run.code_state_id,
      code_label: codeState?.label ?? "",
      code_date: codeState?.code_date ?? "",
      environment_id: run.environment_id,
      environment_label: environment?.label ?? run.environment_id,
      measured_at: run.measured_at,
      notes: run.notes,
      code_state_identity: codeState?.identity ?? {},
      code_state_metadata: codeState?.metadata ?? {},
      environment_identity: environment?.identity ?? {},
      environment_metadata: environment?.metadata ?? {},
      run_metadata: run.metadata,
      benchmark_count: benchmarkIds.size
    });
  }
  return runs.sort(compareRuns);
}

export function databaseTitle(database: BenchLedgerManifestDatabase): string {
  return database.name || database.id;
}

function databasePreviewValue(database: BenchLedgerManifestDatabase, key: string): string {
  return database.metadata_preview?.[key] ?? "";
}

export function databaseDescription(database: BenchLedgerManifestDatabase): string {
  return database.description || databasePreviewValue(database, "description") || "No description provided.";
}

export function formatOptionalDate(value: string): string {
  return value ? formatDate(value) : "n/a";
}

export function formatSchemaLabel(value: number | null | undefined): string {
  return value === null || value === undefined ? "n/a" : `v${value}`;
}

export function metadataTitle(metadata: BenchLedgerMetadata): string {
  return metadata.name || "BenchLedger";
}

export function metadataDescription(metadata: BenchLedgerMetadata): string {
  return metadata.description || metadata.notes || "Performance tracking for benchmark datasets.";
}

export function sourceSummary(dataset: LoadedBenchmarkDataset | null): string {
  if (!dataset) return "No benchmark database loaded";
  return dataset.source_url ? `Serving ${dataset.source_label}` : `Loaded local file ${dataset.source_label}`;
}
