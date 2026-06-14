export type BenchmarkRow = {
  branch: string;
  tag: string;
  code_state_id: string;
  label: string;
  commit_sha: string;
  date: string;
  benchmark_key: string;
  metric_kind: string;
  time_ns_median: number;
  time_ns_min: number;
  memory_bytes_min: number;
  allocs_min: number;
  machine_id: string;
  cpu_model: string;
  cpu_threads: number;
  arch: string;
  os: string;
  julia_version: string;
  is_dirty: boolean;
  notes: string;
  group: string;
};

export type BenchmarkRun = {
  run_id: string;
  code_state_id: string;
  branch: string;
  tag: string;
  label: string;
  commit_sha: string;
  date: string;
  metric_kind: string;
  machine_id: string;
  cpu_model: string;
  cpu_threads: number;
  arch: string;
  os: string;
  julia_version: string;
  is_dirty: boolean;
  notes: string;
  benchmark_count: number;
};

export type PairComparison = {
  benchmark_key: string;
  focus_time_ns_median: number;
  baseline_time_ns_median: number;
  focus_memory_bytes_min: number;
  baseline_memory_bytes_min: number;
  focus_allocs_min: number;
  baseline_allocs_min: number;
  runtime_delta: number;
  memory_delta: number;
  alloc_delta: number;
};
