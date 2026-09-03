import { useMemo, type ChangeEvent } from "react";
import { Menu, MenuButton, MenuItemCheckbox, useMenuStore } from "@ariakit/react";
import { cellSpanningFeature, createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { FiCheck } from "react-icons/fi";
import type { BenchmarkDatabaseState } from "../../app/useBenchmarkDatabaseState";
import { Banner } from "../../components/common/Banner";
import { EmptyState } from "../../components/common/EmptyState";
import { PageHeader } from "../../components/common/PageHeader";
import { SelectField } from "../../components/ui/Field";
import { DisclosureTriggerContent, menuItemRowClassName, menuSurfaceClassName, menuTriggerClassName, selectionIndicatorClassName } from "../../components/ui/Menu";
import { DataCell, DataHeadCell, DataTable, DataTableShell } from "../../components/ui/Table";
import { StatusBadge } from "../../components/ui/Badge";
import { semanticTextClassName } from "../../components/common/semanticTone";
import type { DimensionDefinition, FixedDimensionValueSelection, DimensionValueOption, DimensionValueSelection } from "../../lib/dimension-selector";

type DimensionTableRow = { dimension: DimensionDefinition; hierarchy: string[]; varying: boolean; selection: FixedDimensionValueSelection | undefined; selectedCount: number; };

const Dimension_Table_Features = tableFeatures({ cellSpanningFeature });
const Dimension_Table_Column_Helper = createColumnHelper<typeof Dimension_Table_Features, DimensionTableRow>();

function DimensionValueMultiSelect(props: { dimension: DimensionDefinition; options: DimensionValueOption[]; selectedValues: string[]; onChange: (values: string[]) => void; }) {
  const menu = useMenuStore({ placement: "bottom-start" });
  const selectedSet = new Set(props.selectedValues);
  const selectedLabels = props.options.filter((option) => selectedSet.has(option.key)).map((option) => option.label);
  const summary = selectedLabels.length === 0 ? "0 values selected" : selectedLabels.length <= 4 ? selectedLabels.join(", ") : `${selectedLabels.length} values selected`;
  const singleValueOnly = props.options.length === 1;
  function toggle(value: string) {
    const next = new Set(props.selectedValues);
    if (next.has(value)) next.delete(value); else next.add(value);
    props.onChange(props.options.map((option) => option.key).filter((key) => next.has(key)));
  }
  return (
    <>
      <span className="block w-full" title={singleValueOnly ? "Only one value is available, so this selection cannot be changed." : undefined}>
        <MenuButton store={menu} className={menuTriggerClassName({ disabled: props.options.length <= 1 })} disabled={props.options.length <= 1} aria-label={`${props.dimension.label} values`}>
          <DisclosureTriggerContent>{props.options.length ? summary : "No values"}</DisclosureTriggerContent>
        </MenuButton>
      </span>
      <Menu store={menu} portal gutter={4} overflowPadding={8} fitViewport unmountOnHide className={menuSurfaceClassName("max-h-[24rem] min-w-[16rem] overflow-auto")}>
        {props.options.map((option) => {
          const checked = selectedSet.has(option.key);
          return (
            <MenuItemCheckbox key={option.key} store={menu} name={`${props.dimension.key}-values`} value={option.key} checked={checked} hideOnClick={false} className={menuItemRowClassName()} onClick={() => toggle(option.key)}>
              <span className={selectionIndicatorClassName(checked ? "checked" : "unchecked")} aria-hidden="true">{checked ? <FiCheck /> : null}</span>
              <span className="min-w-0 flex-1 truncate">{option.label}</span>
              <span className="type-meta shrink-0">{option.configurationCount.toLocaleString()}</span>
            </MenuItemCheckbox>
          );
        })}
      </Menu>
    </>
  );
}

export function DimensionSelectorPage({ state }: { state: BenchmarkDatabaseState }) {
  const { settings, setSetting, dimensionSelection } = state;
  const varyingKeys = useMemo(() => new Set(dimensionSelection.varyingDimensionKeys), [dimensionSelection.varyingDimensionKeys]);
  const selectionsByDimension = useMemo(() => new Map(dimensionSelection.fixedValueSelections.map((selection) => [selection.dimension.key, selection])), [dimensionSelection.fixedValueSelections]);
  const rows = useMemo<DimensionTableRow[]>(() => dimensionSelection.dimensions.map((dimension) => { const varying = varyingKeys.has(dimension.key); const selection = selectionsByDimension.get(dimension.key); return { dimension, hierarchy: dimension.label.split(" / "), varying, selection, selectedCount: selection?.valueKeys.length ?? 0 }; }), [dimensionSelection.dimensions, selectionsByDimension, varyingKeys]);
  const hierarchyDepth = useMemo(() => Math.max(1, ...rows.map((row) => row.hierarchy.length)), [rows]);
  const hierarchyColumns = useMemo(() => Dimension_Table_Column_Helper.columns(Array.from({ length: hierarchyDepth }, (_, level) => Dimension_Table_Column_Helper.accessor((row) => row.hierarchy[level] ?? null, { id: `dimension-level-${level}`, spanRows: ({ anchorRow, anchorValue, row, value }) => anchorValue === value && anchorRow.original.hierarchy.length > level + 1 && row.original.hierarchy.length > level + 1 }))), [hierarchyDepth]);
  const table = useTable({ features: Dimension_Table_Features, columns: hierarchyColumns, data: rows, getRowId: (row) => row.dimension.key });
  function setRule(dimension: DimensionDefinition, rule: "fixed" | "varying") {
    const next = new Set(settings.varyingDimensionKeys ?? dimensionSelection.varyingDimensionKeys);
    if (rule === "varying") next.add(dimension.key); else next.delete(dimension.key);
    setSetting("varyingDimensionKeys", dimensionSelection.dimensions.map((entry) => entry.key).filter((key) => next.has(key)));
  }
  function setValues(dimensionKey: string, valueKeys: string[]) {
    const next: DimensionValueSelection[] = [...settings.dimensionValueSelections.filter((selection) => selection.dimensionKey !== dimensionKey), { dimensionKey, valueKeys }];
    setSetting("dimensionValueSelections", next);
  }

  return (
    <>
      <PageHeader eyebrow="Benchmarking › Dimension Selector" title="Dimension Selector" description="Select exactly one varying dimension for the x-axis and choose values for all fixed dimensions." />
      {!dimensionSelection.dimensions.length ? <EmptyState title="No identity dimensions available" description="Load a benchmark database to configure dimension rules." /> : (
        <>
          <Banner tone={dimensionSelection.validation.isValid ? "positive" : "negative"} title={dimensionSelection.validation.isValid ? "Dimension Selector configuration is valid" : "Dimension Selector configuration is invalid"} description={dimensionSelection.validation.isValid ? "Exactly one dimension is Varying, and every Fixed dimension has at least one selected value." : dimensionSelection.validation.issues.join(" ")} />
          <DataTableShell label="Global dimension selector">
            <DataTable>
              <thead><tr><DataHeadCell colSpan={hierarchyDepth}>Dimension</DataHeadCell><DataHeadCell>Rule</DataHeadCell><DataHeadCell>Values</DataHeadCell><DataHeadCell>Resolution</DataHeadCell></tr></thead>
              <tbody>
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id}>
                    {row.getAllCells().map((cell) => { const rowSpan = cell.getRowSpan(); if (cell.getIsCovered()) return null; return <DataCell key={cell.id} rowSpan={rowSpan} className="min-w-[8rem] align-middle"><span className="type-body whitespace-nowrap">{cell.getValue<string | null>() ?? ""}</span></DataCell>; })}
                    <DataCell className="align-middle">
                      <SelectField aria-label={`${row.original.dimension.label} rule`} value={row.original.varying ? "varying" : "fixed"} onChange={(event: ChangeEvent<HTMLSelectElement>) => setRule(row.original.dimension, event.target.value as "fixed" | "varying")}>
                        <option value="fixed">Fixed</option><option value="varying">Varying</option>
                      </SelectField>
                    </DataCell>
                    <DataCell className="align-middle">{row.original.varying ? <span className="type-body-muted text-base leading-6">All</span> : row.original.selection ? <DimensionValueMultiSelect dimension={row.original.dimension} options={row.original.selection.options} selectedValues={row.original.selection.valueKeys} onChange={(values) => setValues(row.original.dimension.key, values)} /> : <span className="type-body-muted text-base leading-6">—</span>}</DataCell>
                    <DataCell className="align-middle">{row.original.varying ? <span className="type-body-muted text-base leading-6">—</span> : row.original.selectedCount === 0 ? <span className={`text-base leading-6 ${semanticTextClassName("negative")}`}>Select at least 1 value</span> : <StatusBadge tone={row.original.selectedCount > 1 ? "brand" : "positive"} className="text-base leading-6">{row.original.selectedCount > 1 ? "Grouped" : "Exact"}</StatusBadge>}</DataCell>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          </DataTableShell>
        </>
      )}
    </>
  );
}
