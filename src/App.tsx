import { useEffect, useMemo, useRef, useState } from "react";
import { FiActivity, FiClock, FiDatabase, FiGitBranch } from "react-icons/fi";
import { GroupCascadeMenu, type GroupMenuOption } from "./components/GroupCascadeMenu";
import Plot from "./components/Plot";
import {
  deltaClass,
  formatBytes,
  formatDate,
  formatPercent,
  formatRuntime,
  parseDate,
  percentageChange,
  shortCommit,
  unique
} from "./lib/format";
import {
  loadBenchmarkRowsFromFile,
  loadBenchmarkRowsFromManifestDatabase,
  loadManifest
} from "./lib/sqlite";
import type {
  BenchmarkRow,
  BenchmarkRun,
  BenchLedgerManifest,
  BenchLedgerManifestDatabase,
  BenchLedgerMetadata,
  LoadedBenchmarkDataset,
  PairComparison
} from "./lib/types";

type ThemeMode = "light" | "dark";
type TrendLineShape = "line" | "curve";
type TrendAxisMode = "commit" | "time";
type DisplayStrategy = "all" | "tagged-only" | "tagged-main";
type ActivePage = "overview" | "chart-tuning" | "database-catalog";
type AppPhase = "booting" | "select-source" | "loading-database" | "ready";
type RunPairSortKey = "benchmark" | "focus" | "baseline" | "delta" | "memory" | "allocs";
type SortDirection = "asc" | "desc";
type RunPairSort = {
  key: RunPairSortKey;
  direction: SortDirection;
};

type DatabaseCatalogStats = {
  rowCount: number;
  runCount: number;
  keyCount: number;
  machineCount: number;
  metrics: string[];
  latestRunDate: string;
  dirtyRunCount: number;
};

type DatabaseCatalogEntry = {
  id: string;
  title: string;
  source: string;
  description: string;
  url: string;
  sha256: string;
  sizeBytes: number | null;
  packedAt: string;
  schemaVersion: number | null;
  metadataPreview: Record<string, string | null>;
  isActive: boolean;
  stats: DatabaseCatalogStats | null;
};

type UISettings = {
  activePage: ActivePage;
  theme: ThemeMode;
  selectedDatabaseId: string;
  machine: string;
  metricKind: string;
  focusRunId: string;
  baselineRunId: string;
  group: string;
  branch: string;
  timeStart: string;
  timeEnd: string;
  displayStrategy: DisplayStrategy;
  benchmarkId: string;
  trendLineShape: TrendLineShape;
  trendAxisMode: TrendAxisMode;
};

const UI_SETTINGS_STORAGE_KEY = "benchledger-ui-settings";
const Trend_Y_Padding_Ratio = 0.08;
const Asset_Base_URL = import.meta.env.BASE_URL;

const deltaColorKey = {
  up: "deltaUp",
  down: "deltaDown",
  neutral: "deltaNeutral"
} as const;

const statDeltaTone = {
  up: "negative",
  down: "positive",
  neutral: "neutral"
} as const;

const runPairTableColumns: { key: RunPairSortKey; label: string }[] = [
  { key: "benchmark", label: "Benchmark" },
  { key: "focus", label: "Focus" },
  { key: "baseline", label: "Baseline" },
  { key: "delta", label: "Delta" },
  { key: "memory", label: "Memory" },
  { key: "allocs", label: "Allocs" }
];

function systemTheme(): ThemeMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringSetting(settings: Record<string, unknown>, key: keyof UISettings): string {
  const value = settings[key];
  return typeof value === "string" ? value : "";
}

function readUISettings(): UISettings {
  const defaults: UISettings = {
    activePage: "overview",
    theme: systemTheme(),
    selectedDatabaseId: "",
    machine: "",
    metricKind: "",
    focusRunId: "",
    baselineRunId: "",
    group: "all",
    branch: "all",
    timeStart: "",
    timeEnd: todayDateInput(),
    displayStrategy: "all",
    benchmarkId: "",
    trendLineShape: "curve",
    trendAxisMode: "commit"
  };
  const rawSettings = window.localStorage.getItem(UI_SETTINGS_STORAGE_KEY);
  if (!rawSettings) return defaults;

  try {
    const parsedSettings: unknown = JSON.parse(rawSettings);
    if (!isRecord(parsedSettings)) return defaults;
    return {
      activePage: parsedSettings.activePage === "overview" || parsedSettings.activePage === "chart-tuning" || parsedSettings.activePage === "database-catalog" ? parsedSettings.activePage : defaults.activePage,
      theme: parsedSettings.theme === "light" || parsedSettings.theme === "dark" ? parsedSettings.theme : defaults.theme,
      selectedDatabaseId: stringSetting(parsedSettings, "selectedDatabaseId"),
      machine: stringSetting(parsedSettings, "machine"),
      metricKind: stringSetting(parsedSettings, "metricKind"),
      focusRunId: stringSetting(parsedSettings, "focusRunId"),
      baselineRunId: stringSetting(parsedSettings, "baselineRunId"),
      group: stringSetting(parsedSettings, "group") || defaults.group,
      branch: stringSetting(parsedSettings, "branch") || defaults.branch,
      timeStart: stringSetting(parsedSettings, "timeStart"),
      timeEnd: stringSetting(parsedSettings, "timeEnd") || defaults.timeEnd,
      displayStrategy: parsedSettings.displayStrategy === "all" || parsedSettings.displayStrategy === "tagged-only" || parsedSettings.displayStrategy === "tagged-main" ? parsedSettings.displayStrategy : defaults.displayStrategy,
      benchmarkId: stringSetting(parsedSettings, "benchmarkId"),
      trendLineShape: parsedSettings.trendLineShape === "line" || parsedSettings.trendLineShape === "curve" ? parsedSettings.trendLineShape : defaults.trendLineShape,
      trendAxisMode: parsedSettings.trendAxisMode === "commit" || parsedSettings.trendAxisMode === "time" ? parsedSettings.trendAxisMode : defaults.trendAxisMode
    };
  } catch {
    return defaults;
  }
}

function runId(row: Pick<BenchmarkRow, "code_state_id" | "machine_id" | "metric_kind">): string {
  return `${row.code_state_id}::${row.machine_id}::${row.metric_kind}`;
}

function runHeadline(run: BenchmarkRun): string {
  if (run.tag) return run.tag;
  if (run.label) return run.label;
  if (run.commit_sha) return shortCommit(run.commit_sha);
  return run.branch || "local";
}

function runTone(run: BenchmarkRun): "tag" | "master" | "branch" {
  if (run.tag) return "tag";
  if (run.branch === "master") return "master";
  return "branch";
}

function runAxisLabel(row: BenchmarkRow): string {
  if (row.tag) return row.tag;
  if (row.commit_sha) return shortCommit(row.commit_sha);
  return "local";
}

function dateInputValue(value: string): string {
  const date = parseDate(value);
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

function todayDateInput(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateRangePart(value: string, fallback: string): string {
  if (!value) return fallback;
  const date = parseDate(`${value}T00:00:00`);
  if (!date) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function openNativeDatePicker(input: HTMLInputElement | null) {
  if (!input) return;
  input.focus();
  if ("showPicker" in input) input.showPicker();
}

function dateRangeStart(value: string): number | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? null : date.valueOf();
}

function dateRangeEnd(value: string): number | null {
  if (!value) return null;
  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.valueOf()) ? null : date.valueOf();
}

function rowMatchesDisplayStrategy(row: BenchmarkRow, strategy: DisplayStrategy): boolean {
  if (strategy === "all") return true;
  if (row.tag) return true;
  return strategy === "tagged-main" && (row.branch === "main" || row.branch === "master");
}

function runPairSortValue(row: PairComparison, key: RunPairSortKey): string | number {
  if (key === "benchmark") return row.benchmark_label;
  if (key === "focus") return row.focus_time_ns_median;
  if (key === "baseline") return row.baseline_time_ns_median;
  if (key === "delta") return row.runtime_delta;
  if (key === "memory") return row.focus_memory_bytes_min;
  return row.focus_allocs_min;
}

function defaultRunPairSortDirection(key: RunPairSortKey): SortDirection {
  return key === "benchmark" ? "asc" : "desc";
}

function compareRuns(left: BenchmarkRun, right: BenchmarkRun): number {
  const leftDate = parseDate(left.date)?.valueOf() ?? 0;
  const rightDate = parseDate(right.date)?.valueOf() ?? 0;
  if (leftDate !== rightDate) return rightDate - leftDate;
  return right.run_id.localeCompare(left.run_id);
}

function buildRuns(rows: BenchmarkRow[]): BenchmarkRun[] {
  const runsById = new Map<string, BenchmarkRun>();
  for (const row of rows) {
    const id = runId(row);
    const existing = runsById.get(id);
    if (existing) {
      existing.benchmark_count += 1;
      continue;
    }
    runsById.set(id, {
      run_id: id,
      code_state_id: row.code_state_id,
      branch: row.branch,
      tag: row.tag,
      label: row.label,
      commit_sha: row.commit_sha,
      date: row.date,
      metric_kind: row.metric_kind,
      machine_id: row.machine_id,
      cpu_model: row.cpu_model,
      cpu_threads: row.cpu_threads,
      arch: row.arch,
      os: row.os,
      julia_version: row.julia_version,
      is_dirty: row.is_dirty,
      notes: row.notes,
      benchmark_count: 1
    });
  }
  return Array.from(runsById.values()).sort(compareRuns);
}

function databaseTitle(database: BenchLedgerManifestDatabase): string {
  return database.name || database.id;
}

function databasePreviewValue(database: BenchLedgerManifestDatabase, key: string): string {
  return database.metadata_preview?.[key] ?? "";
}

function databaseDescription(database: BenchLedgerManifestDatabase): string {
  return database.description || databasePreviewValue(database, "description") || "No description provided.";
}

function formatOptionalDate(value: string): string {
  return value ? formatDate(value) : "n/a";
}

function formatSchemaLabel(value: number | null | undefined): string {
  return value === null || value === undefined ? "n/a" : `v${value}`;
}

function metadataTitle(metadata: BenchLedgerMetadata): string {
  return metadata.name || "BenchLedger";
}

function metadataDescription(metadata: BenchLedgerMetadata): string {
  return metadata.description || metadata.notes || "Performance tracking for benchmark datasets.";
}

function sourceSummary(dataset: LoadedBenchmarkDataset | null): string {
  if (!dataset) return "No benchmark database loaded";
  return dataset.source_url ? `Serving ${dataset.source_label}` : `Loaded local file ${dataset.source_label}`;
}

function App() {
  const initialSettings = useMemo(readUISettings, []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const timeRangePickerRef = useRef<HTMLDetailsElement | null>(null);
  const timeStartInputRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<BenchmarkRow[]>([]);
  const [dataset, setDataset] = useState<LoadedBenchmarkDataset | null>(null);
  const [manifest, setManifest] = useState<BenchLedgerManifest | null>(null);
  const [manifestUrl, setManifestUrl] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<ActivePage>(initialSettings.activePage);
  const [selectedDatabaseId, setSelectedDatabaseId] = useState(initialSettings.selectedDatabaseId);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<AppPhase>("booting");
  const [theme, setTheme] = useState<ThemeMode>(initialSettings.theme);
  const [machine, setMachine] = useState(initialSettings.machine);
  const [metricKind, setMetricKind] = useState(initialSettings.metricKind);
  const [focusRunId, setFocusRunId] = useState(initialSettings.focusRunId);
  const [baselineRunId, setBaselineRunId] = useState(initialSettings.baselineRunId);
  const [group, setGroup] = useState(initialSettings.group);
  const [branch, setBranch] = useState(initialSettings.branch);
  const [timeStart, setTimeStart] = useState(initialSettings.timeStart);
  const [timeEnd, setTimeEnd] = useState(initialSettings.timeEnd);
  const [displayStrategy, setDisplayStrategy] = useState<DisplayStrategy>(initialSettings.displayStrategy);
  const [benchmarkId, setBenchmarkId] = useState(initialSettings.benchmarkId);
  const [trendLineShape, setTrendLineShape] = useState<TrendLineShape>(initialSettings.trendLineShape);
  const [trendAxisMode, setTrendAxisMode] = useState<TrendAxisMode>(initialSettings.trendAxisMode);
  const [runPairSort, setRunPairSort] = useState<RunPairSort | null>(null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  }, [theme]);

  useEffect(() => {
    function closeTimeRangePicker(event: PointerEvent) {
      const picker = timeRangePickerRef.current;
      if (!picker?.open) return;
      if (event.target instanceof Node && picker.contains(event.target)) return;
      picker.open = false;
    }

    document.addEventListener("pointerdown", closeTimeRangePicker);
    return () => {
      document.removeEventListener("pointerdown", closeTimeRangePicker);
    };
  }, []);

  useEffect(() => {
    const settings: UISettings = {
      activePage,
      theme,
      selectedDatabaseId,
      machine,
      metricKind,
      focusRunId,
      baselineRunId,
      group,
      branch,
      timeStart,
      timeEnd,
      displayStrategy,
      benchmarkId,
      trendLineShape,
      trendAxisMode
    };
    window.localStorage.setItem(UI_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [
    activePage,
    baselineRunId,
    benchmarkId,
    branch,
    displayStrategy,
    focusRunId,
    group,
    machine,
    metricKind,
    selectedDatabaseId,
    theme,
    timeEnd,
    timeStart,
    trendAxisMode,
    trendLineShape
  ]);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      setPhase("booting");
      setError("");
      try {
        const manifestEntry = await loadManifest();
        if (cancelled) return;
        if (!manifestEntry) {
          setManifest(null);
          setManifestUrl(null);
          setPhase("select-source");
          return;
        }
        setManifest(manifestEntry.manifest);
        setManifestUrl(manifestEntry.url);
        const databases = manifestEntry.manifest.databases;
        if (!databases.length) {
          setPhase("select-source");
          return;
        }
        const savedDatabase = databases.find((database) => database.id === selectedDatabaseId);
        if (savedDatabase) {
          await selectManifestDatabase(savedDatabase, manifestEntry.url, cancelled);
          return;
        }
        if (databases.length === 1) {
          await selectManifestDatabase(databases[0], manifestEntry.url, cancelled);
          return;
        }
        setSelectedDatabaseId(databases[0].id);
        setPhase("select-source");
      } catch (loadError: unknown) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to initialize BenchLedger.");
        setPhase("select-source");
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  async function selectManifestDatabase(
    database: BenchLedgerManifestDatabase,
    activeManifestUrl: string,
    cancelled = false
  ) {
    setPhase("loading-database");
    setError("");
    try {
      const loadedDataset = await loadBenchmarkRowsFromManifestDatabase(database, activeManifestUrl);
      if (cancelled) return;
      setDataset(loadedDataset);
      setRows(loadedDataset.rows);
      setSelectedDatabaseId(database.id);
      setPhase("ready");
    } catch (loadError: unknown) {
      if (cancelled) return;
      setRows([]);
      setDataset(null);
      setError(loadError instanceof Error ? loadError.message : "Failed to load the selected database.");
      setPhase("select-source");
    }
  }

  async function handleDatabaseSelection(databaseId: string) {
    if (!manifest || !manifestUrl) return;
    const database = manifest.databases.find((entry) => entry.id === databaseId);
    if (!database) return;
    await selectManifestDatabase(database, manifestUrl);
  }

  async function handleLocalFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPhase("loading-database");
    setError("");
    try {
      const loadedDataset = await loadBenchmarkRowsFromFile(file);
      setManifest((current) => current);
      setDataset(loadedDataset);
      setRows(loadedDataset.rows);
      setPhase("ready");
    } catch (loadError: unknown) {
      setRows([]);
      setDataset(null);
      setError(loadError instanceof Error ? loadError.message : "Failed to load the selected SQLite file.");
      setPhase("select-source");
    } finally {
      event.target.value = "";
    }
  }

  const allRuns = useMemo(() => buildRuns(rows), [rows]);
  const latestDatabaseRun = allRuns[0] ?? null;
  const machineOptions = useMemo(() => unique(allRuns.map((run) => run.machine_id)).sort(), [allRuns]);
  const metricOptions = useMemo(() => {
    const metricRows = machine ? rows.filter((row) => row.machine_id === machine) : rows;
    return unique(metricRows.map((row) => row.metric_kind)).sort();
  }, [machine, rows]);
  const branchOptions = useMemo(() => ["all", ...unique(rows.map((row) => row.branch).filter(Boolean)).sort()], [rows]);
  const timeStartValue = useMemo(() => dateRangeStart(timeStart), [timeStart]);
  const timeEndValue = useMemo(() => dateRangeEnd(timeEnd), [timeEnd]);
  const datasetTimeStart = useMemo(() => dateInputValue(rows.reduce((earliest, row) => {
    const rowDate = parseDate(row.date)?.valueOf() ?? Number.POSITIVE_INFINITY;
    const earliestDate = parseDate(earliest)?.valueOf() ?? Number.POSITIVE_INFINITY;
    return rowDate < earliestDate ? row.date : earliest;
  }, "")), [rows]);
  const datasetTimeEnd = useMemo(() => dateInputValue(rows.reduce((latest, row) => {
    const rowDate = parseDate(row.date)?.valueOf() ?? Number.NEGATIVE_INFINITY;
    const latestDate = parseDate(latest)?.valueOf() ?? Number.NEGATIVE_INFINITY;
    return rowDate > latestDate ? row.date : latest;
  }, "")), [rows]);

  useEffect(() => {
    if (!machineOptions.length) return;
    setMachine((current) => (current && machineOptions.includes(current) ? current : machineOptions[0]));
  }, [machineOptions]);

  useEffect(() => {
    if (!metricOptions.length) return;
    setMetricKind((current) => {
      if (current && metricOptions.includes(current)) return current;
      return metricOptions[0];
    });
  }, [metricOptions]);

  useEffect(() => {
    if (!branchOptions.length) return;
    setBranch((current) => (branchOptions.includes(current) ? current : "all"));
  }, [branchOptions]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    if (row.machine_id !== machine || row.metric_kind !== metricKind) return false;
    if (branch !== "all" && row.branch !== branch) return false;
    if (!rowMatchesDisplayStrategy(row, displayStrategy)) return false;
    const rowDate = parseDate(row.date)?.valueOf() ?? null;
    if (timeStartValue !== null && (rowDate === null || rowDate < timeStartValue)) return false;
    if (timeEndValue !== null && (rowDate === null || rowDate > timeEndValue)) return false;
    return true;
  }), [branch, displayStrategy, machine, metricKind, rows, timeEndValue, timeStartValue]);

  const groupOptions = useMemo(() => {
    const optionsByValue = new Map<string, GroupMenuOption>();
    for (const row of filteredRows) {
      for (let depth = 1; depth <= row.benchmark_path.length; depth += 1) {
        const path = row.benchmark_path.slice(0, depth);
        const value = JSON.stringify(path);
        if (optionsByValue.has(value)) continue;
        optionsByValue.set(value, {
          value,
          path
        });
      }
    }
    return Array.from(optionsByValue.values()).sort((left, right) => {
      const length = Math.min(left.path.length, right.path.length);
      for (let index = 0; index < length; index += 1) {
        const order = left.path[index].localeCompare(right.path[index]);
        if (order !== 0) return order;
      }
      return left.path.length - right.path.length;
    });
  }, [filteredRows]);

  const groupOptionsByValue = useMemo(
    () => new Map(groupOptions.map((option) => [option.value, option])),
    [groupOptions]
  );

  useEffect(() => {
    setGroup((current) => (current === "all" || groupOptionsByValue.has(current) ? current : "all"));
  }, [groupOptionsByValue]);

  const selectedGroupPath = useMemo(
    () => (group === "all" ? null : groupOptionsByValue.get(group)?.path ?? null),
    [group, groupOptionsByValue]
  );

  const selectedGroupLabel = useMemo(() => {
    if (group === "all") return "All groups";
    const option = groupOptionsByValue.get(group);
    return option ? option.path.join(" > ") : "All groups";
  }, [group, groupOptionsByValue]);

  const scopedRows = useMemo(
    () => filteredRows.filter((row) => {
      if (!selectedGroupPath) return true;
      return selectedGroupPath.every((segment, index) => row.benchmark_path[index] === segment);
    }),
    [filteredRows, selectedGroupPath]
  );

  const runs = useMemo(() => buildRuns(scopedRows), [scopedRows]);
  const latestRun = runs[0] ?? null;
  const filteredRuns = runs;

  useEffect(() => {
    if (!filteredRuns.length) return;
    setFocusRunId((current) => (current && filteredRuns.some((run) => run.run_id === current) ? current : filteredRuns[0].run_id));
    setBaselineRunId((current) => {
      if (current && filteredRuns.some((run) => run.run_id === current)) return current;
      return filteredRuns[1]?.run_id ?? filteredRuns[0].run_id;
    });
  }, [filteredRuns]);

  const benchmarkOptions = useMemo(() => {
    return Array.from(new Map(scopedRows.map((row) => [row.benchmark_id, row.benchmark_label])).entries())
      .map(([id, label]) => ({ id, label }))
      .sort((left, right) => left.label.localeCompare(right.label) || left.id.localeCompare(right.id));
  }, [scopedRows]);

  useEffect(() => {
    if (!benchmarkOptions.length) return;
    setBenchmarkId((current) => (current && benchmarkOptions.some((option) => option.id === current) ? current : benchmarkOptions[0].id));
  }, [benchmarkOptions]);

  const focusRun = filteredRuns.find((run) => run.run_id === focusRunId) ?? filteredRuns[0] ?? null;
  const baselineRun = filteredRuns.find((run) => run.run_id === baselineRunId) ?? filteredRuns[1] ?? filteredRuns[0] ?? null;

  const focusRows = useMemo(
    () => (focusRun ? scopedRows.filter((row) => runId(row) === focusRun.run_id) : []),
    [focusRun, scopedRows]
  );

  const baselineRows = useMemo(
    () => (baselineRun ? scopedRows.filter((row) => runId(row) === baselineRun.run_id) : []),
    [baselineRun, scopedRows]
  );

  const focusByBenchmark = useMemo(() => new Map(focusRows.map((row) => [row.benchmark_id, row])), [focusRows]);
  const baselineByBenchmark = useMemo(() => new Map(baselineRows.map((row) => [row.benchmark_id, row])), [baselineRows]);

  const focusBenchmark = benchmarkId ? focusByBenchmark.get(benchmarkId) ?? null : null;
  const baselineBenchmark = benchmarkId ? baselineByBenchmark.get(benchmarkId) ?? null : null;

  const comparisonRows = useMemo<PairComparison[]>(() => {
    const keys = unique([...focusByBenchmark.keys(), ...baselineByBenchmark.keys()]).sort();
    return keys
      .map((key) => {
        const focus = focusByBenchmark.get(key);
        const baseline = baselineByBenchmark.get(key);
        if (!focus || !baseline) return null;
        return {
          benchmark_id: key,
          benchmark_label: focus.benchmark_label,
          focus_time_ns_median: focus.time_ns_median,
          baseline_time_ns_median: baseline.time_ns_median,
          focus_memory_bytes_min: focus.memory_bytes_min,
          baseline_memory_bytes_min: baseline.memory_bytes_min,
          focus_allocs_min: focus.allocs_min,
          baseline_allocs_min: baseline.allocs_min,
          runtime_delta: percentageChange(focus.time_ns_median, baseline.time_ns_median),
          memory_delta: percentageChange(focus.memory_bytes_min, baseline.memory_bytes_min),
          alloc_delta: percentageChange(focus.allocs_min, baseline.allocs_min)
        };
      })
      .filter((row): row is PairComparison => row !== null)
      .sort((left, right) => Math.abs(right.runtime_delta) - Math.abs(left.runtime_delta));
  }, [baselineByBenchmark, focusByBenchmark]);

  const sortedComparisonRows = useMemo(() => {
    if (!runPairSort) return comparisonRows;
    return [...comparisonRows].sort((left, right) => {
      const leftValue = runPairSortValue(left, runPairSort.key);
      const rightValue = runPairSortValue(right, runPairSort.key);
      const order = typeof leftValue === "string"
        ? leftValue.localeCompare(String(rightValue))
        : leftValue - Number(rightValue);
      return runPairSort.direction === "asc" ? order : -order;
    });
  }, [comparisonRows, runPairSort]);

  function toggleRunPairSort(key: RunPairSortKey) {
    setRunPairSort((currentSort) => {
      if (currentSort?.key !== key) {
        return { key, direction: defaultRunPairSortDirection(key) };
      }
      return { key, direction: currentSort.direction === "asc" ? "desc" : "asc" };
    });
  }

  const trendRows = useMemo(() => {
    return scopedRows
      .filter((row) => row.benchmark_id === benchmarkId)
      .map((row) => {
        const run = runs.find((candidate) => candidate.run_id === runId(row));
        return {
          ...row,
          date_value: parseDate(row.date),
          run_axis_label: runAxisLabel(row),
          run_headline: run ? runHeadline(run) : row.label,
          run_tone: run ? runTone(run) : "branch"
        };
      })
      .filter((row) => row.date_value)
      .sort((left, right) => left.date_value!.valueOf() - right.date_value!.valueOf());
  }, [benchmarkId, runs, scopedRows]);

  const selectedRuntimeDelta = focusBenchmark && baselineBenchmark
    ? percentageChange(focusBenchmark.time_ns_median, baselineBenchmark.time_ns_median)
    : null;

  const stats = useMemo(() => [
    {
      Icon: FiDatabase,
      label: "Benchmark Rows",
      value: scopedRows.length.toLocaleString(),
      delta: latestRun ? `+${latestRun.benchmark_count.toLocaleString()}` : "",
      deltaTone: latestRun?.benchmark_count ? "positive" : "neutral",
      detail: `${unique(scopedRows.map((row) => row.benchmark_id)).length.toLocaleString()} benchmarks in slice`
    },
    {
      Icon: FiActivity,
      label: "Captured Runs",
      value: filteredRuns.length.toLocaleString(),
      detail: machine && metricKind ? `filtered on ${machine} · ${metricKind}` : "Waiting for a machine slice"
    },
    {
      Icon: FiClock,
      label: "Selected Runtime",
      value: focusBenchmark ? formatRuntime(focusBenchmark.time_ns_median) : "n/a",
      delta: selectedRuntimeDelta === null ? "" : formatPercent(selectedRuntimeDelta),
      deltaTone: selectedRuntimeDelta === null ? "neutral" : statDeltaTone[deltaClass(selectedRuntimeDelta)],
      detail: focusBenchmark && baselineBenchmark ? "vs baseline" : "Pick a comparable baseline run"
    },
    {
      Icon: FiGitBranch,
      label: "Dirty Snapshots",
      value: filteredRuns.filter((run) => run.is_dirty).length.toLocaleString(),
      detail: latestRun?.is_dirty ? "Latest run was recorded from a dirty worktree" : "Latest run is clean"
    }
  ], [baselineBenchmark, filteredRuns, focusBenchmark, latestRun, machine, metricKind, scopedRows, selectedRuntimeDelta]);

  const plotTheme = useMemo(() => {
    if (theme === "dark") {
      return {
        paper: "#1F1F23",
        plot: "#1F1F23",
        grid: "#2F2F33",
        axis: "#A8A29E",
        zero: "#44403C",
        line: "#F59E0B",
        areaGradientStart: "rgba(245, 158, 11, 0)",
        areaGradientEnd: "rgba(245, 158, 11, 0.35)",
        markerStrong: "#FBBF24",
        marker: "#F59E0B",
        markerMuted: "#78716C",
        deltaUp: "#DC2626",
        deltaDown: "#059669",
        deltaNeutral: "#78716C"
      };
    }
    return {
      paper: "#FFFFFF",
      plot: "#FFFFFF",
      grid: "#E7E5E4",
      axis: "#78716C",
      zero: "#D6D3D1",
      line: "#B45309",
      areaGradientStart: "rgba(180, 83, 9, 0)",
      areaGradientEnd: "rgba(180, 83, 9, 0.28)",
      markerStrong: "#18181B",
      marker: "#B45309",
      markerMuted: "#A8A29E",
      deltaUp: "#DC2626",
      deltaDown: "#059669",
      deltaNeutral: "#78716C"
    };
  }, [theme]);

  const sourceDatabases = manifest?.databases ?? [];
  const currentMetadata = dataset?.metadata ?? null;
  const siteTitle = currentMetadata ? metadataTitle(currentMetadata) : manifest?.site?.title || "BenchLedger";
  const siteDescription = currentMetadata ? metadataDescription(currentMetadata) : manifest?.site?.description || "Load a benchmark SQLite database to inspect runs and trends.";
  const loadedDatabaseStats = useMemo<DatabaseCatalogStats | null>(() => {
    if (!dataset) return null;
    return {
      rowCount: rows.length,
      runCount: allRuns.length,
      keyCount: unique(rows.map((row) => row.benchmark_id)).length,
      machineCount: unique(rows.map((row) => row.machine_id)).length,
      metrics: unique(rows.map((row) => row.metric_kind)).sort(),
      latestRunDate: latestDatabaseRun?.date ?? "",
      dirtyRunCount: allRuns.filter((run) => run.is_dirty).length
    };
  }, [allRuns, dataset, latestDatabaseRun?.date, rows]);
  const databaseCatalog = useMemo<DatabaseCatalogEntry[]>(() => {
    const manifestEntries = sourceDatabases.map((database) => {
      const isActive = Boolean(dataset?.source_url && selectedDatabaseId === database.id);
      const metadata = isActive ? currentMetadata : null;
      return {
        id: database.id,
        title: metadata ? metadataTitle(metadata) : databaseTitle(database),
        source: "Manifest",
        description: metadata ? metadataDescription(metadata) : databaseDescription(database),
        url: isActive ? dataset?.source_url ?? database.url : database.url,
        sha256: database.sha256 ?? "",
        sizeBytes: database.size_bytes ?? null,
        packedAt: database.packed_at ?? "",
        schemaVersion: metadata?.schema_version ?? database.schema_version ?? null,
        metadataPreview: metadata?.raw ?? database.metadata_preview ?? {},
        isActive,
        stats: isActive ? loadedDatabaseStats : null
      };
    });

    if (!dataset || dataset.source_url) return manifestEntries;
    return [
      {
        id: "local-sqlite",
        title: metadataTitle(dataset.metadata),
        source: "Local SQLite",
        description: metadataDescription(dataset.metadata),
        url: dataset.source_label,
        sha256: "",
        sizeBytes: null,
        packedAt: "",
        schemaVersion: dataset.metadata.schema_version,
        metadataPreview: dataset.metadata.raw,
        isActive: true,
        stats: loadedDatabaseStats
      },
      ...manifestEntries
    ];
  }, [currentMetadata, dataset, loadedDatabaseStats, selectedDatabaseId, sourceDatabases]);
  const hasDataset = Boolean(dataset && rows.length);
  const trendPlotMargin = trendRows.length ? { t: 10, r: 16, b: 40, l: 60 } : { t: 10, r: 16, b: 40, l: 20 };
  const deltaPlotMargin = comparisonRows.length ? { t: 10, r: 12, b: 36, l: 180 } : { t: 10, r: 12, b: 36, l: 20 };
  const trendX = trendRows.map((row) => trendAxisMode === "commit" ? row.run_axis_label : row.date);
  const trendY = trendRows.map((row) => row.time_ns_median);
  const trendYMin = trendY.length ? Math.min(...trendY) : 0;
  const trendYMax = trendY.length ? Math.max(...trendY) : 0;
  const trendYSpan = trendYMax - trendYMin;
  const trendYPadding = trendYSpan > 0
    ? trendYSpan * Trend_Y_Padding_Ratio
    : Math.max(Math.abs(trendYMin) * Trend_Y_Padding_Ratio, 1);
  const trendFillBaseline = trendY.map(() => trendYMin - trendYPadding);
  const timeRangeLabel = timeStart || timeEnd
    ? `${formatDateRangePart(timeStart, "Any start")} - ${formatDateRangePart(timeEnd, "Any end")}`
    : "All time";

  function openLocalFilePicker() {
    fileInputRef.current?.click();
  }

  if (phase === "booting" || phase === "loading-database") {
    return <div className="state-shell">{phase === "booting" ? "Discovering benchmark sources..." : "Loading benchmark database..."}</div>;
  }

  return (
    <div className="dashboard-app">
      <input
        ref={fileInputRef}
        type="file"
        accept=".db,.sqlite,.sqlite3,application/vnd.sqlite3"
        className="visually-hidden"
        onChange={(event) => {
          void handleLocalFileChange(event);
        }}
      />
      <aside className="sidebar">
        <div className="brand">
          <img className="brand-logo" src={`${Asset_Base_URL}${theme === "dark" ? "LightLogo.png" : "DarkLogo.png"}`} alt="BenchLedger" />
        </div>
        <nav className="nav-section">
          <span className="nav-label">Navigation</span>
          <button
            type="button"
            className={`nav-item${activePage === "overview" ? " nav-item-active" : ""}`}
            onClick={() => setActivePage("overview")}
          >
            Dashboard
          </button>
          <button
            type="button"
            className={`nav-item${activePage === "chart-tuning" ? " nav-item-active" : ""}`}
            onClick={() => setActivePage("chart-tuning")}
          >
            Chart Tuning
          </button>
          <button
            type="button"
            className={`nav-item${activePage === "database-catalog" ? " nav-item-active" : ""}`}
            onClick={() => setActivePage("database-catalog")}
          >
            Databases
          </button>
          <a className="nav-item" href="#">Benchmark Keys</a>
          <a className="nav-item" href="#">Machines</a>
        </nav>
        {sourceDatabases.length > 1 ? (
          <nav className="nav-section">
            <span className="nav-label">Data Source</span>
            <div className="sidebar-controls">
              <label className="sidebar-field">
                <span className="field-label">Database</span>
                <select
                  value={selectedDatabaseId}
                  onChange={(event) => {
                    void handleDatabaseSelection(event.target.value);
                  }}
                >
                  {sourceDatabases.map((database) => <option key={database.id} value={database.id}>{databaseTitle(database)}</option>)}
                </select>
              </label>
            </div>
          </nav>
        ) : null}
        <div className="sidebar-note subtle-card">
          <strong>Source</strong>
          <span>{sourceSummary(dataset)}</span>
          {currentMetadata?.updated_at ? <p>Updated {formatDate(currentMetadata.updated_at)}</p> : null}
        </div>
        <div className="sidebar-footer">
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
          >
            <span className="theme-toggle-copy">
              <strong>{theme === "dark" ? "Dark Mode" : "Light Mode"}</strong>
              <span>{theme === "dark" ? "Switch to light surfaces" : "Switch to dark surfaces"}</span>
            </span>
            <span className="theme-toggle-pill" aria-hidden="true">
              <span className="theme-toggle-thumb">{theme === "dark" ? "◐" : "◑"}</span>
            </span>
          </button>
          <div className="operator">
            <div className="operator-avatar">BL</div>
            <div>
              <strong>{latestRun?.machine_id ?? dataset?.source_label ?? "No database"}</strong>
              <span>{latestRun ? formatDate(latestRun.date) : "No benchmark run"}</span>
            </div>
          </div>
        </div>
      </aside>
      <main className="main">
        {activePage === "overview" ? (
          <>
        <header className="topbar">
          <div className="topbar-copy">
            <div className="breadcrumb">Benchmarking <span>›</span> Dashboard</div>
            <h1>{siteTitle}</h1>
            <p>{siteDescription}</p>
          </div>
          <div className="topbar-actions">
            <label className="field control-card control-card-wide">
              <span className="field-label">Focus run</span>
              <select value={focusRunId} onChange={(event) => setFocusRunId(event.target.value)} disabled={!filteredRuns.length}>
                {filteredRuns.map((run) => <option key={run.run_id} value={run.run_id}>{runHeadline(run)} · {formatDate(run.date)}</option>)}
              </select>
            </label>
            <label className="field control-card control-card-wide">
              <span className="field-label">Baseline run</span>
              <select value={baselineRunId} onChange={(event) => setBaselineRunId(event.target.value)} disabled={!filteredRuns.length}>
                {filteredRuns.map((run) => <option key={run.run_id} value={run.run_id}>{runHeadline(run)} · {formatDate(run.date)}</option>)}
              </select>
            </label>
            <button type="button" className="button button-secondary" onClick={openLocalFilePicker}>Choose SQLite</button>
            {dataset?.source_url ? (
              <a className="button button-primary" href={dataset.source_url} download={dataset.source_label}>Download</a>
            ) : null}
          </div>
        </header>
        {!hasDataset || error ? (
          <section className="data-banner surface-card">
            <div>
              <strong>{dataset ? "No benchmark rows found" : "No database is loaded"}</strong>
              <p>{error || "Choose a local SQLite file to inspect benchmark history."}</p>
            </div>
            <button type="button" className="button button-primary" onClick={openLocalFilePicker}>Choose Local SQLite</button>
          </section>
        ) : null}
        <section className="filter-grid">
            <label className="field">
              <span className="field-label">Machine</span>
              <select value={machine} onChange={(event) => setMachine(event.target.value)} disabled={!machineOptions.length}>
                {machineOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Metric</span>
              <select value={metricKind} onChange={(event) => setMetricKind(event.target.value)} disabled={!metricOptions.length}>
                {metricOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <div className="field">
              <span className="field-label">Group</span>
              <GroupCascadeMenu
                disabled={!hasDataset}
                options={groupOptions}
                selectedValue={group}
                selectedLabel={selectedGroupLabel}
                onSelect={setGroup}
              />
            </div>
            <label className="field">
              <span className="field-label">Branch</span>
              <select value={branch} onChange={(event) => setBranch(event.target.value)} disabled={!branchOptions.length}>
                {branchOptions.map((option) => <option key={option} value={option}>{option === "all" ? "All branches" : option}</option>)}
              </select>
            </label>
            <div className="field time-range-field">
              <span className="field-label">Time Range</span>
              <details className="date-range-picker" ref={timeRangePickerRef}>
                <summary
                  className={`date-range-summary${hasDataset ? "" : " date-range-summary-disabled"}`}
                  onClick={(event) => {
                    if (!hasDataset) event.preventDefault();
                    const picker = event.currentTarget.parentElement as HTMLDetailsElement | null;
                    if (hasDataset && !picker?.open) {
                      window.requestAnimationFrame(() => openNativeDatePicker(timeStartInputRef.current));
                    }
                  }}
                >
                  <strong>{timeRangeLabel}</strong>
                  <em aria-hidden="true">▾</em>
                </summary>
                <div className="date-range-popover">
                  <label className="date-range-input">
                    <span className="field-label">Start</span>
                    <input
                      ref={timeStartInputRef}
                      type="date"
                      value={timeStart}
                      min={datasetTimeStart}
                      max={timeEnd || datasetTimeEnd}
                      onChange={(event) => setTimeStart(event.target.value)}
                    />
                  </label>
                  <label className="date-range-input">
                    <span className="field-label">End</span>
                    <input
                      type="date"
                      value={timeEnd}
                      min={timeStart || datasetTimeStart}
                      max={datasetTimeEnd}
                      onChange={(event) => setTimeEnd(event.target.value)}
                    />
                  </label>
                </div>
              </details>
            </div>
            <label className="field filter-strategy-field">
              <span className="field-label">Display Strategy</span>
              <select value={displayStrategy} onChange={(event) => setDisplayStrategy(event.target.value as DisplayStrategy)} disabled={!hasDataset}>
                <option value="all">All records</option>
                <option value="tagged-only">Tagged only</option>
                <option value="tagged-main">Tagged + main/master</option>
              </select>
            </label>
        </section>
        <section className="stats-grid">
          {stats.map((stat) => {
            const Icon = stat.Icon;
            return (
              <article className="surface-card stat-card" key={stat.label}>
                <Icon className="stat-icon" aria-hidden="true" />
                <div className="stat-copy">
                  <span>{stat.label}</span>
                  <div className="stat-value-row">
                    <strong>{stat.value}</strong>
                    {stat.delta ? <em className={`stat-delta stat-delta-${stat.deltaTone ?? "neutral"}`}>{stat.delta}</em> : null}
                  </div>
                  <p>{stat.detail}</p>
                </div>
              </article>
            );
          })}
        </section>
        <section className="content-grid">
          <article className="surface-card panel panel-wide">
            <div className="panel-head">
              <div className="panel-title-stack">
                <h2>Benchmark Trend</h2>
                <select
                  className="trend-benchmark-select"
                  aria-label="Benchmark"
                  value={benchmarkId}
                  onChange={(event) => setBenchmarkId(event.target.value)}
                >
                  {benchmarkOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
              </div>
              <button
                type="button"
                className="button button-secondary button-compact"
                onClick={() => setTrendAxisMode((current) => (current === "commit" ? "time" : "commit"))}
              >
                X-Axis: {trendAxisMode === "commit" ? "Commit" : "Time"}
              </button>
            </div>
            <div className="plot-shell">
              <Plot
                useResizeHandler
                style={{ width: "100%", height: "100%" }}
                data={[
                  {
                    type: "scatter",
                    mode: "lines",
                    x: trendX,
                    y: trendFillBaseline,
                    line: { color: "rgba(0, 0, 0, 0)", width: 0 },
                    hoverinfo: "skip",
                    showlegend: false
                  },
                  {
                    type: "scatter",
                    mode: "lines+markers",
                    x: trendX,
                    y: trendY,
                    customdata: trendRows.map((row) => row.date),
                    line: {
                      color: plotTheme.line,
                      width: 3,
                      shape: trendLineShape === "curve" ? "spline" : "linear",
                      smoothing: trendLineShape === "curve" ? 0.75 : 0
                    },
                    marker: {
                      size: 8,
                      color: plotTheme.plot,
                      line: { color: plotTheme.line, width: 2.5 }
                    },
                    fill: "tonexty",
                    fillgradient: {
                      type: "vertical",
                      colorscale: [
                        [0, plotTheme.areaGradientStart],
                        [1, plotTheme.areaGradientEnd]
                      ]
                    },
                    hovertemplate: "%{x}<br>%{customdata}<br>%{y:.2f} ns<extra></extra>"
                  }
                ]}
                layout={{
                  autosize: true,
                  margin: trendPlotMargin,
                  paper_bgcolor: plotTheme.paper,
                  plot_bgcolor: plotTheme.plot,
                  font: { color: plotTheme.axis },
                  xaxis: { showgrid: false, color: plotTheme.axis },
                  yaxis: { title: "Median runtime (ns)", gridcolor: plotTheme.grid, zeroline: false, color: plotTheme.axis },
                  showlegend: false
                }}
                config={{ displayModeBar: false, responsive: true }}
              />
            </div>
          </article>
          <aside className="insights-rail">
            <div className="surface-card panel panel-rail">
              <div className="panel-head">
                <div>
                  <h2>Insights Assistant</h2>
                  <p>Summaries derived from the currently selected run pair.</p>
                </div>
              </div>
              <div className="insight-list">
                <article className="subtle-card insight-card">
                  <span>Top insight</span>
                  <strong>
                    {focusBenchmark && baselineBenchmark
                      ? `${focusBenchmark.benchmark_label} is ${formatPercent(percentageChange(focusBenchmark.time_ns_median, baselineBenchmark.time_ns_median))}`
                      : "Choose two runs for a direct benchmark delta"}
                  </strong>
                  <p>
                    {focusBenchmark && baselineBenchmark
                      ? `Focus median is ${formatRuntime(focusBenchmark.time_ns_median)} versus ${formatRuntime(baselineBenchmark.time_ns_median)} on the baseline run.`
                      : "The dashboard computes direct deltas only when both runs contain the same benchmark key."}
                  </p>
                </article>
                <article className="subtle-card insight-card">
                  <span>Run context</span>
                  <strong>{focusRun ? `${runHeadline(focusRun)} on ${focusRun.machine_id}` : "No focus run selected"}</strong>
                  <p>{focusRun ? `${focusRun.os} · ${focusRun.arch} · Julia ${focusRun.julia_version} · ${focusRun.cpu_threads} threads.` : "Select a run to inspect its context."}</p>
                </article>
                <article className="subtle-card insight-card">
                  <span>Data posture</span>
                  <strong>{focusRun ? (focusRun.is_dirty ? "Dirty snapshot captured" : "Clean code state captured") : "No run selected"}</strong>
                  <p>{focusRun?.notes || currentMetadata?.notes || "No additional notes were attached to this dataset."}</p>
                </article>
              </div>
            </div>
          </aside>
          <article className="surface-card panel">
            <div className="panel-head">
              <div>
                <h2>Largest Runtime Deltas</h2>
                <p>Top movers between the focus run and the baseline run.</p>
              </div>
            </div>
            <div className="plot-shell">
              <Plot
                useResizeHandler
                style={{ width: "100%", height: "100%" }}
                data={[
                  {
                    type: "bar",
                    orientation: "h",
                    x: comparisonRows.slice(0, 6).map((row) => row.runtime_delta).reverse(),
                    y: comparisonRows.slice(0, 6).map((row) => row.benchmark_label).reverse(),
                    marker: {
                      color: comparisonRows.slice(0, 6).map((row) => plotTheme[deltaColorKey[deltaClass(row.runtime_delta)]]).reverse()
                    },
                    hovertemplate: "%{y}<br>%{x:.2f}%<extra></extra>"
                  }
                ]}
                layout={{
                  autosize: true,
                  margin: deltaPlotMargin,
                  paper_bgcolor: plotTheme.paper,
                  plot_bgcolor: plotTheme.plot,
                  font: { color: plotTheme.axis },
                  xaxis: { title: "Runtime delta (%)", gridcolor: plotTheme.grid, zerolinecolor: plotTheme.zero, color: plotTheme.axis },
                  yaxis: { automargin: true, color: plotTheme.axis },
                  showlegend: false
                }}
                config={{ displayModeBar: false, responsive: true }}
              />
            </div>
          </article>
          <article className="surface-card panel">
            <div className="panel-head">
              <div>
                <h2>Run Context</h2>
                <p>Execution metadata for the current focus run.</p>
              </div>
            </div>
            <table className="meta-table">
              <tbody>
                <tr><th>Run</th><td>{focusRun ? runHeadline(focusRun) : "n/a"}</td></tr>
                <tr><th>Branch</th><td>{focusRun?.branch || "n/a"}</td></tr>
                <tr><th>Machine</th><td>{focusRun?.machine_id || "n/a"}</td></tr>
                <tr><th>CPU</th><td>{focusRun?.cpu_model || "n/a"}</td></tr>
                <tr><th>Threads</th><td>{focusRun ? focusRun.cpu_threads.toLocaleString() : "n/a"}</td></tr>
                <tr><th>Platform</th><td>{focusRun ? `${focusRun.os} · ${focusRun.arch}` : "n/a"}</td></tr>
                <tr><th>Julia</th><td>{focusRun?.julia_version || "n/a"}</td></tr>
                <tr><th>Dirty</th><td>{focusRun ? String(focusRun.is_dirty) : "n/a"}</td></tr>
              </tbody>
            </table>
          </article>
          <article className="surface-card panel panel-table">
            <div className="panel-head">
              <div>
                <h2>Run Pair Table</h2>
                <p>All comparable benchmark rows in the selected pair.</p>
              </div>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    {runPairTableColumns.map((column) => (
                      <th key={column.key}>
                        <button type="button" className="table-sort-button" onClick={() => toggleRunPairSort(column.key)}>
                          {column.label}
                          <span>{runPairSort?.key === column.key ? (runPairSort.direction === "asc" ? "↑" : "↓") : "↕"}</span>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedComparisonRows.map((row) => (
                    <tr key={row.benchmark_id}>
                      <td><code>{row.benchmark_label}</code></td>
                      <td>{formatRuntime(row.focus_time_ns_median)}</td>
                      <td>{formatRuntime(row.baseline_time_ns_median)}</td>
                      <td><span className={`delta-badge delta-${deltaClass(row.runtime_delta)}`}>{formatPercent(row.runtime_delta)}</span></td>
                      <td>{formatBytes(row.focus_memory_bytes_min)}</td>
                      <td>{row.focus_allocs_min}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
          <article className="surface-card panel panel-table">
            <div className="panel-head">
              <div>
                <h2>Focus Run Benchmarks</h2>
                <p>Raw benchmark rows from the selected focus run.</p>
              </div>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Benchmark</th>
                    <th>Median</th>
                    <th>Min</th>
                    <th>Memory</th>
                    <th>Allocs</th>
                  </tr>
                </thead>
                <tbody>
                  {focusRows.map((row) => (
                    <tr key={row.benchmark_id}>
                      <td><code>{row.benchmark_label}</code></td>
                      <td>{formatRuntime(row.time_ns_median)}</td>
                      <td>{formatRuntime(row.time_ns_min)}</td>
                      <td>{formatBytes(row.memory_bytes_min)}</td>
                      <td>{row.allocs_min}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
          </>
        ) : activePage === "chart-tuning" ? (
          <>
            <header className="topbar">
              <div className="topbar-copy">
                <div className="breadcrumb">Benchmarking <span>›</span> Chart Tuning</div>
                <h1>Chart Tuning</h1>
                <p>Small display preferences for benchmark charts. These settings are saved in this browser.</p>
              </div>
            </header>
            <section className="settings-grid">
              <article className="surface-card panel setting-card">
                <div>
                  <h2>Benchmark Trend Line Style</h2>
                  <p>Choose whether the main trend chart connects points with straight line segments or the current smoothed curve.</p>
                </div>
                <div
                  className={`segmented-toggle segmented-toggle-${trendLineShape}`}
                  role="group"
                  aria-label="Benchmark trend line style"
                >
                  <button
                    type="button"
                    className={`segment-button${trendLineShape === "line" ? " segment-button-active" : ""}`}
                    onClick={() => setTrendLineShape("line")}
                  >
                    Line
                  </button>
                  <button
                    type="button"
                    className={`segment-button${trendLineShape === "curve" ? " segment-button-active" : ""}`}
                    onClick={() => setTrendLineShape("curve")}
                  >
                    Curve
                  </button>
                </div>
              </article>
            </section>
          </>
        ) : (
          <>
            <header className="topbar">
              <div className="topbar-copy">
                <div className="breadcrumb">Benchmarking <span>›</span> Databases</div>
                <h1>Databases</h1>
                <p>All benchmark databases currently visible to the frontend, plus metadata and loaded-dataset statistics when available.</p>
              </div>
              <div className="topbar-actions">
                <button type="button" className="button button-secondary" onClick={openLocalFilePicker}>Choose SQLite</button>
              </div>
            </header>
            <section className="catalog-grid">
              {databaseCatalog.length ? databaseCatalog.map((entry) => (
                <article className={`surface-card panel catalog-card${entry.isActive ? " catalog-card-active" : ""}`} key={entry.id}>
                  <div className="catalog-card-head">
                    <div>
                      <div className="catalog-eyebrow">{entry.source}</div>
                      <h2>{entry.title}</h2>
                      <p>{entry.description}</p>
                    </div>
                    {entry.isActive ? <span className="status-pill">Loaded</span> : <span className="status-pill status-pill-muted">Available</span>}
                  </div>
                  <div className="catalog-meta">
                    <div className="catalog-field">
                      <span>ID</span>
                      <strong>{entry.id}</strong>
                    </div>
                    <div className="catalog-field">
                      <span>Schema</span>
                      <strong>{formatSchemaLabel(entry.schemaVersion)}</strong>
                    </div>
                    <div className="catalog-field">
                      <span>Size</span>
                      <strong>{entry.sizeBytes === null ? "n/a" : formatBytes(entry.sizeBytes)}</strong>
                    </div>
                    <div className="catalog-field">
                      <span>Packed</span>
                      <strong>{formatOptionalDate(entry.packedAt)}</strong>
                    </div>
                    <div className="catalog-field catalog-field-wide">
                      <span>Source</span>
                      <code>{entry.url}</code>
                    </div>
                    {entry.sha256 ? (
                      <div className="catalog-field catalog-field-wide">
                        <span>SHA-256</span>
                        <code>{entry.sha256}</code>
                      </div>
                    ) : null}
                  </div>
                  {entry.stats ? (
                    <div className="catalog-stats">
                      <div className="catalog-stat"><span>Rows</span><strong>{entry.stats.rowCount.toLocaleString()}</strong></div>
                      <div className="catalog-stat"><span>Runs</span><strong>{entry.stats.runCount.toLocaleString()}</strong></div>
                      <div className="catalog-stat"><span>Keys</span><strong>{entry.stats.keyCount.toLocaleString()}</strong></div>
                      <div className="catalog-stat"><span>Machines</span><strong>{entry.stats.machineCount.toLocaleString()}</strong></div>
                      <div className="catalog-stat"><span>Metrics</span><strong>{entry.stats.metrics.join(", ") || "n/a"}</strong></div>
                      <div className="catalog-stat"><span>Latest Run</span><strong>{formatOptionalDate(entry.stats.latestRunDate)}</strong></div>
                      <div className="catalog-stat"><span>Dirty Runs</span><strong>{entry.stats.dirtyRunCount.toLocaleString()}</strong></div>
                    </div>
                  ) : (
                    <div className="catalog-empty subtle-card">Load this database to compute row, run, machine, metric, and latest-run statistics.</div>
                  )}
                  {Object.keys(entry.metadataPreview).length ? (
                    <details className="catalog-details">
                      <summary>Metadata Preview</summary>
                      <div className="catalog-preview">
                        {Object.entries(entry.metadataPreview).map(([key, value]) => (
                          <div className="catalog-preview-row" key={key}>
                            <span>{key}</span>
                            <code>{value || "n/a"}</code>
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </article>
              )) : (
                <article className="surface-card panel catalog-card">
                  <div className="catalog-card-head">
                    <div>
                      <div className="catalog-eyebrow">No catalog</div>
                      <h2>No databases are visible yet</h2>
                      <p>Choose a local SQLite file, or provide a benchledger manifest so the frontend can list available databases.</p>
                    </div>
                  </div>
                  <button type="button" className="button button-primary" onClick={openLocalFilePicker}>Choose Local SQLite</button>
                </article>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
