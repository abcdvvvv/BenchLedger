import { describe, expect, it } from "vitest";
import {
  buildBenchmarkKeyTree,
  flattenVisibleBenchmarkKeyNodes,
  initiallyExpandedBenchmarkGroupIds
} from "./benchmark-key-tree";
import type { BenchmarkDefinition } from "../../lib/types";

function definition(path: string[]): BenchmarkDefinition {
  return { key: JSON.stringify(path), path, label: path[path.length - 1] };
}

describe("benchmark key tree", () => {
  it("counts nested benchmarks and starts with root groups expanded", () => {
    const tree = buildBenchmarkKeyTree([
      definition(["suite", "group", "case-a"]),
      definition(["suite", "group", "case-b"]),
      definition(["other", "case-c"])
    ]);
    const expanded = initiallyExpandedBenchmarkGroupIds(tree);
    const rows = flattenVisibleBenchmarkKeyNodes(tree, expanded);

    expect(tree.groupCount).toBe(3);
    expect(Array.from(expanded)).toEqual(tree.rootIds);
    expect(rows.map((node) => node.path)).toEqual([
      ["other"],
      ["other", "case-c"],
      ["suite"],
      ["suite", "group"]
    ]);
  });
});
