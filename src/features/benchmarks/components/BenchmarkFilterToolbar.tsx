import type { ChangeEvent } from "react";
import type { DisplayStrategy } from "../../../lib/dashboard-settings";
import { Field, FieldLabel, SelectField, Toolbar, ToolbarGrid } from "../../../components/ui/Field";
import { TimeRangePopover, type TimeRangeSelectionProps } from "./TimeRangePopover";

type BenchmarkFilterToolbarProps = TimeRangeSelectionProps & { hasDatabase: boolean; yAxis: string; yAxisOptions: string[]; onYAxisChange: (value: string) => void; displayStrategy: DisplayStrategy; onDisplayStrategyChange: (value: DisplayStrategy) => void; branch: string; branchOptions: string[]; onBranchChange: (value: string) => void; timeRangeLabel: string; };

export function BenchmarkFilterToolbar({ hasDatabase, ...filters }: BenchmarkFilterToolbarProps) {
  return (
    <Toolbar variant="plain">
      <ToolbarGrid>
        <Field>
          <FieldLabel>Y-Axis</FieldLabel>
          <SelectField aria-label="Y-Axis" value={filters.yAxis} onChange={(event: ChangeEvent<HTMLSelectElement>) => filters.onYAxisChange(event.target.value)} disabled={!filters.yAxisOptions.length}>
            {filters.yAxisOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </SelectField>
        </Field>
        <Field>
          <FieldLabel>Branch</FieldLabel>
          <SelectField aria-label="Branch" value={filters.branch} onChange={(event: ChangeEvent<HTMLSelectElement>) => filters.onBranchChange(event.target.value)} disabled={!filters.branchOptions.length}>
            {filters.branchOptions.map((option) => <option key={option} value={option}>{option === "all" ? "All branches" : option}</option>)}
          </SelectField>
        </Field>
        <Field>
          <FieldLabel>Time Range</FieldLabel>
          <TimeRangePopover disabled={!hasDatabase} label={filters.timeRangeLabel} timeStart={filters.timeStart} timeEnd={filters.timeEnd} databaseTimeStart={filters.databaseTimeStart} databaseTimeEnd={filters.databaseTimeEnd} onTimeStartChange={filters.onTimeStartChange} onTimeEndChange={filters.onTimeEndChange} />
        </Field>
        <Field>
          <FieldLabel>Display Strategy</FieldLabel>
          <SelectField aria-label="Display strategy" value={filters.displayStrategy} onChange={(event: ChangeEvent<HTMLSelectElement>) => filters.onDisplayStrategyChange(event.target.value as DisplayStrategy)} disabled={!hasDatabase}>
            <option value="all">All records</option><option value="tagged-only">Tagged only</option><option value="tagged-main">Tagged + main/master</option>
          </SelectField>
        </Field>
      </ToolbarGrid>
    </Toolbar>
  );
}
