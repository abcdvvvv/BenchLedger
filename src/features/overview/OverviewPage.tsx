import { useEffect, useMemo, useState } from "react";
import { FiFolder } from "react-icons/fi";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { RunSelectMenu } from "../benchmarks/components/RunSelectMenu";
import { Button } from "../../components/ui/Button";
import { IconButton } from "../../components/ui/IconButton";
import { StatusBadge } from "../../components/ui/Badge";
import { Banner } from "../../components/common/Banner";
import { EmptyState } from "../../components/common/EmptyState";
import { Field, FieldLabel } from "../../components/ui/Field";
import { Panel, SectionTitle } from "../../components/ui/Card";
import { PageHeader } from "../../components/common/PageHeader";
import { StatCard } from "../../components/common/StatCard";
import { DataCell, DataHeadCell, DataTable, DataTableShell, SortButton } from "../../components/ui/Table";
import { runHeadline, runPairTableColumns } from "../../lib/dashboard-data";
import {
  Benchmark_Diff_Page_Size_Options,
  type BenchmarkDiffPageSize,
  type RunPairSort,
  type RunPairSortKey
} from "../../lib/dashboard-settings";
import {
  formatDate,
  formatMetricValue,
  formatPercent
} from "../../lib/format";
import { SegmentedToggle } from "../../components/ui/SegmentedToggle";
import { benchmarkDeltaTone } from "../benchmarks/benchmarkDeltaPresentation";
import type { OverviewStat } from "./useOverviewModel";
import type { BenchmarkRun, PairComparison } from "../../lib/types";
import { BenchmarkFilterToolbar, type BenchmarkFilterToolbarProps } from "../benchmarks/components/BenchmarkFilterToolbar";

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
  filters: Omit<BenchmarkFilterToolbarProps, "hasDataset">;
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

  const title = datasetState.error
    ? "Database load failed"
    : datasetState.hasLoadedDatabase
      ? "No benchmark rows found"
      : "No database is loaded";
  const description = datasetState.error || (
    datasetState.hasLoadedDatabase
      ? "The loaded SQLite database does not contain benchmark result rows."
      : "Choose a local SQLite file to inspect benchmark history."
  );

  return (
    <Banner
      tone={!datasetState.hasLoadedDatabase || Boolean(datasetState.error) ? "warning" : "default"}
      title={title}
      description={description}
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
  const runtimeName = focusRun?.software_environment_identity.runtime?.name || "";
  const runtimeVersion = focusRun?.software_environment_identity.runtime?.version || "";
  const cpuModel = focusRun?.hardware_environment_identity.cpu?.model || "";
  const cpuThreads = focusRun?.hardware_environment_identity.cpu?.logical_threads;
  const osName = focusRun?.software_environment_identity.platform?.os?.name || "";
  const osVersion = focusRun?.software_environment_identity.platform?.os?.version || "";
  const architecture = focusRun?.hardware_environment_identity.architecture || "";
  const revision = focusRun?.code_state_identity.source?.revision || "";
  const branch = focusRun?.run_metadata.source?.branch || "";
  const tags = focusRun?.run_metadata.source?.tags || [];
  const dirty = typeof focusRun?.code_state_metadata.source?.dirty === "boolean" ? String(focusRun.code_state_metadata.source.dirty) : "n/a";
  const rawSections: ReadonlyArray<readonly [string, unknown]> = focusRun ? [
    ["Code State Identity", focusRun.code_state_identity],
    ["Code State Metadata", focusRun.code_state_metadata],
    ["Hardware Environment Identity", focusRun.hardware_environment_identity],
    ["Hardware Environment Metadata", focusRun.hardware_environment_metadata],
    ["Software Environment Identity", focusRun.software_environment_identity],
    ["Software Environment Metadata", focusRun.software_environment_metadata],
    ["Run Metadata", focusRun.run_metadata]
  ] : [];
  const rows = [
    ["Run", focusRun ? runHeadline(focusRun) : "n/a"],
    ["Code Date", focusRun ? formatDate(focusRun.code_date) : "n/a"],
    ["Measured", focusRun ? formatDate(focusRun.measured_at) : "n/a"],
    ["Branch", branch || "n/a"],
    ["Tags", tags.length ? tags.join(", ") : "n/a"],
    ["Revision", revision || "n/a"],
    ["Hardware", focusRun?.hardware_environment_label || "n/a"],
    ["Hardware ID", focusRun?.hardware_environment_id || "n/a"],
    ["Software", focusRun?.software_environment_label || "n/a"],
    ["Software ID", focusRun?.software_environment_id || "n/a"],
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
          <caption className="visually-hidden">Current focus run identity and metadata</caption>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <th scope="row" className="type-table-head border-theme-b border-stone-200 pad-data-cell text-left dark:border-[#2f2f33]">
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
            {rawSections.map(([label, value]) => (
              <div key={label}>
                <div className="type-table-head mb-2">{label}</div>
                <pre className="surface-inset pad-field type-table overflow-x-auto whitespace-pre-wrap break-words">{JSON.stringify(value, null, 2)}</pre>
              </div>
            ))}
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
    setBenchmarkDiffPage(1);
  }, [comparison.baselineRun?.run_id, comparison.focusRun?.run_id, comparison.sortedComparisonRows]);

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
                <FieldLabel>Baseline run</FieldLabel>
                <RunSelectMenu
                  disabled={!header.filteredRuns.length}
                  runs={header.filteredRuns}
                  selectedRunId={header.baselineRunId}
                  onSelect={header.onBaselineRunChange}
                  ariaLabel="Baseline run"
                />
              </Field>
              <Field>
                <FieldLabel>Focus run</FieldLabel>
                <RunSelectMenu
                  disabled={!header.filteredRuns.length}
                  runs={header.filteredRuns}
                  selectedRunId={header.focusRunId}
                  onSelect={header.onFocusRunChange}
                  ariaLabel="Focus run"
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

      <BenchmarkFilterToolbar {...filters} hasDataset={datasetState.hasDataset} />

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
                  className="min-w-[10rem] place-items-stretch"
                  buttonClassName="flex h-full w-full items-center justify-center px-0 leading-none tabular-nums"
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
              title="Comparing different hardware/software pairs"
              description={`Focus run uses ${comparison.focusRun?.environment_pair_label || "n/a"}, while baseline uses ${comparison.baselineRun?.environment_pair_label || "n/a"}.`}
            />
          ) : null}
          {comparison.sortedComparisonRows.length ? (
            <DataTableShell label="Run comparison results" className="mt-2">
              <DataTable className="table-fixed">
                <caption className="visually-hidden">Benchmark values for the selected baseline and focus runs</caption>
                <colgroup>
                  <col style={{ width: "64%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                </colgroup>
                <thead>
                  <tr>
                    {runPairTableColumns.map((column) => (
                      <DataHeadCell
                        key={column.key}
                        aria-sort={comparison.runPairSort?.key === column.key
                          ? comparison.runPairSort.direction === "asc" ? "ascending" : "descending"
                          : "none"}
                      >
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
                    <tr key={row.benchmark_key}>
                      <DataCell code className="align-top">{row.benchmark_label}</DataCell>
                      <DataCell className="whitespace-nowrap">
                        {row.baseline_value === null ? "—" : formatMetricValue(row.baseline_value, row.unit)}
                      </DataCell>
                      <DataCell className="whitespace-nowrap">
                        {row.focus_value === null ? "—" : formatMetricValue(row.focus_value, row.unit)}
                      </DataCell>
                      <DataCell tone="plain" className="whitespace-nowrap">
                        <StatusBadge tone={row.status === "matched" ? benchmarkDeltaTone(row.delta, row.better) : "neutral"}>
                          {row.status === "matched" ? formatPercent(row.delta) : row.status === "focus-only" ? "Added" : "Removed"}
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
