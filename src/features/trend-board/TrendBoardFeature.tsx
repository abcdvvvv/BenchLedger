import { useBenchmarkViewSlice } from "../benchmarks/useBenchmarkViewSlice";
import type { BenchmarkDatasetState } from "../../app/useBenchmarkDatasetState";
import { TrendBoardPage } from "./TrendBoardPage";
import { useTrendBoardModel } from "./useTrendBoardModel";

export type TrendBoardFeatureProps = {
  state: BenchmarkDatasetState;
};

export function TrendBoardFeature({ state }: TrendBoardFeatureProps) {
  const { settings, setSetting } = state;

  const slice = useBenchmarkViewSlice({
    index: state.benchmarkViewIndex,
    environment: settings.trendBoardEnvironment,
    onEnvironmentChange: (environment) => setSetting("trendBoardEnvironment", environment),
    metricKind: settings.trendBoardMetricKind,
    onMetricKindChange: (metricKind) => setSetting("trendBoardMetricKind", metricKind),
    branch: settings.trendBoardBranch,
    onBranchChange: (branch) => setSetting("trendBoardBranch", branch),
    timeStart: settings.trendBoardTimeStart,
    timeEnd: settings.trendBoardTimeEnd,
    displayStrategy: settings.trendBoardDisplayStrategy,
    group: settings.trendBoardGroup,
    onGroupChange: (group) => setSetting("trendBoardGroup", group)
  });

  const model = useTrendBoardModel({
    rows: slice.scopedRows,
    runsById: state.runsById,
    benchmarkOptions: slice.benchmarkOptions,
    selectedBenchmarkIds: settings.trendBoardSelectedBenchmarkIds,
    onSelectedBenchmarkIdsChange: (values) => setSetting("trendBoardSelectedBenchmarkIds", values),
    metricKind: settings.trendBoardMetricKind,
    trendAxisMode: settings.trendAxisMode,
    trendLineShape: settings.trendLineShape,
    trendMarkerSymbol: settings.trendMarkerSymbol,
    trendMarkerFillMode: settings.trendMarkerFillMode,
    plotTheme: state.plotTheme,
    theme: settings.theme
  });

  return (
    <TrendBoardPage
      header={{
        benchmarkOptions: slice.benchmarkOptions,
        selectedBenchmarkIds: settings.trendBoardSelectedBenchmarkIds,
        onSelectedBenchmarkIdsChange: (values) => setSetting("trendBoardSelectedBenchmarkIds", values),
        hasDataset: state.hasDataset,
        trendBoardColumns: settings.trendBoardColumns,
        onTrendBoardColumnsChange: (value) => setSetting("trendBoardColumns", value),
        trendBoardViewMode: settings.trendBoardViewMode,
        onToggleTrendBoardViewMode: () => setSetting("trendBoardViewMode", settings.trendBoardViewMode === "combined" ? "separate" : "combined"),
        trendAxisMode: settings.trendAxisMode,
        onToggleTrendAxisMode: () => setSetting("trendAxisMode", settings.trendAxisMode === "commit" ? "time" : "commit")
      }}
      filters={{
        environment: settings.trendBoardEnvironment,
        environmentOptions: state.environmentOptions,
        onEnvironmentChange: (environment) => setSetting("trendBoardEnvironment", environment),
        metricKind: settings.trendBoardMetricKind,
        metricOptions: slice.metricOptions,
        onMetricKindChange: (metricKind) => setSetting("trendBoardMetricKind", metricKind),
        displayStrategy: settings.trendBoardDisplayStrategy,
        onDisplayStrategyChange: (strategy) => setSetting("trendBoardDisplayStrategy", strategy),
        group: settings.trendBoardGroup,
        groupOptions: slice.groupOptions,
        selectedGroupLabel: slice.selectedGroupLabel,
        onGroupChange: (group) => setSetting("trendBoardGroup", group),
        branch: settings.trendBoardBranch,
        branchOptions: slice.branchOptions,
        onBranchChange: (branch) => setSetting("trendBoardBranch", branch),
        timeRangeLabel: slice.runsEmptyTimeRangeLabel,
        timeStart: settings.trendBoardTimeStart,
        timeEnd: settings.trendBoardTimeEnd,
        datasetTimeStart: slice.datasetTimeStart,
        datasetTimeEnd: slice.datasetTimeEnd,
        onTimeStartChange: (value) => setSetting("trendBoardTimeStart", value),
        onTimeEndChange: (value) => setSetting("trendBoardTimeEnd", value)
      }}
      trend={{
        selectedMetricLabel: settings.trendBoardMetricKind,
        trendBoardCards: model.trendBoardCards,
        combinedTrendChart: model.combinedTrendChart,
        showCombinedTrendChart: settings.trendBoardViewMode === "combined",
        trendPlotMargin: model.trendPlotMargin,
        plotTheme: state.plotTheme
      }}
    />
  );
}
