import { useCallback, useEffect, useMemo } from "react";
import type { BenchmarkDatasetState } from "../../app/useBenchmarkDatasetState";
import { trendDisplayUnitContext } from "../../lib/dashboard-plotting";
import { comparisonResultIncompatibility } from "../../lib/comparison-results";
import { formatPercent, percentageChange } from "../../lib/format";
import { disambiguatedLabels } from "../../lib/selection-options";
import {
  aggregateRowKey,
  allLeafPathIds,
  buildComparisonConfigurations,
  buildIdentityFieldTree,
  entityIdForCategory,
  entityLabelForCategory,
  formatIdentityProjection,
  identityForCategory,
  identityPathLabel,
  matchComparisonConfigurations,
  summarizeVariableFields,
  type ComparisonCategory,
  type IdentityFieldNode
} from "../../lib/orthogonal-comparison";
import type { BenchmarkAggregateRow } from "../../lib/types";
import { ComparePage, type ComparePageProps, type ComparisonTableRow } from "./ComparePage";

export type CompareFeatureProps = {
  state: BenchmarkDatasetState;
};

const Categories: ComparisonCategory[] = ["code", "hardware", "software"];
const Empty_Field_Tree: IdentityFieldNode[] = [];
const Empty_Variable_Path_Ids: string[] = [];
const Empty_Field_Node_Map = new Map<string, IdentityFieldNode>();

function treeNodeMap(nodes: readonly IdentityFieldNode[]): Map<string, IdentityFieldNode> {
  const nodeMap = new Map<string, IdentityFieldNode>();
  function visit(node: IdentityFieldNode) {
    nodeMap.set(node.id, node);
    for (const child of node.children) visit(child);
  }
  for (const node of nodes) visit(node);
  return nodeMap;
}

function configurationLabel(configuration: ReturnType<typeof buildComparisonConfigurations>[number]): string {
  return `${configuration.codeLabel} · ${configuration.hardwareLabel} · ${configuration.softwareLabel}`;
}

function comparisonResultKey(
  configurationKey: string,
  benchmarkKey: string,
  metricKey: string
): string {
  return JSON.stringify([configurationKey, benchmarkKey, metricKey]);
}

export function CompareFeature({ state }: CompareFeatureProps) {
  const { dataset, aggregateRows, settings, setSetting } = state;
  const configurations = useMemo(
    () => dataset ? buildComparisonConfigurations(dataset) : [],
    [dataset]
  );
  const fieldTrees = useMemo(() => ({
    code: buildIdentityFieldTree(configurations, "code"),
    hardware: buildIdentityFieldTree(configurations, "hardware"),
    software: buildIdentityFieldTree(configurations, "software")
  }), [configurations]);
  const leafPathIdsByCategory = useMemo(() => ({
    code: allLeafPathIds(fieldTrees.code),
    hardware: allLeafPathIds(fieldTrees.hardware),
    software: allLeafPathIds(fieldTrees.software)
  }), [fieldTrees]);

  const baselineConfiguration = configurations.find(
    (configuration) => configuration.key === settings.compareBaselineConfigurationKey
  ) ?? configurations[0] ?? null;
  const baselineKey = baselineConfiguration?.key ?? "";
  const changeBaseline = useCallback((nextKey: string) => {
    setSetting("compareBaselineConfigurationKey", nextKey);
  }, [setSetting]);
  const baselineOptions = useMemo(() => {
    const labels = disambiguatedLabels(
      configurations,
      configurationLabel,
      (configuration) => configuration.key
    );
    return configurations.map((configuration, index) => ({
      value: configuration.key,
      label: labels[index]
    }));
  }, [configurations]);

  useEffect(() => {
    if (baselineKey && settings.compareBaselineConfigurationKey !== baselineKey) {
      changeBaseline(baselineKey);
    }
  }, [baselineKey, changeBaseline, settings.compareBaselineConfigurationKey]);

  const variableCategory = settings.compareVariableCategory;
  const activeFieldTree = variableCategory ? fieldTrees[variableCategory] : Empty_Field_Tree;
  const validVariablePathIds = useMemo(() => {
    if (!variableCategory) return Empty_Variable_Path_Ids;
    const validPaths = new Set(leafPathIdsByCategory[variableCategory]);
    return settings.compareVariableFieldPathIds.filter((pathId) => validPaths.has(pathId));
  }, [leafPathIdsByCategory, settings.compareVariableFieldPathIds, variableCategory]);

  useEffect(() => {
    if (
      validVariablePathIds.length !== settings.compareVariableFieldPathIds.length ||
      validVariablePathIds.some((pathId, index) => pathId !== settings.compareVariableFieldPathIds[index])
    ) {
      setSetting("compareVariableFieldPathIds", validVariablePathIds);
    }
    if (variableCategory && validVariablePathIds.length === 0) {
      setSetting("compareVariableCategory", "");
    }
  }, [setSetting, settings.compareVariableFieldPathIds, validVariablePathIds, variableCategory]);

  const matches = useMemo(() => matchComparisonConfigurations({
    configurations,
    baselineKey,
    variableCategory,
    variableFieldPathIds: validVariablePathIds,
    fieldTree: activeFieldTree
  }), [activeFieldTree, baselineKey, configurations, validVariablePathIds, variableCategory]);

  const aggregateRowsByResultKey = useMemo(() => new Map(
    aggregateRows.map((row) => [
      comparisonResultKey(row.configuration_key, row.benchmark_key, aggregateRowKey(row)),
      row
    ])
  ), [aggregateRows]);
  const baselineRows = useMemo(
    () => aggregateRows.filter((row) => row.configuration_key === baselineKey),
    [aggregateRows, baselineKey]
  );
  const benchmarkKeys = useMemo(
    () => Array.from(new Set(baselineRows.map((row) => row.benchmark_key))).sort((left, right) => {
      const leftLabel = dataset?.benchmarksByKey.get(left)?.label ?? left;
      const rightLabel = dataset?.benchmarksByKey.get(right)?.label ?? right;
      return leftLabel.localeCompare(rightLabel) || left.localeCompare(right);
    }),
    [baselineRows, dataset]
  );
  const benchmarkOptions = useMemo(() => {
    const labels = disambiguatedLabels(
      benchmarkKeys,
      (key) => dataset?.benchmarksByKey.get(key)?.label ?? key,
      (key) => key
    );
    return benchmarkKeys.map((value, index) => ({ value, label: labels[index] }));
  }, [benchmarkKeys, dataset]);
  const selectedBenchmarkKey = benchmarkKeys.includes(settings.compareBenchmarkKey)
    ? settings.compareBenchmarkKey
    : benchmarkKeys[0] ?? "";

  useEffect(() => {
    if (selectedBenchmarkKey !== settings.compareBenchmarkKey) {
      setSetting("compareBenchmarkKey", selectedBenchmarkKey);
    }
  }, [selectedBenchmarkKey, setSetting, settings.compareBenchmarkKey]);

  const metricRows = useMemo(
    () => baselineRows.filter((row) => row.benchmark_key === selectedBenchmarkKey),
    [baselineRows, selectedBenchmarkKey]
  );
  const metricOptions = useMemo(() => {
    const rowsByKey = new Map<string, BenchmarkAggregateRow>();
    for (const row of metricRows) rowsByKey.set(aggregateRowKey(row), row);
    return Array.from(rowsByKey.entries())
      .sort((left, right) => {
        const leftPrimary = left[1].metric_name === "time" && left[1].statistic === "median" ? 0 : 1;
        const rightPrimary = right[1].metric_name === "time" && right[1].statistic === "median" ? 0 : 1;
        return leftPrimary - rightPrimary || left[0].localeCompare(right[0]);
      })
      .map(([value, row]) => ({
        value,
        label: `${row.metric_name} · ${row.statistic}${row.unit ? ` · ${row.unit}` : ""}`
      }));
  }, [metricRows]);
  const selectedMetricKey = metricOptions.some((option) => option.value === settings.compareMetricKey)
    ? settings.compareMetricKey
    : metricOptions[0]?.value ?? "";

  useEffect(() => {
    if (selectedMetricKey !== settings.compareMetricKey) {
      setSetting("compareMetricKey", selectedMetricKey);
    }
  }, [selectedMetricKey, setSetting, settings.compareMetricKey]);

  const baselineMetricRow = metricRows.find((row) => aggregateRowKey(row) === selectedMetricKey) ?? null;
  const selectedRows = useMemo(() => matches.map((match) => {
    const candidate = aggregateRowsByResultKey.get(comparisonResultKey(
      match.configuration.key,
      selectedBenchmarkKey,
      selectedMetricKey
    )) ?? null;
    const incompatibility = comparisonResultIncompatibility(baselineMetricRow, candidate);
    return {
      match,
      candidate,
      aggregate: incompatibility ? null : candidate,
      incompatibility
    };
  }), [aggregateRowsByResultKey, baselineMetricRow, matches, selectedBenchmarkKey, selectedMetricKey]);
  const displayUnit = useMemo(
    () => trendDisplayUnitContext(
      selectedRows.flatMap(({ aggregate }) => aggregate ? [{ value: aggregate.value, unit: aggregate.unit }] : [])
    ),
    [selectedRows]
  );
  const baselineAggregate = selectedRows.find(({ match }) => match.configuration.key === baselineKey)?.aggregate ?? null;
  const baselineDisplayValue = baselineAggregate
    ? displayUnit.scaleValue(baselineAggregate.value, baselineAggregate.unit)
    : Number.NaN;
  const fieldNodes = useMemo(
    () => variableCategory ? treeNodeMap(activeFieldTree) : Empty_Field_Node_Map,
    [activeFieldTree, variableCategory]
  );
  const variablePathIdSet = useMemo(() => new Set(validVariablePathIds), [validVariablePathIds]);
  const variableSelections = useMemo(
    () => variableCategory ? summarizeVariableFields(activeFieldTree, variablePathIdSet) : [],
    [activeFieldTree, variableCategory, variablePathIdSet]
  );
  const baselineIdentity = variableCategory && baselineConfiguration
    ? identityForCategory(baselineConfiguration, variableCategory)
    : {};
  const matchedEntityLabels = disambiguatedLabels(
    matches,
    (match) => variableCategory
      ? entityLabelForCategory(match.configuration, variableCategory)
      : configurationLabel(match.configuration),
    (match) => variableCategory
      ? entityIdForCategory(match.configuration, variableCategory).slice(0, 8)
      : match.configuration.codeStateId.slice(0, 8)
  );

  const comparisonRows: ComparisonTableRow[] = selectedRows.map(({ match, candidate, aggregate, incompatibility }, index) => {
    const scaledValue = aggregate ? displayUnit.scaleValue(aggregate.value, aggregate.unit) : null;
    const delta = scaledValue === null ? Number.NaN : percentageChange(scaledValue, baselineDisplayValue);
    const identity = variableCategory ? identityForCategory(match.configuration, variableCategory) : {};
    return {
      configurationKey: match.configuration.key,
      label: matchedEntityLabels[index],
      codeDate: match.configuration.codeDate,
      isBaseline: match.configuration.key === baselineKey,
      value: scaledValue,
      displayValue: aggregate
        ? displayUnit.formatValue(aggregate.value, aggregate.unit)
        : incompatibility,
      delta,
      displayDelta: match.configuration.key === baselineKey ? "—" : formatPercent(delta),
      runCount: candidate?.run_count ?? 0,
      better: baselineAggregate?.better ?? "neutral",
      changedFields: match.changedFieldPathIds.map((pathId) => {
        const node = fieldNodes.get(pathId);
        const baselineValue = node?.children.length
          ? "Baseline composition"
          : formatIdentityProjection(baselineIdentity, pathId);
        const candidateValue = node?.children.length
          ? "Different composition"
          : formatIdentityProjection(identity, pathId);
        return {
          pathId,
          label: node ? identityPathLabel(node.path) : pathId,
          value: `${baselineValue} → ${candidateValue}`
        };
      })
    };
  });
  const orderedComparisonRows = variableCategory === "code"
    ? [...comparisonRows].sort((left, right) =>
      left.codeDate.localeCompare(right.codeDate) || left.label.localeCompare(right.label)
    )
    : comparisonRows;
  const comparableCandidateCount = orderedComparisonRows.filter((row) => !row.isBaseline && row.value !== null).length;
  const unavailableCandidateCount = orderedComparisonRows.filter((row) => !row.isBaseline && row.value === null).length;

  function setNodeFixed(category: ComparisonCategory, node: IdentityFieldNode, fixed: boolean) {
    if (variableCategory && variableCategory !== category) return;
    const next = new Set(variableCategory === category ? validVariablePathIds : []);
    for (const pathId of node.leafPathIds) {
      if (fixed) next.delete(pathId);
      else next.add(pathId);
    }
    const nextPaths = Array.from(next).sort();
    setSetting("compareVariableFieldPathIds", nextPaths);
    setSetting("compareVariableCategory", nextPaths.length ? category : "");
  }

  const cardModels: ComparePageProps["categories"] = Categories.map((category) => {
    const leafCount = leafPathIdsByCategory[category].length;
    const categoryVariablePaths = variableCategory === category ? validVariablePathIds : [];
    return {
      category,
      title: category === "code" ? "Code" : category === "hardware" ? "Hardware" : "Software",
      nodes: fieldTrees[category],
      identity: baselineConfiguration ? identityForCategory(baselineConfiguration, category) : {},
      locked: Boolean(variableCategory && variableCategory !== category),
      active: variableCategory === category,
      variablePathIds: categoryVariablePaths,
      fixedFieldCount: leafCount - categoryVariablePaths.length,
      totalFieldCount: leafCount,
      variableFieldCount: categoryVariablePaths.length,
      onNodeFixedChange: (node, fixed) => setNodeFixed(category, node, fixed)
    };
  });

  const totalFieldCount = Categories.reduce(
    (count, category) => count + leafPathIdsByCategory[category].length,
    0
  );

  return (
    <ComparePage
      hasDataset={Boolean(dataset && configurations.length)}
      baseline={{
        value: baselineKey,
        options: baselineOptions,
        onChange: changeBaseline
      }}
      categories={cardModels}
      summary={{
        variableCategory,
        variableFieldCount: validVariablePathIds.length,
        variableSelectionLabels: variableSelections.map((selection) => selection.label),
        fixedFieldCount: totalFieldCount - validVariablePathIds.length,
        matchedConfigurationCount: matches.length
      }}
      selection={{
        benchmarkKey: selectedBenchmarkKey,
        benchmarkOptions,
        onBenchmarkKeyChange: (value) => {
          setSetting("compareBenchmarkKey", value);
          setSetting("compareMetricKey", "");
        },
        metricKey: selectedMetricKey,
        metricOptions,
        onMetricKeyChange: (value) => setSetting("compareMetricKey", value)
      }}
      results={{
        rows: orderedComparisonRows,
        variableCategory,
        metricLabel: metricOptions.find((option) => option.value === selectedMetricKey)?.label ?? "",
        displayUnit: displayUnit.unit,
        plotTheme: state.plotTheme,
        comparableCandidateCount,
        unavailableCandidateCount
      }}
    />
  );
}
