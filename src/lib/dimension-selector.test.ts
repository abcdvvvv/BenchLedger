import { describe, expect, it } from "vitest";
import { buildDimensionConfigurations, buildDimensionDefinitions, buildDimensionSelectionIndex, normalizeDimensionValueSelections, resolveDimensionSelection } from "./dimension-selector";
import type { BenchmarkConfigurationIds, LoadedBenchmarkDatabase } from "./types";

const configuration = (code_state_id: string, hardware_environment_id: string, software_environment_id: string): BenchmarkConfigurationIds => ({ code_state_id, hardware_environment_id, software_environment_id });
function fixtureDatabase(): LoadedBenchmarkDatabase {
  return { benchmarksByKey: new Map(), runsById: new Map(), codeStatesById: new Map([["c1", { id: "c1", label: "C1", code_date: "2026-01-01", identity: { source: { kind: "git", revision: "a" } }, metadata: {} }], ["c2", { id: "c2", label: "C2", code_date: "2026-01-02", identity: { source: { kind: "git", revision: "b" } }, metadata: {} }]]), hardwareEnvironmentsById: new Map([["h1", { id: "h1", label: "CPU A", identity: { architecture: "x86_64", cpu: { model: "CPU A" }, gpu: [{ vendor: "NVIDIA", model: "A" }, { vendor: "AMD", model: "B" }] }, metadata: {} }], ["h2", { id: "h2", label: "CPU B", identity: { architecture: "x86_64", cpu: { model: "CPU B" }, gpu: [{ vendor: "NVIDIA", model: "B" }, { vendor: "AMD", model: "A" }] }, metadata: {} }]]), softwareEnvironmentsById: new Map([["s1", { id: "s1", label: "Julia 1.10.11", identity: { runtime: { name: "Julia", version: "1.10.11" } }, metadata: {} }], ["s2", { id: "s2", label: "Julia 1.10.12", identity: { runtime: { name: "Julia", version: "1.10.12" } }, metadata: {} }]]), configurations: [configuration("c1", "h1", "s1"), configuration("c2", "h1", "s1"), configuration("c1", "h1", "s2"), configuration("c2", "h1", "s2"), configuration("c1", "h2", "s1")], benchmarkCountByRun: new Map(), viewCatalog: { metricOptions: [], metricSourcesByLabel: new Map(), branchOptions: ["all"], databaseTimeStart: "", databaseTimeEnd: "" }, stats: { rowCount: 0, runCount: 0, keyCount: 0, hardwareEnvironmentCount: 2, softwareEnvironmentCount: 2, configurationCount: 5, metrics: [], latestRunDate: "", dirtyRunCount: 0 }, metadata: { schema_version: 6, name: "", description: "", project_url: "", logo_url: "", logo_url_dark: "", created_at: "", updated_at: "", notes: "", raw: {} }, source_label: "fixture", source_url: null };
}

describe("Dimension Selector domain logic", () => {
  it("discovers scalar dimensions while keeping object-array collections atomic", () => {
    const configurations = buildDimensionConfigurations(fixtureDatabase()); const dimensions = buildDimensionDefinitions(configurations);
    expect(dimensions.map((dimension) => dimension.label)).toEqual(expect.arrayContaining(["Code / Source / Revision", "Hardware / CPU / Model", "Hardware / GPU", "Software / Runtime / Version"]));
    expect(dimensions.some((dimension) => dimension.label.includes("GPU / Vendor"))).toBe(false);
  });

  it("keeps exactly one dimension free and turns every other dimension into a condition", () => {
    const configurations = buildDimensionConfigurations(fixtureDatabase()); const dimensions = buildDimensionDefinitions(configurations); const revision = dimensions.find((dimension) => dimension.label === "Code / Source / Revision")!;
    const selection = resolveDimensionSelection({ index: buildDimensionSelectionIndex(configurations, dimensions), varyingDimensionKeys: [revision.key], valueSelections: [] });
    expect(selection.varyingDimension?.key).toBe(revision.key);
    expect(selection.fixedValueSelections.some((selector) => selector.dimension.key === revision.key)).toBe(false);
    expect(selection.configurationKeys.length).toBeGreaterThan(1);
  });

  it("treats one selected fixed value as exact and multiple selected values as one grouped condition", () => {
    const configurations = buildDimensionConfigurations(fixtureDatabase()); const dimensions = buildDimensionDefinitions(configurations); const revision = dimensions.find((dimension) => dimension.label === "Code / Source / Revision")!; const version = dimensions.find((dimension) => dimension.label === "Software / Runtime / Version")!; const base = resolveDimensionSelection({ index: buildDimensionSelectionIndex(configurations, dimensions), varyingDimensionKeys: [revision.key], valueSelections: [] }); const values = base.fixedValueSelections.find((entry) => entry.dimension.key === version.key)!.options;
    const exact = resolveDimensionSelection({ index: buildDimensionSelectionIndex(configurations, dimensions), varyingDimensionKeys: [revision.key], valueSelections: [{ dimensionKey: version.key, valueKeys: [values[0].key] }] });
    expect(exact.fixedValueSelections.find((entry) => entry.dimension.key === version.key)?.valueKeys).toEqual([values[0].key]);
    const grouped = resolveDimensionSelection({ index: buildDimensionSelectionIndex(configurations, dimensions), varyingDimensionKeys: [revision.key], valueSelections: [{ dimensionKey: version.key, valueKeys: values.map((value) => value.key) }] });
    expect(grouped.fixedValueSelections.find((entry) => entry.dimension.key === version.key)?.valueKeys).toEqual(values.map((value) => value.key));
    expect(grouped.configurationKeys).toEqual(expect.arrayContaining(['["c1","h1","s1"]', '["c1","h1","s2"]']));
  });
  it("allows temporary zero or multiple varying dimensions and reports them as invalid", () => {
    const configurations = buildDimensionConfigurations(fixtureDatabase()); const dimensions = buildDimensionDefinitions(configurations); const revision = dimensions.find((dimension) => dimension.label === "Code / Source / Revision")!; const cpu = dimensions.find((dimension) => dimension.label === "Hardware / CPU / Model")!;
    const zero = resolveDimensionSelection({ index: buildDimensionSelectionIndex(configurations, dimensions), varyingDimensionKeys: [], valueSelections: [] }); expect(zero.validation.isValid).toBe(false); expect(zero.validation.varyingCount).toBe(0); expect(zero.configurationKeys).toEqual([]);
    const multiple = resolveDimensionSelection({ index: buildDimensionSelectionIndex(configurations, dimensions), varyingDimensionKeys: [revision.key, cpu.key], valueSelections: [] }); expect(multiple.validation.isValid).toBe(false); expect(multiple.validation.varyingCount).toBe(2); expect(multiple.configurationKeys).toEqual([]);
  });

  it("preserves an empty multi-value selection while keeping single-value dimensions fixed", () => {
    const configurations = buildDimensionConfigurations(fixtureDatabase()); const dimensions = buildDimensionDefinitions(configurations); const revision = dimensions.find((dimension) => dimension.label === "Code / Source / Revision")!; const cpu = dimensions.find((dimension) => dimension.label === "Hardware / CPU / Model")!; const kind = dimensions.find((dimension) => dimension.label === "Code / Source / Kind")!;
    const selection = resolveDimensionSelection({ index: buildDimensionSelectionIndex(configurations, dimensions), varyingDimensionKeys: [revision.key], valueSelections: [{ dimensionKey: cpu.key, valueKeys: [] }, { dimensionKey: kind.key, valueKeys: [] }] });
    expect(selection.fixedValueSelections.find((entry) => entry.dimension.key === cpu.key)?.valueKeys).toEqual([]); expect(selection.fixedValueSelections.find((entry) => entry.dimension.key === kind.key)?.valueKeys).toHaveLength(1); expect(selection.validation.isValid).toBe(false); expect(selection.validation.issues).toContain("Hardware / CPU / Model must select at least 1 value."); expect(selection.validation.issues).not.toContain("Code / Source / Kind must select at least 1 value."); expect(selection.configurationKeys).toEqual([]);
  });

  it("keeps fixed-value menus based on all observed values rather than trapping them inside the current dimension selection", () => {
    const configurations = buildDimensionConfigurations(fixtureDatabase()); const dimensions = buildDimensionDefinitions(configurations); const revision = dimensions.find((dimension) => dimension.label === "Code / Source / Revision")!; const cpu = dimensions.find((dimension) => dimension.label === "Hardware / CPU / Model")!; const version = dimensions.find((dimension) => dimension.label === "Software / Runtime / Version")!; const base = resolveDimensionSelection({ index: buildDimensionSelectionIndex(configurations, dimensions), varyingDimensionKeys: [revision.key], valueSelections: [] }); const cpuValues = base.fixedValueSelections.find((entry) => entry.dimension.key === cpu.key)!.options;
    const selection = resolveDimensionSelection({ index: buildDimensionSelectionIndex(configurations, dimensions), varyingDimensionKeys: [revision.key], valueSelections: [{ dimensionKey: cpu.key, valueKeys: [cpuValues.find((value) => value.label === "CPU B")!.key] }] });
    expect(selection.fixedValueSelections.find((entry) => entry.dimension.key === version.key)?.options.map((option) => option.label)).toEqual(["1.10.11", "1.10.12"]);
  });

  it("normalizes persisted fixed-value selections", () => {
    expect(normalizeDimensionValueSelections([{ dimensionKey: "d1", valueKeys: ["a", "a", "b", 3] }, { dimensionKey: "d1", valueKeys: [] }, { dimensionKey: "", valueKeys: ["x"] }, null])).toEqual([{ dimensionKey: "d1", valueKeys: [] }]);
  });

});
