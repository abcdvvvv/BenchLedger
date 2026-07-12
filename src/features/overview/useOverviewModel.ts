import { createElement, useEffect, useMemo, type ReactNode } from "react";
import { FiActivity, FiClock, FiDatabase, FiGitBranch } from "react-icons/fi";
import type { IconType } from "react-icons";
import { formatPercent, percentageChange, unique } from "../../lib/format";
import {
  buildRuns,
  defaultRunPairSortDirection,
  metricFamilyKey,
  runId,
  runPairSortValue,
  trendDisplayUnitContext,
  type RunPairSort,
  type RunPairSortKey
} from "../../lib/dashboard";
import type { BenchmarkRow, PairComparison } from "../../lib/types";
import { benchmarkDeltaTone } from "../benchmarks/benchmarkDeltaPresentation";

export type OverviewStat = {
  Icon: IconType;
  label: string;
  value: string;
  valueTone?: "positive" | "negative" | "neutral";
  delta: string;
  deltaTone: "positive" | "negative" | "neutral";
  detail: ReactNode;
  detailFullWidth?: boolean;
  inlineNoWrap?: boolean;
};

type UseOverviewModelOptions = {
  rows: BenchmarkRow[];
  focusRunId: string;
  onFocusRunIdChange: (runId: string) => void;
  baselineRunId: string;
  onBaselineRunIdChange: (runId: string) => void;
  runPairSort: RunPairSort | null;
  onRunPairSortChange: (sort: RunPairSort | null) => void;
  environment: string;
  metricKind: string;
  group: string;
  branch: string;
  timeStart: string;
  timeEnd: string;
};

type UseOverviewModelResult = {
  runs: ReturnType<typeof buildRuns>;
  latestRun: ReturnType<typeof buildRuns>[number] | null;
  filteredRuns: ReturnType<typeof buildRuns>;
  focusRun: ReturnType<typeof buildRuns>[number] | null;
  baselineRun: ReturnType<typeof buildRuns>[number] | null;
  environmentMismatch: boolean;
  sortedComparisonRows: PairComparison[];
  stats: OverviewStat[];
  toggleRunPairSort: (key: RunPairSortKey) => void;
};

export function useOverviewModel(options: UseOverviewModelOptions): UseOverviewModelResult {
  const {
    rows,
    focusRunId,
    onFocusRunIdChange,
    baselineRunId,
    onBaselineRunIdChange,
    runPairSort,
    onRunPairSortChange,
    environment,
    metricKind,
    group,
    branch,
    timeStart,
    timeEnd
  } = options;

  const runs = useMemo(() => buildRuns(rows), [rows]);
  const latestRun = runs[0] ?? null;
  const filteredRuns = runs;
  const filteredRunsById = useMemo(
    () => new Map(filteredRuns.map((run) => [run.run_id, run])),
    [filteredRuns]
  );

  useEffect(() => {
    if (!filteredRuns.length) return;
    onFocusRunIdChange(
      focusRunId && filteredRunsById.has(focusRunId)
        ? focusRunId
        : filteredRuns[0].run_id
    );
    onBaselineRunIdChange(
      baselineRunId && filteredRunsById.has(baselineRunId)
        ? baselineRunId
        : (filteredRuns[1]?.run_id ?? filteredRuns[0].run_id)
    );
  }, [baselineRunId, filteredRuns, filteredRunsById, focusRunId, onBaselineRunIdChange, onFocusRunIdChange]);

  const focusRun = filteredRunsById.get(focusRunId) ?? filteredRuns[0] ?? null;
  const baselineRun = filteredRunsById.get(baselineRunId) ?? filteredRuns[1] ?? filteredRuns[0] ?? null;
  const environmentMismatch = Boolean(focusRun && baselineRun && focusRun.environment_id !== baselineRun.environment_id);

  const focusRows = useMemo(
    () => (focusRun ? rows.filter((row) => runId(row) === focusRun.run_id) : []),
    [focusRun, rows]
  );
  const baselineRows = useMemo(
    () => (baselineRun ? rows.filter((row) => runId(row) === baselineRun.run_id) : []),
    [baselineRun, rows]
  );

  const focusByBenchmark = useMemo(() => new Map(focusRows.map((row) => [row.benchmark_id, row])), [focusRows]);
  const baselineByBenchmark = useMemo(() => new Map(baselineRows.map((row) => [row.benchmark_id, row])), [baselineRows]);

  const comparisonRows = useMemo<PairComparison[]>(() => {
    const keys = unique([...focusByBenchmark.keys(), ...baselineByBenchmark.keys()]).sort();
    return keys
      .map((key) => {
        const focus = focusByBenchmark.get(key);
        const baseline = baselineByBenchmark.get(key);
        if (!focus || !baseline) return null;
        if (metricFamilyKey(focus) !== metricFamilyKey(baseline)) return null;
        const displayUnitContext = trendDisplayUnitContext([
          { value: focus.value, unit: focus.unit },
          { value: baseline.value, unit: baseline.unit }
        ]);
        const scaledFocusValue = displayUnitContext.scaleValue(focus.value, focus.unit);
        const scaledBaselineValue = displayUnitContext.scaleValue(baseline.value, baseline.unit);
        return {
          benchmark_id: key,
          benchmark_label: focus.benchmark_label,
          focus_value: scaledFocusValue,
          baseline_value: scaledBaselineValue,
          focus_unit: focus.unit,
          baseline_unit: baseline.unit,
          delta: percentageChange(scaledFocusValue, scaledBaselineValue),
          unit: displayUnitContext.unit || focus.unit,
          better: focus.better
        };
      })
      .filter((row): row is PairComparison => row !== null)
      .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));
  }, [baselineByBenchmark, focusByBenchmark]);

  const sortedComparisonRows = useMemo(() => {
    if (!runPairSort) return comparisonRows;
    return [...comparisonRows].sort((left, right) => {
      const leftValue = runPairSortValue(left, runPairSort.key);
      const rightValue = runPairSortValue(right, runPairSort.key);
      const order = typeof leftValue === "string"
        ? leftValue.localeCompare(String(rightValue))
        : leftValue - Number(rightValue);
      return runPairSort.direction === "asc" ? order : -order;
    });
  }, [comparisonRows, runPairSort]);

  function toggleRunPairSort(key: RunPairSortKey) {
    onRunPairSortChange(
      runPairSort?.key !== key
        ? { key, direction: defaultRunPairSortDirection(key) }
        : { key, direction: runPairSort.direction === "asc" ? "desc" : "asc" }
    );
  }

  const capturedRunsDetail = useMemo(() => {
    const filterStates = [
      { label: "Environment", enabled: environment !== "all" },
      { label: "Metric", enabled: Boolean(metricKind) },
      { label: "Group", enabled: group !== "all" },
      { label: "Branch", enabled: branch !== "all" },
      { label: "Time", enabled: Boolean(timeStart || timeEnd) }
    ];

    return createElement(
      "span",
      { className: "text-[12px] leading-4" },
      ...filterStates.map((filterState, index) => createElement(
        "span",
        { key: filterState.label },
        createElement(
          "span",
          { className: filterState.enabled ? "text-theme-brand" : "text-stone-500 dark:text-stone-400" },
          filterState.label
        ),
        index < filterStates.length - 1
          ? createElement("span", { className: "text-stone-400 dark:text-stone-500" }, " · ")
          : null
      ))
    );
  }, [branch, environment, group, metricKind, timeEnd, timeStart]);

  const largestDeltaRow = comparisonRows[0] ?? null;
  const improvedCount = useMemo(
    () => comparisonRows.filter((row) => benchmarkDeltaTone(row.delta, row.better) === "positive").length,
    [comparisonRows]
  );
  const regressedCount = useMemo(
    () => comparisonRows.filter((row) => benchmarkDeltaTone(row.delta, row.better) === "negative").length,
    [comparisonRows]
  );
  const largestDeltaLabel = useMemo(() => {
    if (!largestDeltaRow?.benchmark_label) return "";
    return largestDeltaRow.benchmark_label.length > 20
      ? `${largestDeltaRow.benchmark_label.slice(0, 17)}...`
      : largestDeltaRow.benchmark_label;
  }, [largestDeltaRow]);

  const stats = useMemo<OverviewStat[]>(() => [
    {
      Icon: FiDatabase,
      label: "Benchmark Rows",
      value: rows.length.toLocaleString(),
      delta: latestRun ? `+${latestRun.benchmark_count.toLocaleString()}` : "",
      deltaTone: latestRun?.benchmark_count ? "positive" : "neutral",
      detail: `${unique(rows.map((row) => row.benchmark_id)).length.toLocaleString()} benchmarks in slice`
    },
    {
      Icon: FiActivity,
      label: "Captured Runs",
      value: filteredRuns.length.toLocaleString(),
      delta: "",
      deltaTone: "neutral",
      detail: capturedRunsDetail,
      detailFullWidth: true
    },
    {
      Icon: FiClock,
      label: "Largest Delta",
      value: largestDeltaRow ? formatPercent(largestDeltaRow.delta) : "n/a",
      valueTone: largestDeltaRow ? benchmarkDeltaTone(largestDeltaRow.delta, largestDeltaRow.better) : "neutral",
      delta: largestDeltaLabel,
      deltaTone: "neutral",
      detail: `${improvedCount.toLocaleString()} improved · ${regressedCount.toLocaleString()} regressed`,
      inlineNoWrap: true
    },
    {
      Icon: FiGitBranch,
      label: "Dirty Snapshots",
      value: filteredRuns.filter((run) => Boolean(run.code_state_metadata.source?.dirty)).length.toLocaleString(),
      delta: "",
      deltaTone: "neutral",
      detail: latestRun?.code_state_metadata.source?.dirty ? "Latest run was recorded from a dirty worktree" : "Latest run is clean"
    }
  ], [capturedRunsDetail, filteredRuns, improvedCount, largestDeltaLabel, largestDeltaRow, latestRun, regressedCount, rows]);

  return {
    runs,
    latestRun,
    filteredRuns,
    focusRun,
    baselineRun,
    environmentMismatch,
    sortedComparisonRows,
    stats,
    toggleRunPairSort
  };
}
