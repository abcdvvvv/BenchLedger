import type { ChangeEvent } from "react";
import type { DisplayStrategy } from "../../../lib/dashboard-settings";
import { Field, FieldLabel, SelectField, Toolbar, ToolbarGrid } from "../../../components/ui/Field";
import { GroupCascadeMenu, type GroupMenuOption } from "./GroupCascadeMenu";
import { TimeRangePopover } from "./TimeRangePopover";

export type BenchmarkFilterToolbarProps = {
  hasDataset: boolean;
  environmentPair: string;
  environmentPairOptions: { value: string; label: string }[];
  onEnvironmentPairChange: (value: string) => void;
  metricKind: string;
  metricOptions: string[];
  onMetricKindChange: (value: string) => void;
  displayStrategy: DisplayStrategy;
  onDisplayStrategyChange: (value: DisplayStrategy) => void;
  group: string;
  groupOptions: GroupMenuOption[];
  selectedGroupLabel: string;
  onGroupChange: (value: string) => void;
  branch: string;
  branchOptions: string[];
  onBranchChange: (value: string) => void;
  timeRangeLabel: string;
  timeStart: string;
  timeEnd: string;
  datasetTimeStart: string;
  datasetTimeEnd: string;
  onTimeStartChange: (value: string) => void;
  onTimeEndChange: (value: string) => void;
};

export function BenchmarkFilterToolbar({ hasDataset, ...filters }: BenchmarkFilterToolbarProps) {
  return (
    <Toolbar variant="plain">
      <ToolbarGrid>
        <Field>
          <FieldLabel>Hardware + Software</FieldLabel>
          <SelectField aria-label="Hardware and software" value={filters.environmentPair} onChange={(event: ChangeEvent<HTMLSelectElement>) => filters.onEnvironmentPairChange(event.target.value)} disabled={!hasDataset}>
            {filters.environmentPairOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </SelectField>
        </Field>
        <Field>
          <FieldLabel>Metric</FieldLabel>
          <SelectField aria-label="Metric" value={filters.metricKind} onChange={(event: ChangeEvent<HTMLSelectElement>) => filters.onMetricKindChange(event.target.value)} disabled={!filters.metricOptions.length}>
            {filters.metricOptions.map((option) => <option key={option} value={option}>{option}</option>)}
          </SelectField>
        </Field>
        <Field>
          <FieldLabel>Group</FieldLabel>
          <GroupCascadeMenu disabled={!hasDataset} options={filters.groupOptions} selectedValue={filters.group} selectedLabel={filters.selectedGroupLabel} onSelect={filters.onGroupChange} ariaLabel="Group" />
        </Field>
        <Field>
          <FieldLabel>Branch</FieldLabel>
          <SelectField aria-label="Branch" value={filters.branch} onChange={(event: ChangeEvent<HTMLSelectElement>) => filters.onBranchChange(event.target.value)} disabled={!filters.branchOptions.length}>
            {filters.branchOptions.map((option) => <option key={option} value={option}>{option === "all" ? "All branches" : option}</option>)}
          </SelectField>
        </Field>
        <Field>
          <FieldLabel>Time Range</FieldLabel>
          <TimeRangePopover disabled={!hasDataset} label={filters.timeRangeLabel} timeStart={filters.timeStart} timeEnd={filters.timeEnd} datasetTimeStart={filters.datasetTimeStart} datasetTimeEnd={filters.datasetTimeEnd} onTimeStartChange={filters.onTimeStartChange} onTimeEndChange={filters.onTimeEndChange} />
        </Field>
        <Field>
          <FieldLabel>Display Strategy</FieldLabel>
          <SelectField aria-label="Display strategy" value={filters.displayStrategy} onChange={(event: ChangeEvent<HTMLSelectElement>) => filters.onDisplayStrategyChange(event.target.value as DisplayStrategy)} disabled={!hasDataset}>
            <option value="all">All records</option>
            <option value="tagged-only">Tagged only</option>
            <option value="tagged-main">Tagged + main/master</option>
          </SelectField>
        </Field>
      </ToolbarGrid>
    </Toolbar>
  );
}
