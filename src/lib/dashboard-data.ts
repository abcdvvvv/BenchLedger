import { formatDate, parseDate, percentageChange, shortCommit, unique } from "./format";
import { metricFamilyKey, trendDisplayUnitContext } from "./dashboard-plotting";
import type { RunPairSortKey, SortDirection } from "./dashboard-settings";
import type {
  BenchmarkRow,
  BenchmarkRun,
  BenchmarkDefinition,
  BenchLedgerManifestDatabase,
  BenchLedgerMetadata,
  LoadedBenchmarkDatabase,
  PairComparison,
  BenchmarkDatabaseStats
} from "./types";

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
  stats: BenchmarkDatabaseStats | null;
};

export const Asset_Base_URL = import.meta.env.BASE_URL;

export const runPairTableColumns: { key: RunPairSortKey; label: string }[] = [
  { key: "benchmark", label: "Benchmark" },
  { key: "baseline", label: "Baseline" },
  { key: "focus", label: "Focus" },
  { key: "delta", label: "Delta" }
];

function _runBranch(run: Pick<BenchmarkRun, "run_metadata">): string { return run.run_metadata.source?.branch ?? ""; }
function _runTags(run: Pick<BenchmarkRun, "run_metadata">): string[] { return run.run_metadata.source?.tags ?? []; }
function _codeStateRevision(run: Pick<BenchmarkRun, "code_state_identity">): string { return run.code_state_identity.source?.revision ?? ""; }
function _dirtyRunSuffix(run: BenchmarkRun): string { if (run.code_state_metadata.source?.dirty !== true) return ""; const digest = run.code_state_identity.source?.diff_digest ?? ""; return ` (${digest ? digest.slice(0, 6) : "dirty"})`; }

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
  const digest = run.code_state_identity.source?.diff_digest ?? "";
  return [`Run: ${runHeadline(run)}`, `Tag: ${_runTags(run).join(", ") || "n/a"}`, `Branch: ${_runBranch(run) || "n/a"}`,
    `Revision: ${_codeStateRevision(run) || "n/a"}`, `Dirty: ${run.code_state_metadata.source?.dirty === true}`, `Diff digest: ${digest || "n/a"}`].join(separator);
}

export function buildBenchmarkPairComparisons(
  focusRows: Array<Pick<BenchmarkRow, "benchmark_key" | "metric_name" | "statistic" | "value" | "unit" | "better">>,
  baselineRows: Array<Pick<BenchmarkRow, "benchmark_key" | "metric_name" | "statistic" | "value" | "unit" | "better">>,
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
  const hardwareLabel = `${model}${cores && !/\b\d+-Core\b/i.test(model) ? ` ${cores}-Core` : ""}`;
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

export function buildRuns(database: LoadedBenchmarkDatabase): BenchmarkRun[] {
  const resolved = Array.from(database.runsById.values()).flatMap((run) => {
    const codeState = database.codeStatesById.get(run.code_state_id), hardwareEnvironment = database.hardwareEnvironmentsById.get(run.hardware_environment_id), softwareEnvironment = database.softwareEnvironmentsById.get(run.software_environment_id);
    if (!codeState || !hardwareEnvironment || !softwareEnvironment) return [];
    const hardwareLabel = hardwareEnvironment.label || hardwareEnvironment.id, softwareLabel = softwareEnvironment.label || softwareEnvironment.id;
    return [{ run, codeState, hardwareEnvironment, softwareEnvironment, hardwareLabel, softwareLabel, pairKey: JSON.stringify([hardwareEnvironment.id, softwareEnvironment.id]), pairLabel: environmentPairLabel(hardwareEnvironment.identity, softwareEnvironment.identity, hardwareLabel, softwareLabel) }];
  });
  const pairLabels = new Map(resolved.map((entry) => [entry.pairKey, entry.pairLabel])), labelCounts = new Map<string, number>();
  for (const label of pairLabels.values()) labelCounts.set(label, (labelCounts.get(label) ?? 0) + 1);
  return resolved.map(({ run, codeState, hardwareEnvironment, softwareEnvironment, hardwareLabel, softwareLabel, pairLabel }) => ({
    run_id: run.id, code_label: codeState.label, code_date: codeState.code_date, hardware_environment_id: hardwareEnvironment.id, hardware_environment_label: hardwareLabel, software_environment_id: softwareEnvironment.id, software_environment_label: softwareLabel,
    environment_pair_label: (labelCounts.get(pairLabel) ?? 0) > 1 ? `${pairLabel} · s:${softwareEnvironment.id.replace(/^software-/, "").slice(0, 6)}` : pairLabel, configuration_key: JSON.stringify([codeState.id, hardwareEnvironment.id, softwareEnvironment.id]), measured_at: run.measured_at,
    code_state_identity: codeState.identity, code_state_metadata: codeState.metadata, hardware_environment_identity: hardwareEnvironment.identity, hardware_environment_metadata: hardwareEnvironment.metadata, software_environment_identity: softwareEnvironment.identity, software_environment_metadata: softwareEnvironment.metadata, run_metadata: run.metadata
  })).sort(compareRuns);
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
  return metadata.description || metadata.notes || "Performance tracking for benchmark databases.";
}

export function sourceSummary(database: LoadedBenchmarkDatabase | null): string {
  if (!database) return "No benchmark database loaded";
  return database.source_url ? `Serving ${database.source_label}` : `Loaded local file ${database.source_label}`;
}
