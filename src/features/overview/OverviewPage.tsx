import { useEffect, useMemo, useState } from "react";
import type { BenchmarkDatabaseState } from "../../app/useBenchmarkDatabaseState";
import { useUISettingSetter } from "../../app/useUISettingSetter";
import { FiFolder } from "react-icons/fi";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { DimensionPointSelectMenu } from "../benchmarks/components/DimensionPointSelectMenu";
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
  type RunPairSort
} from "../../lib/dashboard-settings";
import {
  formatDate,
  formatMetricValue,
  formatPercent
} from "../../lib/format";
import { SegmentedToggle } from "../../components/ui/SegmentedToggle";
import { benchmarkDeltaTone } from "../benchmarks/benchmarkDeltaPresentation";
import type { BenchmarkRun } from "../../lib/types";
import type { DimensionSelectionPoint } from "../../lib/dimension-selector";
import { BenchmarkFilterToolbar } from "../benchmarks/components/BenchmarkFilterToolbar";
import { BenchmarkKeyCascadeFilter } from "../benchmarks/components/BenchmarkKeyCascadeFilter";
import { useBenchmarkViewSlice } from "../benchmarks/useBenchmarkViewSlice";
import { useOverviewModel } from "./useOverviewModel";
import { DimensionSelectorInvalidBanner } from "../dimension-selector/DimensionSelectorInvalidBanner";

export type OverviewPageProps = { state: BenchmarkDatabaseState; onOpenLocalFilePicker: () => void; };

function DatabaseBanner(props: { hasLoadedDatabase: boolean; hasDatabase: boolean; error: string; onOpenLocalFilePicker: () => void }) {
  if (props.hasDatabase && !props.error) return null;

  const title = props.error
    ? "Database load failed"
    : props.hasLoadedDatabase
      ? "No benchmark rows found"
      : "No database is loaded";
  const description = props.error || (
    props.hasLoadedDatabase
      ? "The loaded SQLite database does not contain benchmark result rows."
      : "Choose a local SQLite file to inspect benchmark history."
  );

  return (
    <Banner
      tone={!props.hasLoadedDatabase || Boolean(props.error) ? "warning" : "default"}
      title={title}
      description={description}
      action={
        <Button variant="primary" onClick={props.onOpenLocalFilePicker}>
          Choose Local SQLite
        </Button>
      }
    />
  );
}

function RepresentativeRunContextPanel(props: { focusRun: BenchmarkRun | null; focusPoint: DimensionSelectionPoint | null; dimensionLabel: string; }) {
  const { focusRun, focusPoint } = props;
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
    ["Varying Dimension", props.dimensionLabel || "n/a"],
    ["Focus Value", focusPoint?.label || "n/a"],
    ["Exact Configurations", focusPoint ? focusPoint.configurationCount.toLocaleString() : "n/a"],
    ["Representative Run", focusRun ? runHeadline(focusRun) : "n/a"],
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
      <SectionTitle title="Representative Run Context" description="Latest exact run contributing to the current focus point." />
      <div className="mt-5 overflow-x-auto">
        <table className="type-body min-w-full border-separate border-spacing-0 text-left">
          <caption className="visually-hidden">Current focus point and representative run identity metadata</caption>
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

export function OverviewPage({ state, onOpenLocalFilePicker }: OverviewPageProps) {
  const { settings, setSetting } = state;
  const [runPairSort, setRunPairSort] = useState<RunPairSort | null>(null);
  const [benchmarkDiffPage, setBenchmarkDiffPage] = useState(1);
  const setYAxis = useUISettingSetter(setSetting, "yAxis");
  const setSelectedBenchmarkKeys = useUISettingSetter(setSetting, "selectedBenchmarkKeys");
  const setBranch = useUISettingSetter(setSetting, "branch");
  const setFocusPointKey = useUISettingSetter(setSetting, "focusPointKey");
  const setBaselinePointKey = useUISettingSetter(setSetting, "baselinePointKey");
  const setTimeStart = useUISettingSetter(setSetting, "timeStart");
  const setTimeEnd = useUISettingSetter(setSetting, "timeEnd");
  const setDisplayStrategy = useUISettingSetter(setSetting, "displayStrategy");
  const setBenchmarkDiffPageSize = useUISettingSetter(setSetting, "benchmarkDiffPageSize");

  const slice = useBenchmarkViewSlice({
    session: state.session,
    catalog: state.benchmarkViewIndex,
    benchmarksByKey: state.benchmarksByKey,
    sourceRevision: state.databaseSourceRevision,
    configurationKeys: state.dimensionSelection.configurationKeys,
    yAxis: settings.yAxis,
    onYAxisChange: setYAxis,
    branch: settings.branch,
    onBranchChange: setBranch,
    timeStart: settings.timeStart,
    timeEnd: settings.timeEnd,
    displayStrategy: settings.displayStrategy
  });

  const overviewQuery = useMemo(() => ({ ...slice.resultQuery, benchmarkKeys: settings.selectedBenchmarkKeys.length ? settings.selectedBenchmarkKeys : undefined }), [settings.selectedBenchmarkKeys, slice.resultQuery]);
  const model = useOverviewModel({
    session: state.session,
    query: overviewQuery,
    sourceRevision: state.databaseSourceRevision,
    benchmarkCount: slice.benchmarkOptions.length,
    benchmarksByKey: state.benchmarksByKey,
    allRuns: state.allRuns,
    dimensionSelection: state.dimensionSelection,
    focusPointKey: settings.focusPointKey,
    onFocusPointKeyChange: setFocusPointKey,
    baselinePointKey: settings.baselinePointKey,
    onBaselinePointKeyChange: setBaselinePointKey,
    runPairSort,
    onRunPairSortChange: setRunPairSort,
    conditionCount: state.dimensionSelection.fixedValueSelections.filter((selector) => selector.options.length > 1).length,
    yAxis: settings.yAxis,
    branch: settings.branch,
    timeStart: settings.timeStart,
    timeEnd: settings.timeEnd
  });
  const preferRunIdentityPointLabels = state.dimensionSelection.varyingDimension?.category === "code" && state.dimensionSelection.varyingDimension.path.length === 2 && state.dimensionSelection.varyingDimension.path[0] === "source" && state.dimensionSelection.varyingDimension.path[1] === "revision";
  const benchmarkDiffTotalPages = Math.max(1, Math.ceil(model.sortedComparisonRows.length / settings.benchmarkDiffPageSize));
  const pagedComparisonRows = useMemo(() => {
    const startIndex = (benchmarkDiffPage - 1) * settings.benchmarkDiffPageSize;
    return model.sortedComparisonRows.slice(startIndex, startIndex + settings.benchmarkDiffPageSize);
  }, [benchmarkDiffPage, settings.benchmarkDiffPageSize, model.sortedComparisonRows]);

  useEffect(() => {
    setBenchmarkDiffPage(1);
  }, [model.baselinePoint?.key, model.focusPoint?.key, model.sortedComparisonRows]);

  useEffect(() => {
    setBenchmarkDiffPage((currentPage) => Math.min(currentPage, benchmarkDiffTotalPages));
  }, [benchmarkDiffTotalPages]);

  if (state.hasDatabase && state.dimensionSelection.dimensions.length && !state.dimensionSelection.validation.isValid) return (
    <>
      <PageHeader eyebrow="Benchmarking › Dashboard" title={state.siteTitle} description={state.siteDescription} actions={(<>
        <Field className="max-sm:w-full"><FieldLabel className="invisible">Action</FieldLabel><Button variant="secondary" className="max-sm:w-full" onClick={onOpenLocalFilePicker}><FiFolder aria-hidden="true" /><span>SQLite</span></Button></Field>
        {state.database?.source_url ? <Field className="max-sm:w-full"><FieldLabel className="invisible">Action</FieldLabel><Button variant="secondary" className="max-sm:w-full" href={state.database.source_url} download={state.database.source_label ?? "benchledger.sqlite"}>Download</Button></Field> : null}
      </>)} />
      <DatabaseBanner hasLoadedDatabase={Boolean(state.database)} hasDatabase={state.hasDatabase} error={state.error} onOpenLocalFilePicker={onOpenLocalFilePicker} />
      <DimensionSelectorInvalidBanner issues={state.dimensionSelection.validation.issues} onOpenDimensionSelector={() => state.navigateToPage("dimension-selector")} />
    </>
  );

  return (
    <>
      <PageHeader
        eyebrow="Benchmarking › Dashboard"
        title={state.siteTitle}
        description={state.siteDescription}
        actions={(
          <>
            <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:min-w-[30rem]">
              <Field>
                <FieldLabel>Baseline point</FieldLabel>
                <DimensionPointSelectMenu disabled={!model.points.length} points={model.points} runsByPoint={model.runsByPoint} preferRunIdentity={preferRunIdentityPointLabels} selectedPointKey={settings.baselinePointKey} onSelect={setBaselinePointKey} ariaLabel="Baseline point" />
              </Field>
              <Field>
                <FieldLabel>Focus point</FieldLabel>
                <DimensionPointSelectMenu disabled={!model.points.length} points={model.points} runsByPoint={model.runsByPoint} preferRunIdentity={preferRunIdentityPointLabels} selectedPointKey={settings.focusPointKey} onSelect={setFocusPointKey} ariaLabel="Focus point" />
              </Field>
            </div>
            <Field className="min-w-0 flex-1 xl:min-w-[20rem] xl:max-w-[30rem]">
              <FieldLabel>Benchmark Keys</FieldLabel>
              <BenchmarkKeyCascadeFilter options={slice.benchmarkOptions} selectedValues={settings.selectedBenchmarkKeys} setSelectedValues={setSelectedBenchmarkKeys} disabled={!state.hasDatabase} stretchWidth ariaLabel="Benchmark keys" placeholder="All benchmark keys" />
            </Field>
            <Field className="max-sm:w-full">
              <FieldLabel className="invisible">Action</FieldLabel>
              <Button variant="secondary" className="max-sm:w-full" onClick={onOpenLocalFilePicker}>
                <FiFolder aria-hidden="true" />
                <span>SQLite</span>
              </Button>
            </Field>
            {state.database?.source_url ? (
              <Field className="max-sm:w-full">
                <FieldLabel className="invisible">Action</FieldLabel>
                <Button variant="secondary" className="max-sm:w-full" href={state.database.source_url} download={state.database.source_label ?? "benchledger.sqlite"}>
                  Download
                </Button>
              </Field>
            ) : null}
          </>
        )}
      />

      <DatabaseBanner hasLoadedDatabase={Boolean(state.database)} hasDatabase={state.hasDatabase} error={state.error} onOpenLocalFilePicker={onOpenLocalFilePicker} />

      <BenchmarkFilterToolbar
        yAxis={settings.yAxis}
        yAxisOptions={slice.yAxisOptions}
        onYAxisChange={setYAxis}
        branch={settings.branch}
        branchOptions={slice.branchOptions}
        onBranchChange={setBranch}
        timeRangeLabel={slice.runsEmptyTimeRangeLabel}
        timeStart={settings.timeStart}
        timeEnd={settings.timeEnd}
        databaseTimeStart={slice.databaseTimeStart}
        databaseTimeEnd={slice.databaseTimeEnd}
        onTimeStartChange={setTimeStart}
        onTimeEndChange={setTimeEnd}
        displayStrategy={settings.displayStrategy}
        onDisplayStrategyChange={setDisplayStrategy}
        hasDatabase={state.hasDatabase}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {model.stats.map((stat) => (
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
                  value={String(settings.benchmarkDiffPageSize)}
                  options={Benchmark_Diff_Page_Size_Options.map((pageSize) => ({ value: String(pageSize), label: String(pageSize) }))}
                  onChange={(value) => {
                    setBenchmarkDiffPageSize(Number(value) as BenchmarkDiffPageSize);
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

          {model.sortedComparisonRows.length ? (
            <DataTableShell label="Run comparison results" className="mt-2">
              <DataTable className="table-fixed">
                <caption className="visually-hidden">Benchmark values for the selected baseline and focus points</caption>
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
                        aria-sort={runPairSort?.key === column.key
                          ? runPairSort.direction === "asc" ? "ascending" : "descending"
                          : "none"}
                      >
                        <SortButton
                          active={runPairSort?.key === column.key}
                          onClick={() => model.toggleRunPairSort(column.key)}
                          indicator={runPairSort?.key === column.key ? (runPairSort.direction === "asc" ? "↑" : "↓") : "↕"}
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
            <EmptyState className="surface-empty pad-empty mt-4 flex min-h-44 flex-col items-center justify-center text-center" title="No comparable benchmark rows" description="Adjust the selected points or conditions to compare benchmark rows." />
          )}
        </Panel>

        <RepresentativeRunContextPanel focusRun={model.focusRun} focusPoint={model.focusPoint} dimensionLabel={state.dimensionSelection.varyingDimension?.label ?? ""} />
      </section>
    </>
  );
}
