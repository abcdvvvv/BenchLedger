import { formatBytes } from "./format";
import type {
  BenchmarkCodeStateIdentity,
  BenchmarkHardwareEnvironmentIdentity,
  BenchmarkSoftwareEnvironmentIdentity,
  LoadedBenchmarkDatabase
} from "./types";
import { hasOwn, isRecord } from "./object";

type DimensionCategory = "code" | "hardware" | "software";
type IdentityPathToken = string | null;

type IdentityFieldNode = {
  id: string;
  path: IdentityPathToken[];
  children: IdentityFieldNode[];
  collection: boolean;
};

type DimensionConfiguration = {
  key: string;
  codeLabel: string;
  codeDate: string;
  hardwareLabel: string;
  softwareLabel: string;
  codeIdentity: BenchmarkCodeStateIdentity;
  hardwareIdentity: BenchmarkHardwareEnvironmentIdentity;
  softwareIdentity: BenchmarkSoftwareEnvironmentIdentity;
};

const Missing_Value = Symbol("missing identity value");
const Identity_Projection_Key_Cache = new WeakMap<object, Map<string, string>>();

type MissingValue = typeof Missing_Value;
type IdentityValue = unknown | MissingValue;

// Hardware display order also defines its one-way filtering precedence in Dimension Selector.
const Dimension_Field_Order: Record<string, number> = {
  source: 0,
  architecture: 0,
  platform: 0,
  cpu: 1,
  runtime: 1,
  memory: 2,
  execution: 2,
  gpu: 3,
  benchmark: 3,
  gpu_interface: 4,
  gpu_runtime: 5,
  gpu_drivers: 6,
  math_libraries: 7,
  dependencies: 8,
  blas: 0,
  libraries: 0,
  kind: 0,
  vendor: 0,
  name: 0,
  implementation: 0,
  backend: 0,
  revision: 1,
  model: 1,
  version: 1,
  interface: 1,
  format: 1,
  diff_digest: 2,
  digest: 2,
  microarchitecture: 2,
  variant: 2,
  physical_cores: 2,
  logical_threads: 3,
  device_count: 3,
  packages: 4,
  numa_nodes: 5,
  total_bytes: 0,
  memory_bytes: 2,
  count: 3
};

type DimensionFilterChain = { category: DimensionCategory; paths: readonly (readonly IdentityPathToken[])[]; };

// Only explicit parent-child identity relationships belong here. Unrelated fields never filter each other by co-occurrence.
const Dimension_Filter_Chains: readonly DimensionFilterChain[] = [
  { category: "code", paths: [["source", "kind"], ["source", "revision"], ["source", "diff_digest"]] },
  { category: "software", paths: [["platform", "os", "name"], ["platform", "os", "version"]] },
  { category: "software", paths: [["platform", "kernel", "name"], ["platform", "kernel", "version"]] },
  { category: "software", paths: [["runtime", "name"], ["runtime", "version"]] },
  { category: "software", paths: [["gpu", "interface", "name"], ["gpu", "interface", "version"]] },
  { category: "software", paths: [["gpu_runtime", "backend"], ["gpu_runtime", "runtime", "name"], ["gpu_runtime", "runtime", "version"]] },
  { category: "software", paths: [["benchmark", "framework", "name"], ["benchmark", "framework", "version"]] },
  { category: "software", paths: [["dependencies", "kind"], ["dependencies", "format"], ["dependencies", "digest"]] }
];

const Field_Labels: Record<string, string> = {
  architecture: "Architecture",
  backend: "Backend",
  benchmark: "Benchmark",
  blas: "BLAS",
  count: "Count",
  cpu: "CPU",
  dependencies: "Dependencies",
  diff_digest: "Diff digest",
  digest: "Digest",
  device_count: "Device count",
  execution: "Execution",
  framework: "Framework",
  format: "Format",
  gpu: "GPU",
  gpu_drivers: "GPU drivers",
  gpu_interface: "GPU interface",
  gpu_runtime: "GPU runtime",
  kernel: "Kernel",
  kind: "Kind",
  implementation: "Implementation",
  interface: "Interface",
  libraries: "Libraries",
  logical_threads: "Logical threads",
  memory: "Memory",
  memory_bytes: "Memory",
  math_libraries: "Math libraries",
  microarchitecture: "Microarchitecture",
  model: "Model",
  name: "Name",
  numa_nodes: "NUMA nodes",
  os: "OS",
  packages: "Packages",
  physical_cores: "Physical cores",
  platform: "Platform",
  processes: "Processes",
  revision: "Revision",
  runtime: "Runtime",
  source: "Source",
  threads: "Threads",
  total_bytes: "Total capacity",
  type: "Type",
  variant: "Variant",
  vendor: "Vendor",
  version: "Version"
};

function fieldLabel(key: string): string {
  const known = Field_Labels[key];
  if (known) return known;
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function compareFieldKeys(left: string, right: string): number {
  const leftOrder = Dimension_Field_Order[left] ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = Dimension_Field_Order[right] ?? Number.MAX_SAFE_INTEGER;
  return leftOrder - rightOrder || left.localeCompare(right);
}

function identityPathId(path: readonly IdentityPathToken[]): string {
  return JSON.stringify(path);
}

function identityPathLabel(path: readonly IdentityPathToken[]): string {
  return path
    .filter((token): token is string => token !== null)
    .map(fieldLabel)
    .join(" › ");
}

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value
      .map(stableJsonValue)
      .sort((left, right) => serializedJsonValue(left).localeCompare(serializedJsonValue(right)));
  }
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableJsonValue(value[key])])
  );
}

function serializedJsonValue(value: unknown): string {
  const serialized = JSON.stringify(value);
  return serialized === undefined ? String(value) : serialized;
}

function stableJson(value: unknown): string {
  return serializedJsonValue(stableJsonValue(value));
}

function identityValueSortKey(value: IdentityValue): string {
  return value === Missing_Value ? "missing" : `value:${stableJson(value)}`;
}

function projectValue(value: IdentityValue, path: readonly IdentityPathToken[], offset = 0): IdentityValue {
  if (value === Missing_Value) return Missing_Value;
  if (offset >= path.length) return value;

  const token = path[offset];
  if (token === null) {
    if (!Array.isArray(value)) return Missing_Value;
    return value
      .map((entry) => projectValue(entry, path, offset + 1))
      .sort((left, right) => identityValueSortKey(left).localeCompare(identityValueSortKey(right)));
  }

  if (!isRecord(value) || !hasOwn(value, token)) return Missing_Value;
  return projectValue(value[token], path, offset + 1);
}

function projectValueKey(value: IdentityValue, path: readonly IdentityPathToken[], offset = 0): string {
  if (value === Missing_Value) return "missing";
  if (offset >= path.length) return `value:${stableJson(value)}`;

  const token = path[offset];
  if (token === null) {
    if (!Array.isArray(value)) return "missing";
    const values = value
      .map((entry) => projectValueKey(entry, path, offset + 1))
      .sort();
    return `array:${JSON.stringify(values)}`;
  }

  if (!isRecord(value) || !hasOwn(value, token)) return "missing";
  return projectValueKey(value[token], path, offset + 1);
}

function valuesForObjectKey(values: readonly IdentityValue[], key: string): IdentityValue[] {
  return values.map((value) => (
    value !== Missing_Value && isRecord(value) && hasOwn(value, key)
      ? value[key]
      : Missing_Value
  ));
}

function buildFieldNodes(values: readonly IdentityValue[], parentPath: readonly IdentityPathToken[]): IdentityFieldNode[] {
  const keys = new Set<string>();
  for (const value of values) {
    if (value !== Missing_Value && isRecord(value)) {
      for (const key of Object.keys(value)) keys.add(key);
    }
  }

  return Array.from(keys)
    .sort(compareFieldKeys)
    .map((key) => {
      const path = [...parentPath, key];
      const childValues = valuesForObjectKey(values, key);
      const presentValues = childValues.filter((value) => value !== Missing_Value);
      const allObjects = presentValues.length > 0 && presentValues.every(isRecord);
      const allObjectArrays = presentValues.length > 0 && presentValues.every((value) => (
        Array.isArray(value) && value.every(isRecord)
      ));

      let children: IdentityFieldNode[] = [];
      if (allObjects) {
        children = buildFieldNodes(childValues, path);
      } else if (allObjectArrays) {
        const elementValues = childValues.flatMap((value): IdentityValue[] => {
          if (value === Missing_Value) return [Missing_Value];
          if (!Array.isArray(value) || value.length === 0) return [];
          return value;
        });
        children = buildFieldNodes(elementValues, [...path, null]);
      }

      if (children.length === 0) {
        const id = identityPathId(path);
        return {
          id,
          path,
          children: [],
          collection: false
        };
      }

      return {
        id: identityPathId(path),
        path,
        children,
        collection: allObjectArrays
      };
    });
}

function buildIdentityFieldTree(
  configurations: readonly DimensionConfiguration[],
  category: DimensionCategory
): IdentityFieldNode[] {
  return buildFieldNodes(
    configurations.map((configuration) => identityForCategory(configuration, category)),
    []
  );
}

function identityForCategory(
  configuration: DimensionConfiguration,
  category: DimensionCategory
): Record<string, unknown> {
  if (category === "code") return configuration.codeIdentity;
  if (category === "hardware") return configuration.hardwareIdentity;
  return configuration.softwareIdentity;
}

export function buildDimensionConfigurations(database: LoadedBenchmarkDatabase): DimensionConfiguration[] {
  const configurations = database.configurations.flatMap((ids): DimensionConfiguration[] => {
    const codeState = database.codeStatesById.get(ids.code_state_id), hardware = database.hardwareEnvironmentsById.get(ids.hardware_environment_id), software = database.softwareEnvironmentsById.get(ids.software_environment_id);
    if (!codeState || !hardware || !software) return [];
    return [{ key: JSON.stringify([ids.code_state_id, ids.hardware_environment_id, ids.software_environment_id]), codeLabel: codeState.label || codeState.id, codeDate: codeState.code_date, hardwareLabel: hardware.label || hardware.id, softwareLabel: software.label || software.id, codeIdentity: codeState.identity, hardwareIdentity: hardware.identity, softwareIdentity: software.identity }];
  });
  return configurations.sort((left, right) => {
    const dateOrder = right.codeDate.localeCompare(left.codeDate);
    if (dateOrder !== 0) return dateOrder;
    return left.codeLabel.localeCompare(right.codeLabel) ||
      left.hardwareLabel.localeCompare(right.hardwareLabel) ||
      left.softwareLabel.localeCompare(right.softwareLabel) ||
      left.key.localeCompare(right.key);
  });
}

function identityProjectionKey(identity: Record<string, unknown>, pathId: string, path: readonly IdentityPathToken[]): string {
  let identityCache = Identity_Projection_Key_Cache.get(identity);
  if (!identityCache) {
    identityCache = new Map<string, string>();
    Identity_Projection_Key_Cache.set(identity, identityCache);
  }
  const cached = identityCache.get(pathId);
  if (cached !== undefined) return cached;
  const key = projectValueKey(identity, path);
  identityCache.set(pathId, key);
  return key;
}

function formatProjectionValue(value: IdentityValue, finalToken?: string): string {
  if (value === Missing_Value) return "Not recorded";
  if (value === null) return "null";
  if (typeof value === "string") return value || "Empty string";
  if (typeof value === "number") {
    return finalToken === "total_bytes" || finalToken === "memory_bytes"
      ? formatBytes(value)
      : String(value);
  }
  if (typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "None";
    return value.map((entry) => formatProjectionValue(entry, finalToken)).join(" · ");
  }
  return stableJson(value);
}

export type DimensionDefinition = { key: string; category: DimensionCategory; pathId: string; label: string; path: IdentityPathToken[]; };
export type DimensionValueSelection = { dimensionKey: string; valueKeys: string[]; };
export type DimensionValueOption = { key: string; label: string; configurationCount: number; };
export type FixedDimensionValueSelection = { dimension: DimensionDefinition; valueKeys: string[]; rememberedValueKeys: string[]; options: DimensionValueOption[]; };
export type DimensionSelectionPoint = { key: string; label: string; configurationKeys: string[]; };
type DimensionSelectionValidation = { isValid: boolean; issues: string[]; };
type IndexedDimensionCoordinate = { configuration: DimensionConfiguration; valueKeys: string[]; pointLabels: string[]; };
type DimensionSelectionIndex = { dimensions: readonly DimensionDefinition[]; dimensionIndexByKey: ReadonlyMap<string, number>; coordinates: readonly IndexedDimensionCoordinate[]; optionsByDimensionKey: ReadonlyMap<string, DimensionValueOption[]>; availableValueKeysByDimensionKey: ReadonlyMap<string, ReadonlySet<string>>; filterUpstreamIndicesByDimensionIndex: readonly (readonly number[])[]; filterResolutionOrder: readonly number[]; };
export type ResolvedDimensionSelection = { varyingDimensionKeys: string[]; varyingDimension: DimensionDefinition | null; fixedValueSelections: FixedDimensionValueSelection[]; validation: DimensionSelectionValidation; configurationKeys: string[]; points: DimensionSelectionPoint[]; pointKeyByConfigurationKey: ReadonlyMap<string, string>; };

export function dimensionKey(category: DimensionCategory, pathId: string): string { return JSON.stringify([category, pathId]); }

export function buildDimensionDefinitions(configurations: readonly DimensionConfiguration[]): DimensionDefinition[] {
  const dimensions: DimensionDefinition[] = [];
  for (const category of ["code", "hardware", "software"] as const) {
    const tree = buildIdentityFieldTree(configurations, category);
    const visit = (nodes: readonly IdentityFieldNode[]) => {
      for (const node of nodes) {
        if (node.children.length && !node.collection) { visit(node.children); continue; }
        dimensions.push({ key: dimensionKey(category, node.id), category, pathId: node.id, label: `${category === "code" ? "Code" : category === "hardware" ? "Hardware" : "Software"} / ${identityPathLabel(node.path).split(" › ").join(" / ")}`, path: node.path });
      }
    };
    visit(tree);
  }
  return dimensions;
}

function dimensionRawValue(configuration: DimensionConfiguration, dimension: DimensionDefinition): { key: string; label: string } {
  const identity = identityForCategory(configuration, dimension.category);
  const value = projectValue(identity, dimension.path);
  const finalToken = [...dimension.path].reverse().find((token): token is string => token !== null);
  return { key: identityProjectionKey(identity, dimension.pathId, dimension.path), label: formatProjectionValue(value, finalToken) };
}

function varyingDimensionLabel(configuration: DimensionConfiguration, dimension: DimensionDefinition, rawLabel: string): string {
  return dimension.category === "code" && dimension.path.length === 2 && dimension.path[0] === "source" && dimension.path[1] === "revision" ? configuration.codeLabel || rawLabel : rawLabel;
}

function buildDimensionFilterGraph(dimensions: readonly DimensionDefinition[]): { upstreamIndicesByDimensionIndex: readonly (readonly number[])[]; resolutionOrder: readonly number[] } {
  const upstream = dimensions.map(() => new Set<number>());
  const hardwareIndices = dimensions.flatMap((dimension, index) => dimension.category === "hardware" ? [index] : []);
  hardwareIndices.forEach((targetIndex, position) => { for (const upstreamIndex of hardwareIndices.slice(0, position)) upstream[targetIndex].add(upstreamIndex); });
  dimensions.forEach((dimension, targetIndex) => { if (dimension.category !== "hardware") for (const hardwareIndex of hardwareIndices) upstream[targetIndex].add(hardwareIndex); });
  const dimensionIndexByIdentityPath = new Map(dimensions.map((dimension, index) => [`${dimension.category}:${dimension.pathId}`, index]));
  for (const chain of Dimension_Filter_Chains) {
    const chainIndices = chain.paths.flatMap((path) => { const index = dimensionIndexByIdentityPath.get(`${chain.category}:${identityPathId(path)}`); return index === undefined ? [] : [index]; });
    chainIndices.forEach((targetIndex, position) => { for (const upstreamIndex of chainIndices.slice(0, position)) upstream[targetIndex].add(upstreamIndex); });
  }
  const upstreamIndicesByDimensionIndex = upstream.map((indices) => Array.from(indices).sort((left, right) => left - right));
  const downstream = dimensions.map(() => [] as number[]), indegree = upstreamIndicesByDimensionIndex.map((indices) => indices.length);
  upstreamIndicesByDimensionIndex.forEach((indices, targetIndex) => { for (const upstreamIndex of indices) downstream[upstreamIndex].push(targetIndex); });
  const ready = indegree.flatMap((degree, index) => degree === 0 ? [index] : []), resolutionOrder: number[] = [];
  while (ready.length) {
    ready.sort((left, right) => left - right);
    const index = ready.shift()!; resolutionOrder.push(index);
    for (const targetIndex of downstream[index]) if (--indegree[targetIndex] === 0) ready.push(targetIndex);
  }
  if (resolutionOrder.length !== dimensions.length) throw new Error("Dimension filtering dependencies must be acyclic.");
  return { upstreamIndicesByDimensionIndex, resolutionOrder };
}

export function buildDimensionSelectionIndex(configurations: readonly DimensionConfiguration[], dimensions: readonly DimensionDefinition[]): DimensionSelectionIndex {
  const dimensionIndexByKey = new Map(dimensions.map((dimension, index) => [dimension.key, index]));
  const optionCounts = dimensions.map(() => new Map<string, { label: string; count: number }>());
  const coordinates = configurations.map((configuration) => {
    const valueKeys: string[] = [], pointLabels: string[] = [];
    dimensions.forEach((dimension, index) => {
      const raw = dimensionRawValue(configuration, dimension); valueKeys.push(raw.key); pointLabels.push(varyingDimensionLabel(configuration, dimension, raw.label));
      const current = optionCounts[index].get(raw.key); if (current) current.count += 1; else optionCounts[index].set(raw.key, { label: raw.label, count: 1 });
    });
    return { configuration, valueKeys, pointLabels };
  });
  const optionsByDimensionKey = new Map<string, DimensionValueOption[]>(), availableValueKeysByDimensionKey = new Map<string, ReadonlySet<string>>();
  dimensions.forEach((dimension, index) => {
    const values = Array.from(optionCounts[index], ([key, value]) => ({ key, label: value.label, configurationCount: value.count })).sort((left, right) => left.label.localeCompare(right.label, undefined, { numeric: true }) || left.key.localeCompare(right.key));
    optionsByDimensionKey.set(dimension.key, values); availableValueKeysByDimensionKey.set(dimension.key, new Set(values.map((value) => value.key)));
  });
  const filterGraph = buildDimensionFilterGraph(dimensions);
  return { dimensions, dimensionIndexByKey, coordinates, optionsByDimensionKey, availableValueKeysByDimensionKey, filterUpstreamIndicesByDimensionIndex: filterGraph.upstreamIndicesByDimensionIndex, filterResolutionOrder: filterGraph.resolutionOrder };
}

function filteredDimensionOptions(index: DimensionSelectionIndex, dimension: DimensionDefinition, coordinates: readonly IndexedDimensionCoordinate[]): DimensionValueOption[] {
  const dimensionIndex = index.dimensionIndexByKey.get(dimension.key)!;
  const counts = new Map<string, number>();
  for (const coordinate of coordinates) { const key = coordinate.valueKeys[dimensionIndex]; counts.set(key, (counts.get(key) ?? 0) + 1); }
  return index.optionsByDimensionKey.get(dimension.key)!.flatMap((option) => { const configurationCount = counts.get(option.key) ?? 0; return configurationCount ? [{ ...option, configurationCount }] : []; });
}

function resolveFixedDimension(index: DimensionSelectionIndex, dimension: DimensionDefinition, options: DimensionValueOption[], selected: ReadonlyMap<string, string[]>): FixedDimensionValueSelection {
  const globalOptions = index.optionsByDimensionKey.get(dimension.key)!, globallyAvailable = index.availableValueKeysByDimensionKey.get(dimension.key)!, hasStoredSelection = selected.has(dimension.key);
  let rememberedValueKeys = (selected.get(dimension.key) ?? []).filter((key) => globallyAvailable.has(key));
  if (globalOptions.length === 1) rememberedValueKeys = [globalOptions[0].key]; else if (!hasStoredSelection && options[0]) rememberedValueKeys = [options[0].key];
  const available = new Set(options.map((option) => option.key));
  const valueKeys = options.length === 1 ? [options[0].key] : rememberedValueKeys.filter((key) => available.has(key));
  return { dimension, valueKeys, rememberedValueKeys, options };
}

function coordinatesForUpstreamSelections(index: DimensionSelectionIndex, upstreamIndices: readonly number[], fixedByDimensionKey: ReadonlyMap<string, FixedDimensionValueSelection>, cache: Map<string, readonly IndexedDimensionCoordinate[]>): readonly IndexedDimensionCoordinate[] {
  const filters = upstreamIndices.flatMap((dimensionIndex) => { const selection = fixedByDimensionKey.get(index.dimensions[dimensionIndex].key); return selection?.valueKeys.length ? [{ dimensionIndex, valueKeys: selection.valueKeys }] : []; });
  if (!filters.length) return index.coordinates;
  const cacheKey = JSON.stringify(filters.map((filter) => [filter.dimensionIndex, filter.valueKeys]));
  const cached = cache.get(cacheKey); if (cached) return cached;
  const membership = filters.map((filter) => ({ dimensionIndex: filter.dimensionIndex, values: new Set(filter.valueKeys) }));
  const coordinates = index.coordinates.filter((coordinate) => membership.every((filter) => filter.values.has(coordinate.valueKeys[filter.dimensionIndex])));
  cache.set(cacheKey, coordinates);
  return coordinates;
}

export function resolveDimensionSelection(options: { index: DimensionSelectionIndex; varyingDimensionKeys: readonly string[] | null; valueSelections: readonly DimensionValueSelection[]; }): ResolvedDimensionSelection {
  const { index } = options, { dimensions } = index;
  const emptyValidation = { isValid: false, issues: ["Exactly one dimension must be Varying. Currently: 0."] };
  const empty = { varyingDimensionKeys: [], varyingDimension: null, fixedValueSelections: [], validation: emptyValidation, configurationKeys: [], points: [], pointKeyByConfigurationKey: new Map<string, string>() };
  if (!dimensions.length) return empty;
  const defaultVaryingDimension = dimensions.find((dimension) => dimension.category === "code" && dimension.path[dimension.path.length - 1] === "revision") ?? dimensions[0];
  const requestedVaryingKeys = options.varyingDimensionKeys === null ? [defaultVaryingDimension.key] : Array.from(new Set(options.varyingDimensionKeys));
  const varyingDimensionKeys = requestedVaryingKeys.filter((key) => index.dimensionIndexByKey.has(key));
  const varyingKeySet = new Set(varyingDimensionKeys);
  const varyingDimensions = dimensions.filter((dimension) => varyingKeySet.has(dimension.key));
  const varyingDimension = varyingDimensions.length === 1 ? varyingDimensions[0] : null;
  const fixedDimensions = dimensions.filter((dimension) => !varyingKeySet.has(dimension.key));
  const selected = new Map(options.valueSelections.map((selection) => [selection.dimensionKey, Array.from(new Set(selection.valueKeys))]));
  const fixedByDimensionKey = new Map<string, FixedDimensionValueSelection>(), coordinateCache = new Map<string, readonly IndexedDimensionCoordinate[]>();
  for (const dimensionIndex of index.filterResolutionOrder) {
    const dimension = dimensions[dimensionIndex]; if (varyingKeySet.has(dimension.key)) continue;
    const coordinates = coordinatesForUpstreamSelections(index, index.filterUpstreamIndicesByDimensionIndex[dimensionIndex], fixedByDimensionKey, coordinateCache);
    fixedByDimensionKey.set(dimension.key, resolveFixedDimension(index, dimension, filteredDimensionOptions(index, dimension, coordinates), selected));
  }
  const fixedValueSelections = fixedDimensions.map((dimension) => fixedByDimensionKey.get(dimension.key)!);
  const issues: string[] = [];
  if (varyingDimensions.length !== 1) issues.push(`Exactly one dimension must be Varying. Currently: ${varyingDimensions.length}.`);
  for (const selection of fixedValueSelections) if (!selection.valueKeys.length) issues.push(`${selection.dimension.label} must select at least 1 value.`);
  const validation = { isValid: issues.length === 0, issues };
  if (!validation.isValid || !varyingDimension) return { varyingDimensionKeys, varyingDimension, fixedValueSelections, validation, configurationKeys: [], points: [], pointKeyByConfigurationKey: new Map<string, string>() };
  const fixedFilters = fixedValueSelections.map((selection) => ({ dimensionIndex: index.dimensionIndexByKey.get(selection.dimension.key)!, values: new Set(selection.valueKeys) }));
  const matched = index.coordinates.filter((coordinate) => fixedFilters.every((filter) => filter.values.has(coordinate.valueKeys[filter.dimensionIndex])));
  const configurationKeys = matched.map((coordinate) => coordinate.configuration.key);
  const varyingDimensionIndex = index.dimensionIndexByKey.get(varyingDimension.key)!;
  const pointBuckets = new Map<string, { label: string; configurationKeys: string[]; dateValue: number }>();
  const pointKeyByConfigurationKey = new Map<string, string>();
  for (const coordinate of matched) {
    const point = { key: coordinate.valueKeys[varyingDimensionIndex], label: coordinate.pointLabels[varyingDimensionIndex] };
    pointKeyByConfigurationKey.set(coordinate.configuration.key, point.key);
    const bucket = pointBuckets.get(point.key);
    if (bucket) { bucket.configurationKeys.push(coordinate.configuration.key); bucket.dateValue = Math.min(bucket.dateValue, new Date(coordinate.configuration.codeDate).valueOf()); }
    else pointBuckets.set(point.key, { label: point.label, configurationKeys: [coordinate.configuration.key], dateValue: new Date(coordinate.configuration.codeDate).valueOf() });
  }
  const points = Array.from(pointBuckets, ([key, bucket]) => ({ key, label: bucket.label, configurationKeys: bucket.configurationKeys, dateValue: bucket.dateValue })).sort((left, right) => varyingDimension.category === "code" ? left.dateValue - right.dateValue || left.label.localeCompare(right.label, undefined, { numeric: true }) : left.label.localeCompare(right.label, undefined, { numeric: true }) || left.key.localeCompare(right.key)).map((point) => ({ key: point.key, label: point.label, configurationKeys: point.configurationKeys }));
  return { varyingDimensionKeys, varyingDimension, fixedValueSelections, validation, configurationKeys, points, pointKeyByConfigurationKey };
}

export function normalizeDimensionValueSelections(value: unknown): DimensionValueSelection[] {
  if (!Array.isArray(value)) return [];
  const result = new Map<string, string[]>();
  for (const item of value) {
    if (!isRecord(item) || typeof item.dimensionKey !== "string" || !item.dimensionKey || !Array.isArray(item.valueKeys)) continue;
    const valueKeys = Array.from(new Set(item.valueKeys.filter((entry): entry is string => typeof entry === "string" && entry.length > 0)));
    result.set(item.dimensionKey, valueKeys);
  }
  return Array.from(result, ([dimensionKey, valueKeys]) => ({ dimensionKey, valueKeys }));
}
