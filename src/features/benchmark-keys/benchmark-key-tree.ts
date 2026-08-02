import type { BenchmarkDefinition } from "../../lib/types";

export type BenchmarkKeyNode = {
  id: string;
  label: string;
  path: string[];
  parentId: string | null;
  childIds: string[];
  depth: number;
  benchmarkCount: number;
  kind: "group" | "benchmark";
};

export type BenchmarkKeyTree = {
  nodesById: ReadonlyMap<string, BenchmarkKeyNode>;
  rootIds: string[];
  branchIds: string[];
  groupCount: number;
};

function compareNodeOrder(left: BenchmarkKeyNode, right: BenchmarkKeyNode): number {
  if (left.kind !== right.kind) return left.kind === "group" ? -1 : 1;
  return left.label.localeCompare(right.label, undefined, { sensitivity: "base", numeric: true });
}

function benchmarkGroupNodeId(path: readonly string[]): string {
  return `group:${JSON.stringify(path)}`;
}

export function buildBenchmarkKeyTree(benchmarks: readonly BenchmarkDefinition[]): BenchmarkKeyTree {
  const nodesById = new Map<string, BenchmarkKeyNode>();
  const rootIds: string[] = [];
  const branchIds: string[] = [];

  for (const benchmark of benchmarks) {
    let parentId: string | null = null;
    let groupPath: string[] = [];

    for (const segment of benchmark.path.slice(0, -1)) {
      groupPath = [...groupPath, segment];
      const nodeId = benchmarkGroupNodeId(groupPath);

      if (!nodesById.has(nodeId)) {
        nodesById.set(nodeId, {
          id: nodeId,
          label: segment,
          path: groupPath,
          parentId,
          childIds: [],
          depth: groupPath.length - 1,
          benchmarkCount: 0,
          kind: "group"
        });
        if (parentId) {
          nodesById.get(parentId)!.childIds.push(nodeId);
        } else {
          rootIds.push(nodeId);
        }
        branchIds.push(nodeId);
      }

      parentId = nodeId;
    }

    const leafId = `benchmark:${benchmark.key}`;
    nodesById.set(leafId, {
      id: leafId,
      label: benchmark.label,
      path: benchmark.path,
      parentId,
      childIds: [],
      depth: Math.max(benchmark.path.length - 1, 0),
      benchmarkCount: 1,
      kind: "benchmark"
    });

    if (parentId) {
      nodesById.get(parentId)!.childIds.push(leafId);
    } else {
      rootIds.push(leafId);
    }
  }

  for (const node of nodesById.values()) {
    node.childIds.sort((leftId, rightId) => compareNodeOrder(nodesById.get(leftId)!, nodesById.get(rightId)!));
  }
  rootIds.sort((leftId, rightId) => compareNodeOrder(nodesById.get(leftId)!, nodesById.get(rightId)!));

  for (let index = branchIds.length - 1; index >= 0; index -= 1) {
    const branch = nodesById.get(branchIds[index]);
    if (!branch) continue;
    branch.benchmarkCount = branch.childIds.reduce(
      (count, childId) => count + (nodesById.get(childId)?.benchmarkCount ?? 0),
      0
    );
  }

  return {
    nodesById,
    rootIds,
    branchIds,
    groupCount: branchIds.length
  };
}

export function initiallyExpandedBenchmarkGroupIds(tree: BenchmarkKeyTree): Set<string> {
  return new Set(tree.rootIds.filter((nodeId) => tree.nodesById.get(nodeId)?.kind === "group"));
}

export function flattenVisibleBenchmarkKeyNodes(
  tree: BenchmarkKeyTree,
  expandedIds: ReadonlySet<string>
): BenchmarkKeyNode[] {
  const rows: BenchmarkKeyNode[] = [];

  const visit = (nodeId: string) => {
    const node = tree.nodesById.get(nodeId);
    if (!node) return;
    rows.push(node);
    if (node.kind !== "group" || !expandedIds.has(node.id)) return;
    for (const childId of node.childIds) visit(childId);
  };

  for (const rootId of tree.rootIds) visit(rootId);
  return rows;
}
