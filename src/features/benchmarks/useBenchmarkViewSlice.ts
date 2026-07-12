import { useEffect, useMemo, useRef } from "react";
import { dateRangeEnd, dateRangeStart, formatDateRangePart, type DisplayStrategy } from "../../lib/dashboard";
import {
  createLRUCache,
  resolveBenchmarkViewSlice,
  type BenchmarkViewIndex,
  type BenchmarkViewBenchmarkOption,
  type BenchmarkViewGroupOption,
  type BenchmarkViewResolvedSlice
} from "../../lib/benchmark-view";
import type { BenchmarkRow } from "../../lib/types";

type UseBenchmarkViewSliceOptions = {
  index: BenchmarkViewIndex;
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

export function useBenchmarkViewSlice(
  options: UseBenchmarkViewSliceOptions
): UseBenchmarkViewSliceResult {
  const {
    index,
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

  const timeStartValue = useMemo(() => dateRangeStart(timeStart), [timeStart]);
  const timeEndValue = useMemo(() => dateRangeEnd(timeEnd), [timeEnd]);
  const sliceCacheRef = useRef(createLRUCache<string, BenchmarkViewResolvedSlice>(64));
  const cachedIndexRef = useRef<BenchmarkViewIndex | null>(null);

  if (cachedIndexRef.current !== index) {
    cachedIndexRef.current = index;
    sliceCacheRef.current = createLRUCache<string, BenchmarkViewResolvedSlice>(64);
  }

  const resolvedSlice = useMemo(() => {
    const cacheKey = JSON.stringify({
      environment,
      metricKind,
      branch,
      timeStartValue,
      timeEndValue,
      displayStrategy,
      group
    });
    const cachedSlice = sliceCacheRef.current.get(cacheKey);
    if (cachedSlice) return cachedSlice;

    const computedSlice = resolveBenchmarkViewSlice(index, {
      environment,
      metricKind,
      branch,
      timeStartValue,
      timeEndValue,
      displayStrategy,
      group
    });
    sliceCacheRef.current.set(cacheKey, computedSlice);
    return computedSlice;
  }, [branch, displayStrategy, environment, group, index, metricKind, timeEndValue, timeStartValue]);

  useEffect(() => {
    if (environment === resolvedSlice.effectiveEnvironment) return;
    onEnvironmentChange(resolvedSlice.effectiveEnvironment);
  }, [environment, onEnvironmentChange, resolvedSlice.effectiveEnvironment]);

  useEffect(() => {
    if (!resolvedSlice.metricOptions.length || metricKind === resolvedSlice.effectiveMetricKind) return;
    onMetricKindChange(resolvedSlice.effectiveMetricKind);
  }, [metricKind, onMetricKindChange, resolvedSlice.effectiveMetricKind, resolvedSlice.metricOptions.length]);

  useEffect(() => {
    if (branch === resolvedSlice.effectiveBranch) return;
    onBranchChange(resolvedSlice.effectiveBranch);
  }, [branch, onBranchChange, resolvedSlice.effectiveBranch]);

  const runsEmptyTimeRangeLabel = useMemo(() => (
    timeStart || timeEnd
      ? `${formatDateRangePart(timeStart, "Any start")} - ${formatDateRangePart(timeEnd, "Any end")}`
      : "All time"
  ), [timeEnd, timeStart]);

  useEffect(() => {
    if (group === resolvedSlice.effectiveGroup) return;
    onGroupChange(resolvedSlice.effectiveGroup);
  }, [group, onGroupChange, resolvedSlice.effectiveGroup]);

  return {
    metricOptions: resolvedSlice.metricOptions,
    branchOptions: resolvedSlice.branchOptions,
    datasetTimeStart: resolvedSlice.datasetTimeStart,
    datasetTimeEnd: resolvedSlice.datasetTimeEnd,
    filteredRows: resolvedSlice.filteredRows,
    groupOptions: resolvedSlice.groupOptions,
    selectedGroupLabel: resolvedSlice.selectedGroupLabel,
    scopedRows: resolvedSlice.scopedRows,
    benchmarkOptions: resolvedSlice.benchmarkOptions,
    runsEmptyTimeRangeLabel
  };
}
