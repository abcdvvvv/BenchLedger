import { useState } from "react";
import { useBenchmarkViewSlice } from "../benchmarks/useBenchmarkViewSlice";
import { type RunPairSort } from "../../lib/dashboard-settings";
import type { BenchmarkDatasetState } from "../../app/useBenchmarkDatasetState";
import { useUISettingSetter } from "../../app/useUISettingSetter";
import { OverviewPage } from "./OverviewPage";
import { useOverviewModel } from "./useOverviewModel";

export type OverviewFeatureProps = {
  state: BenchmarkDatasetState;
  onOpenLocalFilePicker: () => void;
};

export function OverviewFeature({ state, onOpenLocalFilePicker }: OverviewFeatureProps) {
  const { settings, setSetting } = state;
  const [runPairSort, setRunPairSort] = useState<RunPairSort | null>(null);
  const setEnvironmentPair = useUISettingSetter(setSetting, "environmentPair");
  const setMetricKind = useUISettingSetter(setSetting, "metricKind");
  const setBranch = useUISettingSetter(setSetting, "branch");
  const setGroup = useUISettingSetter(setSetting, "group");
  const setFocusRunId = useUISettingSetter(setSetting, "focusRunId");
  const setBaselineRunId = useUISettingSetter(setSetting, "baselineRunId");
  const setTimeStart = useUISettingSetter(setSetting, "timeStart");
  const setTimeEnd = useUISettingSetter(setSetting, "timeEnd");
  const setDisplayStrategy = useUISettingSetter(setSetting, "displayStrategy");
  const setBenchmarkDiffPageSize = useUISettingSetter(setSetting, "benchmarkDiffPageSize");

  const slice = useBenchmarkViewSlice({
    index: state.benchmarkViewIndex,
    environmentPair: settings.environmentPair,
    onEnvironmentPairChange: setEnvironmentPair,
    metricKind: settings.metricKind,
    onMetricKindChange: setMetricKind,
    branch: settings.branch,
    onBranchChange: setBranch,
    timeStart: settings.timeStart,
    timeEnd: settings.timeEnd,
    displayStrategy: settings.displayStrategy,
    group: settings.group,
    onGroupChange: setGroup
  });

  const model = useOverviewModel({
    rows: slice.scopedRows,
    benchmarksByKey: state.benchmarksByKey,
    allRuns: state.allRuns,
    focusRunId: settings.focusRunId,
    onFocusRunIdChange: setFocusRunId,
    baselineRunId: settings.baselineRunId,
    onBaselineRunIdChange: setBaselineRunId,
    runPairSort,
    onRunPairSortChange: setRunPairSort,
    environmentPair: settings.environmentPair,
    metricKind: settings.metricKind,
    group: settings.group,
    branch: settings.branch,
    timeStart: settings.timeStart,
    timeEnd: settings.timeEnd
  });

  return (
    <OverviewPage
      header={{
        siteTitle: state.siteTitle,
        siteDescription: state.siteDescription,
        focusRunId: settings.focusRunId,
        baselineRunId: settings.baselineRunId,
        filteredRuns: model.filteredRuns,
        onFocusRunChange: setFocusRunId,
        onBaselineRunChange: setBaselineRunId,
        onOpenLocalFilePicker,
        downloadUrl: state.dataset?.source_url ?? null,
        downloadLabel: state.dataset?.source_label ?? "benchledger.sqlite"
      }}
      datasetState={{
        hasLoadedDatabase: Boolean(state.dataset),
        hasDataset: state.hasDataset,
        error: state.error
      }}
      filters={{
        environmentPair: settings.environmentPair,
        environmentPairOptions: state.environmentPairOptions,
        onEnvironmentPairChange: setEnvironmentPair,
        metricKind: settings.metricKind,
        metricOptions: slice.metricOptions,
        onMetricKindChange: setMetricKind,
        group: settings.group,
        groupOptions: slice.groupOptions,
        selectedGroupLabel: slice.selectedGroupLabel,
        onGroupChange: setGroup,
        branch: settings.branch,
        branchOptions: slice.branchOptions,
        onBranchChange: setBranch,
        timeRangeLabel: slice.runsEmptyTimeRangeLabel,
        timeStart: settings.timeStart,
        timeEnd: settings.timeEnd,
        datasetTimeStart: slice.datasetTimeStart,
        datasetTimeEnd: slice.datasetTimeEnd,
        onTimeStartChange: setTimeStart,
        onTimeEndChange: setTimeEnd,
        displayStrategy: settings.displayStrategy,
        onDisplayStrategyChange: setDisplayStrategy
      }}
      stats={model.stats}
      comparison={{
        focusRun: model.focusRun,
        baselineRun: model.baselineRun,
        environmentMismatch: model.environmentMismatch,
        sortedComparisonRows: model.sortedComparisonRows,
        benchmarkDiffPageSize: settings.benchmarkDiffPageSize,
        onBenchmarkDiffPageSizeChange: setBenchmarkDiffPageSize,
        runPairSort,
        onToggleRunPairSort: model.toggleRunPairSort
      }}
    />
  );
}
