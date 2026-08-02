import {
  canonicalMetricUnit,
  compatibleAggregateUnit,
  convertMetricValue
} from "./metric-units";
import type { BenchmarkAggregateRow, BenchmarkRow, BenchmarkRunRecord } from "./types";

function benchmarkConfigurationKey(
  codeStateId: string,
  hardwareEnvironmentId: string,
  softwareEnvironmentId: string
): string {
  return JSON.stringify([codeStateId, hardwareEnvironmentId, softwareEnvironmentId]);
}

export function runConfigurationKey(run: Pick<BenchmarkRunRecord,
  "code_state_id" | "hardware_environment_id" | "software_environment_id"
>): string {
  return benchmarkConfigurationKey(run.code_state_id, run.hardware_environment_id, run.software_environment_id);
}

type AggregateAccumulator = {
  row: BenchmarkAggregateRow;
  contributingRunIds: Set<string>;
};

function normalizedAggregateValue(value: number, sourceUnit: string, targetUnit: string, context: string): number {
  const converted = convertMetricValue(value, sourceUnit, targetUnit);
  if (converted === null) {
    throw new Error(`${context}: value conversion from ${sourceUnit} to ${targetUnit} is not finite.`);
  }
  return converted;
}

/**
 * Average repeated measurements for the same code/hardware/software configuration.
 * A missing benchmark result contributes nothing; it is never treated as zero.
 * Raw rows keep their source units; aggregate rows use a stable canonical time unit.
 */
export function aggregateBenchmarkRows(
  rows: readonly BenchmarkRow[],
  runsById: ReadonlyMap<string, BenchmarkRunRecord>
): BenchmarkAggregateRow[] {
  const aggregates = new Map<string, AggregateAccumulator>();

  for (const sourceRow of rows) {
    const run = runsById.get(sourceRow.run_id);
    if (!run) throw new Error(`Invalid benchmark result: unknown run_id=${sourceRow.run_id}.`);

    const configurationKey = runConfigurationKey(run);
    const aggregateKey = JSON.stringify([
      configurationKey,
      sourceRow.benchmark_key,
      sourceRow.metric_name,
      sourceRow.statistic
    ]);
    const current = aggregates.get(aggregateKey);

    if (!current) {
      const unit = canonicalMetricUnit(sourceRow.unit);
      const value = normalizedAggregateValue(
        sourceRow.value,
        sourceRow.unit,
        unit,
        `Cannot aggregate benchmark_key=${sourceRow.benchmark_key}, metric_name=${sourceRow.metric_name}, statistic=${sourceRow.statistic}`
      );
      aggregates.set(aggregateKey, {
        row: {
          configuration_key: configurationKey,
          code_state_id: run.code_state_id,
          hardware_environment_id: run.hardware_environment_id,
          software_environment_id: run.software_environment_id,
          benchmark_key: sourceRow.benchmark_key,
          metric_name: sourceRow.metric_name,
          statistic: sourceRow.statistic,
          unit,
          value,
          better: sourceRow.better,
          run_count: 1
        },
        contributingRunIds: new Set([sourceRow.run_id])
      });
      continue;
    }

    const row = current.row;
    const aggregateUnit = compatibleAggregateUnit(row.unit, sourceRow.unit);
    if (aggregateUnit === null) {
      throw new Error(
        `Cannot aggregate benchmark_key=${sourceRow.benchmark_key}, metric_name=${sourceRow.metric_name}, ` +
        `statistic=${sourceRow.statistic}: conflicting units ${row.unit} and ${sourceRow.unit}.`
      );
    }
    if (row.better !== sourceRow.better) {
      throw new Error(
        `Cannot aggregate benchmark_key=${sourceRow.benchmark_key}, metric_name=${sourceRow.metric_name}, ` +
        `statistic=${sourceRow.statistic}: conflicting better values ${row.better} and ${sourceRow.better}.`
      );
    }
    if (current.contributingRunIds.has(sourceRow.run_id)) {
      throw new Error(
        `Cannot aggregate duplicate result for run_id=${sourceRow.run_id}, benchmark_key=${sourceRow.benchmark_key}, ` +
        `metric_name=${sourceRow.metric_name}, statistic=${sourceRow.statistic}.`
      );
    }

    const context = `Cannot aggregate benchmark_key=${sourceRow.benchmark_key}, ` +
      `metric_name=${sourceRow.metric_name}, statistic=${sourceRow.statistic}`;
    const currentValue = normalizedAggregateValue(row.value, row.unit, aggregateUnit, context);
    const nextValue = normalizedAggregateValue(sourceRow.value, sourceRow.unit, aggregateUnit, context);

    current.contributingRunIds.add(sourceRow.run_id);
    const nextRunCount = row.run_count + 1;
    row.unit = aggregateUnit;
    row.value = currentValue * (row.run_count / nextRunCount) + nextValue / nextRunCount;
    row.run_count = nextRunCount;
  }

  return Array.from(aggregates.values(), (aggregate) => aggregate.row)
    .sort((left, right) =>
      left.configuration_key.localeCompare(right.configuration_key) ||
      left.benchmark_key.localeCompare(right.benchmark_key) ||
      left.metric_name.localeCompare(right.metric_name) ||
      left.statistic.localeCompare(right.statistic)
    );
}
