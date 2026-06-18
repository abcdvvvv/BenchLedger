import { useEffect, useMemo } from "react";
import { FiActivity, FiClock, FiDatabase, FiGitBranch } from "react-icons/fi";
import type { IconType } from "react-icons";
import { formatMetricValue, formatPercent, metricDeltaClass, percentageChange, unique } from "./format";
import {
  buildTrendRowsByBenchmark,
  normalizeSelectedBenchmarkIds,
  type BenchmarkViewBenchmarkOption
} from "./benchmark-view";
import {
  Trend_Y_Padding_Ratio,
  buildRuns,
  buildTrendTrace,
  colorForBenchmark,
  defaultRunPairSortDirection,
  runId,
  runPairSortValue,
  statDeltaTone,
  trendDisplayUnitContext,
  type PlotTheme,
  type RunPairSort,
  type RunPairSortKey,
  type ThemeMode,
  type TrendAxisMode,
  type TrendLineShape,
  type TrendMarkerFillMode
} from "./dashboard";
import type { TrendMarkerSymbol } from "./trend-marker-symbols";
import type { BenchmarkRow, PairComparison } from "./types";

export type OverviewStat = {
  Icon: IconType;
  label: string;
  value: string;
  delta: string;
  deltaTone: "positive" | "negative" | "neutral";
  detail: string;
};

type UseOverviewModelOptions = {
  rows: BenchmarkRow[];
  benchmarkOptions: BenchmarkViewBenchmarkOption[];
  selectedBenchmarkIds: string[];
  onSelectedBenchmarkIdsChange: (values: string[]) => void;
  focusRunId: string;
  onFocusRunIdChange: (runId: string) => void;
  baselineRunId: string;
  onBaselineRunIdChange: (runId: string) => void;
  runPairSort: RunPairSort | null;
  onRunPairSortChange: (sort: RunPairSort | null) => void;
  machine: string;
  metricKind: string;
  trendAxisMode: TrendAxisMode;
  trendLineShape: TrendLineShape;
  trendMarkerSymbol: TrendMarkerSymbol;
  trendMarkerFillMode: TrendMarkerFillMode;
  plotTheme: PlotTheme;
  theme: ThemeMode;
};

type UseOverviewModelResult = {
  runs: ReturnType<typeof buildRuns>;
  latestRun: ReturnType<typeof buildRuns>[number] | null;
  filteredRuns: ReturnType<typeof buildRuns>;
  focusRun: ReturnType<typeof buildRuns>[number] | null;
  comparisonRows: PairComparison[];
  sortedComparisonRows: PairComparison[];
  stats: OverviewStat[];
  trendMetricLabel: string;
  trendPlotMargin: { t: number; r: number; b: number; l: number };
  deltaPlotMargin: { t: number; r: number; b: number; l: number };
  trendTraces: Array<Record<string, unknown>>;
  toggleRunPairSort: (key: RunPairSortKey) => void;
};

export function useOverviewModel(options: UseOverviewModelOptions): UseOverviewModelResult {
  const {
    rows,
    benchmarkOptions,
    selectedBenchmarkIds,
    onSelectedBenchmarkIdsChange,
    focusRunId,
    onFocusRunIdChange,
    baselineRunId,
    onBaselineRunIdChange,
    runPairSort,
    onRunPairSortChange,
    machine,
    metricKind,
    trendAxisMode,
    trendLineShape,
    trendMarkerSymbol,
    trendMarkerFillMode,
    plotTheme,
    theme
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

  useEffect(() => {
    onSelectedBenchmarkIdsChange(normalizeSelectedBenchmarkIds(selectedBenchmarkIds, benchmarkOptions));
  }, [benchmarkOptions, onSelectedBenchmarkIdsChange, selectedBenchmarkIds]);

  const currentBenchmarkId = selectedBenchmarkIds[0] ?? "";
  const focusRun = filteredRunsById.get(focusRunId) ?? filteredRuns[0] ?? null;
  const baselineRun = filteredRunsById.get(baselineRunId) ?? filteredRuns[1] ?? filteredRuns[0] ?? null;
  const benchmarkOptionsById = useMemo(
    () => new Map(benchmarkOptions.map((option) => [option.value, option])),
    [benchmarkOptions]
  );

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
  const focusBenchmark = currentBenchmarkId ? focusByBenchmark.get(currentBenchmarkId) ?? null : null;
  const baselineBenchmark = currentBenchmarkId ? baselineByBenchmark.get(currentBenchmarkId) ?? null : null;

  const comparisonRows = useMemo<PairComparison[]>(() => {
    const keys = unique([...focusByBenchmark.keys(), ...baselineByBenchmark.keys()]).sort();
    return keys
      .map((key) => {
        const focus = focusByBenchmark.get(key);
        const baseline = baselineByBenchmark.get(key);
        if (!focus || !baseline) return null;
        return {
          benchmark_id: key,
          benchmark_label: focus.benchmark_label,
          focus_value: focus.value,
          baseline_value: baseline.value,
          delta: percentageChange(focus.value, baseline.value),
          unit: focus.unit,
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

  const runsById = useMemo(() => new Map(runs.map((run) => [run.run_id, run])), [runs]);
  const overviewTrendRowsByBenchmark = useMemo(
    () => buildTrendRowsByBenchmark(rows, runsById, selectedBenchmarkIds),
    [rows, runsById, selectedBenchmarkIds]
  );

  const trendRows = useMemo(
    () => benchmarkOptions.flatMap((option) => overviewTrendRowsByBenchmark.get(option.value) ?? []),
    [benchmarkOptions, overviewTrendRowsByBenchmark]
  );
  const trendDisplayContext = useMemo(() => trendDisplayUnitContext(trendRows), [trendRows]);
  const trendMetricLabel = useMemo(
    () => trendDisplayContext.formatMetricLabel(metricKind),
    [metricKind, trendDisplayContext]
  );
  const trendPlotMargin = trendRows.length ? { t: 10, r: 16, b: 40, l: 55 } : { t: 10, r: 16, b: 40, l: 20 };
  const deltaPlotMargin = comparisonRows.length ? { t: 10, r: 12, b: 36, l: 170 } : { t: 10, r: 12, b: 36, l: 20 };
  const trendY = trendRows.map((row) => row.value);
  const trendYMin = trendY.length ? Math.min(...trendY) : 0;
  const trendYMax = trendY.length ? Math.max(...trendY) : 0;
  const trendYSpan = trendYMax - trendYMin;
  const trendYPadding = trendYSpan > 0
    ? trendYSpan * Trend_Y_Padding_Ratio
    : Math.max(Math.abs(trendYMin) * Trend_Y_Padding_Ratio, 1);

  const trendTraces = useMemo(() => {
    if (!selectedBenchmarkIds.length) return [];
    return selectedBenchmarkIds.flatMap((benchmarkKey, index) => {
      const traceRows = overviewTrendRowsByBenchmark.get(benchmarkKey) ?? [];
      const color = colorForBenchmark(index);
      const label = benchmarkOptionsById.get(benchmarkKey)?.label ?? benchmarkKey;
      return buildTrendTrace(traceRows, {
        axisMode: trendAxisMode,
        lineShape: trendLineShape,
        markerSymbol: trendMarkerSymbol,
        markerFillMode: trendMarkerFillMode,
        displayUnitContext: trendDisplayContext,
        color,
        label,
        plotTheme,
        theme,
        yMin: trendYMin,
        yPadding: trendYPadding,
        showLegend: selectedBenchmarkIds.length > 1
      });
    });
  }, [
    benchmarkOptionsById,
    overviewTrendRowsByBenchmark,
    plotTheme,
    selectedBenchmarkIds,
    theme,
    trendAxisMode,
    trendDisplayContext,
    trendLineShape,
    trendMarkerFillMode,
    trendMarkerSymbol,
    trendYMin,
    trendYPadding
  ]);

  const selectedMetricDelta = focusBenchmark && baselineBenchmark
    ? percentageChange(focusBenchmark.value, baselineBenchmark.value)
    : null;

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
      detail: machine && metricKind ? `filtered on ${machine} · ${metricKind}` : "Waiting for a machine slice"
    },
    {
      Icon: FiClock,
      label: "Selected Metric",
      value: focusBenchmark ? formatMetricValue(focusBenchmark.value, focusBenchmark.unit) : "n/a",
      delta: selectedMetricDelta === null ? "" : formatPercent(selectedMetricDelta),
      deltaTone: selectedMetricDelta === null || !focusBenchmark
        ? "neutral"
        : statDeltaTone[metricDeltaClass(selectedMetricDelta, focusBenchmark.better)],
      detail: focusBenchmark && baselineBenchmark ? "vs baseline" : "Pick a comparable baseline run"
    },
    {
      Icon: FiGitBranch,
      label: "Dirty Snapshots",
      value: filteredRuns.filter((run) => run.is_dirty).length.toLocaleString(),
      delta: "",
      deltaTone: "neutral",
      detail: latestRun?.is_dirty ? "Latest run was recorded from a dirty worktree" : "Latest run is clean"
    }
  ], [baselineBenchmark, filteredRuns, focusBenchmark, latestRun, machine, metricKind, rows, selectedMetricDelta]);

  return {
    runs,
    latestRun,
    filteredRuns,
    focusRun,
    comparisonRows,
    sortedComparisonRows,
    stats,
    trendMetricLabel,
    trendPlotMargin,
    deltaPlotMargin,
    trendTraces,
    toggleRunPairSort
  };
}
