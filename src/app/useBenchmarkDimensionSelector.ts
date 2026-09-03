import { useEffect, useMemo } from "react";
import { buildDimensionConfigurations, buildDimensionDefinitions, buildDimensionSelectionIndex, resolveDimensionSelection, type DimensionConfiguration, type DimensionDefinition, type DimensionValueSelection, type ResolvedDimensionSelection } from "../lib/dimension-selector";
import type { UISettings } from "../lib/dashboard-settings";
import type { LoadedBenchmarkDatabase } from "../lib/types";

export type BenchmarkDimensionSelection = ResolvedDimensionSelection & { configurations: DimensionConfiguration[]; configurationsByKey: ReadonlyMap<string, DimensionConfiguration>; dimensions: DimensionDefinition[]; };

const Empty_Dimension_Selection: BenchmarkDimensionSelection = { configurations: [], configurationsByKey: new Map(), dimensions: [], varyingDimensionKeys: [], varyingDimensions: [], varyingDimension: null, fixedValueSelections: [], valueSelections: [], validation: { isValid: false, varyingCount: 0, issues: ["Exactly one dimension must be Varying. Currently: 0."] }, configurationKeys: [], points: [], pointKeyByConfigurationKey: new Map() };

function sameValueSelections(left: readonly DimensionValueSelection[], right: readonly DimensionValueSelection[]): boolean {
  if (left.length !== right.length) return false;
  const rightByDimension = new Map(right.map((selection) => [selection.dimensionKey, selection.valueKeys]));
  return left.every((selection) => { const values = rightByDimension.get(selection.dimensionKey); return values !== undefined && selection.valueKeys.length === values.length && selection.valueKeys.every((value, index) => value === values[index]); });
}

function persistedValueSelections(current: readonly DimensionValueSelection[], resolved: ResolvedDimensionSelection, dimensions: readonly DimensionDefinition[]): DimensionValueSelection[] {
  const dimensionKeys = new Set(dimensions.map((dimension) => dimension.key));
  const selections = new Map(current.filter((selection) => dimensionKeys.has(selection.dimensionKey)).map((selection) => [selection.dimensionKey, selection.valueKeys]));
  for (const selection of resolved.valueSelections) selections.set(selection.dimensionKey, selection.valueKeys);
  return dimensions.flatMap((dimension) => selections.has(dimension.key) ? [{ dimensionKey: dimension.key, valueKeys: selections.get(dimension.key)! }] : []);
}

export function useBenchmarkDimensionSelector(database: LoadedBenchmarkDatabase | null, settings: UISettings, setSetting: <K extends keyof UISettings>(key: K, value: UISettings[K]) => void): BenchmarkDimensionSelection {
  const configurations = useMemo(() => database ? buildDimensionConfigurations(database) : [], [database]);
  const configurationsByKey = useMemo(() => new Map(configurations.map((configuration) => [configuration.key, configuration])), [configurations]);
  const dimensions = useMemo(() => buildDimensionDefinitions(configurations), [configurations]);
  const dimensionIndex = useMemo(() => buildDimensionSelectionIndex(configurations, dimensions), [configurations, dimensions]);
  const resolved = useMemo(() => database ? resolveDimensionSelection({ index: dimensionIndex, varyingDimensionKeys: settings.varyingDimensionKeys, valueSelections: settings.dimensionValueSelections }) : Empty_Dimension_Selection, [database, dimensionIndex, settings.dimensionValueSelections, settings.varyingDimensionKeys]);

  useEffect(() => {
    if (settings.varyingDimensionKeys === null && resolved.varyingDimensionKeys.length) setSetting("varyingDimensionKeys", resolved.varyingDimensionKeys);
  }, [resolved.varyingDimensionKeys, setSetting, settings.varyingDimensionKeys]);

  useEffect(() => {
    if (!database) return;
    const next = persistedValueSelections(settings.dimensionValueSelections, resolved, dimensions);
    if (!sameValueSelections(settings.dimensionValueSelections, next)) setSetting("dimensionValueSelections", next);
  }, [database, dimensions, resolved, setSetting, settings.dimensionValueSelections]);

  return database ? { ...resolved, configurations, configurationsByKey, dimensions } : Empty_Dimension_Selection;
}
