import { useEffect, useMemo, useState } from "react";
import { FiFolder } from "react-icons/fi";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { TimeRangePopover } from "../benchmarks/components/TimeRangePopover";
import { GroupCascadeMenu, type GroupMenuOption } from "../benchmarks/components/GroupCascadeMenu";
import { RunSelectMenu } from "../benchmarks/components/RunSelectMenu";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import { StatusBadge } from "../../components/ui/Badge";
import { Banner } from "../../components/common/Banner";
import { EmptyState } from "../../components/common/EmptyState";
import { Field, FieldLabel, SelectField, Toolbar, ToolbarGrid } from "../../components/ui/Field";
import { Panel, SectionTitle } from "../../components/ui/Card";
import { PageHeader } from "../../components/common/PageHeader";
import { StatCard } from "../../components/common/StatCard";
import { DataCell, DataHeadCell, DataTable, DataTableShell, SortButton } from "../../components/ui/Table";
import { runHeadline, runPairTableColumns } from "../../lib/dashboard-data";
import {
  Benchmark_Diff_Page_Size_Options,
  type BenchmarkDiffPageSize,
  type DisplayStrategy,
  type RunPairSort,
  type RunPairSortKey
} from "../../lib/dashboard-settings";
import {
  formatDate,
  formatMetricValue,
  formatPercent
} from "../../lib/format";
import { cn } from "../../components/ui/cn";
import { benchmarkDeltaTone } from "../benchmarks/benchmarkDeltaPresentation";
import type { OverviewStat } from "./useOverviewModel";
import type { BenchmarkRun, PairComparison } from "../../lib/types";

function SegmentedToggle(props: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  ariaLabel: string;
}) {
  const activeIndex = props.options.findIndex((option) => option.value === props.value);
  const optionCount = Math.max(props.options.length, 1);
  const activeStyle = {
    width: `calc((100% - 0.4rem) / ${optionCount})`,
    transform: `translateX(calc(${activeIndex} * 100%))`
  };

  return (
    <div
      className="control-frame surface-control relative inline-grid min-h-[2.3rem] min-w-[10rem] grid-cols-3 place-items-stretch overflow-hidden p-[0.2rem] shadow-none"
      role="group"
      aria-label={props.ariaLabel}
    >
      <span
        aria-hidden="true"
        className="radius-theme absolute top-[0.2rem] bottom-[0.2rem] left-[0.2rem] z-0 transition-transform"
        style={{ ...activeStyle, backgroundColor: "var(--color-text-theme-brand)" }}
      />
      {props.options.map((option) => {
        const active = option.value === props.value;
        return (
          <button
            key={option.value}
            type="button"
            className={cn(
              "radius-theme relative z-10 flex h-full w-full items-center justify-center border-0 bg-transparent px-0 text-center text-[0.82rem] leading-none font-semibold tabular-nums transition",
              active ? "text-stone-950" : "text-stone-500 dark:text-stone-400"
            )}
            onClick={() => props.onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

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
  comparison: {
    focusRun: BenchmarkRun | null;
    baselineRun: BenchmarkRun | null;
    environmentMismatch: boolean;
    sortedComparisonRows: PairComparison[];
    benchmarkDiffPageSize: BenchmarkDiffPageSize;
    onBenchmarkDiffPageSizeChange: (value: BenchmarkDiffPageSize) => void;
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
  const runtimeName = focusRun?.environment_identity.runtime?.name || "";
  const runtimeVersion = focusRun?.environment_identity.runtime?.version || "";
  const cpuModel = focusRun?.environment_identity.hardware?.cpu?.model || "";
  const cpuThreads = focusRun?.environment_identity.hardware?.cpu?.logical_threads;
  const osName = focusRun?.environment_identity.platform?.os?.name || "";
  const osVersion = focusRun?.environment_identity.platform?.os?.version || "";
  const architecture = focusRun?.environment_identity.platform?.architecture || "";
  const revision = focusRun?.code_state_identity.source?.revision || "";
  const branch = focusRun?.run_metadata.source?.branch || "";
  const tags = focusRun?.run_metadata.source?.tags || [];
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
          <summary className="type-body-strong cursor-pointer">Raw Identity & Metadata</summary>
          <div className="mt-3 grid gap-3">
            <div>
              <div className="type-table-head mb-2">Code State Identity</div>
              <pre className="surface-inset pad-field type-table overflow-x-auto whitespace-pre-wrap break-words">{JSON.stringify(focusRun.code_state_identity, null, 2)}</pre>
            </div>
            <div>
              <div className="type-table-head mb-2">Code State Metadata</div>
              <pre className="surface-inset pad-field type-table overflow-x-auto whitespace-pre-wrap break-words">{JSON.stringify(focusRun.code_state_metadata, null, 2)}</pre>
            </div>
            <div>
              <div className="type-table-head mb-2">Environment Identity</div>
              <pre className="surface-inset pad-field type-table overflow-x-auto whitespace-pre-wrap break-words">{JSON.stringify(focusRun.environment_identity, null, 2)}</pre>
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
    comparison
  } = props;
  const [benchmarkDiffPage, setBenchmarkDiffPage] = useState(1);
  const benchmarkDiffTotalPages = Math.max(1, Math.ceil(comparison.sortedComparisonRows.length / comparison.benchmarkDiffPageSize));
  const pagedComparisonRows = useMemo(() => {
    const startIndex = (benchmarkDiffPage - 1) * comparison.benchmarkDiffPageSize;
    return comparison.sortedComparisonRows.slice(startIndex, startIndex + comparison.benchmarkDiffPageSize);
  }, [benchmarkDiffPage, comparison.benchmarkDiffPageSize, comparison.sortedComparisonRows]);

  useEffect(() => {
    setBenchmarkDiffPage((currentPage) => Math.min(currentPage, benchmarkDiffTotalPages));
  }, [benchmarkDiffTotalPages]);

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
            valueTone={stat.valueTone}
            delta={stat.delta}
            deltaTone={stat.deltaTone}
            detail={stat.detail}
            detailFullWidth={stat.detailFullWidth}
            inlineNoWrap={stat.inlineNoWrap}
          />
        ))}
      </section>

      <section className="grid gap-4">
        <Panel>
          <SectionTitle
            title="Benchmark Diff"
            action={(
              <div className="flex flex-wrap items-center justify-end gap-3">
                <SegmentedToggle
                  value={String(comparison.benchmarkDiffPageSize)}
                  options={Benchmark_Diff_Page_Size_Options.map((pageSize) => ({ value: String(pageSize), label: String(pageSize) }))}
                  onChange={(value) => {
                    comparison.onBenchmarkDiffPageSizeChange(Number(value) as BenchmarkDiffPageSize);
                    setBenchmarkDiffPage(1);
                  }}
                  ariaLabel="Benchmark diff rows per page"
                />
                <div className="type-table-head text-stone-500 dark:text-stone-400">
                  {benchmarkDiffPage} / {benchmarkDiffTotalPages}
                </div>
                <div className="flex items-center gap-2">
                  <IconButton
                    label="Previous page"
                    variant="secondary"
                    disabled={benchmarkDiffPage <= 1}
                    onClick={() => setBenchmarkDiffPage((page) => Math.max(1, page - 1))}
                  >
                    <FiChevronLeft aria-hidden="true" />
                  </IconButton>
                  <IconButton
                    label="Next page"
                    variant="secondary"
                    disabled={benchmarkDiffPage >= benchmarkDiffTotalPages}
                    onClick={() => setBenchmarkDiffPage((page) => Math.min(benchmarkDiffTotalPages, page + 1))}
                  >
                    <FiChevronRight aria-hidden="true" />
                  </IconButton>
                </div>
              </div>
            )}
          />
          {comparison.environmentMismatch ? (
            <Banner
              className="mt-4"
              tone="warning"
              title="Comparing different environments"
              description={`Focus run uses ${comparison.focusRun?.environment_label || "n/a"}, while baseline uses ${comparison.baselineRun?.environment_label || "n/a"}.`}
            />
          ) : null}
          {comparison.sortedComparisonRows.length ? (
            <DataTableShell className="mt-2">
              <DataTable className="table-fixed">
                <colgroup>
                  <col style={{ width: "64%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                </colgroup>
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
                  {pagedComparisonRows.map((row) => (
                    <tr key={row.benchmark_id}>
                      <DataCell code className="align-top">{row.benchmark_label}</DataCell>
                      <DataCell className="whitespace-nowrap">{formatMetricValue(row.baseline_value, row.unit)}</DataCell>
                      <DataCell className="whitespace-nowrap">{formatMetricValue(row.focus_value, row.unit)}</DataCell>
                      <DataCell tone="plain" className="whitespace-nowrap">
                        <StatusBadge tone={benchmarkDeltaTone(row.delta, row.better)}>
                          {formatPercent(row.delta)}
                        </StatusBadge>
                      </DataCell>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            </DataTableShell>
          ) : (
            <EmptyState className="surface-empty pad-empty mt-4 flex min-h-44 flex-col items-center justify-center text-center" title="No comparable benchmark rows" description="Adjust the selected runs or filters to compare benchmark rows." />
          )}
        </Panel>

        <RunContextPanel focusRun={comparison.focusRun} />
      </section>
    </>
  );
}
