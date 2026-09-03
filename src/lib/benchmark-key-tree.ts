export type BenchmarkKeyTreeSource = {
  label: string;
  path: string[];
};

type BenchmarkKeyNodeBase = {
  id: string;
  label: string;
  segment: string;
  path: string[];
  parentId: string | null;
  childIds: string[];
  depth: number;
  benchmarkCount: number;
  leafValues: string[];
};

export type BenchmarkKeyGroupNode = BenchmarkKeyNodeBase & {
  kind: "group";
  value: null;
};

export type BenchmarkKeyBenchmarkNode = BenchmarkKeyNodeBase & {
  kind: "benchmark";
  value: string;
};

export type BenchmarkKeyNode = BenchmarkKeyGroupNode | BenchmarkKeyBenchmarkNode;

export type BenchmarkKeyTreeView = {
  nodesById: ReadonlyMap<string, BenchmarkKeyNode>;
  rootIds: string[];
};

export type BenchmarkKeyTree = BenchmarkKeyTreeView & {
  branchIds: string[];
  groupCount: number;
};

function compareNodeOrder(left: BenchmarkKeyNode, right: BenchmarkKeyNode, order: "groups-first" | "path"): number {
  if (order === "groups-first" && left.kind !== right.kind) return left.kind === "group" ? -1 : 1;
  if (order === "path") {
    const length = Math.min(left.path.length, right.path.length);
    for (let index = 0; index < length; index += 1) {
      const pathOrder = left.path[index].localeCompare(right.path[index]);
      if (pathOrder !== 0) return pathOrder;
    }
    if (left.path.length !== right.path.length) return left.path.length - right.path.length;
  }
  return left.label.localeCompare(right.label, undefined, { sensitivity: "base", numeric: true });
}

function benchmarkGroupNodeId(path: readonly string[]): string {
  return `group:${JSON.stringify(path)}`;
}

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export function buildBenchmarkKeyTree<T extends BenchmarkKeyTreeSource>(sources: readonly T[], valueOf: (source: T) => string, order: "groups-first" | "path" = "groups-first"): BenchmarkKeyTree {
  const nodesById = new Map<string, BenchmarkKeyNode>();
  const rootIds: string[] = [];
  const branchIds: string[] = [];

  for (const source of sources) {
    const value = valueOf(source);
    const path = source.path.length ? source.path : [source.label || value];
    let parentId: string | null = null;
    let groupPath: string[] = [];

    for (const segment of path.slice(0, -1)) {
      groupPath = [...groupPath, segment];
      const nodeId = benchmarkGroupNodeId(groupPath);

      if (!nodesById.has(nodeId)) {
        nodesById.set(nodeId, {
          id: nodeId,
          label: segment,
          segment,
          path: groupPath,
          parentId,
          childIds: [],
          depth: groupPath.length - 1,
          benchmarkCount: 0,
          leafValues: [],
          kind: "group",
          value: null
        });
        if (parentId) nodesById.get(parentId)!.childIds.push(nodeId);
        else rootIds.push(nodeId);
        branchIds.push(nodeId);
      }

      parentId = nodeId;
    }

    const leafId = `benchmark:${value}`;
    nodesById.set(leafId, {
      id: leafId,
      label: source.label,
      segment: path[path.length - 1],
      path,
      parentId,
      childIds: [],
      depth: Math.max(path.length - 1, 0),
      benchmarkCount: 1,
      leafValues: [value],
      kind: "benchmark",
      value
    });

    if (parentId) nodesById.get(parentId)!.childIds.push(leafId);
    else rootIds.push(leafId);
  }

  for (const node of nodesById.values()) {
    node.childIds.sort((leftId, rightId) => compareNodeOrder(nodesById.get(leftId)!, nodesById.get(rightId)!, order));
  }
  rootIds.sort((leftId, rightId) => compareNodeOrder(nodesById.get(leftId)!, nodesById.get(rightId)!, order));

  for (let index = branchIds.length - 1; index >= 0; index -= 1) {
    const branch = nodesById.get(branchIds[index]);
    if (!branch || branch.kind !== "group") continue;
    branch.benchmarkCount = branch.childIds.reduce((count, childId) => count + (nodesById.get(childId)?.benchmarkCount ?? 0), 0);
    branch.leafValues = Array.from(new Set(branch.childIds.flatMap((childId) => nodesById.get(childId)?.leafValues ?? [])));
  }

  return { nodesById, rootIds, branchIds, groupCount: branchIds.length };
}

export function filterBenchmarkKeyTree(tree: BenchmarkKeyTree, query: string): BenchmarkKeyTreeView {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return tree;

  const nodesById = new Map<string, BenchmarkKeyNode>();

  function visit(nodeId: string): BenchmarkKeyNode | null {
    const node = tree.nodesById.get(nodeId);
    if (!node) return null;
    if (node.kind === "benchmark") {
      const matches = [node.path.join(" / "), ...node.path, node.label].some((entry) => normalizeText(entry).includes(normalizedQuery));
      if (!matches) return null;
      nodesById.set(node.id, node);
      return node;
    }

    const children = node.childIds.map((childId) => visit(childId)).filter((child): child is BenchmarkKeyNode => child !== null);
    if (!children.length) return null;
    const filteredNode: BenchmarkKeyGroupNode = {
      ...node,
      childIds: children.map((child) => child.id),
      benchmarkCount: children.reduce((count, child) => count + child.benchmarkCount, 0),
      leafValues: Array.from(new Set(children.flatMap((child) => child.leafValues)))
    };
    nodesById.set(filteredNode.id, filteredNode);
    return filteredNode;
  }

  const rootIds = tree.rootIds.map((nodeId) => visit(nodeId)).filter((node): node is BenchmarkKeyNode => node !== null).map((node) => node.id);
  return { nodesById, rootIds };
}

export function initiallyExpandedBenchmarkGroupIds(tree: BenchmarkKeyTree): Set<string> {
  return new Set(tree.rootIds.filter((nodeId) => tree.nodesById.get(nodeId)?.kind === "group"));
}

export function flattenVisibleBenchmarkKeyNodes(tree: BenchmarkKeyTree, expandedIds: ReadonlySet<string>): BenchmarkKeyNode[] {
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
