import { formatDate, parseDate, percentageChange, shortCommit, unique } from "./format";
import { metricFamilyKey, metricFamilyLabel, trendDisplayUnitContext } from "./dashboard-plotting";
import type { RunPairSortKey, SortDirection } from "./dashboard-settings";
import type {
  BenchmarkRow,
  BenchmarkRun,
  BenchmarkDefinition,
  BenchLedgerManifestDatabase,
  BenchLedgerMetadata,
  LoadedBenchmarkDataset,
  PairComparison
} from "./types";

export type DatabaseCatalogStats = {
  rowCount: number;
  runCount: number;
  keyCount: number;
  hardwareEnvironmentCount: number;
  softwareEnvironmentCount: number;
  configurationCount: number;
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

export function buildDatabaseCatalogStats(
  dataset: LoadedBenchmarkDataset | null,
  rows: readonly BenchmarkRow[],
  runs: readonly BenchmarkRun[]
): DatabaseCatalogStats | null {
  if (!dataset) return null;

  let latestRunDate = "";
  let latestRunValue = Number.NEGATIVE_INFINITY;
  for (const run of runs) {
    const measuredAt = parseDate(run.measured_at)?.valueOf();
    if (measuredAt === undefined || measuredAt <= latestRunValue) continue;
    latestRunValue = measuredAt;
    latestRunDate = run.measured_at;
  }

  return {
    rowCount: rows.length,
    runCount: runs.length,
    keyCount: dataset.benchmarksByKey.size,
    hardwareEnvironmentCount: dataset.hardwareEnvironmentsById.size,
    softwareEnvironmentCount: dataset.softwareEnvironmentsById.size,
    configurationCount: unique(runs.map((run) => run.configuration_key)).length,
    metrics: unique(rows.map(metricFamilyLabel)).sort(),
    latestRunDate,
    dirtyRunCount: runs.filter((run) => run.code_state_metadata.source?.dirty === true).length
  };
}

export const Asset_Base_URL = import.meta.env.BASE_URL;

export const deltaColorKey = {
  up: "deltaUp",
  down: "deltaDown",
  neutral: "deltaNeutral"
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

function _dirtyRunSuffix(run: BenchmarkRun): string {
  if (run.code_state_metadata.source?.dirty !== true) return "";
  const digest = _metadataString(_codeStateIdentitySource(run), "diff_digest");
  return ` (${digest ? digest.slice(0, 6) : "dirty"})`;
}

export function runId(row: Pick<BenchmarkRow, "run_id">): string {
  return row.run_id;
}

export function runHeadline(run: BenchmarkRun): string {
  const suffix = _dirtyRunSuffix(run);
  const tags = _runTags(run);
  if (tags.length) return `${tags[0]}${suffix}`;
  if (run.code_label) return `${run.code_label}${suffix}`;
  const revision = _codeStateRevision(run);
  if (revision) return `${shortCommit(revision)}${suffix}`;
  const branch = _runBranch(run);
  if (branch) return `${branch}${suffix}`;
  return `${run.environment_pair_label || "local"}${suffix}`;
}

export function runTone(run: BenchmarkRun): "tag" | "master" | "branch" {
  if (_runTags(run).length) return "tag";
  const branch = _runBranch(run);
  if (branch === "master" || branch === "main") return "master";
  return "branch";
}

export function runAxisLabel(run: BenchmarkRun): string {
  const suffix = _dirtyRunSuffix(run);
  const tags = _runTags(run);
  if (tags.length) return `${tags[0]}${suffix}`;
  if (run.code_label) return `${run.code_label}${suffix}`;
  const revision = _codeStateRevision(run);
  if (revision) return `${shortCommit(revision)}${suffix}`;
  return `${run.environment_pair_label || "local"}${suffix}`;
}

export function runIdentityTitle(run: BenchmarkRun, separator = "\n"): string {
  const digest = _metadataString(_codeStateIdentitySource(run), "diff_digest");
  return [`Run: ${runHeadline(run)}`, `Tag: ${_runTags(run).join(", ") || "n/a"}`, `Branch: ${_runBranch(run) || "n/a"}`,
    `Revision: ${_codeStateRevision(run) || "n/a"}`, `Dirty: ${run.code_state_metadata.source?.dirty === true}`, `Diff digest: ${digest || "n/a"}`].join(separator);
}


export function buildRunPairComparisons(
  focusRows: BenchmarkRow[],
  baselineRows: BenchmarkRow[],
  benchmarksByKey: ReadonlyMap<string, BenchmarkDefinition>
): PairComparison[] {
  const focusByBenchmark = new Map(focusRows.map((row) => [row.benchmark_key, row]));
  const baselineByBenchmark = new Map(baselineRows.map((row) => [row.benchmark_key, row]));
  const keys = unique([...focusByBenchmark.keys(), ...baselineByBenchmark.keys()]).sort();

  return keys
    .map((key): PairComparison | null => {
      const focus = focusByBenchmark.get(key);
      const baseline = baselineByBenchmark.get(key);
      const benchmark_label = benchmarksByKey.get(key)?.label ?? key;

      if (focus && baseline) {
        if (metricFamilyKey(focus) !== metricFamilyKey(baseline)) return null;
        const displayUnitContext = trendDisplayUnitContext([
          { value: focus.value, unit: focus.unit },
          { value: baseline.value, unit: baseline.unit }
        ]);
        const focus_value = displayUnitContext.scaleValue(focus.value, focus.unit);
        const baseline_value = displayUnitContext.scaleValue(baseline.value, baseline.unit);
        return {
          status: "matched",
          benchmark_key: key,
          benchmark_label,
          focus_value,
          baseline_value,
          focus_unit: focus.unit,
          baseline_unit: baseline.unit,
          delta: percentageChange(focus_value, baseline_value),
          unit: displayUnitContext.unit || focus.unit,
          better: focus.better
        };
      }

      if (focus) {
        return {
          status: "focus-only",
          benchmark_key: key,
          benchmark_label,
          focus_value: focus.value,
          baseline_value: null,
          focus_unit: focus.unit,
          baseline_unit: null,
          delta: null,
          unit: focus.unit,
          better: focus.better
        };
      }

      if (!baseline) return null;
      return {
        status: "baseline-only",
        benchmark_key: key,
        benchmark_label,
        focus_value: null,
        baseline_value: baseline.value,
        focus_unit: null,
        baseline_unit: baseline.unit,
        delta: null,
        unit: baseline.unit,
        better: baseline.better
      };
    })
    .filter((row): row is PairComparison => row !== null)
    .sort((left, right) => {
      if (left.status === "matched" && right.status === "matched") {
        return Math.abs(right.delta) - Math.abs(left.delta);
      }
      if (left.status === "matched") return -1;
      if (right.status === "matched") return 1;
      return left.benchmark_label.localeCompare(right.benchmark_label);
    });
}

export function runPairSortValue(row: PairComparison, key: RunPairSortKey): string | number | null {
  if (key === "benchmark") return row.benchmark_label;
  if (key === "focus") return row.focus_value;
  if (key === "baseline") return row.baseline_value;
  return row.delta;
}

export function defaultRunPairSortDirection(key: RunPairSortKey): SortDirection {
  return key === "benchmark" ? "asc" : "desc";
}

function environmentPairLabel(hardware: BenchmarkRun["hardware_environment_identity"], software: BenchmarkRun["software_environment_identity"], hardwareFallback: string, softwareFallback: string): string {
  const model = (hardware.cpu?.model?.trim() || hardwareFallback).replace(/\s+Processor$/i, "");
  const cores = hardware.cpu?.physical_cores;
  const hardwareLabel = `${model}${cores && !model.includes(`${cores}-Core`) ? ` ${cores}-Core` : ""}`;
  const named = (value?: { name?: string; version?: string }) => [value?.name, value?.version].filter(Boolean).join(" ");
  const threads = software.execution?.threads;
  const softwareLabel = [named(software.platform?.os), named(software.runtime), threads ? `${threads} thread${threads === 1 ? "" : "s"}` : ""].filter(Boolean).join(" / ");
  return `${hardwareLabel} / ${softwareLabel || softwareFallback}`;
}

function compareRuns(left: BenchmarkRun, right: BenchmarkRun): number {
  const leftCodeDate = parseDate(left.code_date)?.valueOf() ?? 0;
  const rightCodeDate = parseDate(right.code_date)?.valueOf() ?? 0;
  if (leftCodeDate !== rightCodeDate) return rightCodeDate - leftCodeDate;
  const leftMeasuredAt = parseDate(left.measured_at)?.valueOf() ?? 0;
  const rightMeasuredAt = parseDate(right.measured_at)?.valueOf() ?? 0;
  if (leftMeasuredAt !== rightMeasuredAt) return rightMeasuredAt - leftMeasuredAt;
  return right.run_id.localeCompare(left.run_id);
}

export function buildRuns(dataset: LoadedBenchmarkDataset): BenchmarkRun[] {
  const benchmarkKeysByRun = new Map<string, Set<string>>();
  for (const row of dataset.rows) {
    const benchmarkKeys = benchmarkKeysByRun.get(row.run_id);
    if (benchmarkKeys) benchmarkKeys.add(row.benchmark_key);
    else benchmarkKeysByRun.set(row.run_id, new Set([row.benchmark_key]));
  }

  const runs: BenchmarkRun[] = [];
  for (const run of dataset.runsById.values()) {
    const codeState = dataset.codeStatesById.get(run.code_state_id);
    const hardwareEnvironment = dataset.hardwareEnvironmentsById.get(run.hardware_environment_id);
    const softwareEnvironment = dataset.softwareEnvironmentsById.get(run.software_environment_id);
    if (!codeState || !hardwareEnvironment || !softwareEnvironment) continue;

    const hardwareLabel = hardwareEnvironment.label || hardwareEnvironment.id;
    const softwareLabel = softwareEnvironment.label || softwareEnvironment.id;
    const pairLabel = environmentPairLabel(hardwareEnvironment.identity, softwareEnvironment.identity, hardwareLabel, softwareLabel);
    const notes = typeof run.metadata.notes === "string" ? run.metadata.notes : "";

    runs.push({
      run_id: run.id,
      code_state_id: run.code_state_id,
      code_label: codeState.label,
      code_date: codeState.code_date,
      hardware_environment_id: hardwareEnvironment.id,
      hardware_environment_label: hardwareLabel,
      software_environment_id: softwareEnvironment.id,
      software_environment_label: softwareLabel,
      environment_pair_key: JSON.stringify([hardwareEnvironment.id, softwareEnvironment.id]),
      environment_pair_label: pairLabel,
      configuration_key: JSON.stringify([codeState.id, hardwareEnvironment.id, softwareEnvironment.id]),
      configuration_label: `${codeState.label || codeState.id} · ${pairLabel}`,
      measured_at: run.measured_at,
      notes,
      code_state_identity: codeState.identity,
      code_state_metadata: codeState.metadata,
      hardware_environment_identity: hardwareEnvironment.identity,
      hardware_environment_metadata: hardwareEnvironment.metadata,
      software_environment_identity: softwareEnvironment.identity,
      software_environment_metadata: softwareEnvironment.metadata,
      run_metadata: run.metadata,
      benchmark_count: benchmarkKeysByRun.get(run.id)?.size ?? 0
    });
  }

  const pairLabels = new Map(runs.map((run) => [run.environment_pair_key, run.environment_pair_label]));
  const labelCounts = new Map<string, number>();
  for (const label of pairLabels.values()) labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  for (const run of runs) {
    if ((labelCounts.get(run.environment_pair_label) ?? 0) < 2) continue;
    run.environment_pair_label += ` · s:${run.software_environment_id.replace(/^software-/, "").slice(0, 6)}`;
    run.configuration_label = `${run.code_label || run.code_state_id} · ${run.environment_pair_label}`;
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
