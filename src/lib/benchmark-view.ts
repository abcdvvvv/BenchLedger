import { aggregateBenchmarkRows, runConfigurationKey } from "./benchmark-aggregation";
import { parseDate } from "./format";
import { comparePath, runAxisLabel, runHeadline, runIdentityTitle, runTone } from "./dashboard-data";
import { metricFamilyLabel, type TrendPlotRow } from "./dashboard-plotting";
import { dateInputValue, type DisplayStrategy } from "./dashboard-settings";
import type { BenchmarkDefinition, BenchmarkRow, BenchmarkRun, BenchmarkRunRecord } from "./types";

export type BenchmarkViewGroupOption = {
  value: string;
  path: string[];
};

export type BenchmarkViewBenchmarkOption = {
  value: string;
  path: string[];
  label: string;
};

export type BenchmarkViewFilterState = {
  environmentPair: string;
  metricKind: string;
  branch: string;
  timeStartValue: number | null;
  timeEndValue: number | null;
  displayStrategy: DisplayStrategy;
};

export type BenchmarkViewIndexedRow = {
  row: BenchmarkRow;
  benchmark: BenchmarkDefinition;
  environmentPairKey: string;
  codeDate: string;
  metricKind: string;
  branch: string;
  codeDateValue: number | null;
  hasTags: boolean;
  isMainBranch: boolean;
};

export type BenchmarkViewIndex = {
  rowsByEnvironmentPair: ReadonlyMap<string, BenchmarkViewIndexedRow[]>;
  metricOptionsByEnvironmentPair: ReadonlyMap<string, string[]>;
  branchOptions: string[];
  datasetTimeStart: string;
  datasetTimeEnd: string;
};

export type BenchmarkViewBaseSlice = {
  effectiveEnvironmentPair: string;
  effectiveMetricKind: string;
  effectiveBranch: string;
  metricOptions: string[];
  branchOptions: string[];
  datasetTimeStart: string;
  datasetTimeEnd: string;
  filteredRows: BenchmarkRow[];
  filteredBenchmarks: BenchmarkDefinition[];
  groupOptions: BenchmarkViewGroupOption[];
};

export type BenchmarkViewResolvedSlice = BenchmarkViewBaseSlice & {
  effectiveGroup: string;
  selectedGroupLabel: string;
  scopedRows: BenchmarkRow[];
  benchmarkOptions: BenchmarkViewBenchmarkOption[];
};

export function buildBenchmarkViewIndex(
  rows: BenchmarkRow[],
  runsById: ReadonlyMap<string, BenchmarkRun>,
  benchmarksByKey: ReadonlyMap<string, BenchmarkDefinition>
): BenchmarkViewIndex {
  const allRows: BenchmarkViewIndexedRow[] = [];
  const rowsByEnvironmentPair = new Map<string, BenchmarkViewIndexedRow[]>([["all", allRows]]);
  const metricOptionsByEnvironmentPair = new Map<string, Set<string>>([["all", new Set<string>()]]);
  const branchOptions = new Set<string>();
  let earliestCodeDateValue = Number.POSITIVE_INFINITY;
  let earliestCodeDate = "";
  let latestCodeDateValue = Number.NEGATIVE_INFINITY;
  let latestCodeDate = "";

  for (const row of rows) {
    const indexedRow = _indexRow(row, runsById.get(row.run_id), benchmarksByKey.get(row.benchmark_key));
    allRows.push(indexedRow);
    metricOptionsByEnvironmentPair.get("all")!.add(indexedRow.metricKind);

    const pairRows = rowsByEnvironmentPair.get(indexedRow.environmentPairKey);
    if (pairRows) pairRows.push(indexedRow);
    else rowsByEnvironmentPair.set(indexedRow.environmentPairKey, [indexedRow]);

    const pairMetricOptions = metricOptionsByEnvironmentPair.get(indexedRow.environmentPairKey);
    if (pairMetricOptions) pairMetricOptions.add(indexedRow.metricKind);
    else metricOptionsByEnvironmentPair.set(indexedRow.environmentPairKey, new Set([indexedRow.metricKind]));

    if (indexedRow.branch) branchOptions.add(indexedRow.branch);

    if (indexedRow.codeDateValue === null) continue;
    if (indexedRow.codeDateValue < earliestCodeDateValue) {
      earliestCodeDateValue = indexedRow.codeDateValue;
      earliestCodeDate = indexedRow.codeDate;
    }
    if (indexedRow.codeDateValue > latestCodeDateValue) {
      latestCodeDateValue = indexedRow.codeDateValue;
      latestCodeDate = indexedRow.codeDate;
    }
  }

  return {
    rowsByEnvironmentPair,
    metricOptionsByEnvironmentPair: new Map(
      Array.from(metricOptionsByEnvironmentPair.entries()).map(([pair, metricOptions]) => [
        pair,
        Array.from(metricOptions).sort()
      ])
    ),
    branchOptions: ["all", ...Array.from(branchOptions).sort()],
    datasetTimeStart: dateInputValue(earliestCodeDate),
    datasetTimeEnd: dateInputValue(latestCodeDate)
  };
}

function buildGroupOptions(benchmarks: Iterable<BenchmarkDefinition>): BenchmarkViewGroupOption[] {
  const optionsByValue = new Map<string, BenchmarkViewGroupOption>();
  for (const benchmark of benchmarks) {
    for (let depth = 1; depth < benchmark.path.length; depth += 1) {
      const path = benchmark.path.slice(0, depth);
      const value = JSON.stringify(path);
      if (optionsByValue.has(value)) continue;
      optionsByValue.set(value, { value, path });
    }
  }
  return Array.from(optionsByValue.values()).sort((left, right) => comparePath(left.path, right.path));
}

function buildBenchmarkOptions(benchmarks: Iterable<BenchmarkDefinition>): BenchmarkViewBenchmarkOption[] {
  return Array.from(benchmarks, (benchmark) => ({
    value: benchmark.key,
    label: benchmark.label,
    path: benchmark.path
  })).sort((left, right) =>
    comparePath(left.path, right.path) || left.label.localeCompare(right.label) || left.value.localeCompare(right.value)
  );
}

function benchmarkMatchesGroup(benchmark: BenchmarkDefinition, selectedGroupPath: string[] | null): boolean {
  if (!selectedGroupPath) return true;
  return selectedGroupPath.every((segment, index) => benchmark.path[index] === segment);
}

export function resolveBenchmarkViewBaseSlice(
  index: BenchmarkViewIndex,
  state: BenchmarkViewFilterState
): BenchmarkViewBaseSlice {
  const effectiveEnvironmentPair = index.rowsByEnvironmentPair.has(state.environmentPair)
    ? state.environmentPair
    : "all";
  const metricOptions = index.metricOptionsByEnvironmentPair.get(effectiveEnvironmentPair) ?? [];
  const effectiveMetricKind = metricOptions.includes(state.metricKind) ? state.metricKind : (metricOptions[0] ?? "");
  const effectiveBranch = index.branchOptions.includes(state.branch) ? state.branch : "all";
  const filteredRows: BenchmarkRow[] = [];
  const filteredBenchmarksByKey = new Map<string, BenchmarkDefinition>();

  if (effectiveMetricKind) {
    for (const indexedRow of index.rowsByEnvironmentPair.get(effectiveEnvironmentPair) ?? []) {
      if (indexedRow.metricKind !== effectiveMetricKind) continue;
      if (effectiveBranch !== "all" && indexedRow.branch !== effectiveBranch) continue;
      if (!rowMatchesDisplayStrategyFromFacts(indexedRow, state.displayStrategy)) continue;
      if (state.timeStartValue !== null && (indexedRow.codeDateValue === null || indexedRow.codeDateValue < state.timeStartValue)) continue;
      if (state.timeEndValue !== null && (indexedRow.codeDateValue === null || indexedRow.codeDateValue > state.timeEndValue)) continue;
      filteredRows.push(indexedRow.row);
      filteredBenchmarksByKey.set(indexedRow.benchmark.key, indexedRow.benchmark);
    }
  }

  const filteredBenchmarks = Array.from(filteredBenchmarksByKey.values());
  return {
    effectiveEnvironmentPair,
    effectiveMetricKind,
    effectiveBranch,
    metricOptions,
    branchOptions: index.branchOptions,
    datasetTimeStart: index.datasetTimeStart,
    datasetTimeEnd: index.datasetTimeEnd,
    filteredRows,
    filteredBenchmarks,
    groupOptions: buildGroupOptions(filteredBenchmarks)
  };
}

export function resolveBenchmarkViewGroupSlice(
  baseSlice: BenchmarkViewBaseSlice,
  group: string
): BenchmarkViewResolvedSlice {
  const selectedGroup = group === "all"
    ? null
    : baseSlice.groupOptions.find((option) => option.value === group) ?? null;
  const effectiveGroup = selectedGroup ? group : "all";
  const selectedGroupPath = selectedGroup?.path ?? null;
  const scopedBenchmarks = selectedGroupPath
    ? baseSlice.filteredBenchmarks.filter((benchmark) => benchmarkMatchesGroup(benchmark, selectedGroupPath))
    : baseSlice.filteredBenchmarks;
  const scopedRows = selectedGroupPath
    ? (() => {
        const scopedBenchmarkKeys = new Set(scopedBenchmarks.map((benchmark) => benchmark.key));
        return baseSlice.filteredRows.filter((row) => scopedBenchmarkKeys.has(row.benchmark_key));
      })()
    : baseSlice.filteredRows;

  return {
    ...baseSlice,
    effectiveGroup,
    selectedGroupLabel: selectedGroup?.path.join(" > ") ?? "All groups",
    scopedRows,
    benchmarkOptions: buildBenchmarkOptions(scopedBenchmarks)
  };
}

export function normalizeSelectedBenchmarkKeys(
  selectedBenchmarkKeys: string[],
  benchmarkOptions: BenchmarkViewBenchmarkOption[]
): string[] {
  const availableValues = new Set(benchmarkOptions.map((option) => option.value));
  const normalized = selectedBenchmarkKeys.filter((value) => availableValues.has(value));
  return normalized.length === selectedBenchmarkKeys.length ? selectedBenchmarkKeys : normalized;
}

export function buildTrendRowsByBenchmark(
  rows: readonly BenchmarkRow[],
  runRecordsById: ReadonlyMap<string, BenchmarkRunRecord>,
  runsById: ReadonlyMap<string, BenchmarkRun>,
  selectedBenchmarkKeys: readonly string[]
): Map<string, TrendPlotRow[]> {
  const rowsByBenchmark = new Map<string, TrendPlotRow[]>();
  if (!selectedBenchmarkKeys.length) return rowsByBenchmark;

  const selectedBenchmarkKeySet = new Set(selectedBenchmarkKeys);
  const selectedRows = rows.filter((row) => selectedBenchmarkKeySet.has(row.benchmark_key));
  const representativeRunsByAggregate = new Map<string, BenchmarkRun>();

  for (const row of selectedRows) {
    const runRecord = runRecordsById.get(row.run_id);
    const run = runsById.get(row.run_id);
    if (!runRecord || !run) continue;
    const configurationKey = runConfigurationKey(runRecord);
    const aggregateKey = _trendAggregateKey(configurationKey, row);
    const current = representativeRunsByAggregate.get(aggregateKey);
    if (!current || _compareRepresentativeRuns(run, current) < 0) {
      representativeRunsByAggregate.set(aggregateKey, run);
    }
  }

  for (const aggregate of aggregateBenchmarkRows(selectedRows, runRecordsById)) {
    const run = representativeRunsByAggregate.get(_trendAggregateKey(aggregate.configuration_key, aggregate));
    if (!run) continue;
    const dateValue = parseDate(run.code_date);
    if (!dateValue) continue;
    const aggregateLabel = aggregate.run_count === 1
      ? "1 contributing run"
      : `${aggregate.run_count.toLocaleString()} contributing runs averaged`;
    const entry: TrendPlotRow = {
      run_id: run.run_id,
      benchmark_key: aggregate.benchmark_key,
      metric_name: aggregate.metric_name,
      statistic: aggregate.statistic,
      unit: aggregate.unit,
      value: aggregate.value,
      better: aggregate.better,
      configuration_key: aggregate.configuration_key,
      code_state_id: aggregate.code_state_id,
      code_date: run.code_date,
      environment_pair_key: run.environment_pair_key,
      environment_pair_label: run.environment_pair_label,
      measured_at: run.measured_at,
      date_value: dateValue,
      run_axis_label: runAxisLabel(run),
      run_headline: runHeadline(run),
      run_tone: runTone(run),
      run_identity_title: `${aggregateLabel}<br>${runIdentityTitle(run, "<br>")}`,
      run_count: aggregate.run_count
    };
    const bucket = rowsByBenchmark.get(aggregate.benchmark_key);
    if (bucket) bucket.push(entry);
    else rowsByBenchmark.set(aggregate.benchmark_key, [entry]);
  }

  for (const entries of rowsByBenchmark.values()) entries.sort(_compareTrendRowsByDate);
  return rowsByBenchmark;
}

function _trendAggregateKey(
  configurationKey: string,
  row: Pick<BenchmarkRow, "benchmark_key" | "metric_name" | "statistic">
): string {
  return JSON.stringify([configurationKey, row.benchmark_key, row.metric_name, row.statistic]);
}

function _compareRepresentativeRuns(left: BenchmarkRun, right: BenchmarkRun): number {
  const leftMeasuredAt = parseDate(left.measured_at)?.valueOf() ?? Number.NEGATIVE_INFINITY;
  const rightMeasuredAt = parseDate(right.measured_at)?.valueOf() ?? Number.NEGATIVE_INFINITY;
  if (leftMeasuredAt !== rightMeasuredAt) return rightMeasuredAt - leftMeasuredAt;
  return right.run_id.localeCompare(left.run_id);
}

function _compareTrendRowsByDate(left: TrendPlotRow, right: TrendPlotRow): number {
  return left.date_value!.valueOf() - right.date_value!.valueOf() ||
    left.code_state_id.localeCompare(right.code_state_id) ||
    left.environment_pair_key.localeCompare(right.environment_pair_key) ||
    left.configuration_key.localeCompare(right.configuration_key);
}

function _indexRow(
  row: BenchmarkRow,
  run: BenchmarkRun | undefined,
  benchmark: BenchmarkDefinition | undefined
): BenchmarkViewIndexedRow {
  const branch = run?.run_metadata.source?.branch || "";
  const tags = run?.run_metadata.source?.tags ?? [];
  const codeDate = run?.code_date ?? "";

  return {
    row,
    benchmark: benchmark ?? { key: row.benchmark_key, path: [], label: row.benchmark_key },
    environmentPairKey: run?.environment_pair_key ?? "",
    codeDate,
    metricKind: metricFamilyLabel(row),
    branch,
    codeDateValue: parseDate(codeDate)?.valueOf() ?? null,
    hasTags: Boolean(tags.length),
    isMainBranch: branch === "main" || branch === "master"
  };
}

function rowMatchesDisplayStrategyFromFacts(
  row: Pick<BenchmarkViewIndexedRow, "hasTags" | "isMainBranch">,
  strategy: DisplayStrategy
): boolean {
  if (strategy === "all") return true;
  if (row.hasTags) return true;
  return strategy === "tagged-main" && row.isMainBranch;
}
