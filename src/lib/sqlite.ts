import initSqlJs, { type Database, type QueryExecResult } from "sql.js";
import type { BenchmarkRow } from "./types";
import sqlWasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import sqliteUrl from "../data/results.sqlite?url";

let sqlPromise: Promise<Awaited<ReturnType<typeof initSqlJs>>> | null = null;

async function loadSqlJs() {
  if (!sqlPromise) {
    sqlPromise = initSqlJs({
      locateFile: () => sqlWasmUrl
    });
  }
  return sqlPromise;
}

function normalizeRow(values: Record<string, unknown>): BenchmarkRow {
  return {
    branch: String(values.branch ?? ""),
    tag: String(values.tag ?? ""),
    code_state_id: String(values.code_state_id ?? ""),
    label: String(values.label ?? ""),
    commit_sha: String(values.commit_sha ?? ""),
    date: String(values.date ?? ""),
    benchmark_key: String(values.benchmark_key ?? ""),
    metric_kind: String(values.metric_kind ?? ""),
    time_ns_median: Number(values.time_ns_median ?? 0),
    time_ns_min: Number(values.time_ns_min ?? 0),
    memory_bytes_min: Number(values.memory_bytes_min ?? 0),
    allocs_min: Number(values.allocs_min ?? 0),
    machine_id: String(values.machine_id ?? ""),
    cpu_model: String(values.cpu_model ?? ""),
    cpu_threads: Number(values.cpu_threads ?? 0),
    arch: String(values.arch ?? ""),
    os: String(values.os ?? ""),
    julia_version: String(values.julia_version ?? ""),
    is_dirty: Boolean(values.is_dirty),
    notes: String(values.notes ?? ""),
    group: String(values.benchmark_key ?? "").split("/")[0] || "other"
  };
}

function rowsFromResult(result: QueryExecResult | undefined): BenchmarkRow[] {
  if (!result) return [];
  return result.values.map((row: unknown[]) => {
    const entry = Object.fromEntries(result.columns.map((column: string, index: number) => [column, row[index]]));
    return normalizeRow(entry);
  });
}

export async function loadBenchmarkRows(): Promise<BenchmarkRow[]> {
  const SQL = await loadSqlJs();
  const response = await fetch(sqliteUrl);
  if (!response.ok) {
    throw new Error(`Failed to load SQLite file: ${response.status}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const db: Database = new SQL.Database(bytes);
  const result = db.exec(`
    SELECT
      branch,
      tag,
      code_state_id,
      label,
      "commit" AS commit_sha,
      date,
      benchmark_key,
      metric_kind,
      time_ns_median,
      time_ns_min,
      memory_bytes_min,
      allocs_min,
      machine_id,
      cpu_model,
      cpu_threads,
      arch,
      os,
      julia_version,
      is_dirty,
      notes
    FROM benchmark_results
    ORDER BY date, benchmark_key
  `);
  db.close();
  return rowsFromResult(result[0]);
}
