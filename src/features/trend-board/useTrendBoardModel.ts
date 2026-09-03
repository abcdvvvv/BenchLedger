import { useEffect, useMemo, useRef, useState } from "react";
import type { BenchmarkDimensionSelection } from "../../app/useBenchmarkDimensionSelector";
import { buildTrendRowsByBenchmark, normalizeSelectedBenchmarkKeys, type BenchmarkViewBenchmarkOption } from "../../lib/benchmark-view";
import { Trend_Y_Padding_Ratio, buildTrendTrace, colorForBenchmark, colorWithAlpha, trendDisplayUnitContext, trendValueExtent } from "../../lib/dashboard-plotting";
import type { TrendLineShape, TrendMarkerFillMode } from "../../lib/dashboard-settings";
import type { TrendMarkerSymbol } from "../../lib/trend-marker-symbols";
import type { BenchmarkRun } from "../../lib/types";
import type { BenchmarkDatabaseSession, BenchmarkResultQuery, BenchmarkTrendAggregateRow } from "../../lib/benchmark-database";
import { LatestTaskRunner } from "../../lib/latest-task";

type TrendBoardCard = { benchmarkKey: string; label: string; path: string[]; metricLabel: string; traces: Array<Record<string, unknown>>; };
type TrendBoardCombinedChart = { traces: Array<Record<string, unknown>>; metricLabel: string; showLegend: boolean; };
type UseTrendBoardModelOptions = { session: BenchmarkDatabaseSession | null; query: BenchmarkResultQuery; sourceRevision: number; runsById: ReadonlyMap<string, BenchmarkRun>; benchmarkOptions: BenchmarkViewBenchmarkOption[]; selectedBenchmarkKeys: string[]; onSelectedBenchmarkKeysChange: (values: string[]) => void; yAxis: string; dimensionSelection: BenchmarkDimensionSelection; trendLineShape: TrendLineShape; trendMarkerSymbol: TrendMarkerSymbol; trendMarkerFillMode: TrendMarkerFillMode; };
type UseTrendBoardModelResult = { trendBoardCards: TrendBoardCard[]; combinedTrendChart: TrendBoardCombinedChart | null; trendPlotMargin: { t: number; r: number; b: number; l: number }; hasTrendRows: boolean; xAxisTitle: string; };

const Trend_Plot_Margin = { t: 2, r: 12, b: 58, l: 52 } as const;
const Empty_Trend_Plot_Margin = { t: 2, r: 12, b: 58, l: 20 } as const;

function yBounds(rows: { value: number; unit: string }[]) {
  const display = trendDisplayUnitContext(rows); const extent = trendValueExtent(rows, display); const min = extent?.min ?? 0; const span = extent ? extent.max - extent.min : 0; const padding = span > 0 ? span * Trend_Y_Padding_Ratio : Math.max(Math.abs(min) * Trend_Y_Padding_Ratio, 1); return { display, min, padding };
}

export function useTrendBoardModel(options: UseTrendBoardModelOptions): UseTrendBoardModelResult {
  const { session, query, sourceRevision, runsById, benchmarkOptions, selectedBenchmarkKeys, onSelectedBenchmarkKeysChange, yAxis, dimensionSelection, trendLineShape, trendMarkerSymbol, trendMarkerFillMode } = options;
  const normalizedSelectedBenchmarkKeys = useMemo(() => dimensionSelection.validation.isValid ? normalizeSelectedBenchmarkKeys(selectedBenchmarkKeys, benchmarkOptions) : selectedBenchmarkKeys, [benchmarkOptions, dimensionSelection.validation.isValid, selectedBenchmarkKeys]);
  const [rows, setRows] = useState<BenchmarkTrendAggregateRow[]>([]);
  const queryContextRef = useRef<{ session: BenchmarkDatabaseSession | null; query: BenchmarkResultQuery; sourceRevision: number } | null>(null);
  const trendQueries = useMemo(() => new LatestTaskRunner<BenchmarkTrendAggregateRow[]>(), []);

  useEffect(() => { onSelectedBenchmarkKeysChange(normalizedSelectedBenchmarkKeys); }, [normalizedSelectedBenchmarkKeys, onSelectedBenchmarkKeysChange]);
  useEffect(() => {
    let cancelled = false; const previous = queryContextRef.current; const contextChanged = previous?.session !== session || previous?.query !== query || previous?.sourceRevision !== sourceRevision; queryContextRef.current = { session, query, sourceRevision };
    if (contextChanged || !normalizedSelectedBenchmarkKeys.length) setRows([]);
    if (!session || !query.yAxis || !normalizedSelectedBenchmarkKeys.length) { trendQueries.clearPending(); return; }
    void trendQueries.run(() => session.queryTrendAggregates({ ...query, benchmarkKeys: normalizedSelectedBenchmarkKeys })).then((nextRows) => { if (!cancelled) setRows(nextRows); }, (error: unknown) => { if (!cancelled) console.error("BenchLedger trend query failed:", error); });
    return () => { cancelled = true; };
  }, [normalizedSelectedBenchmarkKeys, query, session, sourceRevision, trendQueries]);

  const benchmarkOptionsByKey = useMemo(() => new Map(benchmarkOptions.map((option) => [option.value, option])), [benchmarkOptions]);
  const rowsByBenchmark = useMemo(() => buildTrendRowsByBenchmark(rows, runsById, normalizedSelectedBenchmarkKeys, dimensionSelection), [dimensionSelection, normalizedSelectedBenchmarkKeys, rows, runsById]);
  const allRows = useMemo(() => normalizedSelectedBenchmarkKeys.flatMap((key) => rowsByBenchmark.get(key) ?? []), [normalizedSelectedBenchmarkKeys, rowsByBenchmark]);
  const trendPlotMargin = allRows.length ? Trend_Plot_Margin : Empty_Trend_Plot_Margin;
  const combinedBounds = useMemo(() => yBounds(allRows), [allRows]);

  const trendBoardCards = useMemo<TrendBoardCard[]>(() => normalizedSelectedBenchmarkKeys.flatMap((benchmarkKey, index) => {
    const cardRows = rowsByBenchmark.get(benchmarkKey) ?? []; if (!cardRows.length) return [];
    const bounds = yBounds(cardRows); const option = benchmarkOptionsByKey.get(benchmarkKey); const path = option?.path?.length ? option.path : [option?.label ?? benchmarkKey]; const label = path.length > 1 ? path.slice(0, -1).join(" | ") : path[0] ?? benchmarkKey; const color = colorForBenchmark(index);
    return [{ benchmarkKey, label, path, metricLabel: bounds.display.formatMetricLabel(yAxis), traces: buildTrendTrace(cardRows, { lineShape: trendLineShape, markerSymbol: trendMarkerSymbol, markerFillMode: trendMarkerFillMode, displayUnitContext: bounds.display, color, label, yMin: bounds.min, yPadding: bounds.padding, showLegend: false, fillGradientScale: [[0, colorWithAlpha(color, 0)], [1, colorWithAlpha(color, 0.2)]] }) }];
  }), [benchmarkOptionsByKey, normalizedSelectedBenchmarkKeys, rowsByBenchmark, trendLineShape, trendMarkerFillMode, trendMarkerSymbol, yAxis]);

  const combinedTrendChart = useMemo<TrendBoardCombinedChart | null>(() => {
    if (!normalizedSelectedBenchmarkKeys.length) return null;
    const traces = normalizedSelectedBenchmarkKeys.flatMap((benchmarkKey, index) => { const traceRows = rowsByBenchmark.get(benchmarkKey) ?? []; if (!traceRows.length) return []; const label = benchmarkOptionsByKey.get(benchmarkKey)?.label ?? benchmarkKey; const color = colorForBenchmark(index); return buildTrendTrace(traceRows, { lineShape: trendLineShape, markerSymbol: trendMarkerSymbol, markerFillMode: trendMarkerFillMode, displayUnitContext: combinedBounds.display, color, label, yMin: combinedBounds.min, yPadding: combinedBounds.padding, showLegend: normalizedSelectedBenchmarkKeys.length > 1 }); });
    return traces.length ? { traces, metricLabel: combinedBounds.display.formatMetricLabel(yAxis), showLegend: normalizedSelectedBenchmarkKeys.length > 1 } : null;
  }, [benchmarkOptionsByKey, combinedBounds, normalizedSelectedBenchmarkKeys, rowsByBenchmark, trendLineShape, trendMarkerFillMode, trendMarkerSymbol, yAxis]);

  return { trendBoardCards, combinedTrendChart, trendPlotMargin, hasTrendRows: allRows.length > 0, xAxisTitle: dimensionSelection.varyingDimension?.label ?? "Varying dimension" };
}
