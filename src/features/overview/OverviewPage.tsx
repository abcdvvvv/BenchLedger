import { FiFolder } from "react-icons/fi";
import { BenchmarkKeyCascadeFilter, type BenchmarkKeyFilterOption } from "../benchmarks/components/BenchmarkKeyCascadeFilter";
import { TimeRangePopover } from "../benchmarks/components/TimeRangePopover";
import { GroupCascadeMenu, type GroupMenuOption } from "../benchmarks/components/GroupCascadeMenu";
import Plot from "../benchmarks/components/Plot";
import { RunSelectMenu } from "../benchmarks/components/RunSelectMenu";
import { Button } from "../../components/ui/Button";
import { StatusBadge } from "../../components/ui/Badge";
import { Banner } from "../../components/common/Banner";
import { EmptyState } from "../../components/common/EmptyState";
import { Field, FieldLabel, SelectField, Toolbar, ToolbarGrid } from "../../components/ui/Field";
import { Panel, SectionTitle } from "../../components/ui/Card";
import { PageHeader } from "../../components/common/PageHeader";
import { StatCard } from "../../components/common/StatCard";
import { DataCell, DataHeadCell, DataTable, DataTableShell, SortButton } from "../../components/ui/Table";
import {
  Largest_Deltas_Bar_Width,
  runHeadline,
  runPairTableColumns,
  type DisplayStrategy,
  type PlotTheme,
  type RunPairSort,
  type RunPairSortKey,
  type TrendAxisMode
} from "../../lib/dashboard";
import {
  formatDate,
  formatMetricValue,
  formatPercent
} from "../../lib/format";
import { benchmarkDeltaColor, benchmarkDeltaTone } from "../benchmarks/benchmarkDeltaPresentation";
import type { OverviewStat } from "./useOverviewModel";
import type { BenchmarkRun, PairComparison } from "../../lib/types";

export type OverviewPageProps = {
  header: {
    siteTitle: string;
    siteDescription: string;
    focusRunId: string;
    baselineRunId: string;
    filteredRuns: BenchmarkRun[];
    onFocusRunChange: (runId: string) => void;
    onBaselineRunChange: (runId: string) => void;
    onOpenLocalFilePicker: () => void;
    downloadUrl: string | null;
    downloadLabel: string;
  };
  datasetState: {
    hasLoadedDatabase: boolean;
    hasDataset: boolean;
    error: string;
  };
  filters: {
    environment: string;
    environmentOptions: { value: string; label: string }[];
    onEnvironmentChange: (environment: string) => void;
    metricKind: string;
    metricOptions: string[];
    onMetricKindChange: (metricKind: string) => void;
    group: string;
    groupOptions: GroupMenuOption[];
    selectedGroupLabel: string;
    onGroupChange: (group: string) => void;
    branch: string;
    branchOptions: string[];
    onBranchChange: (branch: string) => void;
    timeRangeLabel: string;
    timeStart: string;
    timeEnd: string;
    datasetTimeStart: string;
    datasetTimeEnd: string;
    onTimeStartChange: (value: string) => void;
    onTimeEndChange: (value: string) => void;
    displayStrategy: DisplayStrategy;
    onDisplayStrategyChange: (strategy: DisplayStrategy) => void;
  };
  stats: OverviewStat[];
  trend: {
    benchmarkOptions: BenchmarkKeyFilterOption[];
    selectedBenchmarkIds: string[];
    onSelectedBenchmarkIdsChange: (values: string[]) => void;
    selectedMetricLabel: string;
    trendAxisMode: TrendAxisMode;
    onToggleTrendAxisMode: () => void;
    trendTraces: Array<Record<string, unknown>>;
    trendCommitAxisLabels?: { type: "date"; tickmode: "array"; tickvals: string[]; ticktext: string[] };
    trendPlotMargin: { t: number; r: number; b: number; l: number };
    plotTheme: PlotTheme;
  };
  comparison: {
    focusRun: BenchmarkRun | null;
    baselineRun: BenchmarkRun | null;
    environmentMismatch: boolean;
    comparisonRows: PairComparison[];
    deltaPlotMargin: { t: number; r: number; b: number; l: number };
    sortedComparisonRows: PairComparison[];
    runPairSort: RunPairSort | null;
    onToggleRunPairSort: (key: RunPairSortKey) => void;
  };
};

function DatasetBanner(props: Pick<OverviewPageProps, "datasetState" | "header">) {
  const { datasetState, header } = props;
  if (datasetState.hasDataset && !datasetState.error) return null;

  return (
    <Banner
      tone={!datasetState.hasLoadedDatabase || Boolean(datasetState.error) ? "warning" : "default"}
      title={datasetState.hasLoadedDatabase ? "No benchmark rows found" : "No database is loaded"}
      description={datasetState.error || "Choose a local SQLite file to inspect benchmark history."}
      action={
        <Button variant="primary" onClick={header.onOpenLocalFilePicker}>
          Choose Local SQLite
        </Button>
      }
    />
  );
}

function RunContextPanel(props: { focusRun: BenchmarkRun | null }) {
  const { focusRun } = props;
  const runtimeName = focusRun?.environment_metadata.runtime?.name || "";
  const runtimeVersion = focusRun?.environment_metadata.runtime?.version || "";
  const cpuModel = focusRun?.environment_metadata.hardware?.cpu?.model || "";
  const cpuThreads = focusRun?.environment_metadata.hardware?.cpu?.logical_threads;
  const osName = focusRun?.environment_metadata.platform?.os?.name || "";
  const osVersion = focusRun?.environment_metadata.platform?.os?.version || "";
  const architecture = focusRun?.environment_metadata.platform?.architecture || "";
  const revision = focusRun?.code_state_metadata.source?.revision || "";
  const branch = focusRun?.code_state_metadata.source?.branch || focusRun?.run_metadata.source?.branch || "";
  const tags = focusRun?.code_state_metadata.source?.tags || focusRun?.run_metadata.source?.tags || [];
  const dirty = typeof focusRun?.code_state_metadata.source?.dirty === "boolean" ? String(focusRun.code_state_metadata.source.dirty) : "n/a";
  const rows = [
    ["Run", focusRun ? runHeadline(focusRun) : "n/a"],
    ["Code Date", focusRun ? formatDate(focusRun.code_date) : "n/a"],
    ["Measured", focusRun ? formatDate(focusRun.measured_at) : "n/a"],
    ["Branch", branch || "n/a"],
    ["Tags", tags.length ? tags.join(", ") : "n/a"],
    ["Revision", revision || "n/a"],
    ["Environment", focusRun?.environment_label || "n/a"],
    ["Environment ID", focusRun?.environment_id || "n/a"],
    ["Runtime", [runtimeName, runtimeVersion].filter(Boolean).join(" ") || "n/a"],
    ["CPU", cpuModel || "n/a"],
    ["Threads", typeof cpuThreads === "number" ? cpuThreads.toLocaleString() : "n/a"],
    ["Platform", [osName, osVersion, architecture].filter(Boolean).join(" · ") || "n/a"],
    ["Dirty", dirty]
  ] as const;

  return (
    <Panel>
      <SectionTitle title="Run Context" description="Execution metadata for the current focus run." />
      <div className="mt-5 overflow-x-auto">
        <table className="type-body min-w-full border-separate border-spacing-0 text-left">
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <th className="type-table-head border-theme-b border-stone-200 pad-data-cell text-left dark:border-[#2f2f33]">
                  {label}
                </th>
                <td className="type-body border-theme-b border-stone-200 pad-data-cell dark:border-[#2f2f33]">
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {focusRun ? (
        <details className="mt-5">
          <summary className="type-body-strong cursor-pointer">Raw Metadata</summary>
          <div className="mt-3 grid gap-3">
            <div>
              <div className="type-table-head mb-2">Code State Metadata</div>
              <pre className="surface-inset pad-field type-table overflow-x-auto whitespace-pre-wrap break-words">{JSON.stringify(focusRun.code_state_metadata, null, 2)}</pre>
            </div>
            <div>
              <div className="type-table-head mb-2">Environment Metadata</div>
              <pre className="surface-inset pad-field type-table overflow-x-auto whitespace-pre-wrap break-words">{JSON.stringify(focusRun.environment_metadata, null, 2)}</pre>
            </div>
            <div>
              <div className="type-table-head mb-2">Run Metadata</div>
              <pre className="surface-inset pad-field type-table overflow-x-auto whitespace-pre-wrap break-words">{JSON.stringify(focusRun.run_metadata, null, 2)}</pre>
            </div>
          </div>
        </details>
      ) : null}
    </Panel>
  );
}

export function OverviewPage(props: OverviewPageProps) {
  const {
    header,
    datasetState,
    filters,
    stats,
    trend,
    comparison
  } = props;

  return (
    <>
      <PageHeader
        eyebrow="Benchmarking › Dashboard"
        title={header.siteTitle}
        description={header.siteDescription}
        actions={(
          <>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:min-w-[30rem]">
              <Field>
                <FieldLabel>Focus run</FieldLabel>
                <RunSelectMenu
                  disabled={!header.filteredRuns.length}
                  runs={header.filteredRuns}
                  selectedRunId={header.focusRunId}
                  onSelect={header.onFocusRunChange}
                />
              </Field>
              <Field>
                <FieldLabel>Baseline run</FieldLabel>
                <RunSelectMenu
                  disabled={!header.filteredRuns.length}
                  runs={header.filteredRuns}
                  selectedRunId={header.baselineRunId}
                  onSelect={header.onBaselineRunChange}
                />
              </Field>
            </div>
            <Field className="max-sm:w-full">
              <FieldLabel className="invisible">Action</FieldLabel>
              <Button variant="secondary" className="max-sm:w-full" onClick={header.onOpenLocalFilePicker}>
                <FiFolder aria-hidden="true" />
                <span>SQLite</span>
              </Button>
            </Field>
            {header.downloadUrl ? (
              <Field className="max-sm:w-full">
                <FieldLabel className="invisible">Action</FieldLabel>
                <Button variant="secondary" className="max-sm:w-full" href={header.downloadUrl} download={header.downloadLabel}>
                  Download
                </Button>
              </Field>
            ) : null}
          </>
        )}
      />

      <DatasetBanner datasetState={datasetState} header={header} />

      <Toolbar variant="plain">
        <ToolbarGrid>
          <Field>
            <FieldLabel>Environment</FieldLabel>
            <SelectField value={filters.environment} onChange={(event) => filters.onEnvironmentChange(event.target.value)} disabled={!datasetState.hasDataset}>
              {filters.environmentOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </SelectField>
          </Field>
          <Field>
            <FieldLabel>Metric</FieldLabel>
            <SelectField value={filters.metricKind} onChange={(event) => filters.onMetricKindChange(event.target.value)} disabled={!filters.metricOptions.length}>
              {filters.metricOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </SelectField>
          </Field>
          <Field>
            <FieldLabel>Group</FieldLabel>
            <GroupCascadeMenu
              disabled={!datasetState.hasDataset}
              options={filters.groupOptions}
              selectedValue={filters.group}
              selectedLabel={filters.selectedGroupLabel}
              onSelect={filters.onGroupChange}
            />
          </Field>
          <Field>
            <FieldLabel>Branch</FieldLabel>
            <SelectField value={filters.branch} onChange={(event) => filters.onBranchChange(event.target.value)} disabled={!filters.branchOptions.length}>
              {filters.branchOptions.map((option) => <option key={option} value={option}>{option === "all" ? "All branches" : option}</option>)}
            </SelectField>
          </Field>
          <Field>
            <FieldLabel>Time Range</FieldLabel>
            <TimeRangePopover
              disabled={!datasetState.hasDataset}
              label={filters.timeRangeLabel}
              timeStart={filters.timeStart}
              timeEnd={filters.timeEnd}
              datasetTimeStart={filters.datasetTimeStart}
              datasetTimeEnd={filters.datasetTimeEnd}
              onTimeStartChange={filters.onTimeStartChange}
              onTimeEndChange={filters.onTimeEndChange}
            />
          </Field>
          <Field>
            <FieldLabel>Display Strategy</FieldLabel>
            <SelectField
              value={filters.displayStrategy}
              onChange={(event) => filters.onDisplayStrategyChange(event.target.value as DisplayStrategy)}
              disabled={!datasetState.hasDataset}
            >
              <option value="all">All records</option>
              <option value="tagged-only">Tagged only</option>
              <option value="tagged-main">Tagged + main/master</option>
            </SelectField>
          </Field>
        </ToolbarGrid>
      </Toolbar>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard
            key={stat.label}
            Icon={stat.Icon}
            label={stat.label}
            value={stat.value}
            delta={stat.delta}
            deltaTone={stat.deltaTone}
            detail={stat.detail}
            detailFullWidth={stat.detailFullWidth}
          />
        ))}
      </section>

      <section className="grid gap-4">
        <Panel style={{ paddingBottom: 8 }}>
          <SectionTitle
            title="Benchmark Trend"
            action={(
              <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
                <div className="min-w-0 sm:min-w-[18rem] lg:min-w-[22rem]">
                  <BenchmarkKeyCascadeFilter
                    options={trend.benchmarkOptions}
                    selectedValues={trend.selectedBenchmarkIds}
                    setSelectedValues={trend.onSelectedBenchmarkIdsChange}
                    disabled={!datasetState.hasDataset}
                    stretchWidth
                  />
                </div>
                <Button variant="secondary" size="normal" className="w-34 max-lg:w-full" onClick={trend.onToggleTrendAxisMode}>
                  X-Axis: {trend.trendAxisMode === "commit" ? "Commit" : "Time"}
                </Button>
              </div>
            )}
          />
          <div className="mt-3 h-[24rem]">
            {trend.selectedBenchmarkIds.length ? (
              <div className="h-[24rem]">
                <Plot
                  useResizeHandler
                  style={{ width: "100%", height: "100%" }}
                  data={trend.trendTraces}
                  layout={{
                    autosize: true,
                    margin: trend.trendPlotMargin,
                    paper_bgcolor: "rgba(0, 0, 0, 0)",
                    plot_bgcolor: "rgba(0, 0, 0, 0)",
                    font: { color: trend.plotTheme.axis },
                    xaxis: {
                      showgrid: false,
                      color: trend.plotTheme.axis,
                      tickfont: { size: 14 },
                      ...(trend.trendAxisMode === "commit" ? trend.trendCommitAxisLabels : undefined)
                    },
                    yaxis: {
                      title: { text: trend.selectedMetricLabel || "Metric value" },
                      gridcolor: trend.plotTheme.grid,
                      zeroline: false,
                      color: trend.plotTheme.axis,
                      tickfont: { size: 14 }
                    },
                    modebar: {
                      bgcolor: "rgba(0, 0, 0, 0)",
                      color: trend.plotTheme.axis,
                      activecolor: trend.plotTheme.line
                    },
                    showlegend: trend.selectedBenchmarkIds.length > 1,
                    legend: trend.selectedBenchmarkIds.length > 1 ? {
                      orientation: "h",
                      x: 0,
                      y: -0.2,
                      font: { color: trend.plotTheme.axis }
                    } : undefined
                  }}
                  config={{ displayModeBar: "hover", responsive: true }}
                />
              </div>
            ) : (
              <EmptyState
                className="pad-empty flex h-full flex-col items-center justify-center text-center"
                title="No benchmark key selected"
              />
            )}
          </div>
        </Panel>

        <Panel>
          <SectionTitle title="Largest Deltas" description="Top movers between the focus run and the baseline run." />
          <div className="mt-5 h-[24rem]">
            <Plot
              useResizeHandler
              style={{ width: "100%", height: "100%" }}
              data={[
                {
                  type: "bar",
                  orientation: "h",
                  width: Largest_Deltas_Bar_Width,
                  x: comparison.comparisonRows.slice(0, 6).map((row) => row.delta).reverse(),
                  y: comparison.comparisonRows.slice(0, 6).map((row) => row.benchmark_label).reverse(),
                  marker: {
                    color: comparison.comparisonRows
                      .slice(0, 6)
                      .map((row) => benchmarkDeltaColor(row.delta, row.better, trend.plotTheme))
                      .reverse()
                  },
                  hovertemplate: "%{y}<br>%{x:.2f}%<extra></extra>"
                }
              ]}
              layout={{
                autosize: true,
                margin: comparison.deltaPlotMargin,
                paper_bgcolor: "rgba(0, 0, 0, 0)",
                plot_bgcolor: "rgba(0, 0, 0, 0)",
                font: { color: trend.plotTheme.axis },
                xaxis: { title: "Delta (%)", gridcolor: trend.plotTheme.grid, zerolinecolor: trend.plotTheme.zero, color: trend.plotTheme.axis },
                yaxis: { automargin: true, color: trend.plotTheme.axis },
                showlegend: false
              }}
              config={{ displayModeBar: false, responsive: true }}
            />
          </div>
        </Panel>

        <RunContextPanel focusRun={comparison.focusRun} />

        <Panel>
          <SectionTitle title="Run Pair Table" description="All comparable benchmark rows in the selected pair for the chosen metric." />
          {comparison.environmentMismatch ? (
            <Banner
              className="mt-5"
              tone="warning"
              title="Comparing different environments"
              description={`Focus run uses ${comparison.focusRun?.environment_label || "n/a"}, while baseline uses ${comparison.baselineRun?.environment_label || "n/a"}.`}
            />
          ) : null}
          {comparison.sortedComparisonRows.length ? (
            <DataTableShell className="mt-5">
              <DataTable>
                <thead>
                  <tr>
                    {runPairTableColumns.map((column) => (
                      <DataHeadCell key={column.key}>
                        <SortButton
                          active={comparison.runPairSort?.key === column.key}
                          onClick={() => comparison.onToggleRunPairSort(column.key)}
                          indicator={comparison.runPairSort?.key === column.key ? (comparison.runPairSort.direction === "asc" ? "↑" : "↓") : "↕"}
                        >
                          {column.label}
                        </SortButton>
                      </DataHeadCell>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparison.sortedComparisonRows.map((row) => (
                    <tr key={row.benchmark_id}>
                      <DataCell code className="align-top">{row.benchmark_label}</DataCell>
                      <DataCell>{formatMetricValue(row.focus_value, row.unit)}</DataCell>
                      <DataCell>{formatMetricValue(row.baseline_value, row.unit)}</DataCell>
                      <DataCell tone="plain">
                        <StatusBadge tone={benchmarkDeltaTone(row.delta, row.better)}>
                          {formatPercent(row.delta)}
                        </StatusBadge>
                      </DataCell>
                      <DataCell tone="muted">{row.unit}</DataCell>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </DataTableShell>
          ) : (
            <EmptyState className="surface-empty pad-empty mt-5 flex min-h-44 flex-col items-center justify-center text-center" title="No comparable benchmark rows" description="Adjust the selected runs or filters to compare benchmark rows." />
          )}
        </Panel>
      </section>
    </>
  );
}
