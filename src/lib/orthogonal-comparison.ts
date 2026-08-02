import { formatBytes } from "./format";
import type {
  BenchmarkAggregateRow,
  BenchmarkCodeStateIdentity,
  BenchmarkHardwareEnvironmentIdentity,
  BenchmarkSoftwareEnvironmentIdentity,
  LoadedBenchmarkDataset
} from "./types";

export type ComparisonCategory = "code" | "hardware" | "software";
export type IdentityPathToken = string | null;

export type IdentityFieldNode = {
  id: string;
  label: string;
  path: IdentityPathToken[];
  leafPathIds: string[];
  children: IdentityFieldNode[];
  collection: boolean;
};

export type ComparisonConfiguration = {
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

export type ComparisonMatch = {
  configuration: ComparisonConfiguration;
  changedFieldPathIds: string[];
};

const Missing_Value = Symbol("missing identity value");

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

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
  configurations: readonly ComparisonConfiguration[],
  category: ComparisonCategory
): IdentityFieldNode[] {
  return buildFieldNodes(
    configurations.map((configuration) => identityForCategory(configuration, category)),
    []
  );
}

export function allLeafPathIds(nodes: readonly IdentityFieldNode[]): string[] {
  return nodes.flatMap((node) => node.leafPathIds);
}


export type VariableFieldSelection = {
  pathId: string;
  label: string;
  leafPathIds: string[];
};

export function summarizeVariableFields(
  nodes: readonly IdentityFieldNode[],
  variablePathIds: ReadonlySet<string>
): VariableFieldSelection[] {
  const selections: VariableFieldSelection[] = [];
  function visit(node: IdentityFieldNode) {
    const selectedLeafPaths = node.leafPathIds.filter((pathId) => variablePathIds.has(pathId));
    if (selectedLeafPaths.length === 0) return;
    if (selectedLeafPaths.length === node.leafPathIds.length) {
      selections.push({
        pathId: node.id,
        label: identityPathLabel(node.path),
        leafPathIds: [...node.leafPathIds]
      });
      return;
    }
    for (const child of node.children) visit(child);
  }
  for (const node of nodes) visit(node);
  return selections;
}

export function identityForCategory(
  configuration: ComparisonConfiguration,
  category: ComparisonCategory
): Record<string, unknown> {
  if (category === "code") return configuration.codeIdentity;
  if (category === "hardware") return configuration.hardwareIdentity;
  return configuration.softwareIdentity;
}

export function entityIdForCategory(
  configuration: ComparisonConfiguration,
  category: ComparisonCategory
): string {
  if (category === "code") return configuration.codeStateId;
  if (category === "hardware") return configuration.hardwareEnvironmentId;
  return configuration.softwareEnvironmentId;
}

export function entityLabelForCategory(
  configuration: ComparisonConfiguration,
  category: ComparisonCategory
): string {
  if (category === "code") return configuration.codeLabel || configuration.codeStateId;
  if (category === "hardware") return configuration.hardwareLabel || configuration.hardwareEnvironmentId;
  return configuration.softwareLabel || configuration.softwareEnvironmentId;
}

export function buildComparisonConfigurations(dataset: LoadedBenchmarkDataset): ComparisonConfiguration[] {
  const configurations = new Map<string, ComparisonConfiguration>();

  for (const row of dataset.aggregateRows) {
    if (configurations.has(row.configuration_key)) continue;
    const codeState = dataset.codeStatesById.get(row.code_state_id);
    const hardware = dataset.hardwareEnvironmentsById.get(row.hardware_environment_id);
    const software = dataset.softwareEnvironmentsById.get(row.software_environment_id);
    if (!codeState || !hardware || !software) continue;

    configurations.set(row.configuration_key, {
      key: row.configuration_key,
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

function collectionProjectionKey(
  identity: Record<string, unknown>,
  node: IdentityFieldNode,
  includedPathIds: readonly string[]
): string {
  const value = projectValue(identity, node.path);
  if (value === Missing_Value) return "missing";
  if (!Array.isArray(value)) return `value:${stableJson(value)}`;
  const prefixLength = node.path.length + 1;
  const relativePaths = includedPathIds.map((pathId) => {
    const path = JSON.parse(pathId) as IdentityPathToken[];
    return path.slice(prefixLength);
  });
  const rows = value.map((entry) => JSON.stringify(
    relativePaths.map((path) => projectValueKey(entry, path))
  )).sort();
  return `collection:${JSON.stringify(rows)}`;
}

function fixedNodeMatches(
  baselineIdentity: Record<string, unknown>,
  candidateIdentity: Record<string, unknown>,
  node: IdentityFieldNode,
  variablePaths: ReadonlySet<string>
): boolean {
  const fixedDescendantPaths = node.leafPathIds.filter((pathId) => !variablePaths.has(pathId));
  if (fixedDescendantPaths.length === 0) return true;
  if (node.collection) {
    return collectionProjectionKey(baselineIdentity, node, fixedDescendantPaths) ===
      collectionProjectionKey(candidateIdentity, node, fixedDescendantPaths);
  }
  if (node.children.length > 0) {
    return node.children.every((child) => fixedNodeMatches(
      baselineIdentity, candidateIdentity, child, variablePaths
    ));
  }
  return projectValueKey(baselineIdentity, node.path) === projectValueKey(candidateIdentity, node.path);
}

function collectionVariableChanges(
  baselineIdentity: Record<string, unknown>,
  candidateIdentity: Record<string, unknown>,
  nodes: readonly IdentityFieldNode[],
  variablePaths: ReadonlySet<string>
): string[] {
  const changed = new Set<string>();
  function visit(node: IdentityFieldNode) {
    const variableDescendantPaths = node.leafPathIds.filter((pathId) => variablePaths.has(pathId));
    if (node.collection && variableDescendantPaths.length > 0 &&
      collectionProjectionKey(baselineIdentity, node, node.leafPathIds) !==
        collectionProjectionKey(candidateIdentity, node, node.leafPathIds)) {
      const directLeafChange = variableDescendantPaths.some((pathId) => {
        const path = JSON.parse(pathId) as IdentityPathToken[];
        return projectValueKey(baselineIdentity, path) !== projectValueKey(candidateIdentity, path);
      });
      if (!directLeafChange) changed.add(node.id);
    }
    for (const child of node.children) visit(child);
  }
  for (const node of nodes) visit(node);
  return Array.from(changed);
}

function sameNonVariableCategories(
  baseline: ComparisonConfiguration,
  candidate: ComparisonConfiguration,
  variableCategory: ComparisonCategory
): boolean {
  if (variableCategory !== "code" && baseline.codeStateId !== candidate.codeStateId) return false;
  if (variableCategory !== "hardware" && baseline.hardwareEnvironmentId !== candidate.hardwareEnvironmentId) return false;
  if (variableCategory !== "software" && baseline.softwareEnvironmentId !== candidate.softwareEnvironmentId) return false;
  return true;
}

export function matchComparisonConfigurations(options: {
  configurations: readonly ComparisonConfiguration[];
  baselineKey: string;
  variableCategory: ComparisonCategory | "";
  variableFieldPathIds: readonly string[];
  fieldTree: readonly IdentityFieldNode[];
}): ComparisonMatch[] {
  const baseline = options.configurations.find((configuration) => configuration.key === options.baselineKey);
  if (!baseline) return [];
  const variableCategory = options.variableCategory;
  if (!variableCategory || options.variableFieldPathIds.length === 0) {
    return [{ configuration: baseline, changedFieldPathIds: [] }];
  }

  const allPaths = new Set(allLeafPathIds(options.fieldTree));
  const validVariablePaths = new Set(options.variableFieldPathIds.filter((path) => allPaths.has(path)));
  if (validVariablePaths.size === 0) return [{ configuration: baseline, changedFieldPathIds: [] }];
  const baselineIdentity = identityForCategory(baseline, variableCategory);
  const fieldOrder = new Map<string, number>();
  let nextFieldOrder = 0;
  function recordFieldOrder(nodes: readonly IdentityFieldNode[]) {
    for (const node of nodes) {
      fieldOrder.set(node.id, nextFieldOrder);
      nextFieldOrder += 1;
      recordFieldOrder(node.children);
    }
  }
  recordFieldOrder(options.fieldTree);

  const matches: ComparisonMatch[] = [];
  for (const candidate of options.configurations) {
    if (!sameNonVariableCategories(baseline, candidate, variableCategory)) continue;
    const candidateIdentity = identityForCategory(candidate, variableCategory);
    const fixedFieldsMatch = options.fieldTree.every((node) => fixedNodeMatches(
      baselineIdentity, candidateIdentity, node, validVariablePaths
    ));
    if (!fixedFieldsMatch) continue;

    const changedFieldPathIds = new Set(Array.from(validVariablePaths).filter((pathId) => {
      const path = JSON.parse(pathId) as IdentityPathToken[];
      return projectValueKey(baselineIdentity, path) !== projectValueKey(candidateIdentity, path);
    }));
    for (const pathId of collectionVariableChanges(
      baselineIdentity, candidateIdentity, options.fieldTree, validVariablePaths
    )) changedFieldPathIds.add(pathId);
    const changedFieldPathIdList = Array.from(changedFieldPathIds).sort((left, right) =>
      (fieldOrder.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (fieldOrder.get(right) ?? Number.MAX_SAFE_INTEGER) ||
      left.localeCompare(right)
    );
    if (candidate.key !== baseline.key && changedFieldPathIdList.length === 0) continue;
    matches.push({ configuration: candidate, changedFieldPathIds: changedFieldPathIdList });
  }

  return matches.sort((left, right) => {
    if (left.configuration.key === baseline.key) return -1;
    if (right.configuration.key === baseline.key) return 1;
    if (variableCategory === "code") {
      const dateOrder = left.configuration.codeDate.localeCompare(right.configuration.codeDate);
      if (dateOrder !== 0) return dateOrder;
    }
    return entityLabelForCategory(left.configuration, variableCategory)
      .localeCompare(entityLabelForCategory(right.configuration, variableCategory));
  });
}

export function aggregateRowKey(row: Pick<BenchmarkAggregateRow, "metric_name" | "statistic">): string {
  return JSON.stringify([row.metric_name, row.statistic]);
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

export function formatIdentityProjection(
  identity: Record<string, unknown>,
  pathId: string
): string {
  const path = JSON.parse(pathId) as IdentityPathToken[];
  const value = projectValue(identity, path);
  const finalToken = [...path].reverse().find((token): token is string => token !== null);
  return formatProjectionValue(value, finalToken);
}
