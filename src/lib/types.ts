export type BenchmarkCodeStateIdentity = {
  source?: {
    kind?: string;
    revision?: string;
    diff_digest?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type BenchmarkEnvironmentIdentity = {
  platform?: {
    os?: {
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
  execution?: {
    processes?: number;
    threads?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type BenchmarkCodeStateMetadata = {
  source?: {
    dirty?: boolean;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type BenchmarkEnvironmentMetadata = {
  benchmark?: {
    framework?: {
      name?: string;
      version?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  platform?: {
    kernel?: {
      name?: string;
      version?: string;
      [key: string]: unknown;
    };
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

/** A unique benchmark definition shared by all metric results and runs. */
export type BenchmarkDefinition = {
  id: string;
  path: string[];
  label: string;
};

/** A single metric result. Benchmark, run, code-state, and environment context live in normalized entity maps. */
export type BenchmarkRow = {
  run_id: string;
  benchmark_id: string;
  metric_name: string;
  statistic: string;
  unit: string;
  value: number;
  better: "lower" | "higher" | "neutral";
};

export type BenchmarkCodeState = {
  id: string;
  label: string;
  code_date: string;
  identity: BenchmarkCodeStateIdentity;
  metadata: BenchmarkCodeStateMetadata;
};

export type BenchmarkEnvironment = {
  id: string;
  label: string;
  identity: BenchmarkEnvironmentIdentity;
  metadata: BenchmarkEnvironmentMetadata;
};

export type BenchmarkRunRecord = {
  id: string;
  code_state_id: string;
  environment_id: string;
  measured_at: string;
  notes: string;
  metadata: BenchmarkRunMetadata;
};

/** Resolved run context used by the UI. Built once per run from the normalized entity maps. */
export type BenchmarkRun = {
  run_id: string;
  code_state_id: string;
  code_label: string;
  code_date: string;
  environment_id: string;
  environment_label: string;
  measured_at: string;
  notes: string;
  code_state_identity: BenchmarkCodeStateIdentity;
  code_state_metadata: BenchmarkCodeStateMetadata;
  environment_identity: BenchmarkEnvironmentIdentity;
  environment_metadata: BenchmarkEnvironmentMetadata;
  run_metadata: BenchmarkRunMetadata;
  benchmark_count: number;
};

type PairComparisonBase = {
  benchmark_id: string;
  benchmark_label: string;
  better: "lower" | "higher" | "neutral";
};

export type PairComparison = PairComparisonBase & (
  | {
      status: "matched";
      focus_value: number;
      baseline_value: number;
      focus_unit: string;
      baseline_unit: string;
      delta: number;
      unit: string;
    }
  | {
      status: "focus-only";
      focus_value: number;
      baseline_value: null;
      focus_unit: string;
      baseline_unit: null;
      delta: null;
      unit: string;
    }
  | {
      status: "baseline-only";
      focus_value: null;
      baseline_value: number;
      focus_unit: null;
      baseline_unit: string;
      delta: null;
      unit: string;
    }
);

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
  benchmarksById: ReadonlyMap<string, BenchmarkDefinition>;
  runsById: ReadonlyMap<string, BenchmarkRunRecord>;
  codeStatesById: ReadonlyMap<string, BenchmarkCodeState>;
  environmentsById: ReadonlyMap<string, BenchmarkEnvironment>;
  metadata: BenchLedgerMetadata;
  source_label: string;
  source_url: string | null;
};
