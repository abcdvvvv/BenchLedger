import { createElement, useEffect, useMemo, useState, type ReactNode } from "react";
import { FiActivity, FiClock, FiDatabase, FiGitBranch } from "react-icons/fi";
import type { IconType } from "react-icons";
import type { BenchmarkDimensionSelection } from "../../app/useBenchmarkDimensionSelector";
import { buildDimensionPointAggregates } from "../../lib/benchmark-view";
import { formatPercent } from "../../lib/format";
import { buildBenchmarkPairComparisons, defaultRunPairSortDirection, runPairSortValue } from "../../lib/dashboard-data";
import type { RunPairSort, RunPairSortKey } from "../../lib/dashboard-settings";
import type { BenchmarkDatabaseSession, BenchmarkResultQuery, BenchmarkRunSliceSummary, BenchmarkTrendAggregateRow } from "../../lib/benchmark-database";
import type { DimensionSelectionPoint } from "../../lib/dimension-selector";
import type { BenchmarkDefinition, BenchmarkRun, PairComparison } from "../../lib/types";
import { benchmarkDeltaTone } from "../benchmarks/benchmarkDeltaPresentation";
import { LatestTaskRunner } from "../../lib/latest-task";

export type OverviewStat = { Icon: IconType; label: string; value: string; valueTone?: "positive" | "negative" | "neutral"; delta: string; deltaTone: "positive" | "negative" | "neutral"; detail: ReactNode; detailFullWidth?: boolean; inlineNoWrap?: boolean; };

type UseOverviewModelOptions = {
  session: BenchmarkDatabaseSession | null;
  query: BenchmarkResultQuery;
  sourceRevision: number;
  benchmarkCount: number;
  benchmarksByKey: ReadonlyMap<string, BenchmarkDefinition>;
  allRuns: BenchmarkRun[];
  dimensionSelection: BenchmarkDimensionSelection;
  focusPointKey: string;
  onFocusPointKeyChange: (pointKey: string) => void;
  baselinePointKey: string;
  onBaselinePointKeyChange: (pointKey: string) => void;
  runPairSort: RunPairSort | null;
  onRunPairSortChange: (sort: RunPairSort | null) => void;
  conditionCount: number;
  yAxis: string;
  branch: string;
  timeStart: string;
  timeEnd: string;
};

type UseOverviewModelResult = { points: DimensionSelectionPoint[]; runsByPoint: ReadonlyMap<string, BenchmarkRun[]>; latestRun: BenchmarkRun | null; filteredRuns: BenchmarkRun[]; focusPoint: DimensionSelectionPoint | null; baselinePoint: DimensionSelectionPoint | null; focusRun: BenchmarkRun | null; sortedComparisonRows: PairComparison[]; stats: OverviewStat[]; toggleRunPairSort: (key: RunPairSortKey) => void; };

export function useOverviewModel(options: UseOverviewModelOptions): UseOverviewModelResult {
  const { session, query, sourceRevision, benchmarkCount, benchmarksByKey, allRuns, dimensionSelection, focusPointKey, onFocusPointKeyChange, baselinePointKey, onBaselinePointKeyChange, runPairSort, onRunPairSortChange, conditionCount, yAxis, branch, timeStart, timeEnd } = options;
  const [runSlice, setRunSlice] = useState<BenchmarkRunSliceSummary[]>([]);
  const [pairAggregates, setPairAggregates] = useState<BenchmarkTrendAggregateRow[]>([]);
  const runSliceQueries = useMemo(() => new LatestTaskRunner<BenchmarkRunSliceSummary[]>(), []);
  const pairAggregateQueries = useMemo(() => new LatestTaskRunner<BenchmarkTrendAggregateRow[]>(), []);

  useEffect(() => {
    let cancelled = false;
    setRunSlice([]);
    if (!session || !query.yAxis) { runSliceQueries.clearPending(); return; }
    void runSliceQueries.run(() => session.queryRunSlice(query)).then((rows) => { if (!cancelled) setRunSlice(rows); }, (error: unknown) => { if (!cancelled) console.error("BenchLedger dashboard slice query failed:", error); });
    return () => { cancelled = true; };
  }, [query, runSliceQueries, session, sourceRevision]);

  const runSliceById = useMemo(() => new Map(runSlice.map((entry) => [entry.run_id, entry])), [runSlice]);
  const filteredRuns = useMemo(() => allRuns.filter((run) => runSliceById.has(run.run_id)), [allRuns, runSliceById]);
  const latestRun = filteredRuns[0] ?? null;
  const runsByPoint = useMemo(() => {
    const result = new Map<string, BenchmarkRun[]>();
    for (const run of filteredRuns) {
      const pointKey = dimensionSelection.pointKeyByConfigurationKey.get(run.configuration_key); if (!pointKey) continue;
      const bucket = result.get(pointKey); if (bucket) bucket.push(run); else result.set(pointKey, [run]);
    }
    return result;
  }, [dimensionSelection.pointKeyByConfigurationKey, filteredRuns]);
  const points = useMemo(() => dimensionSelection.points.filter((point) => runsByPoint.has(point.key)), [dimensionSelection.points, runsByPoint]);
  const pointsByKey = useMemo(() => new Map(points.map((point) => [point.key, point])), [points]);

  useEffect(() => {
    if (!dimensionSelection.validation.isValid) return;
    if (!points.length) { if (focusPointKey) onFocusPointKeyChange(""); if (baselinePointKey) onBaselinePointKeyChange(""); return; }
    const focus = pointsByKey.has(focusPointKey) ? focusPointKey : points[points.length - 1].key;
    const baseline = pointsByKey.has(baselinePointKey) ? baselinePointKey : (points[points.length - 2]?.key ?? focus);
    if (focus !== focusPointKey) onFocusPointKeyChange(focus);
    if (baseline !== baselinePointKey) onBaselinePointKeyChange(baseline);
  }, [baselinePointKey, dimensionSelection.validation.isValid, focusPointKey, onBaselinePointKeyChange, onFocusPointKeyChange, points, pointsByKey]);

  const focusPoint = pointsByKey.get(focusPointKey) ?? points[points.length - 1] ?? null;
  const baselinePoint = pointsByKey.get(baselinePointKey) ?? points[points.length - 2] ?? focusPoint;
  const focusRun = focusPoint ? runsByPoint.get(focusPoint.key)?.[0] ?? null : null;

  useEffect(() => {
    let cancelled = false;
    setPairAggregates([]);
    const configurationKeys = Array.from(new Set([...(focusPoint?.configurationKeys ?? []), ...(baselinePoint?.configurationKeys ?? [])]));
    if (!session || !query.yAxis || !configurationKeys.length) { pairAggregateQueries.clearPending(); return; }
    void pairAggregateQueries.run(() => session.queryTrendAggregates({ ...query, configurationKeys })).then((rows) => { if (!cancelled) setPairAggregates(rows); }, (error: unknown) => { if (!cancelled) console.error("BenchLedger dashboard point comparison query failed:", error); });
    return () => { cancelled = true; };
  }, [baselinePoint?.key, focusPoint?.key, pairAggregateQueries, query, session, sourceRevision]);

  const pointAggregates = useMemo(() => buildDimensionPointAggregates(pairAggregates, new Map(allRuns.map((run) => [run.run_id, run])), dimensionSelection), [allRuns, dimensionSelection, pairAggregates]);
  const focusRows = useMemo(() => focusPoint ? pointAggregates.filter((row) => row.point_key === focusPoint.key) : [], [focusPoint, pointAggregates]);
  const baselineRows = useMemo(() => baselinePoint ? pointAggregates.filter((row) => row.point_key === baselinePoint.key) : [], [baselinePoint, pointAggregates]);
  const comparisonRows = useMemo<PairComparison[]>(() => buildBenchmarkPairComparisons(focusRows, baselineRows, benchmarksByKey), [baselineRows, benchmarksByKey, focusRows]);
  const sortedComparisonRows = useMemo(() => {
    if (!runPairSort) return comparisonRows;
    return [...comparisonRows].sort((left, right) => {
      const leftValue = runPairSortValue(left, runPairSort.key); const rightValue = runPairSortValue(right, runPairSort.key);
      if (leftValue === null) return rightValue === null ? 0 : 1; if (rightValue === null) return -1;
      const order = typeof leftValue === "string" ? leftValue.localeCompare(String(rightValue)) : leftValue - Number(rightValue);
      return runPairSort.direction === "asc" ? order : -order;
    });
  }, [comparisonRows, runPairSort]);

  function toggleRunPairSort(key: RunPairSortKey) { onRunPairSortChange(runPairSort?.key !== key ? { key, direction: defaultRunPairSortDirection(key) } : { key, direction: runPairSort.direction === "asc" ? "desc" : "asc" }); }

  const capturedRunsDetail = useMemo(() => {
    const filterStates = [{ label: "Conditions", enabled: conditionCount > 0 }, { label: "Y-Axis", enabled: Boolean(yAxis) }, { label: "Branch", enabled: branch !== "all" }, { label: "Time", enabled: Boolean(timeStart || timeEnd) }];
    return createElement("span", { className: "text-[12px] leading-4" }, ...filterStates.map((filterState, index) => createElement("span", { key: filterState.label }, createElement("span", { className: filterState.enabled ? "text-theme-brand" : "text-stone-500 dark:text-stone-400" }, filterState.label), index < filterStates.length - 1 ? createElement("span", { className: "text-stone-400 dark:text-stone-500" }, " · ") : null)));
  }, [branch, conditionCount, timeEnd, timeStart, yAxis]);

  const matchedComparisonRows = useMemo(() => comparisonRows.filter((row): row is Extract<PairComparison, { status: "matched" }> => row.status === "matched"), [comparisonRows]);
  const largestDeltaRow = matchedComparisonRows[0] ?? null;
  const improvedCount = useMemo(() => matchedComparisonRows.filter((row) => benchmarkDeltaTone(row.delta, row.better) === "positive").length, [matchedComparisonRows]);
  const regressedCount = useMemo(() => matchedComparisonRows.filter((row) => benchmarkDeltaTone(row.delta, row.better) === "negative").length, [matchedComparisonRows]);
  const largestDeltaLabel = useMemo(() => !largestDeltaRow?.benchmark_label ? "" : largestDeltaRow.benchmark_label.length > 20 ? `${largestDeltaRow.benchmark_label.slice(0, 17)}...` : largestDeltaRow.benchmark_label, [largestDeltaRow]);
  const sliceRowCount = useMemo(() => runSlice.reduce((total, entry) => total + entry.row_count, 0), [runSlice]);
  const latestRunSliceRowCount = latestRun ? runSliceById.get(latestRun.run_id)?.row_count ?? 0 : 0;

  const stats = useMemo<OverviewStat[]>(() => [
    { Icon: FiDatabase, label: "Benchmark Rows", value: sliceRowCount.toLocaleString(), delta: latestRun ? `+${latestRunSliceRowCount.toLocaleString()}` : "", deltaTone: latestRunSliceRowCount ? "positive" : "neutral", detail: `${benchmarkCount.toLocaleString()} benchmarks in slice` },
    { Icon: FiActivity, label: "Captured Runs", value: filteredRuns.length.toLocaleString(), delta: "", deltaTone: "neutral", detail: capturedRunsDetail, detailFullWidth: true },
    { Icon: FiClock, label: "Largest Delta", value: largestDeltaRow ? formatPercent(largestDeltaRow.delta) : "n/a", valueTone: largestDeltaRow ? benchmarkDeltaTone(largestDeltaRow.delta, largestDeltaRow.better) : "neutral", delta: largestDeltaLabel, deltaTone: "neutral", detail: `${improvedCount.toLocaleString()} improved · ${regressedCount.toLocaleString()} regressed`, inlineNoWrap: true },
    { Icon: FiGitBranch, label: "Dirty Snapshots", value: filteredRuns.filter((run) => Boolean(run.code_state_metadata.source?.dirty)).length.toLocaleString(), delta: "", deltaTone: "neutral", detail: latestRun?.code_state_metadata.source?.dirty ? "Latest run was recorded from a dirty worktree" : "Latest run is clean" }
  ], [benchmarkCount, capturedRunsDetail, filteredRuns, improvedCount, largestDeltaLabel, largestDeltaRow, latestRun, latestRunSliceRowCount, regressedCount, sliceRowCount]);

  return { points, runsByPoint, latestRun, filteredRuns, focusPoint, baselinePoint, focusRun, sortedComparisonRows, stats, toggleRunPairSort };
}
