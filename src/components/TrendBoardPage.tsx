import { BenchmarkKeyCascadeFilter, type BenchmarkKeyFilterOption } from "./BenchmarkKeyCascadeFilter";
import { TimeRangePopover } from "./TimeRangePopover";
import { GroupCascadeMenu, type GroupMenuOption } from "./GroupCascadeMenu";
import Plot from "./Plot";
import {
  Trend_Board_Max_Columns,
  Trend_Board_Min_Columns,
  Trend_Board_Plot_Height,
  clampTrendBoardColumns,
  type DisplayStrategy,
  type PlotTheme,
  type TrendAxisMode
} from "../lib/dashboard";

export type TrendBoardCard = {
  benchmarkId: string;
  label: string;
  path: string[];
  metricLabel: string;
  traces: Array<Record<string, unknown>>;
};

type TrendBoardPageProps = {
  topbar: {
    benchmarkOptions: BenchmarkKeyFilterOption[];
    selectedBenchmarkIds: string[];
    onSelectedBenchmarkIdsChange: (values: string[]) => void;
    hasDataset: boolean;
    trendBoardColumns: number;
    onTrendBoardColumnsChange: (value: number) => void;
    trendAxisMode: TrendAxisMode;
    onToggleTrendAxisMode: () => void;
  };
  filters: {
    machine: string;
    machineOptions: string[];
    onMachineChange: (machine: string) => void;
    metricKind: string;
    metricOptions: string[];
    onMetricKindChange: (metricKind: string) => void;
    displayStrategy: DisplayStrategy;
    onDisplayStrategyChange: (strategy: DisplayStrategy) => void;
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
  };
  trend: {
    selectedMetricLabel: string;
    trendBoardCards: TrendBoardCard[];
    trendPlotMargin: { t: number; r: number; b: number; l: number };
    plotTheme: PlotTheme;
  };
};

export function TrendBoardPage(props: TrendBoardPageProps) {
  const {
    topbar,
    filters,
    trend
  } = props;

  return (
    <>
      <header className="topbar page-topbar">
        <div className="breadcrumb">Benchmarking <span>›</span> Trend Board</div>
        <div className="page-topbar-row">
          <div className="page-topbar-title">
            <h1>Trend Board</h1>
          </div>
          <div className="topbar-actions page-topbar-actions">
            <div className="topbar-benchmark-field">
              <BenchmarkKeyCascadeFilter
                options={topbar.benchmarkOptions}
                selectedValues={topbar.selectedBenchmarkIds}
                setSelectedValues={topbar.onSelectedBenchmarkIdsChange}
                disabled={!topbar.hasDataset}
                stretchWidth
              />
            </div>
            <label className="field topbar-floating-field">
              <span className="field-label">Columns</span>
              <input
                type="number"
                min={Trend_Board_Min_Columns}
                max={Trend_Board_Max_Columns}
                value={topbar.trendBoardColumns}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  topbar.onTrendBoardColumnsChange(clampTrendBoardColumns(nextValue));
                }}
                disabled={!topbar.hasDataset}
              />
            </label>
            <button
              type="button"
              className="button button-secondary button-compact topbar-axis-button axis-mode-button"
              onClick={topbar.onToggleTrendAxisMode}
            >
              X-Axis: {topbar.trendAxisMode === "commit" ? "Commit" : "Time"}
            </button>
          </div>
        </div>
        <p>Each selected benchmark key is rendered as its own independent trend chart.</p>
      </header>
      <section className="trend-board-toolbar">
        <div className="filter-grid">
          <label className="field">
            <span className="field-label">Machine</span>
            <select value={filters.machine} onChange={(event) => filters.onMachineChange(event.target.value)} disabled={!topbar.hasDataset}>
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
              disabled={!topbar.hasDataset}
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
              disabled={!topbar.hasDataset}
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
              disabled={!topbar.hasDataset}
            >
              <option value="all">All records</option>
              <option value="tagged-only">Tagged only</option>
              <option value="tagged-main">Tagged + main/master</option>
            </select>
          </label>
        </div>
      </section>
      {trend.trendBoardCards.length ? (
        <section
          className="trend-board-grid"
          style={{ gridTemplateColumns: `repeat(${topbar.trendBoardColumns}, minmax(0, 1fr))` }}
        >
          {trend.trendBoardCards.map((card) => (
            <article className="surface-card trend-board-panel trend-board-card" key={card.benchmarkId}>
              <div className="panel-head">
                <div className="panel-title-stack">
                  <h2>{card.label}</h2>
                  <p>{card.path[card.path.length - 1] ?? card.label}</p>
                </div>
              </div>
              <div className="plot-shell trend-board-plot-shell" style={{ height: `${Trend_Board_Plot_Height}px` }}>
                <Plot
                  useResizeHandler
                  style={{ width: "100%", height: "100%" }}
                  data={card.traces}
                  layout={{
                    autosize: true,
                    margin: trend.trendPlotMargin,
                    paper_bgcolor: trend.plotTheme.paper,
                    plot_bgcolor: trend.plotTheme.plot,
                    font: { color: trend.plotTheme.axis },
                    xaxis: { showgrid: false, color: trend.plotTheme.axis, tickfont: { size: 14 } },
                    yaxis: {
                      title: { text: card.metricLabel || trend.selectedMetricLabel || "Metric value" },
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
                    showlegend: false
                  }}
                  config={{ displayModeBar: "hover", responsive: true }}
                />
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="trend-board-empty-state">
          <strong>No benchmark key selected</strong>
        </section>
      )}
    </>
  );
}
