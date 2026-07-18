import { useEffect, useState } from "react";
import { EmptyState } from "../../components/common/EmptyState";
import { PageHeader } from "../../components/common/PageHeader";
import { StatusBadge } from "../../components/ui/Badge";
import { Panel } from "../../components/ui/Card";
import {
  DataCell,
  DataHeadCell,
  DataTable,
  DataTableShell
} from "../../components/ui/Table";
import type { BenchmarkDefinition } from "../../lib/types";

export type BenchmarkKeysPageProps = {
  benchmarks: BenchmarkDefinition[];
};

type BenchmarkKeyNode = {
  id: string;
  label: string;
  path: string[];
  parentId: string | null;
  childIds: string[];
  depth: number;
  benchmarkCount: number;
  kind: "group" | "benchmark";
};

type BenchmarkKeyTree = {
  nodesById: Map<string, BenchmarkKeyNode>;
  rootIds: string[];
  branchIds: string[];
  groupCount: number;
};

const Tree_Indent_Rem = 1.125;

function compareNodeOrder(left: BenchmarkKeyNode, right: BenchmarkKeyNode): number {
  if (left.kind !== right.kind) return left.kind === "group" ? -1 : 1;
  return left.label.localeCompare(right.label, undefined, { sensitivity: "base", numeric: true });
}

function buildBenchmarkKeyTree(benchmarks: BenchmarkDefinition[]): BenchmarkKeyTree {
  const nodesById = new Map<string, BenchmarkKeyNode>();
  const rootIds: string[] = [];
  const branchIds: string[] = [];

  for (const benchmark of benchmarks) {
    let parentId: string | null = null;
    let groupPath: string[] = [];

    for (const segment of benchmark.path) {
      groupPath = [...groupPath, segment];
      const nodeId = `group:${groupPath.join("/")}`;

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

    const leafPath = [...benchmark.path, benchmark.label];
    const leafId = `benchmark:${benchmark.id}`;
    nodesById.set(leafId, {
      id: leafId,
      label: benchmark.label,
      path: leafPath,
      parentId,
      childIds: [],
      depth: benchmark.path.length,
      benchmarkCount: 1,
      kind: "benchmark"
    });

    if (parentId) {
      nodesById.get(parentId)!.childIds.push(leafId);
    } else {
      rootIds.push(leafId);
    }
  }

  const childEntries = Array.from(nodesById.entries());
  for (const [, node] of childEntries) {
    node.childIds.sort((leftId, rightId) => compareNodeOrder(nodesById.get(leftId)!, nodesById.get(rightId)!));
  }
  rootIds.sort((leftId, rightId) => compareNodeOrder(nodesById.get(leftId)!, nodesById.get(rightId)!));

  for (let index = branchIds.length - 1; index >= 0; index -= 1) {
    const branch = nodesById.get(branchIds[index]);
    if (!branch) continue;
    branch.benchmarkCount = branch.childIds.reduce((count, childId) => count + (nodesById.get(childId)?.benchmarkCount ?? 0), 0);
  }

  return {
    nodesById,
    rootIds,
    branchIds,
    groupCount: branchIds.length
  };
}

function flattenVisibleNodes(tree: BenchmarkKeyTree, expandedIds: ReadonlySet<string>): BenchmarkKeyNode[] {
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

export function BenchmarkKeysPage(props: BenchmarkKeysPageProps) {
  const tree = buildBenchmarkKeyTree(props.benchmarks);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set(tree.branchIds));

  useEffect(() => {
    setExpandedIds(new Set(tree.branchIds));
  }, [props.benchmarks]);

  const hasKeys = props.benchmarks.length > 0;
  const rows = flattenVisibleNodes(tree, expandedIds);

  return (
    <>
      <PageHeader
        eyebrow="Benchmarking › Benchmark Keys"
        title="Benchmark Keys"
        description="Explore the benchmark key hierarchy as a collapsible tree built from the loaded dataset."
      />
      {hasKeys ? (
        <Panel className="min-h-[32rem]">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <StatusBadge>{props.benchmarks.length} benchmark{props.benchmarks.length === 1 ? "" : "s"}</StatusBadge>
            <StatusBadge>{tree.groupCount} group{tree.groupCount === 1 ? "" : "s"}</StatusBadge>
            <p className="type-body-muted">Expand or collapse any group to inspect its nested benchmark keys.</p>
          </div>
          <DataTableShell>
            <DataTable>
              <thead>
                <tr>
                  <DataHeadCell>Key</DataHeadCell>
                  <DataHeadCell>Kind</DataHeadCell>
                  <DataHeadCell>Children</DataHeadCell>
                  <DataHeadCell>Benchmarks</DataHeadCell>
                </tr>
              </thead>
              <tbody>
                {rows.map((node) => {
                  const isExpanded = expandedIds.has(node.id);
                  const indentStyle = { paddingLeft: `${node.depth * Tree_Indent_Rem}rem` };

                  return (
                    <tr key={node.id}>
                      <DataCell className="align-top">
                        <div className="min-w-0" style={indentStyle}>
                          {node.kind === "group" ? (
                            <button
                              type="button"
                              className="flex min-w-0 items-start gap-2 text-left"
                              onClick={() => {
                                setExpandedIds((current) => {
                                  const next = new Set(current);
                                  if (next.has(node.id)) next.delete(node.id);
                                  else next.add(node.id);
                                  return next;
                                });
                              }}
                            >
                              <span className="type-meta mt-0.5 w-3 shrink-0 text-center">{isExpanded ? "▾" : "▸"}</span>
                              <span className="type-body-strong min-w-0 truncate">{node.label}</span>
                            </button>
                          ) : (
                            <div className="flex min-w-0 items-start gap-2">
                              <span className="type-meta mt-0.5 w-3 shrink-0 text-center">•</span>
                              <span className="type-body min-w-0 truncate">{node.label}</span>
                            </div>
                          )}
                        </div>
                      </DataCell>
                      <DataCell tone="plain">
                        <StatusBadge>{node.kind === "group" ? "Group" : "Benchmark"}</StatusBadge>
                      </DataCell>
                      <DataCell>{node.kind === "group" ? node.childIds.length : ""}</DataCell>
                      <DataCell>{node.benchmarkCount}</DataCell>
                    </tr>
                  );
                })}
              </tbody>
            </DataTable>
          </DataTableShell>
        </Panel>
      ) : (
        <EmptyState
          className="surface-empty pad-empty flex min-h-[32rem] flex-col items-center justify-center text-center"
          title="No benchmark keys available"
          description="Load a benchmark database with rows to render the hierarchy."
        />
      )}
    </>
  );
}
