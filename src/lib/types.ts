export type BenchmarkCodeStateMetadata = {
  source?: {
    kind?: string;
    branch?: string;
    tags?: string[];
    revision?: string;
    dirty?: boolean;
    diff_digest?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type BenchmarkEnvironmentMetadata = {
  platform?: {
    os?: {
      name?: string;
      version?: string;
      [key: string]: unknown;
    };
    kernel?: {
      name?: string;
      version?: string;
      [key: string]: unknown;
    };
    architecture?: string;
    [key: string]: unknown;
  };
  hardware?: {
    cpu?: {
      model?: string;
      logical_threads?: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  runtime?: {
    name?: string;
    version?: string;
    [key: string]: unknown;
  };
  benchmark?: {
    framework?: {
      name?: string;
      version?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  execution?: {
    processes?: number;
    threads?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type BenchmarkRunMetadata = {
  writer?: {
    name?: string;
    version?: string;
    [key: string]: unknown;
  };
  source?: {
    branch?: string;
    tags?: string[];
    [key: string]: unknown;
  };
  ci?: {
    provider?: string;
    workflow?: string;
    job?: string;
    run_id?: string;
    event?: string;
    runner_name?: string;
    run_attempt?: number;
    run_url?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type BenchmarkRow = {
  run_id: string;
  code_state_id: string;
  code_label: string;
  code_date: string;
  environment_id: string;
  environment_label: string;
  measured_at: string;
  notes: string;
  code_state_metadata: BenchmarkCodeStateMetadata;
  environment_metadata: BenchmarkEnvironmentMetadata;
  run_metadata: BenchmarkRunMetadata;
  benchmark_path: string[];
  benchmark_id: string;
  benchmark_label: string;
  metric_name: string;
  statistic: string;
  unit: string;
  value: number;
  better: "lower" | "higher" | "neutral";
  group: string;
};

export type BenchmarkRun = {
  run_id: string;
  code_state_id: string;
  code_label: string;
  code_date: string;
  environment_id: string;
  environment_label: string;
  measured_at: string;
  notes: string;
  code_state_metadata: BenchmarkCodeStateMetadata;
  environment_metadata: BenchmarkEnvironmentMetadata;
  run_metadata: BenchmarkRunMetadata;
  benchmark_count: number;
};

export type PairComparison = {
  benchmark_id: string;
  benchmark_label: string;
  focus_value: number;
  baseline_value: number;
  focus_unit: string;
  baseline_unit: string;
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
