import { parseDate } from "./format";
import { runAxisLabel, runIdentityTitle } from "./dashboard-data";
import type { TrendPlotRow } from "./dashboard-plotting";
import type { DisplayStrategy } from "./dashboard-settings";
import type { BenchmarkDefinition, BenchmarkRun, BenchmarkViewCatalog } from "./types";
import type { BenchmarkTrendAggregateRow } from "./benchmark-database";
import { compatibleAggregateUnit, convertMetricValue } from "./metric-units";
import type { ResolvedDimensionSelection, DimensionConfiguration } from "./dimension-selector";

export type BenchmarkViewBenchmarkOption = { value: string; path: string[]; label: string; };
export type BenchmarkViewFilterState = { yAxis: string; branch: string; timeStartValue: number | null; timeEndValue: number | null; displayStrategy: DisplayStrategy; configurationKeys: readonly string[]; };
export type BenchmarkViewResolvedFilter = BenchmarkViewFilterState & { yAxisOptions: string[]; branchOptions: string[]; databaseTimeStart: string; databaseTimeEnd: string; };

export function resolveBenchmarkViewFilter(catalog: BenchmarkViewCatalog, state: BenchmarkViewFilterState): BenchmarkViewResolvedFilter {
  const effectiveYAxis = catalog.metricOptions.includes(state.yAxis) ? state.yAxis : (catalog.metricOptions[0] ?? "");
  const effectiveBranch = catalog.branchOptions.includes(state.branch) ? state.branch : "all";
  return { ...state, yAxis: effectiveYAxis, branch: effectiveBranch, yAxisOptions: catalog.metricOptions, branchOptions: catalog.branchOptions, databaseTimeStart: catalog.databaseTimeStart, databaseTimeEnd: catalog.databaseTimeEnd };
}

export function benchmarkDefinitionsForKeys(keys: readonly string[], benchmarksByKey: ReadonlyMap<string, BenchmarkDefinition>): BenchmarkDefinition[] { return keys.map((key) => benchmarksByKey.get(key) ?? { key, path: [], label: key }); }
export function buildBenchmarkOptions(benchmarks: Iterable<BenchmarkDefinition>): BenchmarkViewBenchmarkOption[] { return Array.from(benchmarks, (benchmark) => ({ value: benchmark.key, label: benchmark.label, path: benchmark.path })).sort((left, right) => left.path.join("\0").localeCompare(right.path.join("\0")) || left.label.localeCompare(right.label) || left.value.localeCompare(right.value)); }

export function normalizeSelectedBenchmarkKeys(
  selectedBenchmarkKeys: string[],
  benchmarkOptions: BenchmarkViewBenchmarkOption[]
): string[] {
  const availableValues = new Set(benchmarkOptions.map((option) => option.value));
  const normalized = selectedBenchmarkKeys.filter((value) => availableValues.has(value));
  return normalized.length === selectedBenchmarkKeys.length ? selectedBenchmarkKeys : normalized;
}

export type BenchmarkDimensionPointAggregate = { point_key: string; point_label: string; benchmark_key: string; metric_name: string; statistic: string; unit: string; value: number; better: BenchmarkTrendAggregateRow["better"]; run_count: number; representative_run_id: string; };

export function buildDimensionPointAggregates(aggregates: readonly BenchmarkTrendAggregateRow[], runsById: ReadonlyMap<string, BenchmarkRun>, dimensionSelection: ResolvedDimensionSelection & { configurationsByKey: ReadonlyMap<string, DimensionConfiguration> }): BenchmarkDimensionPointAggregate[] {
  if (!dimensionSelection.varyingDimension) return [];
  const pointsByKey = new Map(dimensionSelection.points.map((point) => [point.key, point]));
  const grouped = new Map<string, BenchmarkDimensionPointAggregate>();
  for (const aggregate of aggregates) {
    const pointKey = dimensionSelection.pointKeyByConfigurationKey.get(aggregate.configuration_key); if (!pointKey) continue;
    const point = pointsByKey.get(pointKey); if (!point) continue;
    const key = JSON.stringify([pointKey, aggregate.benchmark_key, aggregate.metric_name, aggregate.statistic]);
    const current = grouped.get(key);
    if (!current) { grouped.set(key, { point_key: pointKey, point_label: point.label, benchmark_key: aggregate.benchmark_key, metric_name: aggregate.metric_name, statistic: aggregate.statistic, unit: aggregate.unit, value: aggregate.value, better: aggregate.better, run_count: aggregate.run_count, representative_run_id: aggregate.representative_run_id }); continue; }
    if (current.better !== aggregate.better) throw new Error(`Cannot aggregate ${aggregate.benchmark_key}: conflicting better values.`);
    const unit = compatibleAggregateUnit(current.unit, aggregate.unit); if (unit === null) throw new Error(`Cannot aggregate ${aggregate.benchmark_key}: conflicting units ${current.unit} and ${aggregate.unit}.`);
    const left = convertMetricValue(current.value, current.unit, unit); const right = convertMetricValue(aggregate.value, aggregate.unit, unit); if (left === null || right === null) throw new Error(`Cannot aggregate ${aggregate.benchmark_key}: invalid value conversion.`);
    const count = current.run_count + aggregate.run_count; current.value = left * (current.run_count / count) + right * (aggregate.run_count / count); current.unit = unit; current.run_count = count;
    const currentTime = parseDate(runsById.get(current.representative_run_id)?.measured_at ?? "")?.valueOf() ?? Number.NEGATIVE_INFINITY; const candidateTime = parseDate(runsById.get(aggregate.representative_run_id)?.measured_at ?? "")?.valueOf() ?? Number.NEGATIVE_INFINITY;
    if (candidateTime > currentTime || candidateTime === currentTime && aggregate.representative_run_id > current.representative_run_id) current.representative_run_id = aggregate.representative_run_id;
  }
  const pointOrder = new Map(dimensionSelection.points.map((point, index) => [point.key, index]));
  return Array.from(grouped.values()).sort((left, right) => (pointOrder.get(left.point_key) ?? Number.MAX_SAFE_INTEGER) - (pointOrder.get(right.point_key) ?? Number.MAX_SAFE_INTEGER) || left.benchmark_key.localeCompare(right.benchmark_key) || left.metric_name.localeCompare(right.metric_name) || left.statistic.localeCompare(right.statistic));
}

export function buildTrendRowsByBenchmark(aggregates: readonly BenchmarkTrendAggregateRow[], runsById: ReadonlyMap<string, BenchmarkRun>, selectedBenchmarkKeys: readonly string[], dimensionSelection: ResolvedDimensionSelection & { configurationsByKey: ReadonlyMap<string, DimensionConfiguration> }): Map<string, TrendPlotRow[]> {
  const rowsByBenchmark = new Map<string, TrendPlotRow[]>();
  if (!selectedBenchmarkKeys.length || !dimensionSelection.varyingDimension) return rowsByBenchmark;
  const selectedBenchmarkKeySet = new Set(selectedBenchmarkKeys);
  for (const aggregate of buildDimensionPointAggregates(aggregates, runsById, dimensionSelection)) {
    if (!selectedBenchmarkKeySet.has(aggregate.benchmark_key)) continue;
    const run = runsById.get(aggregate.representative_run_id); if (!run) continue;
    const dateValue = parseDate(run.code_date); if (!dateValue) continue;
    const aggregateLabel = aggregate.run_count === 1 ? "1 contributing run" : `${aggregate.run_count.toLocaleString()} contributing runs averaged`;
    const entry: TrendPlotRow = { run_id: run.run_id, benchmark_key: aggregate.benchmark_key, metric_name: aggregate.metric_name, statistic: aggregate.statistic, unit: aggregate.unit, value: aggregate.value, better: aggregate.better, code_date: run.code_date, measured_at: run.measured_at, date_value: dateValue, run_axis_label: runAxisLabel(run), run_identity_title: `${aggregateLabel}<br>${runIdentityTitle(run, "<br>")}`, run_count: aggregate.run_count, x_key: aggregate.point_key, x_label: aggregate.point_label };
    const bucket = rowsByBenchmark.get(aggregate.benchmark_key); if (bucket) bucket.push(entry); else rowsByBenchmark.set(aggregate.benchmark_key, [entry]);
  }
  return rowsByBenchmark;
}
