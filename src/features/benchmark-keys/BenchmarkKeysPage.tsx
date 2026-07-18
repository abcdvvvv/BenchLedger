import Plot from "../benchmarks/components/Plot";
import { EmptyState } from "../../components/common/EmptyState";
import { PageHeader } from "../../components/common/PageHeader";
import { colorForBenchmark, type PlotTheme } from "../../lib/dashboard-plotting";
import type { ThemeMode } from "../../lib/dashboard-settings";
import type { BenchmarkDefinition } from "../../lib/types";

export type BenchmarkKeysPageProps = {
  benchmarks: BenchmarkDefinition[];
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

function buildIcicleNodes(benchmarks: BenchmarkDefinition[]): IcicleNode[] {
  const nodeMap = new Map<string, IcicleNode>();

  nodeMap.set("root", {
    id: "root",
    parent: "",
    label: "Benchmark Keys",
    value: 0,
    depth: 0,
    rootKey: "root"
  });

  for (const benchmark of benchmarks) {
    const path = benchmark.path.length ? benchmark.path : [benchmark.label];
    let parentId = "root";
    const rootKey = path[0] ?? benchmark.id;

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

    const leafId = `${parentId}#${benchmark.id}`;
    nodeMap.set(leafId, {
      id: leafId,
      parent: parentId,
      label: benchmark.label,
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

  return nodes.map((node) => ({ ...node, value: valueById.get(node.id) ?? node.value }));
}

function mixHexColors(left: string, right: string, ratio: number): string {
  const normalizedRatio = Math.min(1, Math.max(0, ratio));
  const normalizeHex = (value: string) => {
    const hex = value.startsWith("#") ? value.slice(1) : value;
    return hex.length === 3 ? hex.split("").map((entry) => `${entry}${entry}`).join("") : hex;
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
  const { benchmarks, plotTheme, theme } = props;
  const nodes = buildIcicleNodes(benchmarks);
  const hasKeys = benchmarks.length > 0;
  const colors = buildIcicleColors(nodes, theme);

  return (
    <>
      <PageHeader
        eyebrow="Benchmarking › Benchmark Keys"
        title="Benchmark Keys"
        description="Explore the benchmark key hierarchy as an icicle chart built from the loaded dataset."
      />
      {hasKeys ? (
        <div className="h-[72vh] min-h-[32rem] overflow-hidden">
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
              paper_bgcolor: "rgba(0, 0, 0, 0)",
              plot_bgcolor: "rgba(0, 0, 0, 0)",
              font: { color: plotTheme.axis }
            }}
            config={{ displayModeBar: false, responsive: true }}
          />
        </div>
      ) : (
        <EmptyState className="surface-empty pad-empty flex min-h-[32rem] flex-col items-center justify-center text-center" title="No benchmark keys available" description="Load a benchmark database with rows to render the hierarchy." />
      )}
    </>
  );
}
