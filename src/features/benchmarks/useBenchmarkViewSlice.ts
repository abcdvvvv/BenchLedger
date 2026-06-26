import { useEffect, useMemo } from "react";
import { unique } from "../../lib/format";
import { dateRangeEnd, dateRangeStart, formatDateRangePart, metricFamilyLabel, type DisplayStrategy } from "../../lib/dashboard";
import {
  buildBenchmarkOptions,
  buildGroupOptions,
  datasetTimeBound,
  filterRowsByViewState,
  scopeRowsToGroup,
  type BenchmarkViewBenchmarkOption,
  type BenchmarkViewGroupOption
} from "../../lib/benchmark-view";
import type { BenchmarkRow } from "../../lib/types";

type UseBenchmarkViewSliceOptions = {
  rows: BenchmarkRow[];
  environmentOptions: string[];
  environment: string;
  onEnvironmentChange: (environment: string) => void;
  metricKind: string;
  onMetricKindChange: (metricKind: string) => void;
  branch: string;
  onBranchChange: (branch: string) => void;
  timeStart: string;
  timeEnd: string;
  displayStrategy: DisplayStrategy;
  group: string;
  onGroupChange: (group: string) => void;
};

type UseBenchmarkViewSliceResult = {
  metricOptions: string[];
  branchOptions: string[];
  datasetTimeStart: string;
  datasetTimeEnd: string;
  filteredRows: BenchmarkRow[];
  groupOptions: BenchmarkViewGroupOption[];
  selectedGroupLabel: string;
  scopedRows: BenchmarkRow[];
  benchmarkOptions: BenchmarkViewBenchmarkOption[];
  runsEmptyTimeRangeLabel: string;
};

function rowBranch(row: BenchmarkRow): string {
  return row.code_state_metadata.source?.branch || row.run_metadata.source?.branch || "";
}

export function useBenchmarkViewSlice(
  options: UseBenchmarkViewSliceOptions
): UseBenchmarkViewSliceResult {
  const {
    rows,
    environmentOptions,
    environment,
    onEnvironmentChange,
    metricKind,
    onMetricKindChange,
    branch,
    onBranchChange,
    timeStart,
    timeEnd,
    displayStrategy,
    group,
    onGroupChange
  } = options;

  const metricOptions = useMemo(() => {
    const metricRows = environment && environment !== "all" ? rows.filter((row) => row.environment_id === environment) : rows;
    return unique(metricRows.map((row) => metricFamilyLabel(row))).sort();
  }, [environment, rows]);

  const branchOptions = useMemo(
    () => ["all", ...unique(rows.map((row) => rowBranch(row)).filter(Boolean)).sort()],
    [rows]
  );

  const timeStartValue = useMemo(() => dateRangeStart(timeStart), [timeStart]);
  const timeEndValue = useMemo(() => dateRangeEnd(timeEnd), [timeEnd]);

  const datasetTimeStart = useMemo(() => datasetTimeBound(rows, "earliest"), [rows]);
  const datasetTimeEnd = useMemo(() => datasetTimeBound(rows, "latest"), [rows]);

  useEffect(() => {
    onEnvironmentChange(environment && environmentOptions.includes(environment) ? environment : "all");
  }, [environment, environmentOptions, onEnvironmentChange]);

  useEffect(() => {
    if (!metricOptions.length) return;
    onMetricKindChange(metricKind && metricOptions.includes(metricKind) ? metricKind : metricOptions[0]);
  }, [metricKind, metricOptions, onMetricKindChange]);

  useEffect(() => {
    if (!branchOptions.length) return;
    onBranchChange(branchOptions.includes(branch) ? branch : "all");
  }, [branch, branchOptions, onBranchChange]);

  const filteredRows = useMemo(
    () => filterRowsByViewState(rows, {
      environment,
      metricKind,
      branch,
      timeStartValue,
      timeEndValue,
      displayStrategy
    }),
    [branch, displayStrategy, environment, metricKind, rows, timeEndValue, timeStartValue]
  );

  const groupOptions = useMemo(() => buildGroupOptions(filteredRows), [filteredRows]);
  const groupOptionsByValue = useMemo(
    () => new Map(groupOptions.map((option) => [option.value, option])),
    [groupOptions]
  );

  useEffect(() => {
    if (group === "all" || groupOptionsByValue.has(group)) return;
    onGroupChange("all");
  }, [group, groupOptionsByValue, onGroupChange]);

  const selectedGroupPath = useMemo(
    () => (group === "all" ? null : groupOptionsByValue.get(group)?.path ?? null),
    [group, groupOptionsByValue]
  );

  const selectedGroupLabel = useMemo(() => {
    if (group === "all") return "All groups";
    const option = groupOptionsByValue.get(group);
    return option ? option.path.join(" > ") : "All groups";
  }, [group, groupOptionsByValue]);

  const scopedRows = useMemo(
    () => scopeRowsToGroup(filteredRows, selectedGroupPath),
    [filteredRows, selectedGroupPath]
  );

  const benchmarkOptions = useMemo(() => buildBenchmarkOptions(scopedRows), [scopedRows]);
  const runsEmptyTimeRangeLabel = useMemo(() => (
    timeStart || timeEnd
      ? `${formatDateRangePart(timeStart, "Any start")} - ${formatDateRangePart(timeEnd, "Any end")}`
      : "All time"
  ), [timeEnd, timeStart]);

  return {
    metricOptions,
    branchOptions,
    datasetTimeStart,
    datasetTimeEnd,
    filteredRows,
    groupOptions,
    selectedGroupLabel,
    scopedRows,
    benchmarkOptions,
    runsEmptyTimeRangeLabel
  };
}
