import { SQLocal } from "sqlocal";
import { metricFamilyLabel } from "./dashboard-plotting";
import { dateInputValue, type DisplayStrategy } from "./dashboard-settings";
import { parseDate } from "./format";
import { canonicalMetricUnit, compatibleAggregateUnit, convertMetricValue } from "./metric-units";
import { metadataFromRaw, normalizeBenchmarkCodeState, normalizeBenchmarkHardwareEnvironment, normalizeBenchmarkKey, normalizeBenchmarkRow, normalizeBenchmarkRunRecord, normalizeBenchmarkSoftwareEnvironment, validateSchemaVersion } from "./sqlite";
import type { BenchmarkAggregateRow, BenchmarkCodeState, BenchmarkConfigurationIds, BenchmarkDatabaseStats, BenchmarkDefinition, BenchmarkHardwareEnvironment, BenchmarkMetricSource, BenchmarkRow, BenchmarkRunRecord, BenchmarkSoftwareEnvironment, BenchmarkViewCatalog, BenchLedgerMetadata, LoadedBenchmarkDatabase } from "./types";

const Required_Tables = ["benchledger_metadata", "code_states", "hardware_environments", "software_environments", "runs", "benchmark_results"] as const;

type DatabaseFile = File | ArrayBuffer;
export type BenchmarkResultQuery = { yAxis: string; branch: string; timeStartValue: number | null; timeEndValue: number | null; displayStrategy: DisplayStrategy; configurationKeys?: readonly string[]; benchmarkKeys?: readonly string[]; };
export type BenchmarkRunSliceSummary = { run_id: string; row_count: number; };
export type BenchmarkTrendAggregateRow = BenchmarkAggregateRow & { representative_run_id: string; };

type SqlParts = { clauses: string[]; params: unknown[]; };
type MetricCatalogRow = BenchmarkMetricSource;
type AggregateGroupRow = { code_state_id: string; hardware_environment_id: string; software_environment_id: string; benchmark_key: string; metric_name: string; statistic: string; unit: string; better: BenchmarkRow["better"]; value: number; run_count: number; representative_run_id?: string; };

function configurationKey(ids: BenchmarkConfigurationIds): string { return JSON.stringify([ids.code_state_id, ids.hardware_environment_id, ids.software_environment_id]); }


function parseConfigurationKey(value: string): BenchmarkConfigurationIds | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed) || parsed.length !== 3 || !parsed.every((item) => typeof item === "string")) return null;
    return { code_state_id: parsed[0], hardware_environment_id: parsed[1], software_environment_id: parsed[2] };
  } catch { return null; }
}

function finiteCount(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error(`Invalid ${context}: expected a non-negative integer.`);
  return value;
}

function stringColumn(value: unknown, context: string): string {
  if (typeof value !== "string") throw new Error(`Invalid ${context}: expected a string.`);
  return value;
}

function numericColumn(value: unknown, context: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`Invalid ${context}: expected a finite number.`);
  return value;
}

function aggregateGroupRow(row: Record<string, unknown>): AggregateGroupRow {
  const better = row.better;
  if (better !== "lower" && better !== "higher" && better !== "neutral") throw new Error("Invalid aggregate better value.");
  return { code_state_id: stringColumn(row.code_state_id, "aggregate code_state_id"), hardware_environment_id: stringColumn(row.hardware_environment_id, "aggregate hardware_environment_id"), software_environment_id: stringColumn(row.software_environment_id, "aggregate software_environment_id"), benchmark_key: stringColumn(row.benchmark_key, "aggregate benchmark_key"), metric_name: stringColumn(row.metric_name, "aggregate metric_name"), statistic: stringColumn(row.statistic, "aggregate statistic"), unit: stringColumn(row.unit, "aggregate unit"), better, value: numericColumn(row.value, "aggregate value"), run_count: finiteCount(row.run_count, "aggregate run count"), representative_run_id: row.representative_run_id === undefined ? undefined : stringColumn(row.representative_run_id, "aggregate representative_run_id") };
}

function combineAggregateGroups(groups: readonly AggregateGroupRow[]): BenchmarkAggregateRow[] {
  const combined = new Map<string, BenchmarkAggregateRow>();
  for (const group of groups) {
    const ids = { code_state_id: group.code_state_id, hardware_environment_id: group.hardware_environment_id, software_environment_id: group.software_environment_id };
    const configuration = configurationKey(ids);
    const key = JSON.stringify([configuration, group.benchmark_key, group.metric_name, group.statistic]);
    const current = combined.get(key);
    const canonicalUnit = canonicalMetricUnit(group.unit);
    const normalizedValue = convertMetricValue(group.value, group.unit, canonicalUnit);
    if (normalizedValue === null) throw new Error(`Cannot aggregate benchmark_key=${group.benchmark_key}, metric_name=${group.metric_name}, statistic=${group.statistic}: invalid value conversion.`);
    if (!current) { combined.set(key, { configuration_key: configuration, benchmark_key: group.benchmark_key, metric_name: group.metric_name, statistic: group.statistic, unit: canonicalUnit, value: normalizedValue, better: group.better, run_count: group.run_count }); continue; }
    const unit = compatibleAggregateUnit(current.unit, group.unit);
    if (unit === null) throw new Error(`Cannot aggregate benchmark_key=${group.benchmark_key}, metric_name=${group.metric_name}, statistic=${group.statistic}: conflicting units ${current.unit} and ${group.unit}.`);
    if (current.better !== group.better) throw new Error(`Cannot aggregate benchmark_key=${group.benchmark_key}, metric_name=${group.metric_name}, statistic=${group.statistic}: conflicting better values ${current.better} and ${group.better}.`);
    const left = convertMetricValue(current.value, current.unit, unit);
    const right = convertMetricValue(group.value, group.unit, unit);
    if (left === null || right === null) throw new Error(`Cannot aggregate benchmark_key=${group.benchmark_key}, metric_name=${group.metric_name}, statistic=${group.statistic}: invalid value conversion.`);
    const count = current.run_count + group.run_count;
    current.unit = unit; current.value = left * (current.run_count / count) + right * (group.run_count / count); current.run_count = count;
  }
  return Array.from(combined.values()).sort((left, right) => left.configuration_key.localeCompare(right.configuration_key) || left.benchmark_key.localeCompare(right.benchmark_key) || left.metric_name.localeCompare(right.metric_name) || left.statistic.localeCompare(right.statistic));
}


function combineTrendAggregateGroups(groups: readonly AggregateGroupRow[]): BenchmarkTrendAggregateRow[] {
  const representatives = new Map<string, string>();
  for (const group of groups) {
    if (!group.representative_run_id) throw new Error("Invalid trend aggregate: representative run is missing.");
    const configuration = configurationKey({ code_state_id: group.code_state_id, hardware_environment_id: group.hardware_environment_id, software_environment_id: group.software_environment_id });
    const key = JSON.stringify([configuration, group.benchmark_key, group.metric_name, group.statistic]);
    const current = representatives.get(key);
    if (current && current !== group.representative_run_id) throw new Error("Invalid trend aggregate: inconsistent representative run.");
    representatives.set(key, group.representative_run_id);
  }
  return combineAggregateGroups(groups).map((row) => ({ ...row, representative_run_id: representatives.get(JSON.stringify([row.configuration_key, row.benchmark_key, row.metric_name, row.statistic]))! }));
}

function buildViewCatalog(metricRows: MetricCatalogRow[], runsById: ReadonlyMap<string, BenchmarkRunRecord>, runIdsWithResults: ReadonlySet<string>, minCodeDate: string, maxCodeDate: string): BenchmarkViewCatalog {
  const metricSourcesByLabel = new Map<string, BenchmarkMetricSource[]>();
  const metricOptions = new Set<string>();
  for (const row of metricRows) {
    const label = metricFamilyLabel(row);
    const source = { metric_name: row.metric_name, statistic: row.statistic, unit: row.unit };
    const existingSources = metricSourcesByLabel.get(label);
    if (existingSources) { if (!existingSources.some((entry) => entry.metric_name === source.metric_name && entry.statistic === source.statistic && entry.unit === source.unit)) existingSources.push(source); }
    else metricSourcesByLabel.set(label, [source]);
    metricOptions.add(label);
  }
  const branchOptions = new Set<string>();
  for (const run of runsById.values()) { const branch = runIdsWithResults.has(run.id) ? run.metadata.source?.branch : undefined; if (branch) branchOptions.add(branch); }
  return { metricOptions: Array.from(metricOptions).sort(), metricSourcesByLabel, branchOptions: ["all", ...Array.from(branchOptions).sort()], databaseTimeStart: dateInputValue(minCodeDate), databaseTimeEnd: dateInputValue(maxCodeDate) };
}

function queryFilters(snapshot: LoadedBenchmarkDatabase, query: BenchmarkResultQuery): SqlParts {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const metricSources = snapshot.viewCatalog.metricSourcesByLabel.get(query.yAxis) ?? [];
  if (!metricSources.length) clauses.push("0");
  else { clauses.push(`(${metricSources.map(() => "(br.metric_name = ? AND br.statistic = ? AND br.unit = ?)").join(" OR ")})`); for (const source of metricSources) params.push(source.metric_name, source.statistic, source.unit); }
  if (query.branch !== "all") { clauses.push("COALESCE(json_extract(r.metadata, '$.source.branch'), '') = ?"); params.push(query.branch); }
  if (query.displayStrategy !== "all") { const tagged = "COALESCE(json_array_length(r.metadata, '$.source.tags'), 0) > 0"; clauses.push(query.displayStrategy === "tagged-only" ? tagged : `(${tagged} OR COALESCE(json_extract(r.metadata, '$.source.branch'), '') IN ('main', 'master'))`); }
  if (query.timeStartValue !== null) { clauses.push("julianday(cs.code_date) >= julianday(?)"); params.push(new Date(query.timeStartValue).toISOString()); }
  if (query.timeEndValue !== null) { clauses.push("julianday(cs.code_date) <= julianday(?)"); params.push(new Date(query.timeEndValue).toISOString()); }
  if (query.configurationKeys) {
    if (!query.configurationKeys.length) clauses.push("0");
    else { const configurations = query.configurationKeys.map(parseConfigurationKey).filter((value): value is BenchmarkConfigurationIds => Boolean(value)); if (!configurations.length) clauses.push("0"); else { clauses.push("EXISTS (SELECT 1 FROM json_each(?) cfg WHERE json_extract(cfg.value, '$[0]') = r.code_state_id AND json_extract(cfg.value, '$[1]') = r.hardware_environment_id AND json_extract(cfg.value, '$[2]') = r.software_environment_id)"); params.push(JSON.stringify(configurations.map((configuration) => [configuration.code_state_id, configuration.hardware_environment_id, configuration.software_environment_id]))); } }
  }
  if (query.benchmarkKeys) { if (!query.benchmarkKeys.length) clauses.push("0"); else { clauses.push(`br.benchmark_key IN (${query.benchmarkKeys.map(() => "?").join(", ")})`); params.push(...query.benchmarkKeys); } }
  return { clauses, params };
}

function benchmarkQuerySql(select: string, filters: SqlParts, tail = ""): string {
  return `${select}\nFROM benchmark_results br\nJOIN runs r ON r.id = br.run_id\nJOIN code_states cs ON cs.id = r.code_state_id${filters.clauses.length ? `\nWHERE ${filters.clauses.join(" AND ")}` : ""}${tail ? `\n${tail}` : ""}`;
}

function temporaryDatabasePath(): string { return typeof globalThis.Worker === "undefined" ? ":memory:" : `benchledger-${crypto.randomUUID()}.sqlite3`; }

async function normalizeStandaloneDatabaseFile(databaseFile: DatabaseFile): Promise<ArrayBuffer> {
  const source = databaseFile instanceof ArrayBuffer ? databaseFile : await databaseFile.arrayBuffer();
  const bytes = new Uint8Array(source);
  // BenchLedger distributes one self-contained SQLite file, never a -wal sidecar. The loaded ArrayBuffer is already the disposable import buffer, so normalize it in place instead of cloning the full database.
  if (bytes.length >= 20 && bytes[18] === 2 && bytes[19] === 2) { bytes[18] = 1; bytes[19] = 1; }
  return source;
}

async function createDatabaseClient(): Promise<SQLocal> {
  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => { resolveReady = resolve; });
  // A named path makes SQLocal use its Worker in browsers; readOnly must stay false so the staging database can be created before import.
  const client = new SQLocal({ databasePath: temporaryDatabasePath(), reactive: false, readOnly: false, onConnect: () => resolveReady() });
  await ready;
  return client;
}

async function disposeDatabaseClient(client: SQLocal): Promise<void> {
  try { await client.deleteDatabaseFile(undefined, true); }
  catch { await client.destroy(true).catch(() => undefined); }
}

export class BenchmarkDatabaseSession {
  private client: SQLocal | null = null;
  private snapshot: LoadedBenchmarkDatabase | null = null;
  private replaceTail: Promise<void> = Promise.resolve();


  async replaceDatabaseFile(databaseFile: DatabaseFile, sourceLabel: string, sourceUrl: string | null): Promise<LoadedBenchmarkDatabase> {
    const operation = this.replaceTail.then(async () => {
      const candidate = await createDatabaseClient();
      let snapshot: LoadedBenchmarkDatabase;
      try { await candidate.overwriteDatabaseFile(await normalizeStandaloneDatabaseFile(databaseFile)); snapshot = await this.readSnapshot(candidate, sourceLabel, sourceUrl); }
      catch (error) { await disposeDatabaseClient(candidate); throw error; }
      const previous = this.client;
      this.client = candidate;
      this.snapshot = snapshot;
      if (previous) await disposeDatabaseClient(previous);
      return snapshot;
    });
    this.replaceTail = operation.then(() => undefined, () => undefined);
    return operation;
  }

  async destroy(): Promise<void> {
    await this.replaceTail;
    this.snapshot = null;
    const client = this.client;
    this.client = null;
    if (client) await disposeDatabaseClient(client);
  }

  async queryBenchmarkKeys(query: BenchmarkResultQuery): Promise<string[]> {
    await this.replaceTail;
    const filters = queryFilters(this.requireSnapshot(), query);
    const rows = await this.requireClient().sql<Record<string, unknown>>(benchmarkQuerySql("SELECT DISTINCT br.benchmark_key", filters, "ORDER BY br.benchmark_key"), ...filters.params);
    return rows.map((row) => stringColumn(row.benchmark_key, "benchmark_key query result"));
  }


  async queryRunSlice(query: BenchmarkResultQuery): Promise<BenchmarkRunSliceSummary[]> {
    await this.replaceTail;
    const filters = queryFilters(this.requireSnapshot(), query);
    const rows = await this.requireClient().sql<Record<string, unknown>>(benchmarkQuerySql("SELECT br.run_id, COUNT(*) AS row_count", filters, "GROUP BY br.run_id"), ...filters.params);
    return rows.map((row) => ({ run_id: stringColumn(row.run_id, "run slice run_id"), row_count: finiteCount(row.row_count, "run slice row count") }));
  }

  async queryTrendAggregates(query: BenchmarkResultQuery): Promise<BenchmarkTrendAggregateRow[]> {
    await this.replaceTail;
    const filters = queryFilters(this.requireSnapshot(), query);
    const where = filters.clauses.length ? `WHERE ${filters.clauses.join(" AND ")}` : "";
    const filteredSql = `SELECT br.run_id, br.benchmark_key, br.metric_name, br.statistic, br.unit, br.value, br.better, r.code_state_id, r.hardware_environment_id, r.software_environment_id, r.measured_at, ROW_NUMBER() OVER (PARTITION BY r.code_state_id, r.hardware_environment_id, r.software_environment_id, br.benchmark_key, br.metric_name, br.statistic ORDER BY julianday(r.measured_at) DESC, br.run_id DESC) AS representative_rank FROM benchmark_results br JOIN runs r ON r.id = br.run_id JOIN code_states cs ON cs.id = r.code_state_id ${where}`;
    const aggregateSql = `WITH filtered AS (${filteredSql}), representatives AS (SELECT code_state_id, hardware_environment_id, software_environment_id, benchmark_key, metric_name, statistic, run_id AS representative_run_id FROM filtered WHERE representative_rank = 1), aggregates AS (SELECT code_state_id, hardware_environment_id, software_environment_id, benchmark_key, metric_name, statistic, unit, better, AVG(value) AS value, COUNT(*) AS run_count FROM filtered GROUP BY code_state_id, hardware_environment_id, software_environment_id, benchmark_key, metric_name, statistic, unit, better) SELECT a.*, r.representative_run_id FROM aggregates a JOIN representatives r USING (code_state_id, hardware_environment_id, software_environment_id, benchmark_key, metric_name, statistic) ORDER BY a.code_state_id, a.hardware_environment_id, a.software_environment_id, a.benchmark_key, a.metric_name, a.statistic`;
    const aggregateRows = await this.requireClient().sql<Record<string, unknown>>(aggregateSql, ...filters.params);
    return combineTrendAggregateGroups(aggregateRows.map(aggregateGroupRow));
  }

  private requireClient(): SQLocal {
    if (!this.client) throw new Error("No BenchLedger database is loaded.");
    return this.client;
  }

  private requireSnapshot(): LoadedBenchmarkDatabase {
    if (!this.snapshot) throw new Error("No BenchLedger database is loaded.");
    return this.snapshot;
  }

  private async readSnapshot(client: SQLocal, sourceLabel: string, sourceUrl: string | null): Promise<LoadedBenchmarkDatabase> {
    const tableRows = await client.sql<Record<string, unknown>>("SELECT name FROM sqlite_master WHERE type = 'table'");
    const tableNames = new Set(tableRows.map((row) => stringColumn(row.name, "sqlite_master.name")));
    for (const table of Required_Tables) if (!tableNames.has(table)) throw new Error(`Invalid BenchLedger database: missing table ${table}.`);

    const metadataRows = await client.sql<Record<string, unknown>>("SELECT key, value FROM benchledger_metadata");
    const rawMetadata: Record<string, string> = {};
    for (const row of metadataRows) {
      const key = stringColumn(row.key, "benchledger_metadata.key");
      if (Object.prototype.hasOwnProperty.call(rawMetadata, key)) throw new Error(`Invalid benchledger_metadata: duplicate key=${key}.`);
      rawMetadata[key] = stringColumn(row.value, `benchledger_metadata value for ${key}`);
    }
    const metadata: BenchLedgerMetadata = metadataFromRaw(rawMetadata);
    validateSchemaVersion(metadata);

    const [runRows, codeRows, hardwareRows, softwareRows, benchmarkKeyRows, runCountRows, metricRows, orphanRows, invalidResultRows, duplicateResultRows, betterConflictRows, unitConflictRows] = await client.batch<Record<string, unknown>>((sql) => [
      sql`SELECT id, code_state_id, hardware_environment_id, software_environment_id, measured_at, metadata FROM runs`,
      sql`SELECT id, label, code_date, identity, metadata FROM code_states`,
      sql`SELECT id, label, identity, metadata FROM hardware_environments`,
      sql`SELECT id, label, identity, metadata FROM software_environments`,
      sql`SELECT DISTINCT benchmark_key FROM benchmark_results ORDER BY benchmark_key`,
      sql`SELECT run_id, COUNT(*) AS row_count FROM benchmark_results GROUP BY run_id`,
      sql`SELECT DISTINCT br.metric_name, br.statistic, br.unit FROM benchmark_results br ORDER BY br.metric_name, br.statistic, br.unit`,
      sql`SELECT br.run_id FROM benchmark_results br LEFT JOIN runs r ON r.id = br.run_id WHERE r.id IS NULL LIMIT 1`,
      sql`SELECT run_id, benchmark_key, metric_name, statistic, unit, value, better FROM benchmark_results WHERE typeof(run_id) <> 'text' OR length(trim(CAST(run_id AS TEXT))) = 0 OR typeof(benchmark_key) <> 'text' OR length(trim(CAST(benchmark_key AS TEXT))) = 0 OR typeof(metric_name) <> 'text' OR length(trim(CAST(metric_name AS TEXT))) = 0 OR typeof(statistic) <> 'text' OR length(trim(CAST(statistic AS TEXT))) = 0 OR typeof(unit) <> 'text' OR length(trim(CAST(unit AS TEXT))) = 0 OR typeof(value) NOT IN ('integer', 'real') OR value IS NULL OR abs(value) > 1.7976931348623157e308 OR typeof(better) <> 'text' OR better NOT IN ('lower', 'higher', 'neutral') LIMIT 1`,
      sql`SELECT run_id, benchmark_key, metric_name, statistic FROM benchmark_results GROUP BY run_id, benchmark_key, metric_name, statistic HAVING COUNT(*) > 1 LIMIT 1`,
      sql`SELECT r.code_state_id, r.hardware_environment_id, r.software_environment_id, br.benchmark_key, br.metric_name, br.statistic FROM benchmark_results br JOIN runs r ON r.id = br.run_id GROUP BY r.code_state_id, r.hardware_environment_id, r.software_environment_id, br.benchmark_key, br.metric_name, br.statistic HAVING COUNT(DISTINCT br.better) > 1 LIMIT 1`,
      sql`SELECT r.code_state_id, r.hardware_environment_id, r.software_environment_id, br.benchmark_key, br.metric_name, br.statistic FROM benchmark_results br JOIN runs r ON r.id = br.run_id GROUP BY r.code_state_id, r.hardware_environment_id, r.software_environment_id, br.benchmark_key, br.metric_name, br.statistic HAVING COUNT(DISTINCT CASE WHEN br.unit IN ('ns', 'us', 'μs', 'ms', 's', 'min', 'h') THEN 'time' ELSE br.unit END) > 1 LIMIT 1`
    ]);

    const runsById = new Map<string, BenchmarkRunRecord>();
    for (const row of runRows) { const value = normalizeBenchmarkRunRecord(row); if (runsById.has(value.id)) throw new Error(`Invalid runs: duplicate id=${value.id}.`); runsById.set(value.id, value); }
    const codeStatesById = new Map<string, BenchmarkCodeState>();
    for (const row of codeRows) { const value = normalizeBenchmarkCodeState(row); if (codeStatesById.has(value.id)) throw new Error(`Invalid code_states: duplicate id=${value.id}.`); codeStatesById.set(value.id, value); }
    const hardwareEnvironmentsById = new Map<string, BenchmarkHardwareEnvironment>();
    for (const row of hardwareRows) { const value = normalizeBenchmarkHardwareEnvironment(row); if (hardwareEnvironmentsById.has(value.id)) throw new Error(`Invalid hardware_environments: duplicate id=${value.id}.`); hardwareEnvironmentsById.set(value.id, value); }
    const softwareEnvironmentsById = new Map<string, BenchmarkSoftwareEnvironment>();
    for (const row of softwareRows) { const value = normalizeBenchmarkSoftwareEnvironment(row); if (softwareEnvironmentsById.has(value.id)) throw new Error(`Invalid software_environments: duplicate id=${value.id}.`); softwareEnvironmentsById.set(value.id, value); }
    for (const run of runsById.values()) {
      if (!codeStatesById.has(run.code_state_id)) throw new Error(`Invalid run ${run.id}: unknown code_state_id=${run.code_state_id}.`);
      if (!hardwareEnvironmentsById.has(run.hardware_environment_id)) throw new Error(`Invalid run ${run.id}: unknown hardware_environment_id=${run.hardware_environment_id}.`);
      if (!softwareEnvironmentsById.has(run.software_environment_id)) throw new Error(`Invalid run ${run.id}: unknown software_environment_id=${run.software_environment_id}.`);
    }
    if (orphanRows.length) throw new Error(`Invalid benchmark result: unknown run_id=${stringColumn(orphanRows[0].run_id, "orphan benchmark run_id")}.`);
    if (invalidResultRows.length) normalizeBenchmarkRow(invalidResultRows[0]);
    if (duplicateResultRows.length) throw new Error(`Cannot aggregate duplicate result for run_id=${stringColumn(duplicateResultRows[0].run_id, "duplicate benchmark run_id")}, benchmark_key=${stringColumn(duplicateResultRows[0].benchmark_key, "duplicate benchmark key")}, metric_name=${stringColumn(duplicateResultRows[0].metric_name, "duplicate benchmark metric")}, statistic=${stringColumn(duplicateResultRows[0].statistic, "duplicate benchmark statistic")}.`);
    if (betterConflictRows.length) throw new Error(`Cannot aggregate benchmark_key=${stringColumn(betterConflictRows[0].benchmark_key, "conflicting better benchmark key")}, metric_name=${stringColumn(betterConflictRows[0].metric_name, "conflicting better metric")}, statistic=${stringColumn(betterConflictRows[0].statistic, "conflicting better statistic")}: conflicting better values.`);
    if (unitConflictRows.length) throw new Error(`Cannot aggregate benchmark_key=${stringColumn(unitConflictRows[0].benchmark_key, "conflicting unit benchmark key")}, metric_name=${stringColumn(unitConflictRows[0].metric_name, "conflicting unit metric")}, statistic=${stringColumn(unitConflictRows[0].statistic, "conflicting unit statistic")}: conflicting units.`);

    const benchmarksByKey = new Map<string, BenchmarkDefinition>();
    for (const row of benchmarkKeyRows) { const rawKey = stringColumn(row.benchmark_key, "benchmark result key"); const definition = normalizeBenchmarkKey(rawKey, "benchmark_results"); benchmarksByKey.set(definition.key, definition); }

    const runIdsWithResults = new Set<string>();
    let rowCount = 0;
    for (const row of runCountRows) { const runId = stringColumn(row.run_id, "benchmark result run_id"); runIdsWithResults.add(runId); rowCount += finiteCount(row.row_count, "benchmark result count"); }
    const configurationMap = new Map<string, BenchmarkConfigurationIds>();
    let minCodeDate = "";
    let maxCodeDate = "";
    let minCodeDateValue = Number.POSITIVE_INFINITY;
    let maxCodeDateValue = Number.NEGATIVE_INFINITY;
    for (const runId of runIdsWithResults) {
      const run = runsById.get(runId);
      if (!run) throw new Error(`Invalid benchmark result: unknown run_id=${runId}.`);
      const ids = { code_state_id: run.code_state_id, hardware_environment_id: run.hardware_environment_id, software_environment_id: run.software_environment_id };
      configurationMap.set(configurationKey(ids), ids);
      const codeDate = codeStatesById.get(run.code_state_id)?.code_date ?? "";
      const codeDateValue = parseDate(codeDate)?.valueOf();
      if (codeDateValue === undefined) continue;
      if (codeDateValue < minCodeDateValue) { minCodeDateValue = codeDateValue; minCodeDate = codeDate; }
      if (codeDateValue > maxCodeDateValue) { maxCodeDateValue = codeDateValue; maxCodeDate = codeDate; }
    }
    const configurations = Array.from(configurationMap.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([, ids]) => ids);
    const normalizedMetricRows: MetricCatalogRow[] = metricRows.map((row) => ({ metric_name: stringColumn(row.metric_name, "metric catalog metric_name"), statistic: stringColumn(row.statistic, "metric catalog statistic"), unit: stringColumn(row.unit, "metric catalog unit") }));
    const viewCatalog = buildViewCatalog(normalizedMetricRows, runsById, runIdsWithResults, minCodeDate, maxCodeDate);
    const latestRunDate = Array.from(runsById.values()).reduce((latest, run) => {
      const currentValue = parseDate(run.measured_at)?.valueOf() ?? Number.NEGATIVE_INFINITY;
      const latestValue = parseDate(latest)?.valueOf() ?? Number.NEGATIVE_INFINITY;
      return currentValue > latestValue ? run.measured_at : latest;
    }, "");
    const allConfigurationCount = new Set(Array.from(runsById.values(), (run) => configurationKey({ code_state_id: run.code_state_id, hardware_environment_id: run.hardware_environment_id, software_environment_id: run.software_environment_id }))).size;
    const stats: BenchmarkDatabaseStats = { rowCount, runCount: runsById.size, keyCount: benchmarksByKey.size, hardwareEnvironmentCount: hardwareEnvironmentsById.size, softwareEnvironmentCount: softwareEnvironmentsById.size, configurationCount: allConfigurationCount, metrics: Array.from(viewCatalog.metricSourcesByLabel.keys()).sort(), latestRunDate, dirtyRunCount: Array.from(runsById.values()).filter((run) => codeStatesById.get(run.code_state_id)?.metadata.source?.dirty === true).length };

    return { benchmarksByKey, runsById, codeStatesById, hardwareEnvironmentsById, softwareEnvironmentsById, configurations, viewCatalog, stats, metadata, source_label: sourceLabel, source_url: sourceUrl };
  }
}

