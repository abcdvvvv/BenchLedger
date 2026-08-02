import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { FiChevronDown, FiChevronRight, FiLock, FiSliders } from "react-icons/fi";
import { EmptyState } from "../../components/common/EmptyState";
import { PageHeader } from "../../components/common/PageHeader";
import { semanticTextClassName } from "../../components/common/semanticTone";
import { StatusBadge } from "../../components/ui/Badge";
import { Inset, Panel, SectionTitle } from "../../components/ui/Card";
import { Field, FieldLabel, SelectField } from "../../components/ui/Field";
import { DataCell, DataHeadCell, DataTable, DataTableShell } from "../../components/ui/Table";
import { cn } from "../../components/ui/cn";
import { benchmarkDeltaColor, benchmarkDeltaTone } from "../benchmarks/benchmarkDeltaPresentation";
import Plot from "../benchmarks/components/Plot";
import type { PlotTheme } from "../../lib/dashboard-plotting";
import type { BenchmarkBetter } from "../../lib/types";
import {
  formatIdentityProjection,
  type ComparisonCategory,
  type IdentityFieldNode
} from "../../lib/orthogonal-comparison";

export type ComparisonTableRow = {
  configurationKey: string;
  label: string;
  codeDate: string;
  isBaseline: boolean;
  value: number | null;
  displayValue: string;
  delta: number;
  displayDelta: string;
  runCount: number;
  better: BenchmarkBetter;
  changedFields: Array<{
    pathId: string;
    label: string;
    value: string;
  }>;
};

type CategoryCardModel = {
  category: ComparisonCategory;
  title: string;
  nodes: IdentityFieldNode[];
  identity: Record<string, unknown>;
  locked: boolean;
  active: boolean;
  variablePathIds: string[];
  fixedFieldCount: number;
  totalFieldCount: number;
  variableFieldCount: number;
  onNodeFixedChange: (node: IdentityFieldNode, fixed: boolean) => void;
};

export type ComparePageProps = {
  hasDataset: boolean;
  baseline: {
    value: string;
    options: Array<{ value: string; label: string }>;
    onChange: (value: string) => void;
  };
  categories: CategoryCardModel[];
  summary: {
    variableCategory: ComparisonCategory | "";
    variableFieldCount: number;
    variableSelectionLabels: string[];
    fixedFieldCount: number;
    matchedConfigurationCount: number;
  };
  selection: {
    benchmarkKey: string;
    benchmarkOptions: Array<{ value: string; label: string }>;
    onBenchmarkKeyChange: (value: string) => void;
    metricKey: string;
    metricOptions: Array<{ value: string; label: string }>;
    onMetricKeyChange: (value: string) => void;
  };
  results: {
    rows: ComparisonTableRow[];
    variableCategory: ComparisonCategory | "";
    metricLabel: string;
    displayUnit: string;
    plotTheme: PlotTheme;
    comparableCandidateCount: number;
    unavailableCandidateCount: number;
  };
};

function TriStateCheckbox(props: {
  checked: boolean;
  indeterminate: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (inputRef.current) inputRef.current.indeterminate = props.indeterminate;
  }, [props.indeterminate]);

  return (
    <input
      ref={inputRef}
      type="checkbox"
      checked={props.checked}
      disabled={props.disabled}
      aria-label={props.label}
      onChange={(event: ChangeEvent<HTMLInputElement>) => props.onChange(event.target.checked)}
      className="size-4 shrink-0 accent-amber-600 disabled:cursor-not-allowed disabled:opacity-50 dark:accent-amber-500"
    />
  );
}

function FieldTreeItem(props: {
  node: IdentityFieldNode;
  identity: Record<string, unknown>;
  locked: boolean;
  variablePathIds: ReadonlySet<string>;
  depth?: number;
  onNodeFixedChange: (node: IdentityFieldNode, fixed: boolean) => void;
  formatValue: (identity: Record<string, unknown>, pathId: string) => string;
}) {
  const depth = props.depth ?? 0;
  const [expanded, setExpanded] = useState(false);
  const variableCount = props.node.leafPathIds.filter((pathId) => props.variablePathIds.has(pathId)).length;
  const fixedCount = props.node.leafPathIds.length - variableCount;
  const allFixed = fixedCount === props.node.leafPathIds.length;
  const partiallyFixed = fixedCount > 0 && !allFixed;
  const hasChildren = props.node.children.length > 0;
  const variable = variableCount > 0;

  useEffect(() => {
    if (hasChildren && partiallyFixed) setExpanded(true);
  }, [hasChildren, partiallyFixed]);

  return (
    <div className={cn(depth > 0 && "border-theme-l border-stone-200 pl-4 dark:border-[#3f3f46]")}>
      <div
        className={cn(
          "flex min-w-0 items-start gap-2 rounded-md px-2 py-2 transition",
          variable && !props.locked ? "bg-amber-50 dark:bg-amber-500/10" : "hover:bg-stone-100 dark:hover:bg-white/5"
        )}
      >
        <TriStateCheckbox
          checked={allFixed}
          indeterminate={partiallyFixed}
          disabled={props.locked}
          label={`${allFixed ? "Allow" : "Fix"} ${props.node.label}`}
          onChange={(checked) => props.onNodeFixedChange(props.node, checked)}
        />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className={cn("type-body-strong truncate", variable && !props.locked && "text-theme-brand")}>{props.node.label}</span>
            {variable ? <span className="type-caption text-theme-brand">varies</span> : null}
          </div>
          {hasChildren ? (
            <div className="type-meta mt-0.5">{props.node.leafPathIds.length} fields</div>
          ) : (
            <div className="type-meta mt-0.5 truncate" title={props.formatValue(props.identity, props.node.id)}>
              {props.formatValue(props.identity, props.node.id)}
            </div>
          )}
        </div>
        {hasChildren ? (
          <button
            type="button"
            className="mt-[-0.25rem] grid size-7 shrink-0 place-items-center rounded-md text-stone-500 hover:bg-stone-200 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-white/10 dark:hover:text-stone-100"
            onClick={() => setExpanded((current) => !current)}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${props.node.label}`}
          >
            {expanded ? <FiChevronDown aria-hidden="true" /> : <FiChevronRight aria-hidden="true" />}
          </button>
        ) : null}
      </div>
      {hasChildren && expanded ? (
        <div className="space-y-1 pb-1">
          {props.node.children.map((child) => (
            <FieldTreeItem
              key={child.id}
              {...props}
              node={child}
              depth={depth + 1}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CategoryCard(props: CategoryCardModel & {
  formatValue: (identity: Record<string, unknown>, pathId: string) => string;
}) {
  const variablePathIds = useMemo(() => new Set(props.variablePathIds), [props.variablePathIds]);
  const status = props.locked
    ? "Locked"
    : props.active
      ? `Allowing ${props.variableFieldCount} field${props.variableFieldCount === 1 ? "" : "s"} to vary`
      : "Fixed";

  return (
    <Panel
      className={cn(
        "space-y-4 transition",
        props.active && "border-amber-400 ring-4 ring-amber-500/10 dark:border-amber-500",
        props.locked && "opacity-75"
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
          <div className="flex items-center gap-2">
            <h2 className="type-section-title">{props.title}</h2>
            {props.locked ? <FiLock className="size-4 text-stone-400" aria-hidden="true" /> : null}
          </div>
          <span className="type-body-muted">
            {props.fixedFieldCount} of {props.totalFieldCount} fields fixed
          </span>
        </div>
        <StatusBadge tone={props.active ? "brand" : "neutral"}>{status}</StatusBadge>
      </div>
      {props.nodes.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {props.nodes.map((node) => (
            <div key={node.id} className="surface-inset-muted min-w-0 p-2">
              <FieldTreeItem
                node={node}
                identity={props.identity}
                locked={props.locked}
                variablePathIds={variablePathIds}
                onNodeFixedChange={props.onNodeFixedChange}
                formatValue={props.formatValue}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="type-body-muted">No identity fields were recorded for this category.</div>
      )}
    </Panel>
  );
}

function escapePlotlyText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resultPlot(props: ComparePageProps["results"]) {
  if (!props.rows.some((row) => !row.isBaseline && row.value !== null)) return null;
  const codeComparison = props.variableCategory === "code";
  const rows = props.rows;
  const colors = rows.map((row) => (
    row.value === null
      ? props.plotTheme.markerMuted
      : row.isBaseline
      ? props.plotTheme.markerStrong
      : benchmarkDeltaColor(row.delta, row.better, props.plotTheme)
  ));
  const hoverText = rows.map((row) => {
    const changes = row.changedFields.length
      ? row.changedFields
        .map((field) => `${escapePlotlyText(field.label)}: ${escapePlotlyText(field.value)}`)
        .join("<br>")
      : "Baseline";
    const codeDate = props.variableCategory === "code" && row.codeDate
      ? `<br>${escapePlotlyText(row.codeDate)}`
      : "";
    return `${escapePlotlyText(row.label)}${codeDate}<br>${escapePlotlyText(row.displayValue)}` +
      `<br>Runs: ${row.runCount}<br>${changes}`;
  });
  const labels = rows.map((row) => row.label);
  const values = rows.map((row) => row.value);

  return (
    <Plot
      data={codeComparison ? [{
        type: "scatter",
        mode: "lines+markers",
        x: labels,
        y: values,
        text: hoverText,
        hoverinfo: "text",
        connectgaps: false,
        line: { color: props.plotTheme.line, width: 2 },
        marker: { color: colors, size: 10, line: { color: props.plotTheme.paper, width: 1 } }
      }] : [{
        type: "bar",
        x: labels,
        y: values,
        text: hoverText,
        hoverinfo: "text",
        marker: { color: colors }
      }]}
      layout={{
        autosize: true,
        height: 340,
        margin: { t: 24, r: 20, b: 100, l: 70 },
        paper_bgcolor: props.plotTheme.paper,
        plot_bgcolor: props.plotTheme.plot,
        font: { color: props.plotTheme.axis },
        showlegend: false,
        xaxis: {
          type: "category",
          gridcolor: props.plotTheme.grid,
          linecolor: props.plotTheme.axis,
          tickangle: labels.some((label) => label.length > 18) ? -25 : 0,
          automargin: true
        },
        yaxis: {
          title: props.displayUnit || props.metricLabel || "Value",
          gridcolor: props.plotTheme.grid,
          linecolor: props.plotTheme.axis,
          zerolinecolor: props.plotTheme.zero,
          automargin: true
        }
      }}
      config={{ responsive: true, displaylogo: false }}
      style={{ width: "100%", height: "340px" }}
      useResizeHandler
    />
  );
}

export function ComparePage(props: ComparePageProps) {
  const plot = resultPlot(props.results);
  const variableCategoryLabel = props.summary.variableCategory
    ? props.summary.variableCategory[0].toUpperCase() + props.summary.variableCategory.slice(1)
    : "None";
  const variableLabel = props.summary.variableSelectionLabels.length
    ? `${variableCategoryLabel} · ${props.summary.variableSelectionLabels.join(", ")}`
    : variableCategoryLabel;
  const hasVariableFields = props.summary.variableFieldCount > 0;
  const hasCandidate = props.summary.matchedConfigurationCount > 1;
  const hasComparableCandidate = props.results.comparableCandidateCount > 0;

  return (
    <>
      <PageHeader
        eyebrow="Benchmarking › Compare"
        title="Orthogonal Comparison"
        description="Fix every unrelated identity field, then allow only the code, hardware, or software fields you want to compare."
        actions={(
          <Field className="w-full min-w-0 sm:min-w-[24rem] xl:max-w-[42rem]">
            <FieldLabel>Baseline configuration</FieldLabel>
            <SelectField
              aria-label="Baseline configuration"
              value={props.baseline.value}
              onChange={(event: ChangeEvent<HTMLSelectElement>) => props.baseline.onChange(event.target.value)}
              disabled={!props.hasDataset}
            >
              {props.baseline.options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </SelectField>
          </Field>
        )}
      />

      {!props.hasDataset ? (
        <EmptyState title="No comparison data" description="Load a schema v6 benchmark database with aggregated results to compare configurations." />
      ) : (
        <>
          <Inset className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <FiSliders className="mt-0.5 size-5 shrink-0 text-theme-brand" aria-hidden="true" />
              <div>
                <div className="type-body-strong">Checkbox meaning</div>
                <div className="type-body-muted mt-1">Checked fields are fixed to the baseline. Unchecked fields are allowed to vary.</div>
              </div>
            </div>
            <div className="type-meta">Only one major category can vary at a time.</div>
          </Inset>

          <div className="space-y-4">
            {props.categories.map((category) => (
              <CategoryCard
                key={category.category}
                {...category}
                formatValue={formatIdentityProjection}
              />
            ))}
          </div>

          <Panel className="space-y-5">
            <SectionTitle
              title="Comparison result"
              description="Values come from repeated-run aggregates. Missing benchmark results are excluded rather than treated as zero."
              action={(
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={hasVariableFields ? "brand" : "neutral"}>Variable: {variableLabel}</StatusBadge>
                  <StatusBadge>{props.summary.fixedFieldCount} fixed fields</StatusBadge>
                  <StatusBadge>{props.summary.matchedConfigurationCount} identity matches</StatusBadge>
                </div>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel>Benchmark key</FieldLabel>
                <SelectField
                  aria-label="Benchmark key"
                  value={props.selection.benchmarkKey}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => props.selection.onBenchmarkKeyChange(event.target.value)}
                  disabled={!props.selection.benchmarkOptions.length}
                >
                  {props.selection.benchmarkOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </SelectField>
              </Field>
              <Field>
                <FieldLabel>Metric and statistic</FieldLabel>
                <SelectField
                  aria-label="Metric and statistic"
                  value={props.selection.metricKey}
                  onChange={(event: ChangeEvent<HTMLSelectElement>) => props.selection.onMetricKeyChange(event.target.value)}
                  disabled={!props.selection.metricOptions.length}
                >
                  {props.selection.metricOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </SelectField>
              </Field>
            </div>

            {!hasVariableFields ? (
              <EmptyState
                title="Choose a variable field"
                description="Uncheck one or more fields in Code, Hardware, or Software. Every field that stays checked must match the baseline."
              />
            ) : !hasCandidate ? (
              <EmptyState
                title="No matching alternative configuration"
                description={`No other configuration matches all ${props.summary.fixedFieldCount} fixed fields. Allow another field to vary or choose a different baseline.`}
              />
            ) : (
              <>
                {props.summary.variableFieldCount > 1 ? (
                  <div className="surface-card-warning pad-panel type-body-muted">
                    Multiple identity fields are allowed to vary. Each row lists the fields that actually changed, but the performance difference cannot be attributed to one field independently.
                  </div>
                ) : null}

                {!hasComparableCandidate ? (
                  <div className="surface-card-warning pad-panel type-body-muted">
                    Matching identities were found, but none has a compatible result for the selected benchmark, metric, and statistic. The table explains whether each result is missing or incompatible.
                  </div>
                ) : props.results.unavailableCandidateCount > 0 ? (
                  <div className="surface-inset-muted pad-panel type-body-muted">
                    {props.results.unavailableCandidateCount} matching configuration{props.results.unavailableCandidateCount === 1 ? " has" : "s have"} no plotted value because {props.results.unavailableCandidateCount === 1 ? "its result is" : "their results are"} missing or incompatible. {props.results.unavailableCandidateCount === 1 ? "It remains" : "They remain"} listed in the table.
                  </div>
                ) : null}

                {plot ? <div className="surface-plot pad-plot overflow-hidden">{plot}</div> : null}

                <DataTableShell label="Comparison result variants">
                  <DataTable>
                    <caption className="visually-hidden">Baseline and candidate comparison values</caption>
                    <thead>
                      <tr>
                        <DataHeadCell>Variant</DataHeadCell>
                        <DataHeadCell>Changed fields</DataHeadCell>
                        <DataHeadCell className="text-right">Value</DataHeadCell>
                        <DataHeadCell className="text-right">Delta</DataHeadCell>
                        <DataHeadCell className="text-right">Runs</DataHeadCell>
                      </tr>
                    </thead>
                    <tbody>
                      {props.results.rows.map((row) => (
                        <tr key={row.configurationKey}>
                          <DataCell>
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="type-body-strong truncate">{row.label}</span>
                              {row.isBaseline ? <StatusBadge tone="brand">Baseline</StatusBadge> : null}
                            </div>
                          </DataCell>
                          <DataCell tone="muted">
                            {row.changedFields.length ? (
                              <div className="flex flex-wrap gap-1.5">
                                {row.changedFields.map((field) => (
                                  <span key={field.pathId} className="rounded-md bg-stone-100 px-2 py-1 dark:bg-white/10" title={field.label}>
                                    <span className="font-medium">{field.label.split(" › ").slice(-1)[0]}</span>: {field.value}
                                  </span>
                                ))}
                              </div>
                            ) : "—"}
                          </DataCell>
                          <DataCell className="text-right tabular-nums">{row.displayValue}</DataCell>
                          <DataCell className={cn("text-right tabular-nums", semanticTextClassName(benchmarkDeltaTone(row.delta, row.better)))}>
                            {row.displayDelta}
                          </DataCell>
                          <DataCell className="text-right tabular-nums">{row.runCount || "—"}</DataCell>
                        </tr>
                      ))}
                    </tbody>
                  </DataTable>
                </DataTableShell>
              </>
            )}
          </Panel>
        </>
      )}
    </>
  );
}
