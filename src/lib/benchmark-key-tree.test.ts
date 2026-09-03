import { describe, expect, it } from "vitest";
import {
  buildBenchmarkKeyTree,
  filterBenchmarkKeyTree,
  flattenVisibleBenchmarkKeyNodes,
  initiallyExpandedBenchmarkGroupIds
} from "./benchmark-key-tree";
import type { BenchmarkDefinition } from "./types";

function definition(path: string[]): BenchmarkDefinition {
  return { key: JSON.stringify(path), path, label: path[path.length - 1] };
}

describe("benchmark key tree", () => {
  it("counts nested benchmarks and starts with root groups expanded", () => {
    const tree = buildBenchmarkKeyTree([
      definition(["suite", "group", "case-a"]),
      definition(["suite", "group", "case-b"]),
      definition(["other", "case-c"])
    ], (benchmark) => benchmark.key);
    const expanded = initiallyExpandedBenchmarkGroupIds(tree);
    const rows = flattenVisibleBenchmarkKeyNodes(tree, expanded);

    expect(tree.branchIds).toHaveLength(3);
    expect(Array.from(expanded)).toEqual(tree.rootIds);
    expect(rows.map((node) => node.path)).toEqual([
      ["other"],
      ["other", "case-c"],
      ["suite"],
      ["suite", "group"]
    ]);
  });

  it("shares path ordering and subtree leaf values with cascade consumers", () => {
    const options = [
      { value: "root", path: ["alpha"], label: "alpha" },
      { value: "case-b", path: ["beta", "case-b"], label: "case-b" },
      { value: "case-a", path: ["beta", "case-a"], label: "case-a" }
    ];
    const tree = buildBenchmarkKeyTree(options, (option) => option.value, "path");
    expect(tree.rootIds.map((nodeId) => tree.nodesById.get(nodeId)?.path)).toEqual([["alpha"], ["beta"]]);
    expect(tree.nodesById.get(tree.rootIds[1])?.leafValues).toEqual(["case-a", "case-b"]);
  });

  it("filters branch leaf values to visible benchmark matches", () => {
    const options = [
      { value: "fast", path: ["suite", "fast-case"], label: "fast-case" },
      { value: "slow", path: ["suite", "slow-case"], label: "slow-case" }
    ];
    const tree = buildBenchmarkKeyTree(options, (option) => option.value, "path");
    const filtered = filterBenchmarkKeyTree(tree, "slow");
    expect(filtered.rootIds).toHaveLength(1);
    expect(filtered.nodesById.get(filtered.rootIds[0])?.leafValues).toEqual(["slow"]);
  });

});
