export type BenchmarkBetter = "lower" | "higher" | "neutral";

export type BenchmarkCodeStateIdentity = {
  source?: {
    kind?: string;
    revision?: string;
    diff_digest?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type BenchmarkHardwareEnvironmentIdentity = {
  architecture?: string;
  cpu?: {
    model?: string;
    vendor?: string;
    physical_cores?: number;
    logical_threads?: number;
    packages?: number;
    microarchitecture?: string;
    numa_nodes?: number;
    [key: string]: unknown;
  };
  memory?: {
    total_bytes?: number;
    [key: string]: unknown;
  };
  gpu?: Array<{
    vendor?: string;
    model?: string;
    type?: "integrated" | "discrete" | "unknown";
    memory_bytes?: number;
    count?: number;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
};

type BenchmarkNamedVersion = {
  name?: string;
  version?: string;
  [key: string]: unknown;
};

export type BenchmarkSoftwareEnvironmentIdentity = {
  platform?: {
    os?: BenchmarkNamedVersion;
    kernel?: BenchmarkNamedVersion;
    [key: string]: unknown;
  };
  runtime?: BenchmarkNamedVersion;
  gpu_drivers?: Array<{
    vendor?: string;
    name?: string;
    variant?: string;
    version?: string;
    device_count?: number;
    [key: string]: unknown;
  }>;
  gpu?: {
    interface?: BenchmarkNamedVersion;
    [key: string]: unknown;
  };
  gpu_runtime?: {
    backend?: string;
    runtime?: BenchmarkNamedVersion;
    [key: string]: unknown;
  };
  execution?: {
    processes?: number;
    threads?: number;
    [key: string]: unknown;
  };
  math_libraries?: {
    blas?: {
      libraries?: Array<{
        implementation?: string;
        interface?: string;
        [key: string]: unknown;
      }>;
      threads?: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  benchmark?: {
    framework?: BenchmarkNamedVersion;
    [key: string]: unknown;
  };
  dependencies?: {
    kind?: string;
    format?: string;
    digest?: string;
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

export type BenchmarkEnvironmentMetadata = Record<string, unknown>;

export type BenchmarkRunMetadata = {
  notes?: string;
  writer?: {
    name?: string;
    schema_version?: number;
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

/** A canonical benchmark key and its decoded path. */
export type BenchmarkDefinition = {
  key: string;
  path: string[];
  label: string;
};

/** A raw metric result from one physical run. */
export type BenchmarkRow = {
  run_id: string;
  benchmark_key: string;
  metric_name: string;
  statistic: string;
  unit: string;
  value: number;
  better: BenchmarkBetter;
};

/** An average across repeated runs of one code/hardware/software configuration. */
export type BenchmarkAggregateRow = {
  configuration_key: string;
  code_state_id: string;
  hardware_environment_id: string;
  software_environment_id: string;
  benchmark_key: string;
  metric_name: string;
  statistic: string;
  unit: string;
  value: number;
  better: BenchmarkBetter;
  run_count: number;
};

export type BenchmarkCodeState = {
  id: string;
  label: string;
  code_date: string;
  identity: BenchmarkCodeStateIdentity;
  metadata: BenchmarkCodeStateMetadata;
};

export type BenchmarkHardwareEnvironment = {
  id: string;
  label: string;
  identity: BenchmarkHardwareEnvironmentIdentity;
  metadata: BenchmarkEnvironmentMetadata;
};

export type BenchmarkSoftwareEnvironment = {
  id: string;
  label: string;
  identity: BenchmarkSoftwareEnvironmentIdentity;
  metadata: BenchmarkEnvironmentMetadata;
};

export type BenchmarkRunRecord = {
  id: string;
  code_state_id: string;
  hardware_environment_id: string;
  software_environment_id: string;
  measured_at: string;
  metadata: BenchmarkRunMetadata;
};

/** Resolved raw-run context used by run detail and run-to-run comparison. */
export type BenchmarkRun = {
  run_id: string;
  code_state_id: string;
  code_label: string;
  code_date: string;
  hardware_environment_id: string;
  hardware_environment_label: string;
  software_environment_id: string;
  software_environment_label: string;
  environment_pair_key: string;
  environment_pair_label: string;
  configuration_key: string;
  configuration_label: string;
  measured_at: string;
  notes: string;
  code_state_identity: BenchmarkCodeStateIdentity;
  code_state_metadata: BenchmarkCodeStateMetadata;
  hardware_environment_identity: BenchmarkHardwareEnvironmentIdentity;
  hardware_environment_metadata: BenchmarkEnvironmentMetadata;
  software_environment_identity: BenchmarkSoftwareEnvironmentIdentity;
  software_environment_metadata: BenchmarkEnvironmentMetadata;
  run_metadata: BenchmarkRunMetadata;
  benchmark_count: number;
};

type PairComparisonBase = {
  benchmark_key: string;
  benchmark_label: string;
  better: BenchmarkBetter;
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
  metadata_preview?: Record<string, string | null>;
};

export type BenchLedgerManifest = {
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

export type BenchmarkMetricSource = { metric_name: string; statistic: string; unit: string; };

export type BenchmarkViewCatalog = {
  metricOptions: string[];
  metricSourcesByLabel: ReadonlyMap<string, BenchmarkMetricSource[]>;
  branchOptions: string[];
  databaseTimeStart: string;
  databaseTimeEnd: string;
};

export type BenchmarkConfigurationIds = {
  code_state_id: string;
  hardware_environment_id: string;
  software_environment_id: string;
};

export type BenchmarkDatabaseStats = {
  rowCount: number;
  runCount: number;
  keyCount: number;
  hardwareEnvironmentCount: number;
  softwareEnvironmentCount: number;
  configurationCount: number;
  metrics: string[];
  latestRunDate: string;
  dirtyRunCount: number;
};

/** Lightweight database snapshot. Benchmark result rows remain inside SQLocal and are queried on demand. */
export type LoadedBenchmarkDatabase = {
  benchmarksByKey: ReadonlyMap<string, BenchmarkDefinition>;
  runsById: ReadonlyMap<string, BenchmarkRunRecord>;
  codeStatesById: ReadonlyMap<string, BenchmarkCodeState>;
  hardwareEnvironmentsById: ReadonlyMap<string, BenchmarkHardwareEnvironment>;
  softwareEnvironmentsById: ReadonlyMap<string, BenchmarkSoftwareEnvironment>;
  configurations: BenchmarkConfigurationIds[];
  benchmarkCountByRun: ReadonlyMap<string, number>;
  viewCatalog: BenchmarkViewCatalog;
  stats: BenchmarkDatabaseStats;
  metadata: BenchLedgerMetadata;
  source_label: string;
  source_url: string | null;
};
