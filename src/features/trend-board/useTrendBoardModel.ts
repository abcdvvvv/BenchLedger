import { useEffect, useMemo } from "react";
import {
  buildTrendRowsByBenchmark,
  normalizeSelectedBenchmarkIds,
  type BenchmarkViewBenchmarkOption
} from "../../lib/benchmark-view";
import {
  Trend_Y_Padding_Ratio,
  buildTrendTrace,
  commitAxisLayout,
  colorForBenchmark,
  colorWithAlpha,
  splitTrendRowsByEnvironment,
  trendDisplayUnitContext,
  type PlotAxisTickLabels,
  type PlotTheme
} from "../../lib/dashboard-plotting";
import type { ThemeMode, TrendAxisMode, TrendLineShape, TrendMarkerFillMode } from "../../lib/dashboard-settings";
import type { TrendMarkerSymbol } from "../../lib/trend-marker-symbols";
import type { BenchmarkRow, BenchmarkRun } from "../../lib/types";

export type TrendBoardCard = {
  benchmarkId: string;
  label: string;
  path: string[];
  metricLabel: string;
  traces: Array<Record<string, unknown>>;
  commitAxisLabels?: PlotAxisTickLabels;
};

export type TrendBoardCombinedChart = {
  traces: Array<Record<string, unknown>>;
  metricLabel: string;
  commitAxisLabels?: PlotAxisTickLabels;
  showLegend: boolean;
};

type UseTrendBoardModelOptions = {
  rows: BenchmarkRow[];
  runsById: ReadonlyMap<string, BenchmarkRun>;
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
  combinedTrendChart: TrendBoardCombinedChart | null;
  trendPlotMargin: { t: number; r: number; b: number; l: number };
};

export function useTrendBoardModel(options: UseTrendBoardModelOptions): UseTrendBoardModelResult {
  const {
    rows,
    runsById,
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
  const combinedDisplayUnitContext = useMemo(
    () => trendDisplayUnitContext(trendBoardRows),
    [trendBoardRows]
  );
  const combinedCommitAxis = useMemo(
    () => trendAxisMode === "commit" ? commitAxisLayout(trendBoardRows) : undefined,
    [trendAxisMode, trendBoardRows]
  );
  const combinedYValues = trendBoardRows.map((row) => combinedDisplayUnitContext.scaleValue(row.value, row.unit));
  const combinedYMin = combinedYValues.length ? Math.min(...combinedYValues) : 0;
  const combinedYMax = combinedYValues.length ? Math.max(...combinedYValues) : 0;
  const combinedYSpan = combinedYMax - combinedYMin;
  const combinedYPadding = combinedYSpan > 0
    ? combinedYSpan * Trend_Y_Padding_Ratio
    : Math.max(Math.abs(combinedYMin) * Trend_Y_Padding_Ratio, 1);

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

  const combinedTrendChart = useMemo<TrendBoardCombinedChart | null>(() => {
    if (!selectedBenchmarkIds.length) return null;

    let showLegend = false;
    const traces = selectedBenchmarkIds.flatMap((benchmarkKey, index) => {
      const traceRows = trendBoardRowsByBenchmark.get(benchmarkKey) ?? [];
      if (!traceRows.length) return [];
      const benchmarkLabel = benchmarkOptionsById.get(benchmarkKey)?.label ?? benchmarkKey;
      const environmentSeries = splitTrendRowsByEnvironment(traceRows);

      if (selectedBenchmarkIds.length > 1 || environmentSeries.length > 1) {
        showLegend = true;
      }

      return environmentSeries.flatMap((series, environmentIndex) => {
        const label = environmentSeries.length > 1
          ? `${benchmarkLabel} · ${series.environmentLabel}`
          : benchmarkLabel;
        const color = colorForBenchmark(index * Math.max(environmentSeries.length, 1) + environmentIndex);

        return buildTrendTrace(series.rows, {
          axisMode: trendAxisMode,
          commitAxisPositions: combinedCommitAxis?.positionsByCodeStateId,
          lineShape: trendLineShape,
          markerSymbol: trendMarkerSymbol,
          markerFillMode: trendMarkerFillMode,
          displayUnitContext: combinedDisplayUnitContext,
          color,
          label,
          plotTheme,
          theme,
          yMin: combinedYMin,
          yPadding: combinedYPadding,
          showLegend: selectedBenchmarkIds.length > 1 || environmentSeries.length > 1
        });
      });
    });

    if (!traces.length) return null;
    return {
      traces,
      metricLabel: combinedDisplayUnitContext.formatMetricLabel(metricKind),
      commitAxisLabels: combinedCommitAxis?.tickLabels,
      showLegend
    };
  }, [
    benchmarkOptionsById,
    combinedCommitAxis,
    combinedDisplayUnitContext,
    combinedYMin,
    combinedYPadding,
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
    combinedTrendChart,
    trendPlotMargin
  };
}
