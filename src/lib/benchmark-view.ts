import { parseDate } from "./format";
import {
  comparePath,
  dateInputValue,
  metricFamilyLabel,
  rowMatchesDisplayStrategy,
  runAxisLabel,
  runHeadline,
  runTone,
  type DisplayStrategy,
  type TrendPlotRow
} from "./dashboard";
import type { BenchmarkRow, BenchmarkRun } from "./types";

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

export type BenchmarkViewResolvedSlice = {
  effectiveEnvironment: string;
  effectiveMetricKind: string;
  effectiveBranch: string;
  effectiveGroup: string;
  metricOptions: string[];
  branchOptions: string[];
  datasetTimeStart: string;
  datasetTimeEnd: string;
  filteredRows: BenchmarkRow[];
  groupOptions: BenchmarkViewGroupOption[];
  selectedGroupLabel: string;
  scopedRows: BenchmarkRow[];
  benchmarkOptions: BenchmarkViewBenchmarkOption[];
};

export function buildBenchmarkViewIndex(rows: BenchmarkRow[]): BenchmarkViewIndex {
  const allRows: BenchmarkViewIndexedRow[] = [];
  const rowsByEnvironment = new Map<string, BenchmarkViewIndexedRow[]>([["all", allRows]]);
  const metricOptionsByEnvironment = new Map<string, Set<string>>([["all", new Set<string>()]]);
  const branchOptions = new Set<string>();
  let earliestCodeDateValue = Number.POSITIVE_INFINITY;
  let earliestCodeDate = "";
  let latestCodeDateValue = Number.NEGATIVE_INFINITY;
  let latestCodeDate = "";

  for (const row of rows) {
    const indexedRow = _indexRow(row);
    allRows.push(indexedRow);
    metricOptionsByEnvironment.get("all")!.add(indexedRow.metricKind);

    const environmentRows = rowsByEnvironment.get(row.environment_id);
    if (environmentRows) {
      environmentRows.push(indexedRow);
    } else {
      rowsByEnvironment.set(row.environment_id, [indexedRow]);
    }

    const environmentMetricOptions = metricOptionsByEnvironment.get(row.environment_id);
    if (environmentMetricOptions) {
      environmentMetricOptions.add(indexedRow.metricKind);
    } else {
      metricOptionsByEnvironment.set(row.environment_id, new Set([indexedRow.metricKind]));
    }

    if (indexedRow.branch) branchOptions.add(indexedRow.branch);

    if (indexedRow.codeDateValue === null) continue;
    if (indexedRow.codeDateValue < earliestCodeDateValue) {
      earliestCodeDateValue = indexedRow.codeDateValue;
      earliestCodeDate = row.code_date;
    }
    if (indexedRow.codeDateValue > latestCodeDateValue) {
      latestCodeDateValue = indexedRow.codeDateValue;
      latestCodeDate = row.code_date;
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

export function buildGroupOptions(rows: BenchmarkRow[]): BenchmarkViewGroupOption[] {
  const optionsByValue = new Map<string, BenchmarkViewGroupOption>();
  for (const row of rows) {
    for (let depth = 1; depth <= row.benchmark_path.length; depth += 1) {
      const path = row.benchmark_path.slice(0, depth);
      const value = JSON.stringify(path);
      if (optionsByValue.has(value)) continue;
      optionsByValue.set(value, { value, path });
    }
  }
  return Array.from(optionsByValue.values()).sort((left, right) => comparePath(left.path, right.path));
}

export function buildBenchmarkOptions(rows: BenchmarkRow[]): BenchmarkViewBenchmarkOption[] {
  const optionRows = Array.from(new Map(rows.map((row) => [row.benchmark_id, row])).values());
  return optionRows
    .map((row) => ({
      value: row.benchmark_id,
      label: row.benchmark_label,
      path: row.benchmark_path.length ? row.benchmark_path : [row.benchmark_label]
    }))
    .sort((left, right) => comparePath(left.path, right.path) || left.label.localeCompare(right.label) || left.value.localeCompare(right.value));
}

export function scopeRowsToGroup(rows: BenchmarkRow[], selectedGroupPath: string[] | null): BenchmarkRow[] {
  if (!selectedGroupPath) return rows;
  return rows.filter((row) => selectedGroupPath.every((segment, index) => row.benchmark_path[index] === segment));
}

export function datasetTimeBound(
  rows: BenchmarkRow[],
  mode: "earliest" | "latest"
): string {
  let selectedCodeDate = "";
  let selectedTime = mode === "earliest" ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;

  for (const row of rows) {
    const rowDate = parseDate(row.code_date)?.valueOf();
    if (rowDate === undefined) continue;
    if (mode === "earliest") {
      if (rowDate < selectedTime) {
        selectedTime = rowDate;
        selectedCodeDate = row.code_date;
      }
      continue;
    }
    if (rowDate > selectedTime) {
      selectedTime = rowDate;
      selectedCodeDate = row.code_date;
    }
  }

  return dateInputValue(selectedCodeDate);
}

export function resolveBenchmarkViewSlice(
  index: BenchmarkViewIndex,
  state: BenchmarkViewFilterState & { group: string }
): BenchmarkViewResolvedSlice {
  const effectiveEnvironment = index.rowsByEnvironment.has(state.environment) ? state.environment : "all";
  const metricOptions = index.metricOptionsByEnvironment.get(effectiveEnvironment) ?? [];
  const effectiveMetricKind = metricOptions.includes(state.metricKind) ? state.metricKind : (metricOptions[0] ?? "");
  const effectiveBranch = index.branchOptions.includes(state.branch) ? state.branch : "all";
  const filteredRows = effectiveMetricKind
    ? (index.rowsByEnvironment.get(effectiveEnvironment) ?? [])
      .filter((indexedRow) => {
        if (indexedRow.metricKind !== effectiveMetricKind) return false;
        if (effectiveBranch !== "all" && indexedRow.branch !== effectiveBranch) return false;
        if (!rowMatchesDisplayStrategyFromFacts(indexedRow, state.displayStrategy)) return false;
        if (state.timeStartValue !== null && (indexedRow.codeDateValue === null || indexedRow.codeDateValue < state.timeStartValue)) return false;
        if (state.timeEndValue !== null && (indexedRow.codeDateValue === null || indexedRow.codeDateValue > state.timeEndValue)) return false;
        return true;
      })
      .map((indexedRow) => indexedRow.row)
    : [];
  const groupOptions = buildGroupOptions(filteredRows);
  const groupOptionsByValue = new Map(groupOptions.map((option) => [option.value, option]));
  const effectiveGroup = state.group === "all" || groupOptionsByValue.has(state.group) ? state.group : "all";
  const selectedGroupPath = effectiveGroup === "all" ? null : groupOptionsByValue.get(effectiveGroup)?.path ?? null;
  const selectedGroupLabel = effectiveGroup === "all"
    ? "All groups"
    : groupOptionsByValue.get(effectiveGroup)?.path.join(" > ") ?? "All groups";
  const scopedRows = scopeRowsToGroup(filteredRows, selectedGroupPath);

  return {
    effectiveEnvironment,
    effectiveMetricKind,
    effectiveBranch,
    effectiveGroup,
    metricOptions,
    branchOptions: index.branchOptions,
    datasetTimeStart: index.datasetTimeStart,
    datasetTimeEnd: index.datasetTimeEnd,
    filteredRows,
    groupOptions,
    selectedGroupLabel,
    scopedRows,
    benchmarkOptions: buildBenchmarkOptions(scopedRows)
  };
}

export function filterRowsByViewState(
  rows: BenchmarkRow[],
  state: BenchmarkViewFilterState
): BenchmarkRow[] {
  const {
    environment,
    metricKind,
    branch,
    timeStartValue,
    timeEndValue,
    displayStrategy
  } = state;

  return rows.filter((row) => {
    if (environment !== "all" && row.environment_id !== environment) return false;
    if (metricFamilyLabel(row) !== metricKind) return false;
    const rowBranch = row.code_state_metadata.source?.branch || row.run_metadata.source?.branch || "";
    if (branch !== "all" && rowBranch !== branch) return false;
    if (!rowMatchesDisplayStrategy(row, displayStrategy)) return false;
    const rowDate = parseDate(row.code_date)?.valueOf() ?? null;
    if (timeStartValue !== null && (rowDate === null || rowDate < timeStartValue)) return false;
    if (timeEndValue !== null && (rowDate === null || rowDate > timeEndValue)) return false;
    return true;
  });
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
    const dateValue = parseDate(row.code_date);
    if (!dateValue) continue;
    const run = runsById.get(row.run_id);
    const entry: TrendPlotRow = {
      ...row,
      date_value: dateValue,
      run_axis_label: runAxisLabel(row),
      run_headline: run ? runHeadline(run) : row.code_label,
      run_tone: run ? runTone(run) : "branch"
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

export function createLRUCache<K, V>(limit: number) {
  const entries = new Map<K, V>();

  return {
    get(key: K): V | undefined {
      const value = entries.get(key);
      if (value === undefined) return undefined;
      entries.delete(key);
      entries.set(key, value);
      return value;
    },
    set(key: K, value: V) {
      if (entries.has(key)) entries.delete(key);
      entries.set(key, value);
      if (entries.size <= limit) return;
      const oldestKey = entries.keys().next().value as K | undefined;
      if (oldestKey !== undefined) entries.delete(oldestKey);
    },
    keys(): K[] {
      return Array.from(entries.keys());
    }
  };
}

function _compareTrendRowsByDate(left: TrendPlotRow, right: TrendPlotRow): number {
  return left.date_value!.valueOf() - right.date_value!.valueOf();
}

function _indexRow(row: BenchmarkRow): BenchmarkViewIndexedRow {
  const branch = row.code_state_metadata.source?.branch || row.run_metadata.source?.branch || "";
  const tags = row.code_state_metadata.source?.tags?.length
    ? row.code_state_metadata.source.tags
    : row.run_metadata.source?.tags ?? [];

  return {
    row,
    metricKind: metricFamilyLabel(row),
    branch,
    codeDateValue: parseDate(row.code_date)?.valueOf() ?? null,
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
