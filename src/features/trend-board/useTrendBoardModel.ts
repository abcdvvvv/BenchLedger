import { useEffect, useMemo } from "react";
import {
  buildTrendRowsByBenchmark,
  normalizeSelectedBenchmarkIds,
  type BenchmarkViewBenchmarkOption
} from "../../lib/benchmark-view";
import {
  Trend_Y_Padding_Ratio,
  buildRuns,
  buildTrendTrace,
  commitAxisLayout,
  colorForBenchmark,
  colorWithAlpha,
  splitTrendRowsByEnvironment,
  trendDisplayUnitContext,
  type PlotAxisTickLabels,
  type PlotTheme,
  type ThemeMode,
  type TrendAxisMode,
  type TrendLineShape,
  type TrendMarkerFillMode
} from "../../lib/dashboard";
import type { TrendMarkerSymbol } from "../../lib/trend-marker-symbols";
import type { BenchmarkRow } from "../../lib/types";

export type TrendBoardCard = {
  benchmarkId: string;
  label: string;
  path: string[];
  metricLabel: string;
  traces: Array<Record<string, unknown>>;
  commitAxisLabels?: PlotAxisTickLabels;
};

type UseTrendBoardModelOptions = {
  rows: BenchmarkRow[];
  benchmarkOptions: BenchmarkViewBenchmarkOption[];
  selectedBenchmarkIds: string[];
  onSelectedBenchmarkIdsChange: (values: string[]) => void;
  metricKind: string;
  trendAxisMode: TrendAxisMode;
  trendLineShape: TrendLineShape;
  trendMarkerSymbol: TrendMarkerSymbol;
  trendMarkerFillMode: TrendMarkerFillMode;
  plotTheme: PlotTheme;
  theme: ThemeMode;
};

type UseTrendBoardModelResult = {
  trendBoardCards: TrendBoardCard[];
  trendPlotMargin: { t: number; r: number; b: number; l: number };
};

export function useTrendBoardModel(options: UseTrendBoardModelOptions): UseTrendBoardModelResult {
  const {
    rows,
    benchmarkOptions,
    selectedBenchmarkIds,
    onSelectedBenchmarkIdsChange,
    metricKind,
    trendAxisMode,
    trendLineShape,
    trendMarkerSymbol,
    trendMarkerFillMode,
    plotTheme,
    theme
  } = options;

  useEffect(() => {
    onSelectedBenchmarkIdsChange(normalizeSelectedBenchmarkIds(selectedBenchmarkIds, benchmarkOptions));
  }, [benchmarkOptions, onSelectedBenchmarkIdsChange, selectedBenchmarkIds]);

  const runs = useMemo(() => buildRuns(rows), [rows]);
  const runsById = useMemo(() => new Map(runs.map((run) => [run.run_id, run])), [runs]);
  const benchmarkOptionsById = useMemo(
    () => new Map(benchmarkOptions.map((option) => [option.value, option])),
    [benchmarkOptions]
  );
  const trendBoardRowsByBenchmark = useMemo(
    () => buildTrendRowsByBenchmark(rows, runsById, selectedBenchmarkIds),
    [rows, runsById, selectedBenchmarkIds]
  );

  const trendBoardRows = useMemo(
    () => benchmarkOptions.flatMap((option) => trendBoardRowsByBenchmark.get(option.value) ?? []),
    [benchmarkOptions, trendBoardRowsByBenchmark]
  );
  const trendPlotMargin = trendBoardRows.length ? { t: 2, r: 12, b: 50, l: 52 } : { t: 2, r: 12, b: 50, l: 20 };

  const trendBoardCards = useMemo<TrendBoardCard[]>(() => {
    return selectedBenchmarkIds.flatMap((benchmarkKey, index) => {
      const cardRows = trendBoardRowsByBenchmark.get(benchmarkKey) ?? [];
      if (!cardRows.length) return [];
      const displayUnitContext = trendDisplayUnitContext(cardRows);
      const option = benchmarkOptionsById.get(benchmarkKey);
      const path = option?.path?.length ? option.path : [option?.label ?? benchmarkKey];
      const label = path.length > 1 ? path.slice(0, -1).join(" | ") : path[0] ?? benchmarkKey;
      const yValues = cardRows.map((row) => displayUnitContext.scaleValue(row.value, row.unit));
      const yMin = Math.min(...yValues);
      const yMax = Math.max(...yValues);
      const ySpan = yMax - yMin;
      const yPadding = ySpan > 0
        ? ySpan * Trend_Y_Padding_Ratio
        : Math.max(Math.abs(yMin) * Trend_Y_Padding_Ratio, 1);
      const commitAxis = trendAxisMode === "commit" ? commitAxisLayout(cardRows) : undefined;

      return [{
        benchmarkId: benchmarkKey,
        label,
        path,
        metricLabel: displayUnitContext.formatMetricLabel(metricKind),
        commitAxisLabels: commitAxis?.tickLabels,
        traces: splitTrendRowsByEnvironment(cardRows).flatMap((series, environmentIndex, environmentSeries) => {
          const color = colorForBenchmark(index * Math.max(environmentSeries.length, 1) + environmentIndex);
          const seriesLabel = environmentSeries.length > 1 ? series.environmentLabel : label;

          return buildTrendTrace(series.rows, {
            axisMode: trendAxisMode,
            commitAxisPositions: commitAxis?.positionsByCodeStateId,
            lineShape: trendLineShape,
            markerSymbol: trendMarkerSymbol,
            markerFillMode: trendMarkerFillMode,
            displayUnitContext,
            color,
            label: seriesLabel,
            plotTheme,
            theme,
            yMin,
            yPadding,
            showLegend: environmentSeries.length > 1,
            fillGradientScale: [
              [0, colorWithAlpha(color, 0)],
              [1, colorWithAlpha(color, 0.2)]
            ]
          });
        })
      }];
    });
  }, [
    benchmarkOptionsById,
    metricKind,
    plotTheme,
    selectedBenchmarkIds,
    theme,
    trendAxisMode,
    trendBoardRowsByBenchmark,
    trendLineShape,
    trendMarkerFillMode,
    trendMarkerSymbol
  ]);

  return {
    trendBoardCards,
    trendPlotMargin
  };
}
