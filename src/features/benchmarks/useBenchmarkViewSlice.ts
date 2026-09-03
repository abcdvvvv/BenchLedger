import { useEffect, useMemo, useState } from "react";
import { benchmarkDefinitionsForKeys, buildBenchmarkOptions, resolveBenchmarkViewFilter, type BenchmarkViewBenchmarkOption } from "../../lib/benchmark-view";
import type { BenchmarkDatabaseSession, BenchmarkResultQuery } from "../../lib/benchmark-database";
import { dateRangeEnd, dateRangeStart, formatDateRangePart } from "../../lib/dashboard-settings";
import type { BenchmarkDefinition, BenchmarkViewCatalog } from "../../lib/types";
import type { DisplayStrategy } from "../../lib/dashboard-settings";
import { LatestTaskRunner } from "../../lib/latest-task";

export type UseBenchmarkViewSliceOptions = { session: BenchmarkDatabaseSession | null; catalog: BenchmarkViewCatalog; benchmarksByKey: ReadonlyMap<string, BenchmarkDefinition>; sourceRevision: number; configurationKeys: readonly string[]; yAxis: string; onYAxisChange: (value: string) => void; branch: string; onBranchChange: (value: string) => void; timeStart: string; timeEnd: string; displayStrategy: DisplayStrategy; };
export type BenchmarkViewSlice = { yAxisOptions: string[]; branchOptions: string[]; databaseTimeStart: string; databaseTimeEnd: string; benchmarkOptions: BenchmarkViewBenchmarkOption[]; resultQuery: BenchmarkResultQuery; runsEmptyTimeRangeLabel: string; loading: boolean; error: string; };

export function useBenchmarkViewSlice(options: UseBenchmarkViewSliceOptions): BenchmarkViewSlice {
  const { session, catalog, benchmarksByKey, sourceRevision, configurationKeys, yAxis, onYAxisChange, branch, onBranchChange, timeStart, timeEnd, displayStrategy } = options;
  const filter = useMemo(() => resolveBenchmarkViewFilter(catalog, { yAxis, branch, timeStartValue: dateRangeStart(timeStart), timeEndValue: dateRangeEnd(timeEnd), displayStrategy, configurationKeys }), [branch, catalog, configurationKeys, displayStrategy, timeEnd, timeStart, yAxis]);
  const [benchmarkKeys, setBenchmarkKeys] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const benchmarkKeyQueries = useMemo(() => new LatestTaskRunner<string[]>(), []);

  useEffect(() => { if (filter.yAxisOptions.length && yAxis !== filter.yAxis) onYAxisChange(filter.yAxis); }, [filter.yAxis, filter.yAxisOptions.length, onYAxisChange, yAxis]);
  useEffect(() => { if (branch !== filter.branch) onBranchChange(filter.branch); }, [branch, filter.branch, onBranchChange]);

  const resultQuery = useMemo<BenchmarkResultQuery>(() => ({ yAxis: filter.yAxis, branch: filter.branch, timeStartValue: filter.timeStartValue, timeEndValue: filter.timeEndValue, displayStrategy: filter.displayStrategy, configurationKeys: filter.configurationKeys }), [filter]);

  useEffect(() => {
    let cancelled = false;
    setError("");
    if (!session || !filter.yAxis || !configurationKeys.length) { benchmarkKeyQueries.clearPending(); setBenchmarkKeys([]); setLoading(false); return; }
    setLoading(true);
    void benchmarkKeyQueries.run(() => session.queryBenchmarkKeys(resultQuery)).then((keys) => { if (!cancelled) { setBenchmarkKeys(keys); setLoading(false); } }, (queryError: unknown) => { if (!cancelled) { setBenchmarkKeys([]); setLoading(false); setError(queryError instanceof Error ? queryError.message : "Failed to query benchmark keys."); } });
    return () => { cancelled = true; };
  }, [benchmarkKeyQueries, configurationKeys.length, filter.yAxis, resultQuery, session, sourceRevision]);

  const benchmarkOptions = useMemo(() => buildBenchmarkOptions(benchmarkDefinitionsForKeys(benchmarkKeys, benchmarksByKey)), [benchmarkKeys, benchmarksByKey]);
  const runsEmptyTimeRangeLabel = timeStart || timeEnd ? `${formatDateRangePart(timeStart, "Start")} - ${formatDateRangePart(timeEnd, "End")}` : "All time";
  return { yAxisOptions: filter.yAxisOptions, branchOptions: filter.branchOptions, databaseTimeStart: filter.databaseTimeStart, databaseTimeEnd: filter.databaseTimeEnd, benchmarkOptions, resultQuery, runsEmptyTimeRangeLabel, loading, error };
}
