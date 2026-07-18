import { parseDate } from "./format";
import { comparePath, runAxisLabel, runHeadline, runTone } from "./dashboard-data";
import { metricFamilyLabel, type TrendPlotRow } from "./dashboard-plotting";
import { dateInputValue, type DisplayStrategy } from "./dashboard-settings";
import type { BenchmarkDefinition, BenchmarkRow, BenchmarkRun } from "./types";

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
  environment: string;
  metricKind: string;
  branch: string;
  timeStartValue: number | null;
  timeEndValue: number | null;
  displayStrategy: DisplayStrategy;
};

export type BenchmarkViewIndexedRow = {
  row: BenchmarkRow;
  benchmark: BenchmarkDefinition;
  environmentId: string;
  codeDate: string;
  metricKind: string;
  branch: string;
  codeDateValue: number | null;
  hasTags: boolean;
  isMainBranch: boolean;
};

export type BenchmarkViewIndex = {
  rowsByEnvironment: ReadonlyMap<string, BenchmarkViewIndexedRow[]>;
  metricOptionsByEnvironment: ReadonlyMap<string, string[]>;
  branchOptions: string[];
  datasetTimeStart: string;
  datasetTimeEnd: string;
};

export type BenchmarkViewBaseSlice = {
  effectiveEnvironment: string;
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
  benchmarksById: ReadonlyMap<string, BenchmarkDefinition>
): BenchmarkViewIndex {
  const allRows: BenchmarkViewIndexedRow[] = [];
  const rowsByEnvironment = new Map<string, BenchmarkViewIndexedRow[]>([["all", allRows]]);
  const metricOptionsByEnvironment = new Map<string, Set<string>>([["all", new Set<string>()]]);
  const branchOptions = new Set<string>();
  let earliestCodeDateValue = Number.POSITIVE_INFINITY;
  let earliestCodeDate = "";
  let latestCodeDateValue = Number.NEGATIVE_INFINITY;
  let latestCodeDate = "";

  for (const row of rows) {
    const indexedRow = _indexRow(row, runsById.get(row.run_id), benchmarksById.get(row.benchmark_id));
    allRows.push(indexedRow);
    metricOptionsByEnvironment.get("all")!.add(indexedRow.metricKind);

    const environmentRows = rowsByEnvironment.get(indexedRow.environmentId);
    if (environmentRows) {
      environmentRows.push(indexedRow);
    } else {
      rowsByEnvironment.set(indexedRow.environmentId, [indexedRow]);
    }

    const environmentMetricOptions = metricOptionsByEnvironment.get(indexedRow.environmentId);
    if (environmentMetricOptions) {
      environmentMetricOptions.add(indexedRow.metricKind);
    } else {
      metricOptionsByEnvironment.set(indexedRow.environmentId, new Set([indexedRow.metricKind]));
    }

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
    rowsByEnvironment,
    metricOptionsByEnvironment: new Map(Array.from(metricOptionsByEnvironment.entries()).map(([environment, metricOptions]) => [
      environment,
      Array.from(metricOptions).sort()
    ])),
    branchOptions: ["all", ...Array.from(branchOptions).sort()],
    datasetTimeStart: dateInputValue(earliestCodeDate),
    datasetTimeEnd: dateInputValue(latestCodeDate)
  };
}

export function buildGroupOptions(benchmarks: Iterable<BenchmarkDefinition>): BenchmarkViewGroupOption[] {
  const optionsByValue = new Map<string, BenchmarkViewGroupOption>();
  for (const benchmark of benchmarks) {
    for (let depth = 1; depth <= benchmark.path.length; depth += 1) {
      const path = benchmark.path.slice(0, depth);
      const value = JSON.stringify(path);
      if (optionsByValue.has(value)) continue;
      optionsByValue.set(value, { value, path });
    }
  }
  return Array.from(optionsByValue.values()).sort((left, right) => comparePath(left.path, right.path));
}

export function buildBenchmarkOptions(benchmarks: Iterable<BenchmarkDefinition>): BenchmarkViewBenchmarkOption[] {
  return Array.from(benchmarks, (benchmark) => ({
    value: benchmark.id,
    label: benchmark.label,
    path: benchmark.path
  })).sort((left, right) => comparePath(left.path, right.path) || left.label.localeCompare(right.label) || left.value.localeCompare(right.value));
}

function benchmarkMatchesGroup(benchmark: BenchmarkDefinition, selectedGroupPath: string[] | null): boolean {
  if (!selectedGroupPath) return true;
  return selectedGroupPath.every((segment, index) => benchmark.path[index] === segment);
}

export function resolveBenchmarkViewBaseSlice(
  index: BenchmarkViewIndex,
  state: BenchmarkViewFilterState
): BenchmarkViewBaseSlice {
  const effectiveEnvironment = index.rowsByEnvironment.has(state.environment) ? state.environment : "all";
  const metricOptions = index.metricOptionsByEnvironment.get(effectiveEnvironment) ?? [];
  const effectiveMetricKind = metricOptions.includes(state.metricKind) ? state.metricKind : (metricOptions[0] ?? "");
  const effectiveBranch = index.branchOptions.includes(state.branch) ? state.branch : "all";
  const filteredRows: BenchmarkRow[] = [];
  const filteredBenchmarksById = new Map<string, BenchmarkDefinition>();

  if (effectiveMetricKind) {
    for (const indexedRow of index.rowsByEnvironment.get(effectiveEnvironment) ?? []) {
      if (indexedRow.metricKind !== effectiveMetricKind) continue;
      if (effectiveBranch !== "all" && indexedRow.branch !== effectiveBranch) continue;
      if (!rowMatchesDisplayStrategyFromFacts(indexedRow, state.displayStrategy)) continue;
      if (state.timeStartValue !== null && (indexedRow.codeDateValue === null || indexedRow.codeDateValue < state.timeStartValue)) continue;
      if (state.timeEndValue !== null && (indexedRow.codeDateValue === null || indexedRow.codeDateValue > state.timeEndValue)) continue;
      filteredRows.push(indexedRow.row);
      filteredBenchmarksById.set(indexedRow.benchmark.id, indexedRow.benchmark);
    }
  }

  const filteredBenchmarks = Array.from(filteredBenchmarksById.values());
  return {
    effectiveEnvironment,
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
        const scopedBenchmarkIds = new Set(scopedBenchmarks.map((benchmark) => benchmark.id));
        return baseSlice.filteredRows.filter((row) => scopedBenchmarkIds.has(row.benchmark_id));
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

export function resolveBenchmarkViewSlice(
  index: BenchmarkViewIndex,
  state: BenchmarkViewFilterState & { group: string }
): BenchmarkViewResolvedSlice {
  return resolveBenchmarkViewGroupSlice(resolveBenchmarkViewBaseSlice(index, state), state.group);
}

export function normalizeSelectedBenchmarkIds(
  selectedBenchmarkIds: string[],
  benchmarkOptions: BenchmarkViewBenchmarkOption[]
): string[] {
  const availableValues = new Set(benchmarkOptions.map((option) => option.value));
  const normalized = selectedBenchmarkIds.filter((value) => availableValues.has(value));
  return normalized.length === selectedBenchmarkIds.length ? selectedBenchmarkIds : normalized;
}

export function buildTrendRowsByBenchmark(
  rows: BenchmarkRow[],
  runsById: ReadonlyMap<string, BenchmarkRun>,
  selectedBenchmarkIds: string[]
): Map<string, TrendPlotRow[]> {
  const rowsByBenchmark = new Map<string, TrendPlotRow[]>();
  if (!selectedBenchmarkIds.length) return rowsByBenchmark;

  const selectedBenchmarkIdSet = new Set(selectedBenchmarkIds);

  for (const row of rows) {
    if (!selectedBenchmarkIdSet.has(row.benchmark_id)) continue;
    const run = runsById.get(row.run_id);
    if (!run) continue;
    const dateValue = parseDate(run.code_date);
    if (!dateValue) continue;
    const entry: TrendPlotRow = {
      ...row,
      code_state_id: run.code_state_id,
      code_date: run.code_date,
      environment_id: run.environment_id,
      environment_label: run.environment_label,
      measured_at: run.measured_at,
      date_value: dateValue,
      run_axis_label: runAxisLabel(run),
      run_headline: runHeadline(run),
      run_tone: runTone(run)
    };
    const bucket = rowsByBenchmark.get(row.benchmark_id);
    if (bucket) {
      bucket.push(entry);
      continue;
    }
    rowsByBenchmark.set(row.benchmark_id, [entry]);
  }

  for (const entries of rowsByBenchmark.values()) {
    entries.sort(_compareTrendRowsByDate);
  }

  return rowsByBenchmark;
}


function _compareTrendRowsByDate(left: TrendPlotRow, right: TrendPlotRow): number {
  return left.date_value!.valueOf() - right.date_value!.valueOf();
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
    benchmark: benchmark ?? { id: row.benchmark_id, path: [], label: row.benchmark_id },
    environmentId: run?.environment_id ?? "",
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
