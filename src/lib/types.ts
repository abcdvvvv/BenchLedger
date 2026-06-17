export type BenchmarkRow = {
  run_id: string;
  branch: string;
  tag: string;
  code_state_id: string;
  label: string;
  commit_sha: string;
  code_date: string;
  measured_at: string;
  benchmark_path: string[];
  benchmark_id: string;
  benchmark_label: string;
  metric_name: string;
  statistic: string;
  unit: string;
  value: number;
  better: "lower" | "higher" | "neutral";
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
  code_date: string;
  measured_at: string;
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
  benchmark_id: string;
  benchmark_label: string;
  focus_value: number;
  baseline_value: number;
  delta: number;
  unit: string;
  better: "lower" | "higher" | "neutral";
};

export type BenchLedgerManifestDatabase = {
  id: string;
  name?: string;
  description?: string;
  url: string;
  sha256?: string;
  size_bytes?: number;
  packed_at?: string;
  schema_version?: number;
  metadata_preview?: Record<string, string | null>;
};

export type BenchLedgerManifest = {
  manifest_version: number;
  benchledger_web_version?: string;
  generated_at?: string;
  site?: {
    title?: string;
    description?: string;
  };
  databases: BenchLedgerManifestDatabase[];
};

export type BenchLedgerMetadata = {
  schema_version: number | null;
  name: string;
  description: string;
  project_url: string;
  logo_url: string;
  logo_url_light: string;
  logo_url_dark: string;
  created_at: string;
  updated_at: string;
  notes: string;
  raw: Record<string, string>;
};

export type LoadedBenchmarkDataset = {
  rows: BenchmarkRow[];
  metadata: BenchLedgerMetadata;
  source_label: string;
  source_url: string | null;
};
