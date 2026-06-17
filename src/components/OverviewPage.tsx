import type { RefObject } from "react";
import type { IconType } from "react-icons";
import { BenchmarkKeyCascadeFilter, type BenchmarkKeyFilterOption } from "./BenchmarkKeyCascadeFilter";
import { GroupCascadeMenu, type GroupMenuOption } from "./GroupCascadeMenu";
import Plot from "./Plot";
import {
  deltaColorKey,
  openNativeDatePicker,
  runHeadline,
  runPairTableColumns,
  type DisplayStrategy,
  type PlotTheme,
  type RunPairSort,
  type RunPairSortKey,
  type TrendAxisMode
} from "../lib/dashboard";
import {
  formatDate,
  formatDateOnly,
  formatMetricValue,
  metricDeltaClass,
  formatPercent,
} from "../lib/format";
import type { BenchmarkRun, PairComparison } from "../lib/types";

export type OverviewStat = {
  Icon: IconType;
  label: string;
  value: string;
  delta: string;
  deltaTone: "positive" | "negative" | "neutral";
  detail: string;
};

type OverviewPageProps = {
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
  hasLoadedDatabase: boolean;
  hasDataset: boolean;
  error: string;
  machine: string;
  machineOptions: string[];
  onMachineChange: (machine: string) => void;
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
  timeRangePickerRef: RefObject<HTMLDetailsElement | null>;
  timeStartInputRef: RefObject<HTMLInputElement | null>;
  timeRangeLabel: string;
  timeStart: string;
  timeEnd: string;
  datasetTimeStart: string;
  datasetTimeEnd: string;
  onTimeStartChange: (value: string) => void;
  onTimeEndChange: (value: string) => void;
  displayStrategy: DisplayStrategy;
  onDisplayStrategyChange: (strategy: DisplayStrategy) => void;
  stats: OverviewStat[];
  benchmarkOptions: BenchmarkKeyFilterOption[];
  selectedBenchmarkIds: string[];
  onSelectedBenchmarkIdsChange: (values: string[]) => void;
  selectedMetricLabel: string;
  trendAxisMode: TrendAxisMode;
  onToggleTrendAxisMode: () => void;
  trendTraces: Array<Record<string, unknown>>;
  trendPlotMargin: { t: number; r: number; b: number; l: number };
  plotTheme: PlotTheme;
  focusRun: BenchmarkRun | null;
  comparisonRows: PairComparison[];
  deltaPlotMargin: { t: number; r: number; b: number; l: number };
  sortedComparisonRows: PairComparison[];
  runPairSort: RunPairSort | null;
  onToggleRunPairSort: (key: RunPairSortKey) => void;
};

export function OverviewPage(props: OverviewPageProps) {
  const {
    siteTitle,
    siteDescription,
    focusRunId,
    baselineRunId,
    filteredRuns,
    onFocusRunChange,
    onBaselineRunChange,
    onOpenLocalFilePicker,
    downloadUrl,
    downloadLabel,
    hasLoadedDatabase,
    hasDataset,
    error,
    machine,
    machineOptions,
    onMachineChange,
    metricKind,
    metricOptions,
    onMetricKindChange,
    group,
    groupOptions,
    selectedGroupLabel,
    onGroupChange,
    branch,
    branchOptions,
    onBranchChange,
    timeRangePickerRef,
    timeStartInputRef,
    timeRangeLabel,
    timeStart,
    timeEnd,
    datasetTimeStart,
    datasetTimeEnd,
    onTimeStartChange,
    onTimeEndChange,
    displayStrategy,
    onDisplayStrategyChange,
    stats,
    benchmarkOptions,
    selectedBenchmarkIds,
    onSelectedBenchmarkIdsChange,
    selectedMetricLabel,
    trendAxisMode,
    onToggleTrendAxisMode,
    trendTraces,
    trendPlotMargin,
    plotTheme,
    focusRun,
    comparisonRows,
    deltaPlotMargin,
    sortedComparisonRows,
    runPairSort,
    onToggleRunPairSort
  } = props;

  return (
    <>
      <header className="topbar page-topbar dashboard-topbar">
        <div className="breadcrumb">Benchmarking <span>›</span> Dashboard</div>
        <div className="page-topbar-row dashboard-topbar-row">
          <div className="page-topbar-title">
            <h1>{siteTitle}</h1>
          </div>
          <div className="topbar-actions">
            <label className="field topbar-floating-field dashboard-run-field">
              <span className="field-label">Focus run</span>
              <select value={focusRunId} onChange={(event) => onFocusRunChange(event.target.value)} disabled={!filteredRuns.length}>
                {filteredRuns.map((run) => <option key={run.run_id} value={run.run_id} title={formatDate(run.measured_at)}>{runHeadline(run)} · {formatDateOnly(run.measured_at)}</option>)}
              </select>
            </label>
            <label className="field topbar-floating-field dashboard-run-field">
              <span className="field-label">Baseline run</span>
              <select value={baselineRunId} onChange={(event) => onBaselineRunChange(event.target.value)} disabled={!filteredRuns.length}>
                {filteredRuns.map((run) => <option key={run.run_id} value={run.run_id} title={formatDate(run.measured_at)}>{runHeadline(run)} · {formatDateOnly(run.measured_at)}</option>)}
              </select>
            </label>
            <button type="button" className="button button-secondary button-compact" onClick={onOpenLocalFilePicker}>Choose SQLite</button>
            {downloadUrl ? (
              <a className="button button-secondary button-compact" href={downloadUrl} download={downloadLabel}>Download</a>
            ) : null}
          </div>
        </div>
        <p>{siteDescription}</p>
      </header>
      {!hasDataset || error ? (
        <section className="data-banner surface-card">
          <div>
            <strong>{hasLoadedDatabase ? "No benchmark rows found" : "No database is loaded"}</strong>
            <p>{error || "Choose a local SQLite file to inspect benchmark history."}</p>
          </div>
          <button type="button" className="button button-primary" onClick={onOpenLocalFilePicker}>Choose Local SQLite</button>
        </section>
      ) : null}
      <section className="trend-board-toolbar">
        <div className="filter-grid">
          <label className="field">
            <span className="field-label">Machine</span>
            <select value={machine} onChange={(event) => onMachineChange(event.target.value)} disabled={!machineOptions.length}>
              {machineOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Metric</span>
            <select value={metricKind} onChange={(event) => onMetricKindChange(event.target.value)} disabled={!metricOptions.length}>
              {metricOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <div className="field">
            <span className="field-label">Group</span>
            <GroupCascadeMenu
              disabled={!hasDataset}
              options={groupOptions}
              selectedValue={group}
              selectedLabel={selectedGroupLabel}
              onSelect={onGroupChange}
            />
          </div>
          <label className="field">
            <span className="field-label">Branch</span>
            <select value={branch} onChange={(event) => onBranchChange(event.target.value)} disabled={!branchOptions.length}>
              {branchOptions.map((option) => <option key={option} value={option}>{option === "all" ? "All branches" : option}</option>)}
            </select>
          </label>
          <div className="field time-range-field">
            <span className="field-label">Time Range</span>
            <details className="date-range-picker" ref={timeRangePickerRef}>
              <summary
                className={`date-range-summary${hasDataset ? "" : " date-range-summary-disabled"}`}
                onClick={(event) => {
                  if (!hasDataset) event.preventDefault();
                  const picker = event.currentTarget.parentElement as HTMLDetailsElement | null;
                  if (hasDataset && !picker?.open) {
                    window.requestAnimationFrame(() => openNativeDatePicker(timeStartInputRef.current));
                  }
                }}
              >
                <strong>{timeRangeLabel}</strong>
                <em aria-hidden="true">▾</em>
              </summary>
              <div className="date-range-popover">
                <label className="date-range-input">
                  <span className="field-label">Start</span>
                  <input
                    ref={timeStartInputRef}
                    type="date"
                    value={timeStart}
                    min={datasetTimeStart}
                    max={timeEnd || datasetTimeEnd}
                    onChange={(event) => onTimeStartChange(event.target.value)}
                  />
                </label>
                <label className="date-range-input">
                  <span className="field-label">End</span>
                  <input
                    type="date"
                    value={timeEnd}
                    min={timeStart || datasetTimeStart}
                    max={datasetTimeEnd}
                    onChange={(event) => onTimeEndChange(event.target.value)}
                  />
                </label>
              </div>
            </details>
          </div>
          <label className="field filter-strategy-field">
            <span className="field-label">Display Strategy</span>
            <select
              value={displayStrategy}
              onChange={(event) => onDisplayStrategyChange(event.target.value as DisplayStrategy)}
              disabled={!hasDataset}
            >
              <option value="all">All records</option>
              <option value="tagged-only">Tagged only</option>
              <option value="tagged-main">Tagged + main/master</option>
            </select>
          </label>
        </div>
      </section>
      <section className="stats-grid">
        {stats.map((stat) => {
          const Icon = stat.Icon;
          return (
            <article className="surface-card stat-card" key={stat.label}>
              <Icon className="stat-icon" aria-hidden="true" />
              <div className="stat-copy">
                <span>{stat.label}</span>
                <div className="stat-value-row">
                  <strong>{stat.value}</strong>
                  {stat.delta ? <em className={`stat-delta stat-delta-${stat.deltaTone}`}>{stat.delta}</em> : null}
                </div>
                <p>{stat.detail}</p>
              </div>
            </article>
          );
        })}
      </section>
      <section className="content-grid">
        <article className="surface-card panel panel-wide panel-full">
          <div className="panel-head">
            <div>
              <h2>Benchmark Trend</h2>
            </div>
            <div className="benchmark-trend-controls">
              <BenchmarkKeyCascadeFilter
                options={benchmarkOptions}
                selectedValues={selectedBenchmarkIds}
                setSelectedValues={onSelectedBenchmarkIdsChange}
                disabled={!hasDataset}
              />
            </div>
            <button type="button" className="button button-secondary button-compact" onClick={onToggleTrendAxisMode}>
              X-Axis: {trendAxisMode === "commit" ? "Commit" : "Time"}
            </button>
          </div>
          <div className="plot-shell">
            {selectedBenchmarkIds.length ? (
              <Plot
                useResizeHandler
                style={{ width: "100%", height: "100%" }}
                data={trendTraces}
                layout={{
                  autosize: true,
                  margin: trendPlotMargin,
                  paper_bgcolor: plotTheme.paper,
                  plot_bgcolor: plotTheme.plot,
                  font: { color: plotTheme.axis },
                  xaxis: { showgrid: false, color: plotTheme.axis, tickfont: { size: 14 } },
                  yaxis: {
                    title: { text: selectedMetricLabel || "Metric value" },
                    gridcolor: plotTheme.grid,
                    zeroline: false,
                    color: plotTheme.axis,
                    tickfont: { size: 14 }
                  },
                  showlegend: selectedBenchmarkIds.length > 1,
                  legend: selectedBenchmarkIds.length > 1 ? {
                    orientation: "h",
                    x: 0,
                    y: -0.2,
                    font: { color: plotTheme.axis }
                  } : undefined
                }}
                config={{ displayModeBar: "hover", responsive: true }}
              />
            ) : (
              <div className="plot-empty-state">
                <strong>No benchmark key selected</strong>
                <p>Choose at least one benchmark key to render a trend chart.</p>
              </div>
            )}
          </div>
        </article>
        <article className="surface-card panel panel-full">
          <div className="panel-head">
            <div>
              <h2>Largest Deltas</h2>
              <p>Top movers between the focus run and the baseline run.</p>
            </div>
          </div>
          <div className="plot-shell">
            <Plot
              useResizeHandler
              style={{ width: "100%", height: "100%" }}
              data={[
                {
                  type: "bar",
                  orientation: "h",
                  x: comparisonRows.slice(0, 6).map((row) => row.delta).reverse(),
                  y: comparisonRows.slice(0, 6).map((row) => row.benchmark_label).reverse(),
                  marker: {
                    color: comparisonRows
                      .slice(0, 6)
                      .map((row) => plotTheme[deltaColorKey[metricDeltaClass(row.delta, row.better)]])
                      .reverse()
                  },
                  hovertemplate: "%{y}<br>%{x:.2f}%<extra></extra>"
                }
              ]}
              layout={{
                autosize: true,
                margin: deltaPlotMargin,
                paper_bgcolor: plotTheme.paper,
                plot_bgcolor: plotTheme.plot,
                font: { color: plotTheme.axis },
                xaxis: { title: "Delta (%)", gridcolor: plotTheme.grid, zerolinecolor: plotTheme.zero, color: plotTheme.axis },
                yaxis: { automargin: true, color: plotTheme.axis },
                showlegend: false
              }}
              config={{ displayModeBar: false, responsive: true }}
            />
          </div>
        </article>
        <article className="surface-card panel panel-full">
          <div className="panel-head">
            <div>
              <h2>Run Context</h2>
              <p>Execution metadata for the current focus run.</p>
            </div>
          </div>
          <table className="meta-table">
            <tbody>
              <tr><th>Run</th><td>{focusRun ? runHeadline(focusRun) : "n/a"}</td></tr>
              <tr><th>Code Date</th><td>{focusRun ? formatDate(focusRun.code_date) : "n/a"}</td></tr>
              <tr><th>Measured</th><td>{focusRun ? formatDate(focusRun.measured_at) : "n/a"}</td></tr>
              <tr><th>Branch</th><td>{focusRun?.branch || "n/a"}</td></tr>
              <tr><th>Machine</th><td>{focusRun?.machine_id || "n/a"}</td></tr>
              <tr><th>CPU</th><td>{focusRun?.cpu_model || "n/a"}</td></tr>
              <tr><th>Threads</th><td>{focusRun ? focusRun.cpu_threads.toLocaleString() : "n/a"}</td></tr>
              <tr><th>Platform</th><td>{focusRun ? `${focusRun.os} · ${focusRun.arch}` : "n/a"}</td></tr>
              <tr><th>Julia</th><td>{focusRun?.julia_version || "n/a"}</td></tr>
              <tr><th>Dirty</th><td>{focusRun ? String(focusRun.is_dirty) : "n/a"}</td></tr>
            </tbody>
          </table>
        </article>
        <article className="surface-card panel panel-table panel-full">
          <div className="panel-head">
            <div>
              <h2>Run Pair Table</h2>
              <p>All comparable benchmark rows in the selected pair for the chosen metric.</p>
            </div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {runPairTableColumns.map((column) => (
                    <th key={column.key}>
                      <button type="button" className="table-sort-button" onClick={() => onToggleRunPairSort(column.key)}>
                        {column.label}
                        <span>{runPairSort?.key === column.key ? (runPairSort.direction === "asc" ? "↑" : "↓") : "↕"}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedComparisonRows.map((row) => (
                  <tr key={row.benchmark_id}>
                    <td><code>{row.benchmark_label}</code></td>
                    <td>{formatMetricValue(row.focus_value, row.unit)}</td>
                    <td>{formatMetricValue(row.baseline_value, row.unit)}</td>
                    <td><span className={`delta-badge delta-${metricDeltaClass(row.delta, row.better)}`}>{formatPercent(row.delta)}</span></td>
                    <td>{row.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>
    </>
  );
}
