export type TimeMetricUnit = "ns" | "μs" | "ms" | "s" | "min" | "h";

export type TimeMetricUnitDefinition = {
  unit: TimeMetricUnit;
  nanoseconds: number;
};

export const Time_Metric_Units: readonly TimeMetricUnitDefinition[] = [
  { unit: "ns", nanoseconds: 1 },
  { unit: "μs", nanoseconds: 1_000 },
  { unit: "ms", nanoseconds: 1_000_000 },
  { unit: "s", nanoseconds: 1_000_000_000 },
  { unit: "min", nanoseconds: 60 * 1_000_000_000 },
  { unit: "h", nanoseconds: 60 * 60 * 1_000_000_000 }
] as const;

const Time_Unit_Nanoseconds = new Map<string, number>([
  ...Time_Metric_Units.map(({ unit, nanoseconds }) => [unit, nanoseconds] as const),
  ["us", 1_000]
]);

export function canonicalMetricUnit(unit: string): string {
  return unit === "us" ? "μs" : unit;
}

export function timeUnitNanoseconds(unit: string): number | null {
  return Time_Unit_Nanoseconds.get(unit) ?? null;
}

export function isTimeMetricUnit(unit: string): boolean {
  return timeUnitNanoseconds(unit) !== null;
}

export function metricUnitFamily(unit: string): string {
  return isTimeMetricUnit(unit) ? "time" : unit;
}

export function compatibleAggregateUnit(leftUnit: string, rightUnit: string): string | null {
  const left = canonicalMetricUnit(leftUnit);
  const right = canonicalMetricUnit(rightUnit);
  if (left === right) return left;

  const leftNanoseconds = timeUnitNanoseconds(left);
  const rightNanoseconds = timeUnitNanoseconds(right);
  if (leftNanoseconds === null || rightNanoseconds === null) return null;
  return leftNanoseconds <= rightNanoseconds ? left : right;
}

export function convertMetricValue(value: number, sourceUnit: string, targetUnit: string): number | null {
  if (!Number.isFinite(value)) return null;

  const canonicalSource = canonicalMetricUnit(sourceUnit);
  const canonicalTarget = canonicalMetricUnit(targetUnit);
  if (canonicalSource === canonicalTarget) return value;

  const sourceNanoseconds = timeUnitNanoseconds(canonicalSource);
  const targetNanoseconds = timeUnitNanoseconds(canonicalTarget);
  if (sourceNanoseconds === null || targetNanoseconds === null) return null;

  const converted = value * (sourceNanoseconds / targetNanoseconds);
  return Number.isFinite(converted) ? converted : null;
}
