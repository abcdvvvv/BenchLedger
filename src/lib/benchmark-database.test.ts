import { afterEach, describe, expect, it } from "vitest";
import { SQLocal } from "sqlocal";
import { BenchmarkDatabaseSession, type BenchmarkResultQuery } from "./benchmark-database";

const Sessions: BenchmarkDatabaseSession[] = [];
const Base_Query: BenchmarkResultQuery = { yAxis: "time median", branch: "all", timeStartValue: null, timeEndValue: null, displayStrategy: "all" };
const Key_A = '["suite","group","a"]';
const Key_B = '["suite","group","b"]';
const Key_C = '["suite","other","c"]';

function configurationKey(codeStateId: string, hardwareEnvironmentId: string, softwareEnvironmentId: string): string { return JSON.stringify([codeStateId, hardwareEnvironmentId, softwareEnvironmentId]); }

async function connectedMemoryDatabase(): Promise<SQLocal> {
  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => { resolveReady = resolve; });
  const client = new SQLocal({ databasePath: ":memory:", onConnect: () => resolveReady() });
  await ready;
  return client;
}

async function fixtureDatabaseFile(): Promise<File> {
  const db = await connectedMemoryDatabase();
  await db.batch((sql) => [
    sql`CREATE TABLE benchledger_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
    sql`CREATE TABLE code_states (id TEXT PRIMARY KEY, label TEXT NOT NULL, code_date TEXT NOT NULL, identity TEXT NOT NULL, metadata TEXT NOT NULL)`,
    sql`CREATE TABLE hardware_environments (id TEXT PRIMARY KEY, label TEXT NOT NULL, identity TEXT NOT NULL, metadata TEXT NOT NULL)`,
    sql`CREATE TABLE software_environments (id TEXT PRIMARY KEY, label TEXT NOT NULL, identity TEXT NOT NULL, metadata TEXT NOT NULL)`,
    sql`CREATE TABLE runs (id TEXT PRIMARY KEY, code_state_id TEXT NOT NULL, hardware_environment_id TEXT NOT NULL, software_environment_id TEXT NOT NULL, measured_at TEXT NOT NULL, metadata TEXT NOT NULL)`,
    sql`CREATE TABLE benchmark_results (run_id TEXT NOT NULL, benchmark_key TEXT NOT NULL, metric_name TEXT NOT NULL, statistic TEXT NOT NULL, unit TEXT NOT NULL, value REAL NOT NULL, better TEXT NOT NULL)`
  ]);
  await db.batch((sql) => [
    sql`INSERT INTO benchledger_metadata VALUES ('schema_version', '6')`,
    sql`INSERT INTO benchledger_metadata VALUES ('name', 'SQLocal fixture')`,
    sql`INSERT INTO code_states VALUES ('c1', 'Commit 1', '2026-01-01T00:00:00Z', ${JSON.stringify({ source: { kind: "git", revision: "111111" } })}, ${JSON.stringify({ source: { dirty: false } })})`,
    sql`INSERT INTO code_states VALUES ('c2', 'Commit 2', '2026-01-01T23:30:00-02:00', ${JSON.stringify({ source: { kind: "git", revision: "222222" } })}, ${JSON.stringify({ source: { dirty: false } })})`,
    sql`INSERT INTO hardware_environments VALUES ('h1', 'CPU 1', ${JSON.stringify({ architecture: "x86_64", cpu: { model: "CPU 1" } })}, '{}')`,
    sql`INSERT INTO hardware_environments VALUES ('h2', 'CPU 2', ${JSON.stringify({ architecture: "x86_64", cpu: { model: "CPU 2" } })}, '{}')`,
    sql`INSERT INTO software_environments VALUES ('s1', 'Julia', ${JSON.stringify({ runtime: { name: "Julia", version: "1.12" } })}, '{}')`,
    sql`INSERT INTO runs VALUES ('r1', 'c1', 'h1', 's1', '2026-01-01T03:00:00+02:00', ${JSON.stringify({ source: { branch: "main", tags: [] } })})`,
    sql`INSERT INTO runs VALUES ('r2', 'c1', 'h1', 's1', '2026-01-01T02:00:00Z', ${JSON.stringify({ source: { branch: "main", tags: [] } })})`,
    sql`INSERT INTO runs VALUES ('r3', 'c2', 'h2', 's1', '2026-01-02T01:00:00Z', ${JSON.stringify({ source: { branch: "feature", tags: ["v1.0.0"] } })})`,
    sql`INSERT INTO runs VALUES ('r0', 'c2', 'h1', 's1', '2025-12-31T23:00:00Z', ${JSON.stringify({ source: { branch: "scratch", tags: [] } })})`
  ]);
  await db.batch((sql) => [
    sql`INSERT INTO benchmark_results VALUES ('r1', ${Key_A}, 'time', 'median', 'ns', 100, 'lower')`,
    sql`INSERT INTO benchmark_results VALUES ('r1', ${Key_B}, 'time', 'median', 'ns', 200, 'lower')`,
    sql`INSERT INTO benchmark_results VALUES ('r1', ${Key_A}, 'memory', 'median', 'bytes', 1000, 'lower')`,
    sql`INSERT INTO benchmark_results VALUES ('r2', ${Key_A}, 'time', 'median', 'us', 0.12, 'lower')`,
    sql`INSERT INTO benchmark_results VALUES ('r2', ${Key_B}, 'time', 'median', 'ns', 180, 'lower')`,
    sql`INSERT INTO benchmark_results VALUES ('r3', ${Key_A}, 'time', 'median', 'ns', 80, 'lower')`,
    sql`INSERT INTO benchmark_results VALUES ('r3', ${Key_C}, 'time', 'median', 'ns', 50, 'lower')`
  ]);
  const file = await db.getDatabaseFile();
  await db.destroy(true);
  return file;
}

async function loadedSession(): Promise<{ session: BenchmarkDatabaseSession; database: Awaited<ReturnType<BenchmarkDatabaseSession["replaceDatabaseFile"]>>; }> {
  const session = new BenchmarkDatabaseSession();
  Sessions.push(session);
  const database = await session.replaceDatabaseFile(await fixtureDatabaseFile(), "fixture.sqlite", null);
  return { session, database };
}

afterEach(async () => { while (Sessions.length) await Sessions.pop()!.destroy(); });

describe("BenchmarkDatabaseSession", () => {
  it("keeps benchmark values inside SQLocal while exposing only the lightweight catalog snapshot", async () => {
    const { database } = await loadedSession();
    expect(database.stats).toMatchObject({ rowCount: 7, runCount: 4, keyCount: 3, configurationCount: 3, latestRunDate: "2026-01-02T01:00:00Z" });
    expect(database.configurations).toHaveLength(2);
    expect(database.benchmarkCountByRun).toEqual(new Map([["r1", 2], ["r2", 2], ["r3", 2]]));
    expect(database.viewCatalog.metricOptions).toEqual(["memory median bytes", "time median"]);
    expect(database.viewCatalog.branchOptions).toEqual(["all", "feature", "main"]);
    expect("rows" in database).toBe(false);
    expect("aggregateRows" in database).toBe(false);
  });


  it("loads standalone WAL-format SQLite files by normalizing the import copy", async () => {
    const session = new BenchmarkDatabaseSession();
    Sessions.push(session);
    const source = new Uint8Array(await (await fixtureDatabaseFile()).arrayBuffer());
    source[18] = 2; source[19] = 2;
    const database = await session.replaceDatabaseFile(source.buffer, "wal.sqlite", null);
    expect(database.stats).toMatchObject({ rowCount: 7, runCount: 4, keyCount: 3 });
    await expect(session.queryBenchmarkKeys(Base_Query)).resolves.toEqual([Key_A, Key_B, Key_C]);
  });

  it("queries benchmark keys, run summaries, and trend aggregates only for the requested slice", async () => {
    const { session } = await loadedSession();
    await expect(session.queryBenchmarkKeys(Base_Query)).resolves.toEqual([Key_A, Key_B, Key_C]);
    await expect(session.queryBenchmarkKeys({ ...Base_Query, configurationKeys: [configurationKey("c1", "h1", "s1")] })).resolves.toEqual([Key_A, Key_B]);
    await expect(session.queryBenchmarkKeys({ ...Base_Query, branch: "feature" })).resolves.toEqual([Key_A, Key_C]);
    await expect(session.queryBenchmarkKeys({ ...Base_Query, benchmarkKeys: [Key_A, Key_B] })).resolves.toEqual([Key_A, Key_B]);
    await expect(session.queryBenchmarkKeys({ ...Base_Query, timeStartValue: Date.parse("2026-01-02T00:00:00Z"), timeEndValue: Date.parse("2026-01-02T23:59:59.999Z") })).resolves.toEqual([Key_A, Key_C]);
    await expect(session.queryRunSlice(Base_Query)).resolves.toEqual([
      { run_id: "r1", row_count: 2, benchmark_count: 2 },
      { run_id: "r2", row_count: 2, benchmark_count: 2 },
      { run_id: "r3", row_count: 2, benchmark_count: 2 }
    ]);
    const trendRows = await session.queryTrendAggregates({ ...Base_Query, benchmarkKeys: [Key_A] });
    expect(trendRows).toEqual(expect.arrayContaining([
      expect.objectContaining({ configuration_key: configurationKey("c1", "h1", "s1"), value: 110, unit: "ns", run_count: 2, representative_run_id: "r2" }),
      expect.objectContaining({ configuration_key: configurationKey("c2", "h2", "s1"), value: 80, unit: "ns", run_count: 1, representative_run_id: "r3" })
    ]));
  });


  it("keeps the active database when a replacement fails validation", async () => {
    const { session } = await loadedSession();
    const invalid = await fixtureDatabaseFile();
    const editor = await connectedMemoryDatabase();
    await editor.overwriteDatabaseFile(invalid);
    await editor.sql`UPDATE benchledger_metadata SET value = '5' WHERE key = 'schema_version'`;
    const invalidFile = await editor.getDatabaseFile();
    await editor.destroy(true);
    await expect(session.replaceDatabaseFile(invalidFile, "invalid.sqlite", null)).rejects.toThrow();
    await expect(session.queryBenchmarkKeys(Base_Query)).resolves.toEqual([Key_A, Key_B, Key_C]);
  });

  it("rejects invalid benchmark result fields while loading instead of deferring failure to a page query", async () => {
    const session = new BenchmarkDatabaseSession();
    Sessions.push(session);
    const invalid = await fixtureDatabaseFile();
    const editor = await connectedMemoryDatabase();
    await editor.overwriteDatabaseFile(invalid);
    await editor.sql`UPDATE benchmark_results SET better = 'sideways' WHERE run_id = 'r1' AND benchmark_key = ${Key_A} AND metric_name = 'time'`;
    const invalidFile = await editor.getDatabaseFile();
    await editor.destroy(true);
    await expect(session.replaceDatabaseFile(invalidFile, "invalid-result.sqlite", null)).rejects.toThrow(/better/i);
  });


  it("preserves load-time aggregate integrity checks without materializing aggregates", async () => {
    const session = new BenchmarkDatabaseSession();
    Sessions.push(session);
    const invalid = await fixtureDatabaseFile();
    const editor = await connectedMemoryDatabase();
    await editor.overwriteDatabaseFile(invalid);
    await editor.sql`UPDATE benchmark_results SET better = 'higher' WHERE run_id = 'r2' AND benchmark_key = ${Key_A} AND metric_name = 'time'`;
    const invalidFile = await editor.getDatabaseFile();
    await editor.destroy(true);
    await expect(session.replaceDatabaseFile(invalidFile, "conflicting-aggregate.sqlite", null)).rejects.toThrow(/conflicting better/i);
  });

  it("rejects duplicate results and incompatible aggregate units at load time", async () => {
    const duplicateSession = new BenchmarkDatabaseSession();
    const unitSession = new BenchmarkDatabaseSession();
    Sessions.push(duplicateSession, unitSession);
    const duplicateEditor = await connectedMemoryDatabase();
    await duplicateEditor.overwriteDatabaseFile(await fixtureDatabaseFile());
    await duplicateEditor.sql`INSERT INTO benchmark_results VALUES ('r1', ${Key_A}, 'time', 'median', 'ns', 101, 'lower')`;
    const duplicateFile = await duplicateEditor.getDatabaseFile();
    await duplicateEditor.destroy(true);
    await expect(duplicateSession.replaceDatabaseFile(duplicateFile, "duplicate-result.sqlite", null)).rejects.toThrow(/duplicate result/i);
    const unitEditor = await connectedMemoryDatabase();
    await unitEditor.overwriteDatabaseFile(await fixtureDatabaseFile());
    await unitEditor.sql`UPDATE benchmark_results SET unit = 'bytes' WHERE run_id = 'r2' AND benchmark_key = ${Key_A} AND metric_name = 'time'`;
    const unitFile = await unitEditor.getDatabaseFile();
    await unitEditor.destroy(true);
    await expect(unitSession.replaceDatabaseFile(unitFile, "conflicting-unit.sqlite", null)).rejects.toThrow(/conflicting units/i);
  });


  it("preserves tagged-only and tagged-main filtering semantics in SQL", async () => {
    const session = new BenchmarkDatabaseSession();
    Sessions.push(session);
    const source = await fixtureDatabaseFile();
    const editor = await connectedMemoryDatabase();
    await editor.overwriteDatabaseFile(source);
    await editor.sql`INSERT INTO benchmark_results VALUES ('r0', ${Key_B}, 'time', 'median', 'ns', 90, 'lower')`;
    const file = await editor.getDatabaseFile();
    await editor.destroy(true);
    await session.replaceDatabaseFile(file, "display-strategy.sqlite", null);
    await expect(session.queryRunSlice({ ...Base_Query, displayStrategy: "tagged-only" })).resolves.toEqual([{ run_id: "r3", row_count: 2, benchmark_count: 2 }]);
    await expect(session.queryRunSlice({ ...Base_Query, displayStrategy: "tagged-main" })).resolves.toEqual([
      { run_id: "r1", row_count: 2, benchmark_count: 2 },
      { run_id: "r2", row_count: 2, benchmark_count: 2 },
      { run_id: "r3", row_count: 2, benchmark_count: 2 }
    ]);
  });

});
