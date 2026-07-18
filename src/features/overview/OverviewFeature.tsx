import { useState } from "react";
import { useBenchmarkViewSlice } from "../benchmarks/useBenchmarkViewSlice";
import { type RunPairSort } from "../../lib/dashboard-settings";
import type { BenchmarkDatasetState } from "../../app/useBenchmarkDatasetState";
import { OverviewPage } from "./OverviewPage";
import { useOverviewModel } from "./useOverviewModel";

export type OverviewFeatureProps = {
  state: BenchmarkDatasetState;
  onOpenLocalFilePicker: () => void;
};

export function OverviewFeature({ state, onOpenLocalFilePicker }: OverviewFeatureProps) {
  const { settings, setSetting } = state;
  const [runPairSort, setRunPairSort] = useState<RunPairSort | null>(null);

  const slice = useBenchmarkViewSlice({
    index: state.benchmarkViewIndex,
    environment: settings.environment,
    onEnvironmentChange: (environment) => setSetting("environment", environment),
    metricKind: settings.metricKind,
    onMetricKindChange: (metricKind) => setSetting("metricKind", metricKind),
    branch: settings.branch,
    onBranchChange: (branch) => setSetting("branch", branch),
    timeStart: settings.timeStart,
    timeEnd: settings.timeEnd,
    displayStrategy: settings.displayStrategy,
    group: settings.group,
    onGroupChange: (group) => setSetting("group", group)
  });

  const model = useOverviewModel({
    rows: slice.scopedRows,
    benchmarksById: state.benchmarksById,
    allRuns: state.allRuns,
    focusRunId: settings.focusRunId,
    onFocusRunIdChange: (runId) => setSetting("focusRunId", runId),
    baselineRunId: settings.baselineRunId,
    onBaselineRunIdChange: (runId) => setSetting("baselineRunId", runId),
    runPairSort,
    onRunPairSortChange: setRunPairSort,
    environment: settings.environment,
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
        onFocusRunChange: (runId) => setSetting("focusRunId", runId),
        onBaselineRunChange: (runId) => setSetting("baselineRunId", runId),
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
        environment: settings.environment,
        environmentOptions: state.environmentOptions,
        onEnvironmentChange: (environment) => setSetting("environment", environment),
        metricKind: settings.metricKind,
        metricOptions: slice.metricOptions,
        onMetricKindChange: (metricKind) => setSetting("metricKind", metricKind),
        group: settings.group,
        groupOptions: slice.groupOptions,
        selectedGroupLabel: slice.selectedGroupLabel,
        onGroupChange: (group) => setSetting("group", group),
        branch: settings.branch,
        branchOptions: slice.branchOptions,
        onBranchChange: (branch) => setSetting("branch", branch),
        timeRangeLabel: slice.runsEmptyTimeRangeLabel,
        timeStart: settings.timeStart,
        timeEnd: settings.timeEnd,
        datasetTimeStart: slice.datasetTimeStart,
        datasetTimeEnd: slice.datasetTimeEnd,
        onTimeStartChange: (value) => setSetting("timeStart", value),
        onTimeEndChange: (value) => setSetting("timeEnd", value),
        displayStrategy: settings.displayStrategy,
        onDisplayStrategyChange: (strategy) => setSetting("displayStrategy", strategy)
      }}
      stats={model.stats}
      comparison={{
        focusRun: model.focusRun,
        baselineRun: model.baselineRun,
        environmentMismatch: model.environmentMismatch,
        sortedComparisonRows: model.sortedComparisonRows,
        benchmarkDiffPageSize: settings.benchmarkDiffPageSize,
        onBenchmarkDiffPageSizeChange: (value) => setSetting("benchmarkDiffPageSize", value),
        runPairSort,
        onToggleRunPairSort: model.toggleRunPairSort
      }}
    />
  );
}
