import type { CSSProperties } from "react";
import { BenchmarkKeyCascadeFilter, type BenchmarkKeyFilterOption } from "../benchmarks/components/BenchmarkKeyCascadeFilter";
import { TimeRangePopover } from "../benchmarks/components/TimeRangePopover";
import { GroupCascadeMenu, type GroupMenuOption } from "../benchmarks/components/GroupCascadeMenu";
import Plot from "../benchmarks/components/Plot";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/common/EmptyState";
import { Field, FieldLabel, InputField, SelectField, Toolbar, ToolbarGrid } from "../../components/ui/Field";
import { Panel, SectionTitle } from "../../components/ui/Card";
import { PageHeader } from "../../components/common/PageHeader";
import {
  Trend_Board_Max_Columns,
  Trend_Board_Min_Columns,
  Trend_Board_Plot_Height,
  clampTrendBoardColumns,
  type DisplayStrategy,
  type PlotTheme,
  type TrendAxisMode
} from "../../lib/dashboard";
import type { TrendBoardCard } from "./useTrendBoardModel";

export type TrendBoardPageProps = {
  header: {
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
    environment: string;
    environmentOptions: string[];
    onEnvironmentChange: (environment: string) => void;
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
  const { header, filters, trend } = props;

  return (
    <>
      <PageHeader
        eyebrow="Benchmarking › Trend Board"
        title="Trend Board"
        description="Each selected benchmark key is rendered as its own independent trend chart."
        actions={(
          <>
            <Field className="min-w-0 flex-1 xl:min-w-[22rem] xl:max-w-[34rem]">
              <FieldLabel className="invisible">Benchmark key</FieldLabel>
              <BenchmarkKeyCascadeFilter
                options={header.benchmarkOptions}
                selectedValues={header.selectedBenchmarkIds}
                setSelectedValues={header.onSelectedBenchmarkIdsChange}
                disabled={!header.hasDataset}
                stretchWidth
              />
            </Field>
            <Field className="min-w-[7rem]">
              <FieldLabel>Columns</FieldLabel>
              <InputField
                type="number"
                min={Trend_Board_Min_Columns}
                max={Trend_Board_Max_Columns}
                value={header.trendBoardColumns}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  header.onTrendBoardColumnsChange(clampTrendBoardColumns(nextValue));
                }}
                disabled={!header.hasDataset}
              />
            </Field>
            <Field className="max-sm:w-full">
              <FieldLabel className="invisible">Axis mode</FieldLabel>
              <Button variant="secondary" className="w-34 max-sm:w-full" onClick={header.onToggleTrendAxisMode}>
                X-Axis: {header.trendAxisMode === "commit" ? "Commit" : "Time"}
              </Button>
            </Field>
          </>
        )}
      />

      <Toolbar variant="plain">
        <ToolbarGrid>
          <Field>
            <FieldLabel>Environment</FieldLabel>
            <SelectField value={filters.environment} onChange={(event) => filters.onEnvironmentChange(event.target.value)} disabled={!header.hasDataset}>
              {filters.environmentOptions.map((option) => <option key={option} value={option}>{option === "all" ? "All environments" : option}</option>)}
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
              disabled={!header.hasDataset}
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
              disabled={!header.hasDataset}
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
              disabled={!header.hasDataset}
            >
              <option value="all">All records</option>
              <option value="tagged-only">Tagged only</option>
              <option value="tagged-main">Tagged + main/master</option>
            </SelectField>
          </Field>
        </ToolbarGrid>
      </Toolbar>

      {trend.trendBoardCards.length ? (
        <section
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:[grid-template-columns:repeat(var(--trend-board-columns),minmax(0,1fr))]"
          style={{ "--trend-board-columns": String(header.trendBoardColumns) } as CSSProperties}
        >
          {trend.trendBoardCards.map((card) => (
            <Panel key={card.benchmarkId} className="surface-card-trend-board pad-trend-board-card min-w-0">
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
                      ...(header.trendAxisMode === "commit" ? card.commitAxisOrder : undefined)
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
        <EmptyState className="pad-empty flex min-h-60 flex-col items-center justify-center text-center" title="No benchmark key selected" />
      )}
    </>
  );
}
