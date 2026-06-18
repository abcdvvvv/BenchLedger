import type { IconType } from "react-icons";
import { FiFolder } from "react-icons/fi";
import { BenchmarkKeyCascadeFilter, type BenchmarkKeyFilterOption } from "./BenchmarkKeyCascadeFilter";
import { TimeRangePopover } from "./TimeRangePopover";
import { GroupCascadeMenu, type GroupMenuOption } from "./GroupCascadeMenu";
import Plot from "./Plot";
import { RunSelectMenu } from "./RunSelectMenu";
import {
  deltaColorKey,
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
    trendPlotMargin: { t: number; r: number; b: number; l: number };
    plotTheme: PlotTheme;
  };
  comparison: {
    focusRun: BenchmarkRun | null;
    comparisonRows: PairComparison[];
    deltaPlotMargin: { t: number; r: number; b: number; l: number };
    sortedComparisonRows: PairComparison[];
    runPairSort: RunPairSort | null;
    onToggleRunPairSort: (key: RunPairSortKey) => void;
  };
};

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
      <header className="topbar page-topbar dashboard-topbar">
        <div className="breadcrumb">Benchmarking <span>›</span> Dashboard</div>
        <div className="page-topbar-row dashboard-topbar-row">
          <div className="page-topbar-title">
            <h1>{header.siteTitle}</h1>
          </div>
          <div className="topbar-actions">
            <div className="field topbar-floating-field dashboard-run-field">
              <span className="field-label">Focus run</span>
              <RunSelectMenu
                disabled={!header.filteredRuns.length}
                runs={header.filteredRuns}
                selectedRunId={header.focusRunId}
                onSelect={header.onFocusRunChange}
              />
            </div>
            <div className="field topbar-floating-field dashboard-run-field">
              <span className="field-label">Baseline run</span>
              <RunSelectMenu
                disabled={!header.filteredRuns.length}
                runs={header.filteredRuns}
                selectedRunId={header.baselineRunId}
                onSelect={header.onBaselineRunChange}
              />
            </div>
            <button type="button" className="button button-secondary button-compact" onClick={header.onOpenLocalFilePicker} style={{ gap: "0.4rem" }}>
              <FiFolder aria-hidden="true" />
              <span>SQLite</span>
            </button>
            {header.downloadUrl ? (
              <a className="button button-secondary button-compact" href={header.downloadUrl} download={header.downloadLabel}>Download</a>
            ) : null}
          </div>
        </div>
        <p>{header.siteDescription}</p>
      </header>
      {!datasetState.hasDataset || datasetState.error ? (
        <section className="data-banner surface-card">
          <div>
            <strong>{datasetState.hasLoadedDatabase ? "No benchmark rows found" : "No database is loaded"}</strong>
            <p>{datasetState.error || "Choose a local SQLite file to inspect benchmark history."}</p>
          </div>
          <button type="button" className="button button-primary" onClick={header.onOpenLocalFilePicker}>Choose Local SQLite</button>
        </section>
      ) : null}
      <section className="trend-board-toolbar">
        <div className="filter-grid">
          <label className="field">
            <span className="field-label">Machine</span>
            <select value={filters.machine} onChange={(event) => filters.onMachineChange(event.target.value)} disabled={!datasetState.hasDataset}>
              {filters.machineOptions.map((option) => <option key={option} value={option}>{option === "all" ? "All machines" : option}</option>)}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Metric</span>
            <select value={filters.metricKind} onChange={(event) => filters.onMetricKindChange(event.target.value)} disabled={!filters.metricOptions.length}>
              {filters.metricOptions.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <div className="field">
            <span className="field-label">Group</span>
            <GroupCascadeMenu
              disabled={!datasetState.hasDataset}
              options={filters.groupOptions}
              selectedValue={filters.group}
              selectedLabel={filters.selectedGroupLabel}
              onSelect={filters.onGroupChange}
            />
          </div>
          <label className="field">
            <span className="field-label">Branch</span>
            <select value={filters.branch} onChange={(event) => filters.onBranchChange(event.target.value)} disabled={!filters.branchOptions.length}>
              {filters.branchOptions.map((option) => <option key={option} value={option}>{option === "all" ? "All branches" : option}</option>)}
            </select>
          </label>
          <div className="field time-range-field">
            <span className="field-label">Time Range</span>
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
          </div>
          <label className="field filter-strategy-field">
            <span className="field-label">Display Strategy</span>
            <select
              value={filters.displayStrategy}
              onChange={(event) => filters.onDisplayStrategyChange(event.target.value as DisplayStrategy)}
              disabled={!datasetState.hasDataset}
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
                options={trend.benchmarkOptions}
                selectedValues={trend.selectedBenchmarkIds}
                setSelectedValues={trend.onSelectedBenchmarkIdsChange}
                disabled={!datasetState.hasDataset}
              />
            </div>
            <button type="button" className="button button-secondary button-compact axis-mode-button" onClick={trend.onToggleTrendAxisMode}>
              X-Axis: {trend.trendAxisMode === "commit" ? "Commit" : "Time"}
            </button>
          </div>
          <div className="plot-shell">
            {trend.selectedBenchmarkIds.length ? (
              <Plot
                useResizeHandler
                style={{ width: "100%", height: "100%" }}
                data={trend.trendTraces}
                layout={{
                  autosize: true,
                  margin: trend.trendPlotMargin,
                  paper_bgcolor: trend.plotTheme.paper,
                  plot_bgcolor: trend.plotTheme.plot,
                  font: { color: trend.plotTheme.axis },
                  xaxis: { showgrid: false, color: trend.plotTheme.axis, tickfont: { size: 14 } },
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
            ) : (
              <div className="plot-empty-state">
                <strong>No benchmark key selected</strong>
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
                  x: comparison.comparisonRows.slice(0, 6).map((row) => row.delta).reverse(),
                  y: comparison.comparisonRows.slice(0, 6).map((row) => row.benchmark_label).reverse(),
                  marker: {
                    color: comparison.comparisonRows
                      .slice(0, 6)
                      .map((row) => trend.plotTheme[deltaColorKey[metricDeltaClass(row.delta, row.better)]])
                      .reverse()
                  },
                  hovertemplate: "%{y}<br>%{x:.2f}%<extra></extra>"
                }
              ]}
              layout={{
                autosize: true,
                margin: comparison.deltaPlotMargin,
                paper_bgcolor: trend.plotTheme.paper,
                plot_bgcolor: trend.plotTheme.plot,
                font: { color: trend.plotTheme.axis },
                xaxis: { title: "Delta (%)", gridcolor: trend.plotTheme.grid, zerolinecolor: trend.plotTheme.zero, color: trend.plotTheme.axis },
                yaxis: { automargin: true, color: trend.plotTheme.axis },
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
              <tr><th>Run</th><td>{comparison.focusRun ? runHeadline(comparison.focusRun) : "n/a"}</td></tr>
              <tr><th>Code Date</th><td>{comparison.focusRun ? formatDate(comparison.focusRun.code_date) : "n/a"}</td></tr>
              <tr><th>Measured</th><td>{comparison.focusRun ? formatDate(comparison.focusRun.measured_at) : "n/a"}</td></tr>
              <tr><th>Branch</th><td>{comparison.focusRun?.branch || "n/a"}</td></tr>
              <tr><th>Machine</th><td>{comparison.focusRun?.machine_id || "n/a"}</td></tr>
              <tr><th>CPU</th><td>{comparison.focusRun?.cpu_model || "n/a"}</td></tr>
              <tr><th>Threads</th><td>{comparison.focusRun ? comparison.focusRun.cpu_threads.toLocaleString() : "n/a"}</td></tr>
              <tr><th>Platform</th><td>{comparison.focusRun ? `${comparison.focusRun.os} · ${comparison.focusRun.arch}` : "n/a"}</td></tr>
              <tr><th>Julia</th><td>{comparison.focusRun?.julia_version || "n/a"}</td></tr>
              <tr><th>Dirty</th><td>{comparison.focusRun ? String(comparison.focusRun.is_dirty) : "n/a"}</td></tr>
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
                      <button type="button" className="table-sort-button" onClick={() => comparison.onToggleRunPairSort(column.key)}>
                        {column.label}
                        <span>{comparison.runPairSort?.key === column.key ? (comparison.runPairSort.direction === "asc" ? "↑" : "↓") : "↕"}</span>
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparison.sortedComparisonRows.map((row) => (
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
