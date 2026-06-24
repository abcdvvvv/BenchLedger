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
  machine: string;
  metricKind: string;
  branch: string;
  timeStartValue: number | null;
  timeEndValue: number | null;
  displayStrategy: DisplayStrategy;
};

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

export function filterRowsByViewState(
  rows: BenchmarkRow[],
  state: BenchmarkViewFilterState
): BenchmarkRow[] {
  const {
    machine,
    metricKind,
    branch,
    timeStartValue,
    timeEndValue,
    displayStrategy
  } = state;

  return rows.filter((row) => {
    if (machine !== "all" && row.machine_id !== machine) return false;
    if (metricFamilyLabel(row) !== metricKind) return false;
    if (branch !== "all" && row.branch !== branch) return false;
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
      run_headline: run ? runHeadline(run) : row.label,
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

function _compareTrendRowsByDate(left: TrendPlotRow, right: TrendPlotRow): number {
  return left.date_value!.valueOf() - right.date_value!.valueOf();
}
