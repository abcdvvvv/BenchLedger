import { useEffect, useMemo, useState } from "react";
import { buildBenchmarkOptions, resolveBenchmarkViewFilter, type BenchmarkViewBenchmarkOption } from "../../lib/benchmark-view";
import type { BenchmarkDatabaseSession, BenchmarkResultQuery } from "../../lib/benchmark-database";
import { dateRangeEnd, dateRangeStart, formatDateRangePart } from "../../lib/dashboard-settings";
import type { BenchmarkDefinition, BenchmarkViewCatalog } from "../../lib/types";
import type { DisplayStrategy } from "../../lib/dashboard-settings";
import { LatestTaskRunner } from "../../lib/latest-task";

type UseBenchmarkViewSliceOptions = { session: BenchmarkDatabaseSession | null; catalog: BenchmarkViewCatalog; benchmarksByKey: ReadonlyMap<string, BenchmarkDefinition>; sourceRevision: number; configurationKeys: readonly string[]; yAxis: string; onYAxisChange: (value: string) => void; branch: string; onBranchChange: (value: string) => void; timeStart: string; timeEnd: string; displayStrategy: DisplayStrategy; };
type BenchmarkViewSlice = { yAxisOptions: string[]; branchOptions: string[]; databaseTimeStart: string; databaseTimeEnd: string; benchmarkOptions: BenchmarkViewBenchmarkOption[]; resultQuery: BenchmarkResultQuery; runsEmptyTimeRangeLabel: string; };

export function useBenchmarkViewSlice(options: UseBenchmarkViewSliceOptions): BenchmarkViewSlice {
  const { session, catalog, benchmarksByKey, sourceRevision, configurationKeys, yAxis, onYAxisChange, branch, onBranchChange, timeStart, timeEnd, displayStrategy } = options;
  const filter = useMemo(() => resolveBenchmarkViewFilter(catalog, { yAxis, branch, timeStartValue: dateRangeStart(timeStart), timeEndValue: dateRangeEnd(timeEnd), displayStrategy, configurationKeys }), [branch, catalog, configurationKeys, displayStrategy, timeEnd, timeStart, yAxis]);
  const [benchmarkKeys, setBenchmarkKeys] = useState<string[]>([]);
  const benchmarkKeyQueries = useMemo(() => new LatestTaskRunner<string[]>(), []);

  useEffect(() => { if (catalog.metricOptions.length && yAxis !== filter.yAxis) onYAxisChange(filter.yAxis); }, [catalog.metricOptions.length, filter.yAxis, onYAxisChange, yAxis]);
  useEffect(() => { if (branch !== filter.branch) onBranchChange(filter.branch); }, [branch, filter.branch, onBranchChange]);

  const resultQuery = useMemo<BenchmarkResultQuery>(() => ({ yAxis: filter.yAxis, branch: filter.branch, timeStartValue: filter.timeStartValue, timeEndValue: filter.timeEndValue, displayStrategy: filter.displayStrategy, configurationKeys: filter.configurationKeys }), [filter]);

  useEffect(() => {
    let cancelled = false;
    if (!session || !filter.yAxis || !configurationKeys.length) { benchmarkKeyQueries.clearPending(); setBenchmarkKeys([]); return; }
    void benchmarkKeyQueries.run(() => session.queryBenchmarkKeys(resultQuery)).then((keys) => { if (!cancelled) setBenchmarkKeys(keys); }, (queryError: unknown) => { if (!cancelled) { setBenchmarkKeys([]); console.error("BenchLedger benchmark-key query failed:", queryError); } });
    return () => { cancelled = true; };
  }, [benchmarkKeyQueries, configurationKeys.length, filter.yAxis, resultQuery, session, sourceRevision]);

  const benchmarkOptions = useMemo(() => buildBenchmarkOptions(benchmarkKeys, benchmarksByKey), [benchmarkKeys, benchmarksByKey]);
  const runsEmptyTimeRangeLabel = timeStart || timeEnd ? `${formatDateRangePart(timeStart, "Start")} - ${formatDateRangePart(timeEnd, "End")}` : "All time";
  return { yAxisOptions: catalog.metricOptions, branchOptions: catalog.branchOptions, databaseTimeStart: catalog.databaseTimeStart, databaseTimeEnd: catalog.databaseTimeEnd, benchmarkOptions, resultQuery, runsEmptyTimeRangeLabel };
}
