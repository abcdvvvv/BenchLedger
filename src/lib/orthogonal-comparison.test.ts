import { describe, expect, it } from "vitest";
import {
  allLeafPathIds,
  buildComparisonConfigurations,
  buildIdentityFieldTree,
  matchComparisonConfigurations,
  summarizeVariableFields
} from "./orthogonal-comparison";
import type { BenchmarkAggregateRow, LoadedBenchmarkDataset } from "./types";

const pathId = (path: readonly (string | null)[]) => JSON.stringify(path);

function aggregate(
  key: string,
  codeStateId: string,
  hardwareEnvironmentId: string,
  softwareEnvironmentId: string,
  value = 1
): BenchmarkAggregateRow {
  return {
    configuration_key: key,
    code_state_id: codeStateId,
    hardware_environment_id: hardwareEnvironmentId,
    software_environment_id: softwareEnvironmentId,
    benchmark_key: '["suite","case"]',
    metric_name: "time",
    statistic: "median",
    unit: "ns",
    value,
    better: "lower",
    run_count: 1
  };
}

function fixtureDataset(): LoadedBenchmarkDataset {
  return {
    rows: [],
    aggregateRows: [
      aggregate("config-a", "code-a", "hardware-a", "software-a"),
      aggregate("config-b", "code-a", "hardware-b", "software-a"),
      aggregate("config-c", "code-a", "hardware-c", "software-a"),
      aggregate("config-d", "code-b", "hardware-b", "software-a"),
      aggregate("config-e", "code-a", "hardware-b", "software-b")
    ],
    benchmarksByKey: new Map(),
    runsById: new Map(),
    codeStatesById: new Map([
      ["code-a", { id: "code-a", label: "A", code_date: "2026-01-01", identity: { source: { kind: "git", revision: "a" } }, metadata: {} }],
      ["code-b", { id: "code-b", label: "B", code_date: "2026-01-02", identity: { source: { kind: "git", revision: "b" } }, metadata: {} }]
    ]),
    hardwareEnvironmentsById: new Map([
      ["hardware-a", {
        id: "hardware-a",
        label: "CPU A",
        identity: {
          architecture: "x86_64",
          cpu: { vendor: "Vendor", model: "CPU A", logical_threads: 8 },
          memory: { total_bytes: 32 },
          gpu: [{ vendor: "NVIDIA", model: "GPU", count: 1 }]
        },
        metadata: {}
      }],
      ["hardware-b", {
        id: "hardware-b",
        label: "CPU B",
        identity: {
          architecture: "x86_64",
          cpu: { vendor: "Vendor", model: "CPU B", logical_threads: 8 },
          memory: { total_bytes: 32 },
          gpu: [{ vendor: "NVIDIA", model: "GPU", count: 1 }]
        },
        metadata: {}
      }],
      ["hardware-c", {
        id: "hardware-c",
        label: "CPU C · 64",
        identity: {
          architecture: "x86_64",
          cpu: { vendor: "Vendor", model: "CPU C", logical_threads: 8 },
          memory: { total_bytes: 64 },
          gpu: [{ model: "GPU", count: 1, vendor: "NVIDIA" }]
        },
        metadata: {}
      }]
    ]),
    softwareEnvironmentsById: new Map([
      ["software-a", { id: "software-a", label: "Julia A", identity: { runtime: { name: "Julia", version: "1" } }, metadata: {} }],
      ["software-b", { id: "software-b", label: "Julia B", identity: { runtime: { name: "Julia", version: "2" } }, metadata: {} }]
    ]),
    metadata: {
      schema_version: 6,
      name: "Fixture",
      description: "",
      project_url: "",
      logo_url: "",
      logo_url_dark: "",
      created_at: "",
      updated_at: "",
      notes: "",
      raw: {}
    },
    source_label: "fixture",
    source_url: null
  };
}

describe("orthogonal comparison", () => {
  it("keeps the newest code date first and builds the nested field tree", () => {
    const configurations = buildComparisonConfigurations(fixtureDataset());
    const tree = buildIdentityFieldTree(configurations, "hardware");
    const leaves = new Set(allLeafPathIds(tree));

    expect(configurations[0]).toMatchObject({ codeStateId: "code-b", codeDate: "2026-01-02" });
    expect(leaves).toContain(pathId(["cpu", "model"]));
    expect(leaves).toContain(pathId(["gpu", null, "vendor"]));
    const cpu = tree.find((node) => node.path[0] === "cpu");
    expect(summarizeVariableFields(tree, new Set(cpu?.leafPathIds ?? [])))
      .toEqual([expect.objectContaining({ label: "CPU" })]);
  });

  it("allows selected hardware fields to vary while every fixed field and other category stays equal", () => {
    const configurations = buildComparisonConfigurations(fixtureDataset());
    const tree = buildIdentityFieldTree(configurations, "hardware");
    const matches = matchComparisonConfigurations({
      configurations,
      baselineKey: "config-a",
      variableCategory: "hardware",
      variableFieldPathIds: [pathId(["cpu", "model"])],
      fieldTree: tree
    });

    expect(matches.map((match) => match.configuration.key)).toEqual(["config-a", "config-b"]);
    expect(matches[1].changedFieldPathIds).toEqual([pathId(["cpu", "model"])]);
  });

  it("preserves relationships between fields inside object arrays", () => {
    const dataset = fixtureDataset();
    const hardwareEnvironments = new Map(dataset.hardwareEnvironmentsById);
    hardwareEnvironments.set("hardware-paired-a", {
      id: "hardware-paired-a", label: "Paired A", metadata: {},
      identity: { gpu: [{ vendor: "NVIDIA", model: "A" }, { vendor: "AMD", model: "B" }] }
    });
    hardwareEnvironments.set("hardware-paired-b", {
      id: "hardware-paired-b", label: "Paired B", metadata: {},
      identity: { gpu: [{ vendor: "NVIDIA", model: "B" }, { vendor: "AMD", model: "A" }] }
    });
    dataset.hardwareEnvironmentsById = hardwareEnvironments;
    dataset.aggregateRows.push(
      aggregate("paired-a", "code-a", "hardware-paired-a", "software-a"),
      aggregate("paired-b", "code-a", "hardware-paired-b", "software-a")
    );

    const configurations = buildComparisonConfigurations(dataset);
    const tree = buildIdentityFieldTree(configurations, "hardware");
    const matches = matchComparisonConfigurations({
      configurations, baselineKey: "paired-a", variableCategory: "hardware",
      variableFieldPathIds: [pathId(["gpu", null, "model"])], fieldTree: tree
    });

    expect(matches.find((match) => match.configuration.key === "paired-b")?.changedFieldPathIds)
      .toContain(pathId(["gpu"]));
  });

  it("treats primitive identity arrays as order-independent collections", () => {
    const dataset = fixtureDataset();
    const hardwareEnvironments = new Map(dataset.hardwareEnvironmentsById);
    hardwareEnvironments.set("hardware-array-a", {
      id: "hardware-array-a", label: "Array A", metadata: {},
      identity: { cpu: { model: "CPU A" }, instruction_sets: ["avx2", "sse4"] }
    });
    hardwareEnvironments.set("hardware-array-b", {
      id: "hardware-array-b", label: "Array B", metadata: {},
      identity: { cpu: { model: "CPU B" }, instruction_sets: ["sse4", "avx2"] }
    });
    dataset.hardwareEnvironmentsById = hardwareEnvironments;
    dataset.aggregateRows.push(
      aggregate("array-a", "code-a", "hardware-array-a", "software-a"),
      aggregate("array-b", "code-a", "hardware-array-b", "software-a")
    );

    const configurations = buildComparisonConfigurations(dataset);
    const tree = buildIdentityFieldTree(configurations, "hardware");
    const matches = matchComparisonConfigurations({
      configurations, baselineKey: "array-a", variableCategory: "hardware",
      variableFieldPathIds: [pathId(["cpu", "model"])], fieldTree: tree
    });

    expect(matches.map((match) => match.configuration.key)).toContain("array-b");
  });

  it("treats a missing identity field as a real value rather than a wildcard", () => {
    const dataset = fixtureDataset();
    const hardwareEnvironments = new Map(dataset.hardwareEnvironmentsById);
    hardwareEnvironments.set("hardware-custom", {
      id: "hardware-custom",
      label: "CPU B custom",
      identity: {
        architecture: "x86_64",
        cpu: { vendor: "Vendor", model: "CPU B", logical_threads: 8 },
        memory: { total_bytes: 32 },
        gpu: [{ vendor: "NVIDIA", model: "GPU", count: 1 }],
        custom_feature: "enabled"
      },
      metadata: {}
    });
    dataset.hardwareEnvironmentsById = hardwareEnvironments;
    dataset.aggregateRows.push(aggregate("config-custom", "code-a", "hardware-custom", "software-a"));

    const configurations = buildComparisonConfigurations(dataset);
    const tree = buildIdentityFieldTree(configurations, "hardware");
    const matchKeys = (fields: string[]) => matchComparisonConfigurations({
      configurations, baselineKey: "config-a", variableCategory: "hardware",
      variableFieldPathIds: fields, fieldTree: tree
    }).map((match) => match.configuration.key);

    expect(matchKeys([pathId(["cpu", "model"])])).not.toContain("config-custom");
    expect(matchKeys([pathId(["cpu", "model"]), pathId(["custom_feature"])])).toContain("config-custom");
  });
});
