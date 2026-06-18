import Plot from "./Plot";
import { colorForBenchmark, type PlotTheme, type ThemeMode } from "../lib/dashboard";
import type { BenchmarkRow } from "../lib/types";

type BenchmarkKeysPageProps = {
  rows: BenchmarkRow[];
  plotTheme: PlotTheme;
  theme: ThemeMode;
};

type IcicleNode = {
  id: string;
  parent: string;
  label: string;
  value: number;
  depth: number;
  rootKey: string;
};

function buildIcicleNodes(rows: BenchmarkRow[]): IcicleNode[] {
  const nodeMap = new Map<string, IcicleNode>();

  nodeMap.set("root", {
    id: "root",
    parent: "",
    label: "Benchmark Keys",
    value: 0,
    depth: 0,
    rootKey: "root"
  });

  for (const row of rows) {
    const path = row.benchmark_path.length ? row.benchmark_path : [row.benchmark_label];
    let parentId = "root";
    const rootKey = path[0] ?? row.benchmark_id;

    for (let index = 0; index < path.length; index += 1) {
      const segment = path[index];
      const nodeId = `${parentId}/${segment}`;
      if (!nodeMap.has(nodeId)) {
        nodeMap.set(nodeId, {
          id: nodeId,
          parent: parentId,
          label: segment,
          value: 0,
          depth: index + 1,
          rootKey
        });
      }
      parentId = nodeId;
    }

    const leafId = `${parentId}#${row.benchmark_id}`;
    nodeMap.set(leafId, {
      id: leafId,
      parent: parentId,
      label: row.benchmark_label,
      value: 1,
      depth: path.length + 1,
      rootKey
    });
  }

  const nodes = Array.from(nodeMap.values());
  const valueById = new Map(nodes.map((node) => [node.id, node.value]));

  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index];
    if (!node.parent) continue;
    valueById.set(node.parent, (valueById.get(node.parent) ?? 0) + (valueById.get(node.id) ?? 0));
  }

  return nodes.map((node) => ({
    ...node,
    value: valueById.get(node.id) ?? node.value
  }));
}

function mixHexColors(left: string, right: string, ratio: number): string {
  const normalizedRatio = Math.min(1, Math.max(0, ratio));
  const normalizeHex = (value: string) => {
    const hex = value.startsWith("#") ? value.slice(1) : value;
    return hex.length === 3
      ? hex.split("").map((entry) => `${entry}${entry}`).join("")
      : hex;
  };
  const leftHex = normalizeHex(left);
  const rightHex = normalizeHex(right);
  if (leftHex.length !== 6 || rightHex.length !== 6) return left;

  const mixChannel = (index: number) => {
    const leftChannel = Number.parseInt(leftHex.slice(index, index + 2), 16);
    const rightChannel = Number.parseInt(rightHex.slice(index, index + 2), 16);
    const mixed = Math.round(leftChannel + (rightChannel - leftChannel) * normalizedRatio);
    return mixed.toString(16).padStart(2, "0");
  };

  return `#${mixChannel(0)}${mixChannel(2)}${mixChannel(4)}`;
}

function buildIcicleColors(nodes: IcicleNode[], theme: ThemeMode): string[] {
  const rootOrder = new Map<string, number>();

  for (const node of nodes) {
    if (node.depth !== 1 || rootOrder.has(node.rootKey)) continue;
    rootOrder.set(node.rootKey, rootOrder.size);
  }

  return nodes.map((node) => {
    if (node.depth === 0) return theme === "dark" ? "#3f3f46" : "#44403c";
    const rootIndex = rootOrder.get(node.rootKey) ?? 0;
    const baseColor = colorForBenchmark(rootIndex);
    const darkenBase = theme === "dark" ? 0.24 : 0.12;
    const darkenStep = theme === "dark" ? 0.1 : 0.06;
    const darkenCap = theme === "dark" ? 0.52 : 0.3;
    const darkenRatio = Math.min(darkenBase + Math.max(node.depth - 1, 0) * darkenStep, darkenCap);
    return mixHexColors(baseColor, "#09090b", darkenRatio);
  });
}

export function BenchmarkKeysPage(props: BenchmarkKeysPageProps) {
  const { rows, plotTheme, theme } = props;
  const nodes = buildIcicleNodes(rows);
  const hasKeys = rows.length > 0;
  const colors = buildIcicleColors(nodes, theme);

  return (
    <>
      <header className="topbar page-topbar">
        <div className="breadcrumb">Benchmarking <span>›</span> Benchmark Keys</div>
        <div className="page-topbar-row">
          <div className="page-topbar-title">
            <h1>Benchmark Keys</h1>
          </div>
          <div className="topbar-actions page-topbar-actions page-topbar-actions-empty" aria-hidden="true" />
        </div>
        <p>Explore the benchmark key hierarchy as an icicle chart built from the loaded dataset.</p>
      </header>
      <section>
        {hasKeys ? (
          <div className="plot-shell benchmark-keys-plot-shell">
            <Plot
              useResizeHandler
              style={{ width: "100%", height: "100%" }}
              data={[{
                type: "icicle",
                ids: nodes.map((node) => node.id),
                labels: nodes.map((node) => node.label),
                parents: nodes.map((node) => node.parent),
                values: nodes.map((node) => node.value),
                branchvalues: "total",
                tiling: { packing: "squarify" },
                hovertemplate: "%{label}<br>%{value} benchmark keys<extra></extra>",
                textinfo: "label+value",
                textfont: { color: "#fafaf9", size: 14 },
                pathbar: { textfont: { color: plotTheme.axis } },
                marker: {
                  colors,
                  line: { color: plotTheme.grid, width: 1 }
                }
              }]}
              layout={{
                autosize: true,
                margin: { t: 0, r: 0, b: 0, l: 0 },
                paper_bgcolor: plotTheme.paper,
                plot_bgcolor: plotTheme.plot,
                font: { color: plotTheme.axis }
              }}
              config={{ displayModeBar: false, responsive: true }}
            />
          </div>
        ) : (
          <div className="plot-empty-state benchmark-keys-empty-state">
            <strong>No benchmark keys available</strong>
            <p>Load a benchmark database with rows to render the hierarchy.</p>
          </div>
        )}
      </section>
    </>
  );
}
