import { useBenchmarkViewSlice } from "../benchmarks/useBenchmarkViewSlice";
import type { BenchmarkDatasetState } from "../../app/useBenchmarkDatasetState";
import { useUISettingSetter } from "../../app/useUISettingSetter";
import { TrendBoardPage } from "./TrendBoardPage";
import { useTrendBoardModel } from "./useTrendBoardModel";
import type { BenchmarkRunRecord } from "../../lib/types";

const Empty_Run_Records: ReadonlyMap<string, BenchmarkRunRecord> = new Map();

export type TrendBoardFeatureProps = {
  state: BenchmarkDatasetState;
};

export function TrendBoardFeature({ state }: TrendBoardFeatureProps) {
  const { settings, setSetting } = state;
  const setEnvironmentPair = useUISettingSetter(setSetting, "trendBoardEnvironmentPair");
  const setMetricKind = useUISettingSetter(setSetting, "trendBoardMetricKind");
  const setBranch = useUISettingSetter(setSetting, "trendBoardBranch");
  const setGroup = useUISettingSetter(setSetting, "trendBoardGroup");
  const setSelectedBenchmarkKeys = useUISettingSetter(setSetting, "trendBoardSelectedBenchmarkKeys");
  const setColumns = useUISettingSetter(setSetting, "trendBoardColumns");
  const setDisplayStrategy = useUISettingSetter(setSetting, "trendBoardDisplayStrategy");
  const setTimeStart = useUISettingSetter(setSetting, "trendBoardTimeStart");
  const setTimeEnd = useUISettingSetter(setSetting, "trendBoardTimeEnd");

  const slice = useBenchmarkViewSlice({
    index: state.benchmarkViewIndex,
    environmentPair: settings.trendBoardEnvironmentPair,
    onEnvironmentPairChange: setEnvironmentPair,
    metricKind: settings.trendBoardMetricKind,
    onMetricKindChange: setMetricKind,
    branch: settings.trendBoardBranch,
    onBranchChange: setBranch,
    timeStart: settings.trendBoardTimeStart,
    timeEnd: settings.trendBoardTimeEnd,
    displayStrategy: settings.trendBoardDisplayStrategy,
    group: settings.trendBoardGroup,
    onGroupChange: setGroup
  });

  const model = useTrendBoardModel({
    rows: slice.scopedRows,
    runRecordsById: state.dataset?.runsById ?? Empty_Run_Records,
    runsById: state.runsById,
    benchmarkOptions: slice.benchmarkOptions,
    selectedBenchmarkKeys: settings.trendBoardSelectedBenchmarkKeys,
    onSelectedBenchmarkKeysChange: setSelectedBenchmarkKeys,
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
        selectedBenchmarkKeys: settings.trendBoardSelectedBenchmarkKeys,
        onSelectedBenchmarkKeysChange: setSelectedBenchmarkKeys,
        hasDataset: state.hasDataset,
        trendBoardColumns: settings.trendBoardColumns,
        onTrendBoardColumnsChange: setColumns,
        trendBoardViewMode: settings.trendBoardViewMode,
        onToggleTrendBoardViewMode: () => setSetting("trendBoardViewMode", settings.trendBoardViewMode === "combined" ? "separate" : "combined"),
        trendAxisMode: settings.trendAxisMode,
        onToggleTrendAxisMode: () => setSetting("trendAxisMode", settings.trendAxisMode === "commit" ? "time" : "commit")
      }}
      filters={{
        environmentPair: settings.trendBoardEnvironmentPair,
        environmentPairOptions: state.environmentPairOptions,
        onEnvironmentPairChange: setEnvironmentPair,
        metricKind: settings.trendBoardMetricKind,
        metricOptions: slice.metricOptions,
        onMetricKindChange: setMetricKind,
        displayStrategy: settings.trendBoardDisplayStrategy,
        onDisplayStrategyChange: setDisplayStrategy,
        group: settings.trendBoardGroup,
        groupOptions: slice.groupOptions,
        selectedGroupLabel: slice.selectedGroupLabel,
        onGroupChange: setGroup,
        branch: settings.trendBoardBranch,
        branchOptions: slice.branchOptions,
        onBranchChange: setBranch,
        timeRangeLabel: slice.runsEmptyTimeRangeLabel,
        timeStart: settings.trendBoardTimeStart,
        timeEnd: settings.trendBoardTimeEnd,
        datasetTimeStart: slice.datasetTimeStart,
        datasetTimeEnd: slice.datasetTimeEnd,
        onTimeStartChange: setTimeStart,
        onTimeEndChange: setTimeEnd
      }}
      trend={{
        selectedMetricLabel: settings.trendBoardMetricKind,
        trendBoardCards: model.trendBoardCards,
        combinedTrendChart: model.combinedTrendChart,
        showCombinedTrendChart: settings.trendBoardViewMode === "combined",
        trendPlotMargin: model.trendPlotMargin,
        plotTheme: state.plotTheme,
        hasTrendRows: model.hasTrendRows
      }}
    />
  );
}
