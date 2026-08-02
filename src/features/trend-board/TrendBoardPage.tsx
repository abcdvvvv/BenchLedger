import type { ChangeEvent, CSSProperties } from "react";
import { BenchmarkKeyCascadeFilter, type BenchmarkKeyFilterOption } from "../benchmarks/components/BenchmarkKeyCascadeFilter";
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
  clampTrendBoardColumns,
  type TrendAxisMode,
  type TrendBoardViewMode
} from "../../lib/dashboard-settings";
import type { TrendBoardCard, TrendBoardCombinedChart } from "./useTrendBoardModel";
import { BenchmarkFilterToolbar, type BenchmarkFilterToolbarProps } from "../benchmarks/components/BenchmarkFilterToolbar";

export type TrendBoardPageProps = {
  header: {
    benchmarkOptions: BenchmarkKeyFilterOption[];
    selectedBenchmarkKeys: string[];
    onSelectedBenchmarkKeysChange: (values: string[]) => void;
    hasDataset: boolean;
    trendBoardColumns: number;
    onTrendBoardColumnsChange: (value: number) => void;
    trendBoardViewMode: TrendBoardViewMode;
    onToggleTrendBoardViewMode: () => void;
    trendAxisMode: TrendAxisMode;
    onToggleTrendAxisMode: () => void;
  };
  filters: Omit<BenchmarkFilterToolbarProps, "hasDataset">;
  trend: {
    selectedMetricLabel: string;
    trendBoardCards: TrendBoardCard[];
    combinedTrendChart: TrendBoardCombinedChart | null;
    showCombinedTrendChart: boolean;
    trendPlotMargin: { t: number; r: number; b: number; l: number };
    plotTheme: PlotTheme;
    hasTrendRows: boolean;
  };
};

export function TrendBoardPage(props: TrendBoardPageProps) {
  const { header, filters, trend } = props;
  const showCombinedTrendChart = trend.showCombinedTrendChart;
  const pageDescription = showCombinedTrendChart
    ? "All selected benchmark keys are rendered together in one shared trend chart."
    : "Each selected benchmark key is rendered as its own independent trend chart.";

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
                options={header.benchmarkOptions}
                selectedValues={header.selectedBenchmarkKeys}
                setSelectedValues={header.onSelectedBenchmarkKeysChange}
                disabled={!header.hasDataset}
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
                value={header.trendBoardColumns}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const nextValue = Number(event.target.value);
                  header.onTrendBoardColumnsChange(clampTrendBoardColumns(nextValue));
                }}
                disabled={!header.hasDataset || showCombinedTrendChart}
              />
            </Field>
            <Field className="max-sm:w-full">
              <FieldLabel className="invisible">View mode</FieldLabel>
              <Button
                variant="secondary"
                className="max-sm:w-full"
                onClick={header.onToggleTrendBoardViewMode}
                aria-pressed={header.trendBoardViewMode === "combined"}
              >
                View: {header.trendBoardViewMode === "combined" ? "Combined" : "Separate"}
              </Button>
            </Field>
            <Field className="max-sm:w-full">
              <FieldLabel className="invisible">Axis mode</FieldLabel>
              <Button
                variant="secondary"
                className="w-34 max-sm:w-full"
                onClick={header.onToggleTrendAxisMode}
                aria-pressed={header.trendAxisMode === "time"}
              >
                X-Axis: {header.trendAxisMode === "commit" ? "Commit" : "Time"}
              </Button>
            </Field>
          </>
        )}
      />

      <BenchmarkFilterToolbar {...filters} hasDataset={header.hasDataset} />

      {showCombinedTrendChart && trend.combinedTrendChart ? (
        <Panel className="surface-card-trend-board pad-trend-board-card min-w-0">
          <SectionTitle title="Combined Trend" description="Trend Board benchmarks overlaid in one chart." />
          <div className="mt-5" style={{ height: `${Trend_Board_Plot_Height}px` }}>
            <Plot
              useResizeHandler
              style={{ width: "100%", height: "100%" }}
              data={trend.combinedTrendChart.traces}
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
                  ...(header.trendAxisMode === "commit" ? trend.combinedTrendChart.commitAxisLabels : undefined)
                },
                yaxis: {
                  title: { text: trend.combinedTrendChart.metricLabel || trend.selectedMetricLabel || "Metric value" },
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
                showlegend: trend.combinedTrendChart.showLegend,
                legend: trend.combinedTrendChart.showLegend ? {
                  orientation: "h",
                  x: 0,
                  y: -0.2,
                  font: { color: trend.plotTheme.axis }
                } : undefined
              }}
              config={{ displayModeBar: "hover", responsive: true }}
            />
          </div>
        </Panel>
      ) : trend.trendBoardCards.length ? (
        <section
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:[grid-template-columns:repeat(var(--trend-board-columns),minmax(0,1fr))]"
          style={{ "--trend-board-columns": String(header.trendBoardColumns) } as CSSProperties}
        >
          {trend.trendBoardCards.map((card) => (
            <Panel key={card.benchmarkKey} className="surface-card-trend-board pad-trend-board-card min-w-0">
              <SectionTitle
                title={card.label}
                description={card.path[card.path.length - 1] ?? card.label}
              />
              <div className="mt-5" style={{ height: `${Trend_Board_Plot_Height}px` }}>
                <Plot
                  useResizeHandler
                  style={{ width: "100%", height: "100%" }}
                  data={card.traces}
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
                      ...(header.trendAxisMode === "commit" ? card.commitAxisLabels : undefined)
                    },
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
            </Panel>
          ))}
        </section>
      ) : (
        <EmptyState
          className="pad-empty flex min-h-60 flex-col items-center justify-center text-center"
          title={
            !header.hasDataset
              ? "No benchmark data loaded"
              : !header.benchmarkOptions.length
                ? "No benchmarks match the current filters"
                : header.selectedBenchmarkKeys.length
                  ? "No trend data matches the current filters"
                  : "No benchmark key selected"
          }
          description={
            !header.hasDataset
              ? "Load a benchmark database to build trend charts."
              : !header.benchmarkOptions.length || (header.selectedBenchmarkKeys.length && !trend.hasTrendRows)
                ? "Adjust the hardware/software pair, metric, group, branch, time range, or display strategy."
                : "Choose one or more benchmark keys to render trend charts."
          }
        />
      )}
    </>
  );
}
