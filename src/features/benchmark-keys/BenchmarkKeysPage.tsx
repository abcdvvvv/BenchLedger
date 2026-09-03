import { useEffect, useMemo, useState } from "react";
import { EmptyState } from "../../components/common/EmptyState";
import { Button } from "../../components/ui/Button";
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
import {
  buildBenchmarkKeyTree,
  flattenVisibleBenchmarkKeyNodes,
  initiallyExpandedBenchmarkGroupIds
} from "../../lib/benchmark-key-tree";

type BenchmarkKeysPageProps = {
  benchmarks: BenchmarkDefinition[];
};

const Tree_Indent_Rem = 1.125;

export function BenchmarkKeysPage(props: BenchmarkKeysPageProps) {
  const tree = useMemo(() => buildBenchmarkKeyTree(props.benchmarks, (benchmark) => benchmark.key), [props.benchmarks]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => initiallyExpandedBenchmarkGroupIds(tree));

  useEffect(() => {
    setExpandedIds(initiallyExpandedBenchmarkGroupIds(tree));
  }, [tree]);

  const hasKeys = props.benchmarks.length > 0;
  const rows = useMemo(
    () => flattenVisibleBenchmarkKeyNodes(tree, expandedIds),
    [expandedIds, tree]
  );

  return (
    <>
      <PageHeader
        eyebrow="Benchmarking › Benchmark Keys"
        title="Benchmark Keys"
        description="Explore the benchmark key hierarchy as a collapsible tree built from the loaded database."
      />
      {hasKeys ? (
        <Panel className="min-h-[32rem]">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <StatusBadge>{props.benchmarks.length.toLocaleString()} benchmark{props.benchmarks.length === 1 ? "" : "s"}</StatusBadge>
            <StatusBadge>{tree.branchIds.length.toLocaleString()} group{tree.branchIds.length === 1 ? "" : "s"}</StatusBadge>
            <p className="type-body-muted mr-auto">Expand or collapse any group to inspect its nested benchmark keys.</p>
            <Button
              variant="secondary"
              onClick={() => setExpandedIds(new Set(tree.branchIds))}
              disabled={expandedIds.size === tree.branchIds.length}
            >
              Expand all
            </Button>
            <Button
              variant="secondary"
              onClick={() => setExpandedIds(new Set())}
              disabled={expandedIds.size === 0}
            >
              Collapse all
            </Button>
          </div>
          <DataTableShell label="Benchmark key hierarchy">
            <DataTable>
              <caption className="visually-hidden">Benchmark key groups and leaf benchmarks</caption>
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
                  const indentStyle = { paddingLeft: `${Math.max(node.path.length - 1, 0) * Tree_Indent_Rem}rem` };

                  return (
                    <tr key={node.id}>
                      <DataCell className="align-top">
                        <div className="min-w-0" style={indentStyle}>
                          {node.kind === "group" ? (
                            <button
                              type="button"
                              className="flex min-w-0 items-start gap-2 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/15"
                              aria-expanded={isExpanded}
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
                      <DataCell>{node.leafValues.length}</DataCell>
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
