import { describe, expect, it } from "vitest";
import { buildBenchmarkOptions, buildTrendRowsByBenchmark, normalizeSelectedBenchmarkKeys, resolveBenchmarkViewFilter } from "./benchmark-view";
import { buildDimensionConfigurations, buildDimensionDefinitions, buildDimensionSelectionIndex, resolveDimensionSelection } from "./dimension-selector";
import type { BenchmarkConfigurationIds, BenchmarkDefinition, BenchmarkRun, BenchmarkViewCatalog, LoadedBenchmarkDatabase } from "./types";
import type { BenchmarkTrendAggregateRow } from "./benchmark-database";

const Key_1 = '["suite","group-a","case-1"]';
const Key_2 = '["suite","group-b","case-2"]';
const configuration = (code_state_id: string, hardware_environment_id: string, software_environment_id: string): BenchmarkConfigurationIds => ({ code_state_id, hardware_environment_id, software_environment_id });
const Catalog: BenchmarkViewCatalog = { metricOptions: ["memory median bytes", "time median"], metricSourcesByLabel: new Map(), branchOptions: ["all", "feature", "main"], databaseTimeStart: "2026-01-01", databaseTimeEnd: "2026-01-31" };

function fixtureDatabase(): LoadedBenchmarkDatabase {
  return { benchmarksByKey: new Map(), runsById: new Map(), codeStatesById: new Map([["c1", { id: "c1", label: "C1", code_date: "2026-01-01T00:00:00Z", identity: { source: { revision: "a" } }, metadata: {} }], ["c2", { id: "c2", label: "C2", code_date: "2026-01-02T00:00:00Z", identity: { source: { revision: "b" } }, metadata: {} }]]), hardwareEnvironmentsById: new Map([["h1", { id: "h1", label: "CPU", identity: { cpu: { model: "CPU" } }, metadata: {} }]]), softwareEnvironmentsById: new Map([["s1", { id: "s1", label: "Julia 1", identity: { runtime: { name: "Julia", version: "1.10.11" } }, metadata: {} }], ["s2", { id: "s2", label: "Julia 2", identity: { runtime: { name: "Julia", version: "1.10.12" } }, metadata: {} }]]), configurations: [configuration("c1", "h1", "s1"), configuration("c2", "h1", "s1"), configuration("c1", "h1", "s2"), configuration("c2", "h1", "s2")], viewCatalog: Catalog, stats: { rowCount: 0, runCount: 0, keyCount: 0, hardwareEnvironmentCount: 1, softwareEnvironmentCount: 2, configurationCount: 4, metrics: [], latestRunDate: "", dirtyRunCount: 0 }, metadata: { schema_version: 6, name: "", description: "", project_url: "", logo_url: "", logo_url_dark: "", created_at: "", updated_at: "", notes: "", raw: {} }, source_label: "fixture", source_url: null };
}

const Base_Run: BenchmarkRun = { run_id: "r1", code_label: "C1", code_date: "2026-01-01T00:00:00Z", hardware_environment_id: "h1", hardware_environment_label: "CPU", software_environment_id: "s1", software_environment_label: "Julia", environment_pair_label: "CPU · Julia", configuration_key: '["c1","h1","s1"]', measured_at: "2026-01-01T00:00:00Z", code_state_identity: { source: { revision: "a" } }, code_state_metadata: {}, hardware_environment_identity: { cpu: { model: "CPU" } }, hardware_environment_metadata: {}, software_environment_identity: { runtime: { name: "Julia", version: "1.10.11" } }, software_environment_metadata: {}, run_metadata: {} };

function benchmarkDefinition(key: string): BenchmarkDefinition { const path = JSON.parse(key) as string[]; return { key, path, label: path.join(" / ") }; }

describe("benchmark view filtering", () => {
  it("resolves Y-axis and branch from the catalog", () => {
    expect(resolveBenchmarkViewFilter(Catalog, { yAxis: "missing", branch: "missing", timeStartValue: 1, timeEndValue: 2, displayStrategy: "all", configurationKeys: ["a"] })).toEqual({ yAxis: "memory median bytes", branch: "all", timeStartValue: 1, timeEndValue: 2, displayStrategy: "all", configurationKeys: ["a"] });
  });

  it("builds benchmark options and normalizes selected keys", () => {
    const definitions = [benchmarkDefinition(Key_2), benchmarkDefinition(Key_1)];
    expect(buildBenchmarkOptions([Key_1, Key_2], new Map(definitions.map((definition) => [definition.key, definition]))).map((option) => option.value)).toEqual([Key_1, Key_2]);
    expect(buildBenchmarkOptions([Key_1, "unknown"], new Map([[Key_1, definitions[1]]]))).toContainEqual({ value: "unknown", path: [], label: "unknown" });
    expect(normalizeSelectedBenchmarkKeys([Key_1, Key_2], [{ value: Key_1, label: "case-1", path: ["suite", "group-a", "case-1"] }])).toEqual([Key_1]);
  });

  it("collapses multiple selected fixed values into one point on the varying dimension", () => {
    const database = fixtureDatabase(); const configurations = buildDimensionConfigurations(database); const dimensions = buildDimensionDefinitions(configurations); const revision = dimensions.find((dimension) => dimension.label.endsWith("Source / Revision"))!; const version = dimensions.find((dimension) => dimension.label.endsWith("Runtime / Version"))!;
    const versions = configurations.map((configuration) => configuration.softwareIdentity.runtime?.version).filter(Boolean); expect(versions).toHaveLength(4);
    const rawValues = Array.from(new Set(configurations.map((configuration) => JSON.stringify(configuration.softwareIdentity.runtime?.version))));
    const selection = resolveDimensionSelection({ index: buildDimensionSelectionIndex(configurations, dimensions), varyingDimensionKeys: [revision.key], valueSelections: [{ dimensionKey: version.key, valueKeys: rawValues.map((value) => `value:${value}`) }] });
    const runs = new Map<string, BenchmarkRun>([["r1", Base_Run], ["r2", { ...Base_Run, run_id: "r2", software_environment_id: "s2", configuration_key: '["c1","h1","s2"]', measured_at: "2026-01-02T00:00:00Z" }]]);
    const aggregates: BenchmarkTrendAggregateRow[] = [{ configuration_key: '["c1","h1","s1"]', benchmark_key: Key_1, metric_name: "time", statistic: "median", unit: "ns", value: 100, better: "lower", run_count: 1, representative_run_id: "r1" }, { configuration_key: '["c1","h1","s2"]', benchmark_key: Key_1, metric_name: "time", statistic: "median", unit: "ns", value: 120, better: "lower", run_count: 1, representative_run_id: "r2" }];
    const rows = buildTrendRowsByBenchmark(aggregates, runs, [Key_1], selection);
    expect(rows.get(Key_1)).toEqual([expect.objectContaining({ x_label: "C1", value: 110, run_identity_title: expect.stringContaining("2 contributing runs averaged") })]);
  });
});
