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
  benchmarkOptions: BenchmarkKeyFilterOption[];
  selectedBenchmarkIds: string[];
  onSelectedBenchmarkIdsChange: (values: string[]) => void;
  hasDataset: boolean;
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
  trendBoardColumns: number;
  onTrendBoardColumnsChange: (value: number) => void;
  selectedMetricLabel: string;
  trendAxisMode: TrendAxisMode;
  onToggleTrendAxisMode: () => void;
  trendBoardCards: TrendBoardCard[];
  trendPlotMargin: { t: number; r: number; b: number; l: number };
  plotTheme: PlotTheme;
};

export function TrendBoardPage(props: TrendBoardPageProps) {
  const {
    benchmarkOptions,
    selectedBenchmarkIds,
    onSelectedBenchmarkIdsChange,
    hasDataset,
    machine,
    machineOptions,
    onMachineChange,
    metricKind,
    metricOptions,
    onMetricKindChange,
    displayStrategy,
    onDisplayStrategyChange,
    group,
    groupOptions,
    selectedGroupLabel,
    onGroupChange,
    branch,
    branchOptions,
    onBranchChange,
    timeRangeLabel,
    timeStart,
    timeEnd,
    datasetTimeStart,
    datasetTimeEnd,
    onTimeStartChange,
    onTimeEndChange,
    trendBoardColumns,
    onTrendBoardColumnsChange,
    selectedMetricLabel,
    trendAxisMode,
    onToggleTrendAxisMode,
    trendBoardCards,
    trendPlotMargin,
    plotTheme
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
                options={benchmarkOptions}
                selectedValues={selectedBenchmarkIds}
                setSelectedValues={onSelectedBenchmarkIdsChange}
                disabled={!hasDataset}
                stretchWidth
              />
            </div>
            <label className="field topbar-floating-field">
              <span className="field-label">Columns</span>
              <input
                type="number"
                min={Trend_Board_Min_Columns}
                max={Trend_Board_Max_Columns}
                value={trendBoardColumns}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  onTrendBoardColumnsChange(clampTrendBoardColumns(nextValue));
                }}
                disabled={!hasDataset}
              />
            </label>
            <button
              type="button"
              className="button button-secondary button-compact topbar-axis-button axis-mode-button"
              onClick={onToggleTrendAxisMode}
            >
              X-Axis: {trendAxisMode === "commit" ? "Commit" : "Time"}
            </button>
          </div>
        </div>
        <p>Each selected benchmark key is rendered as its own independent trend chart.</p>
      </header>
      <section className="trend-board-toolbar">
        <div className="filter-grid">
          <label className="field">
            <span className="field-label">Machine</span>
            <select value={machine} onChange={(event) => onMachineChange(event.target.value)} disabled={!hasDataset}>
              {machineOptions.map((option) => <option key={option} value={option}>{option === "all" ? "All machines" : option}</option>)}
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
            <TimeRangePopover
              disabled={!hasDataset}
              label={timeRangeLabel}
              timeStart={timeStart}
              timeEnd={timeEnd}
              datasetTimeStart={datasetTimeStart}
              datasetTimeEnd={datasetTimeEnd}
              onTimeStartChange={onTimeStartChange}
              onTimeEndChange={onTimeEndChange}
            />
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
      {trendBoardCards.length ? (
        <section
          className="trend-board-grid"
          style={{ gridTemplateColumns: `repeat(${trendBoardColumns}, minmax(0, 1fr))` }}
        >
          {trendBoardCards.map((card) => (
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
                    margin: trendPlotMargin,
                    paper_bgcolor: plotTheme.paper,
                    plot_bgcolor: plotTheme.plot,
                    font: { color: plotTheme.axis },
                    xaxis: { showgrid: false, color: plotTheme.axis, tickfont: { size: 14 } },
                    yaxis: {
                      title: { text: card.metricLabel || selectedMetricLabel || "Metric value" },
                      gridcolor: plotTheme.grid,
                      zeroline: false,
                      color: plotTheme.axis,
                      tickfont: { size: 14 }
                    },
                    modebar: {
                      bgcolor: "rgba(0, 0, 0, 0)",
                      color: plotTheme.axis,
                      activecolor: plotTheme.line
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
