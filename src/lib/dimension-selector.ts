import { formatBytes } from "./format";
import type {
  BenchmarkCodeStateIdentity,
  BenchmarkHardwareEnvironmentIdentity,
  BenchmarkSoftwareEnvironmentIdentity,
  LoadedBenchmarkDatabase
} from "./types";
import { hasOwn, isRecord } from "./object";

export type DimensionCategory = "code" | "hardware" | "software";
export type IdentityPathToken = string | null;

export type IdentityFieldNode = {
  id: string;
  label: string;
  path: IdentityPathToken[];
  leafPathIds: string[];
  children: IdentityFieldNode[];
  collection: boolean;
};

export type DimensionConfiguration = {
  key: string;
  codeStateId: string;
  hardwareEnvironmentId: string;
  softwareEnvironmentId: string;
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

const Preferred_Key_Order: Record<string, number> = {
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
  const leftOrder = Preferred_Key_Order[left] ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = Preferred_Key_Order[right] ?? Number.MAX_SAFE_INTEGER;
  return leftOrder - rightOrder || left.localeCompare(right);
}

function identityPathId(path: readonly IdentityPathToken[]): string {
  return JSON.stringify(path);
}

export function identityPathLabel(path: readonly IdentityPathToken[]): string {
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
          label: fieldLabel(key),
          path,
          leafPathIds: [id],
          children: [],
          collection: false
        };
      }

      return {
        id: identityPathId(path),
        label: fieldLabel(key),
        path,
        leafPathIds: children.flatMap((child) => child.leafPathIds),
        children,
        collection: allObjectArrays
      };
    });
}

export function buildIdentityFieldTree(
  configurations: readonly DimensionConfiguration[],
  category: DimensionCategory
): IdentityFieldNode[] {
  return buildFieldNodes(
    configurations.map((configuration) => identityForCategory(configuration, category)),
    []
  );
}

export function identityForCategory(
  configuration: DimensionConfiguration,
  category: DimensionCategory
): Record<string, unknown> {
  if (category === "code") return configuration.codeIdentity;
  if (category === "hardware") return configuration.hardwareIdentity;
  return configuration.softwareIdentity;
}

export function buildDimensionConfigurations(database: LoadedBenchmarkDatabase): DimensionConfiguration[] {
  const configurations = new Map<string, DimensionConfiguration>();

  for (const ids of database.configurations) {
    const key = JSON.stringify([ids.code_state_id, ids.hardware_environment_id, ids.software_environment_id]);
    const codeState = database.codeStatesById.get(ids.code_state_id);
    const hardware = database.hardwareEnvironmentsById.get(ids.hardware_environment_id);
    const software = database.softwareEnvironmentsById.get(ids.software_environment_id);
    if (!codeState || !hardware || !software) continue;

    configurations.set(key, {
      key,
      codeStateId: codeState.id,
      hardwareEnvironmentId: hardware.id,
      softwareEnvironmentId: software.id,
      codeLabel: codeState.label || codeState.id,
      codeDate: codeState.code_date,
      hardwareLabel: hardware.label || hardware.id,
      softwareLabel: software.label || software.id,
      codeIdentity: codeState.identity,
      hardwareIdentity: hardware.identity,
      softwareIdentity: software.identity
    });
  }

  return Array.from(configurations.values()).sort((left, right) => {
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
export type FixedDimensionValueSelection = { dimension: DimensionDefinition; valueKeys: string[]; options: DimensionValueOption[]; };
export type DimensionSelectionPoint = { key: string; label: string; configurationKeys: string[]; configurationCount: number; };
export type DimensionSelectionValidation = { isValid: boolean; varyingCount: number; issues: string[]; };
type IndexedDimensionCoordinate = { configuration: DimensionConfiguration; valueKeys: string[]; pointLabels: string[]; };
export type DimensionSelectionIndex = { dimensions: readonly DimensionDefinition[]; dimensionIndexByKey: ReadonlyMap<string, number>; coordinates: readonly IndexedDimensionCoordinate[]; optionsByDimensionKey: ReadonlyMap<string, DimensionValueOption[]>; availableValueKeysByDimensionKey: ReadonlyMap<string, ReadonlySet<string>>; };
export type ResolvedDimensionSelection = { varyingDimensionKeys: string[]; varyingDimensions: DimensionDefinition[]; varyingDimension: DimensionDefinition | null; fixedValueSelections: FixedDimensionValueSelection[]; valueSelections: DimensionValueSelection[]; validation: DimensionSelectionValidation; configurationKeys: string[]; points: DimensionSelectionPoint[]; pointKeyByConfigurationKey: ReadonlyMap<string, string>; };

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
  return { dimensions, dimensionIndexByKey, coordinates, optionsByDimensionKey, availableValueKeysByDimensionKey };
}

function pointDateValue(configurations: readonly DimensionConfiguration[]): number { return configurations.reduce((value, configuration) => Math.min(value, new Date(configuration.codeDate).valueOf()), Number.POSITIVE_INFINITY); }

export function resolveDimensionSelection(options: { index: DimensionSelectionIndex; varyingDimensionKeys: readonly string[] | null; valueSelections: readonly DimensionValueSelection[]; }): ResolvedDimensionSelection {
  const { index } = options, { dimensions } = index;
  const emptyValidation = { isValid: false, varyingCount: 0, issues: ["Exactly one dimension must be Varying. Currently: 0."] };
  const empty = { varyingDimensionKeys: [], varyingDimensions: [], varyingDimension: null, fixedValueSelections: [], valueSelections: [], validation: emptyValidation, configurationKeys: [], points: [], pointKeyByConfigurationKey: new Map<string, string>() };
  if (!dimensions.length) return empty;
  const defaultVaryingDimension = dimensions.find((dimension) => dimension.category === "code" && dimension.path[dimension.path.length - 1] === "revision") ?? dimensions[0];
  const requestedVaryingKeys = options.varyingDimensionKeys === null ? [defaultVaryingDimension.key] : Array.from(new Set(options.varyingDimensionKeys));
  const varyingDimensionKeys = requestedVaryingKeys.filter((key) => index.dimensionIndexByKey.has(key));
  const varyingKeySet = new Set(varyingDimensionKeys);
  const varyingDimensions = dimensions.filter((dimension) => varyingKeySet.has(dimension.key));
  const varyingDimension = varyingDimensions.length === 1 ? varyingDimensions[0] : null;
  const fixedDimensions = dimensions.filter((dimension) => !varyingKeySet.has(dimension.key));
  const selected = new Map(options.valueSelections.map((selection) => [selection.dimensionKey, Array.from(new Set(selection.valueKeys))]));
  const fixedValueSelections = fixedDimensions.map((dimension) => {
    const selectorOptions = index.optionsByDimensionKey.get(dimension.key) ?? [];
    const available = index.availableValueKeysByDimensionKey.get(dimension.key) ?? new Set<string>();
    const hasStoredSelection = selected.has(dimension.key);
    const current = selected.get(dimension.key) ?? [];
    const valid = current.filter((key) => available.has(key));
    const valueKeys = selectorOptions.length === 1 ? [selectorOptions[0].key] : hasStoredSelection ? valid : selectorOptions[0] ? [selectorOptions[0].key] : [];
    return { dimension, valueKeys, options: selectorOptions };
  });
  const valueSelections = fixedValueSelections.map((selector) => ({ dimensionKey: selector.dimension.key, valueKeys: selector.valueKeys }));
  const issues: string[] = [];
  if (varyingDimensions.length !== 1) issues.push(`Exactly one dimension must be Varying. Currently: ${varyingDimensions.length}.`);
  for (const selector of fixedValueSelections) if (!selector.valueKeys.length) issues.push(`${selector.dimension.label} must select at least 1 value.`);
  const validation = { isValid: issues.length === 0, varyingCount: varyingDimensions.length, issues };
  if (!validation.isValid || !varyingDimension) return { varyingDimensionKeys, varyingDimensions, varyingDimension, fixedValueSelections, valueSelections, validation, configurationKeys: [], points: [], pointKeyByConfigurationKey: new Map<string, string>() };
  const fixedFilters = fixedValueSelections.map((selector) => ({ dimensionIndex: index.dimensionIndexByKey.get(selector.dimension.key)!, values: new Set(selector.valueKeys) }));
  const matched = index.coordinates.filter((coordinate) => fixedFilters.every((filter) => filter.values.has(coordinate.valueKeys[filter.dimensionIndex])));
  const configurationKeys = matched.map((coordinate) => coordinate.configuration.key);
  const varyingDimensionIndex = index.dimensionIndexByKey.get(varyingDimension.key)!;
  const pointBuckets = new Map<string, { label: string; configurations: DimensionConfiguration[]; configurationKeys: string[] }>();
  const pointKeyByConfigurationKey = new Map<string, string>();
  for (const coordinate of matched) {
    const point = { key: coordinate.valueKeys[varyingDimensionIndex], label: coordinate.pointLabels[varyingDimensionIndex] };
    pointKeyByConfigurationKey.set(coordinate.configuration.key, point.key);
    const bucket = pointBuckets.get(point.key);
    if (bucket) { bucket.configurations.push(coordinate.configuration); bucket.configurationKeys.push(coordinate.configuration.key); }
    else pointBuckets.set(point.key, { label: point.label, configurations: [coordinate.configuration], configurationKeys: [coordinate.configuration.key] });
  }
  const points = Array.from(pointBuckets, ([key, bucket]) => ({ key, label: bucket.label, configurationKeys: bucket.configurationKeys, configurationCount: bucket.configurationKeys.length, dateValue: pointDateValue(bucket.configurations) })).sort((left, right) => varyingDimension.category === "code" ? left.dateValue - right.dateValue || left.label.localeCompare(right.label, undefined, { numeric: true }) : left.label.localeCompare(right.label, undefined, { numeric: true }) || left.key.localeCompare(right.key)).map((point) => ({ key: point.key, label: point.label, configurationKeys: point.configurationKeys, configurationCount: point.configurationCount }));
  return { varyingDimensionKeys, varyingDimensions, varyingDimension, fixedValueSelections, valueSelections, validation, configurationKeys, points, pointKeyByConfigurationKey };
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
