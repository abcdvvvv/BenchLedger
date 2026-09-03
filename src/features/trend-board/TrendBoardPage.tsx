import { memo, useMemo, type ChangeEvent, type CSSProperties } from "react";
import type { Config, Layout } from "plotly.js";
import type { BenchmarkDatabaseState } from "../../app/useBenchmarkDatabaseState";
import { useUISettingSetter } from "../../app/useUISettingSetter";
import { BenchmarkKeyCascadeFilter } from "../benchmarks/components/BenchmarkKeyCascadeFilter";
import Plot from "../benchmarks/components/Plot";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/common/EmptyState";
import { Field, FieldLabel, InputField } from "../../components/ui/Field";
import { Panel, SectionTitle } from "../../components/ui/Card";
import { PageHeader } from "../../components/common/PageHeader";
import { Trend_Board_Plot_Height, type PlotTheme } from "../../lib/dashboard-plotting";
import {
  Trend_Board_Max_Columns,
  Trend_Board_Min_Columns,
  clampTrendBoardColumns
} from "../../lib/dashboard-settings";
import { BenchmarkFilterToolbar } from "../benchmarks/components/BenchmarkFilterToolbar";
import { useBenchmarkViewSlice } from "../benchmarks/useBenchmarkViewSlice";
import { useTrendBoardModel } from "./useTrendBoardModel";
import { DimensionSelectorInvalidBanner } from "../dimension-selector/DimensionSelectorInvalidBanner";


const Trend_Plot_Config: Partial<Config> = { displayModeBar: "hover", responsive: true };
const Trend_Plot_Style = { width: "100%", height: "100%" } as const;
type TrendPlotProps = { data: Array<Record<string, unknown>>; margin: { t: number; r: number; b: number; l: number }; metricLabel: string; xAxisTitle: string; plotTheme: PlotTheme; showLegend: boolean; };

const TrendPlot = memo(function TrendPlot({ data, margin, metricLabel, xAxisTitle, plotTheme, showLegend }: TrendPlotProps) {
  const layout = useMemo<Partial<Layout>>(() => ({ autosize: true, margin, paper_bgcolor: "rgba(0, 0, 0, 0)", plot_bgcolor: "rgba(0, 0, 0, 0)", font: { color: plotTheme.axis }, xaxis: { showgrid: false, color: plotTheme.axis, tickfont: { size: 14 }, title: { text: xAxisTitle }, type: "category" }, yaxis: { title: { text: metricLabel }, gridcolor: plotTheme.grid, zeroline: false, color: plotTheme.axis, tickfont: { size: 14 } }, modebar: { bgcolor: "rgba(0, 0, 0, 0)", color: plotTheme.axis, activecolor: plotTheme.line }, showlegend: showLegend, legend: showLegend ? { orientation: "h", x: 0, y: -0.2, font: { color: plotTheme.axis } } : undefined }), [margin, metricLabel, plotTheme, showLegend, xAxisTitle]);
  return <Plot useResizeHandler style={Trend_Plot_Style} data={data} layout={layout} config={Trend_Plot_Config} />;
});

export type TrendBoardPageProps = { state: BenchmarkDatabaseState; };

export function TrendBoardPage({ state }: TrendBoardPageProps) {
  const { settings, setSetting } = state;
  const setYAxis = useUISettingSetter(setSetting, "yAxis");
  const setBranch = useUISettingSetter(setSetting, "trendBoardBranch");
  const setSelectedBenchmarkKeys = useUISettingSetter(setSetting, "selectedBenchmarkKeys");
  const setColumns = useUISettingSetter(setSetting, "trendBoardColumns");
  const setDisplayStrategy = useUISettingSetter(setSetting, "trendBoardDisplayStrategy");
  const setTimeStart = useUISettingSetter(setSetting, "trendBoardTimeStart");
  const setTimeEnd = useUISettingSetter(setSetting, "trendBoardTimeEnd");

  const slice = useBenchmarkViewSlice({
    session: state.session,
    catalog: state.benchmarkViewIndex,
    benchmarksByKey: state.benchmarksByKey,
    sourceRevision: state.databaseSourceRevision,
    configurationKeys: state.dimensionSelection.configurationKeys,
    yAxis: settings.yAxis,
    onYAxisChange: setYAxis,
    branch: settings.trendBoardBranch,
    onBranchChange: setBranch,
    timeStart: settings.trendBoardTimeStart,
    timeEnd: settings.trendBoardTimeEnd,
    displayStrategy: settings.trendBoardDisplayStrategy
  });

  const model = useTrendBoardModel({
    session: state.session,
    query: slice.resultQuery,
    sourceRevision: state.databaseSourceRevision,
    runsById: state.runsById,
    benchmarkOptions: slice.benchmarkOptions,
    selectedBenchmarkKeys: settings.selectedBenchmarkKeys,
    onSelectedBenchmarkKeysChange: setSelectedBenchmarkKeys,
    yAxis: settings.yAxis,
    dimensionSelection: state.dimensionSelection,
    trendLineShape: settings.trendLineShape,
    trendMarkerSymbol: settings.trendMarkerSymbol,
    trendMarkerFillMode: settings.trendMarkerFillMode,
    plotTheme: state.plotTheme,
    theme: settings.theme
  });
  const showCombinedTrendChart = settings.trendBoardViewMode === "combined";
  const pageDescription = showCombinedTrendChart
    ? "All selected benchmark keys are rendered together in one shared trend chart."
    : "Each selected benchmark key is rendered as its own independent trend chart.";

  if (state.hasDatabase && state.dimensionSelection.dimensions.length && !state.dimensionSelection.validation.isValid) return (
    <>
      <PageHeader eyebrow="Benchmarking › Trend Board" title="Trend Board" description={pageDescription} />
      <DimensionSelectorInvalidBanner issues={state.dimensionSelection.validation.issues} onOpenDimensionSelector={() => state.navigateToPage("dimension-selector")} />
    </>
  );

  return (
    <>
      <PageHeader
        eyebrow="Benchmarking › Trend Board"
        title="Trend Board"
        description={pageDescription}
        actions={(
          <>
            <Field className="min-w-0 flex-1 xl:min-w-[22rem] xl:max-w-[34rem]">
              <FieldLabel className="invisible">Benchmark key</FieldLabel>
              <BenchmarkKeyCascadeFilter
                options={slice.benchmarkOptions}
                selectedValues={settings.selectedBenchmarkKeys}
                setSelectedValues={setSelectedBenchmarkKeys}
                disabled={!state.hasDatabase}
                stretchWidth
                ariaLabel="Benchmark keys"
              />
            </Field>
            <Field className="min-w-[7rem]">
              <FieldLabel>Columns</FieldLabel>
              <InputField
                type="number"
                aria-label="Trend board columns"
                min={Trend_Board_Min_Columns}
                max={Trend_Board_Max_Columns}
                value={settings.trendBoardColumns}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const nextValue = Number(event.target.value);
                  setColumns(clampTrendBoardColumns(nextValue));
                }}
                disabled={!state.hasDatabase || showCombinedTrendChart}
              />
            </Field>
            <Field className="max-sm:w-full">
              <FieldLabel className="invisible">View mode</FieldLabel>
              <Button
                variant="secondary"
                className="max-sm:w-full"
                onClick={() => setSetting("trendBoardViewMode", settings.trendBoardViewMode === "combined" ? "separate" : "combined")}
                aria-pressed={settings.trendBoardViewMode === "combined"}
              >
                View: {settings.trendBoardViewMode === "combined" ? "Combined" : "Separate"}
              </Button>
            </Field>

          </>
        )}
      />

      <BenchmarkFilterToolbar
        yAxis={settings.yAxis}
        yAxisOptions={slice.yAxisOptions}
        onYAxisChange={setYAxis}
        displayStrategy={settings.trendBoardDisplayStrategy}
        onDisplayStrategyChange={setDisplayStrategy}
        branch={settings.trendBoardBranch}
        branchOptions={slice.branchOptions}
        onBranchChange={setBranch}
        timeRangeLabel={slice.runsEmptyTimeRangeLabel}
        timeStart={settings.trendBoardTimeStart}
        timeEnd={settings.trendBoardTimeEnd}
        databaseTimeStart={slice.databaseTimeStart}
        databaseTimeEnd={slice.databaseTimeEnd}
        onTimeStartChange={setTimeStart}
        onTimeEndChange={setTimeEnd}
        hasDatabase={state.hasDatabase}
      />

      {showCombinedTrendChart && model.combinedTrendChart ? (
        <Panel className="surface-card-trend-board pad-trend-board-card min-w-0">
          <SectionTitle title="Combined Trend" description="Trend Board benchmarks overlaid in one chart." />
          <div className="mt-5" style={{ height: `${Trend_Board_Plot_Height}px` }}>
            <TrendPlot data={model.combinedTrendChart.traces} margin={model.trendPlotMargin} metricLabel={model.combinedTrendChart.metricLabel || settings.yAxis || "Metric value"} xAxisTitle={model.xAxisTitle} plotTheme={state.plotTheme} showLegend={model.combinedTrendChart.showLegend} />
          </div>
        </Panel>
      ) : model.trendBoardCards.length ? (
        <section
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:[grid-template-columns:repeat(var(--trend-board-columns),minmax(0,1fr))]"
          style={{ "--trend-board-columns": String(settings.trendBoardColumns) } as CSSProperties}
        >
          {model.trendBoardCards.map((card) => (
            <Panel key={card.benchmarkKey} className="surface-card-trend-board pad-trend-board-card min-w-0">
              <SectionTitle
                title={card.label}
                description={card.path[card.path.length - 1] ?? card.label}
              />
              <div className="mt-5" style={{ height: `${Trend_Board_Plot_Height}px` }}>
                <TrendPlot data={card.traces} margin={model.trendPlotMargin} metricLabel={card.metricLabel || settings.yAxis || "Metric value"} xAxisTitle={model.xAxisTitle} plotTheme={state.plotTheme} showLegend={false} />
              </div>
            </Panel>
          ))}
        </section>
      ) : (
        <EmptyState
          className="pad-empty flex min-h-60 flex-col items-center justify-center text-center"
          title={
            !state.hasDatabase
              ? "No benchmark data loaded"
              : !slice.benchmarkOptions.length
                ? "No benchmarks match the current filters"
                : settings.selectedBenchmarkKeys.length
                  ? "No trend data matches the current filters"
                  : "No benchmark key selected"
          }
          description={
            !state.hasDatabase
              ? "Load a benchmark database to build trend charts."
              : !slice.benchmarkOptions.length || (settings.selectedBenchmarkKeys.length && !model.hasTrendRows)
                ? "Adjust the Dimension Selector, Y-axis, branch, time range, or display strategy."
                : "Choose one or more benchmark keys to render trend charts."
          }
        />
      )}
    </>
  );
}
