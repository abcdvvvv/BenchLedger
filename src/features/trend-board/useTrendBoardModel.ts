import { useEffect, useMemo } from "react";
import {
  buildTrendRowsByBenchmark,
  normalizeSelectedBenchmarkKeys,
  type BenchmarkViewBenchmarkOption
} from "../../lib/benchmark-view";
import {
  Trend_Y_Padding_Ratio,
  buildTrendTrace,
  commitAxisLayout,
  colorForBenchmark,
  colorWithAlpha,
  splitTrendRowsByEnvironmentPair,
  trendDisplayUnitContext,
  trendValueExtent,
  type PlotAxisTickLabels,
  type PlotTheme
} from "../../lib/dashboard-plotting";
import type { ThemeMode, TrendAxisMode, TrendLineShape, TrendMarkerFillMode } from "../../lib/dashboard-settings";
import type { TrendMarkerSymbol } from "../../lib/trend-marker-symbols";
import type { BenchmarkRow, BenchmarkRun, BenchmarkRunRecord } from "../../lib/types";

export type TrendBoardCard = {
  benchmarkKey: string;
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
  runRecordsById: ReadonlyMap<string, BenchmarkRunRecord>;
  runsById: ReadonlyMap<string, BenchmarkRun>;
  benchmarkOptions: BenchmarkViewBenchmarkOption[];
  selectedBenchmarkKeys: string[];
  onSelectedBenchmarkKeysChange: (values: string[]) => void;
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
  hasTrendRows: boolean;
};

export function useTrendBoardModel(options: UseTrendBoardModelOptions): UseTrendBoardModelResult {
  const {
    rows,
    runRecordsById,
    runsById,
    benchmarkOptions,
    selectedBenchmarkKeys,
    onSelectedBenchmarkKeysChange,
    metricKind,
    trendAxisMode,
    trendLineShape,
    trendMarkerSymbol,
    trendMarkerFillMode,
    plotTheme,
    theme
  } = options;

  useEffect(() => {
    onSelectedBenchmarkKeysChange(normalizeSelectedBenchmarkKeys(selectedBenchmarkKeys, benchmarkOptions));
  }, [benchmarkOptions, onSelectedBenchmarkKeysChange, selectedBenchmarkKeys]);

  const benchmarkOptionsByKey = useMemo(
    () => new Map(benchmarkOptions.map((option) => [option.value, option])),
    [benchmarkOptions]
  );
  const trendBoardRowsByBenchmark = useMemo(
    () => buildTrendRowsByBenchmark(rows, runRecordsById, runsById, selectedBenchmarkKeys),
    [rows, runRecordsById, runsById, selectedBenchmarkKeys]
  );

  const trendBoardRows = useMemo(
    () => selectedBenchmarkKeys.flatMap((benchmarkKey) => trendBoardRowsByBenchmark.get(benchmarkKey) ?? []),
    [selectedBenchmarkKeys, trendBoardRowsByBenchmark]
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
  const combinedYExtent = useMemo(
    () => trendValueExtent(trendBoardRows, combinedDisplayUnitContext),
    [combinedDisplayUnitContext, trendBoardRows]
  );
  const combinedYMin = combinedYExtent?.min ?? 0;
  const combinedYSpan = combinedYExtent ? combinedYExtent.max - combinedYExtent.min : 0;
  const combinedYPadding = combinedYSpan > 0
    ? combinedYSpan * Trend_Y_Padding_Ratio
    : Math.max(Math.abs(combinedYMin) * Trend_Y_Padding_Ratio, 1);

  const trendBoardCards = useMemo<TrendBoardCard[]>(() => {
    return selectedBenchmarkKeys.flatMap((benchmarkKey, index) => {
      const cardRows = trendBoardRowsByBenchmark.get(benchmarkKey) ?? [];
      if (!cardRows.length) return [];
      const displayUnitContext = trendDisplayUnitContext(cardRows);
      const option = benchmarkOptionsByKey.get(benchmarkKey);
      const path = option?.path?.length ? option.path : [option?.label ?? benchmarkKey];
      const label = path.length > 1 ? path.slice(0, -1).join(" | ") : path[0] ?? benchmarkKey;
      const yExtent = trendValueExtent(cardRows, displayUnitContext);
      if (!yExtent) return [];
      const yMin = yExtent.min;
      const ySpan = yExtent.max - yExtent.min;
      const yPadding = ySpan > 0
        ? ySpan * Trend_Y_Padding_Ratio
        : Math.max(Math.abs(yMin) * Trend_Y_Padding_Ratio, 1);
      const commitAxis = trendAxisMode === "commit" ? commitAxisLayout(cardRows) : undefined;

      return [{
        benchmarkKey: benchmarkKey,
        label,
        path,
        metricLabel: displayUnitContext.formatMetricLabel(metricKind),
        commitAxisLabels: commitAxis?.tickLabels,
        traces: splitTrendRowsByEnvironmentPair(cardRows).flatMap((series, environmentPairIndex, environmentPairSeries) => {
          const color = colorForBenchmark(index * Math.max(environmentPairSeries.length, 1) + environmentPairIndex);
          const seriesLabel = environmentPairSeries.length > 1 ? series.environmentPairLabel : label;

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
            showLegend: environmentPairSeries.length > 1,
            fillGradientScale: [
              [0, colorWithAlpha(color, 0)],
              [1, colorWithAlpha(color, 0.2)]
            ]
          });
        })
      }];
    });
  }, [
    benchmarkOptionsByKey,
    metricKind,
    plotTheme,
    selectedBenchmarkKeys,
    theme,
    trendAxisMode,
    trendBoardRowsByBenchmark,
    trendLineShape,
    trendMarkerFillMode,
    trendMarkerSymbol
  ]);

  const combinedTrendChart = useMemo<TrendBoardCombinedChart | null>(() => {
    if (!selectedBenchmarkKeys.length) return null;

    let showLegend = false;
    const traces = selectedBenchmarkKeys.flatMap((benchmarkKey, index) => {
      const traceRows = trendBoardRowsByBenchmark.get(benchmarkKey) ?? [];
      if (!traceRows.length) return [];
      const benchmarkLabel = benchmarkOptionsByKey.get(benchmarkKey)?.label ?? benchmarkKey;
      const environmentPairSeries = splitTrendRowsByEnvironmentPair(traceRows);

      if (selectedBenchmarkKeys.length > 1 || environmentPairSeries.length > 1) {
        showLegend = true;
      }

      return environmentPairSeries.flatMap((series, environmentPairIndex) => {
        const label = environmentPairSeries.length > 1
          ? `${benchmarkLabel} · ${series.environmentPairLabel}`
          : benchmarkLabel;
        const color = colorForBenchmark(index * Math.max(environmentPairSeries.length, 1) + environmentPairIndex);

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
          showLegend: selectedBenchmarkKeys.length > 1 || environmentPairSeries.length > 1
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
    benchmarkOptionsByKey,
    combinedCommitAxis,
    combinedDisplayUnitContext,
    combinedYMin,
    combinedYPadding,
    metricKind,
    plotTheme,
    selectedBenchmarkKeys,
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
    trendPlotMargin,
    hasTrendRows: trendBoardRows.length > 0
  };
}
