import { useEffect, useMemo, useRef, useState } from "react";
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
type TrendAxisMode = "commit" | "time";
type AppPhase = "booting" | "select-source" | "loading-database" | "ready";

const THEME_STORAGE_KEY = "componentlogging-perf-theme";

function initialTheme(): ThemeMode {
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "light" || savedTheme === "dark") return savedTheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
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

function metadataTitle(metadata: BenchLedgerMetadata): string {
  return metadata.project_name || "BenchLedger";
}

function metadataDescription(metadata: BenchLedgerMetadata): string {
  return metadata.project_description || metadata.notes || "Performance tracking for benchmark datasets.";
}

function sourceSummary(dataset: LoadedBenchmarkDataset | null): string {
  if (!dataset) return "No benchmark database loaded";
  return dataset.source_url ? `Serving ${dataset.source_label}` : `Loaded local file ${dataset.source_label}`;
}

function formatSchemaVersion(metadata: BenchLedgerMetadata): string {
  return metadata.schema_version === null ? "Unknown schema" : `Schema v${metadata.schema_version}`;
}

function App() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<BenchmarkRow[]>([]);
  const [dataset, setDataset] = useState<LoadedBenchmarkDataset | null>(null);
  const [manifest, setManifest] = useState<BenchLedgerManifest | null>(null);
  const [manifestUrl, setManifestUrl] = useState<string | null>(null);
  const [selectedDatabaseId, setSelectedDatabaseId] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<AppPhase>("booting");
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);
  const [machine, setMachine] = useState("");
  const [metricKind, setMetricKind] = useState("");
  const [focusRunId, setFocusRunId] = useState("");
  const [baselineRunId, setBaselineRunId] = useState("");
  const [group, setGroup] = useState("all");
  const [benchmarkKey, setBenchmarkKey] = useState("");
  const [trendAxisMode, setTrendAxisMode] = useState<TrendAxisMode>("commit");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

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
        if (databases.length === 1) {
          await selectManifestDatabase(databases[0], manifestEntry.url, cancelled);
          return;
        }
        setSelectedDatabaseId((current) => current || databases[0].id);
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

  const runs = useMemo(() => buildRuns(rows), [rows]);
  const latestRun = runs[0] ?? null;
  const machineOptions = useMemo(() => unique(runs.map((run) => run.machine_id)).sort(), [runs]);
  const metricOptions = useMemo(() => unique(runs.map((run) => run.metric_kind)).sort(), [runs]);

  useEffect(() => {
    if (!machineOptions.length) return;
    setMachine((current) => (current && machineOptions.includes(current) ? current : machineOptions[0]));
  }, [machineOptions]);

  useEffect(() => {
    if (!metricOptions.length) return;
    const metadataMetric = dataset?.metadata.default_metric ?? "";
    setMetricKind((current) => {
      if (current && metricOptions.includes(current)) return current;
      if (metadataMetric && metricOptions.includes(metadataMetric)) return metadataMetric;
      return metricOptions[0];
    });
  }, [dataset?.metadata.default_metric, metricOptions]);

  const filteredRuns = useMemo(
    () => runs.filter((run) => run.machine_id === machine && run.metric_kind === metricKind),
    [runs, machine, metricKind]
  );

  useEffect(() => {
    if (!filteredRuns.length) return;
    setFocusRunId((current) => (current && filteredRuns.some((run) => run.run_id === current) ? current : filteredRuns[0].run_id));
    setBaselineRunId((current) => {
      if (current && filteredRuns.some((run) => run.run_id === current)) return current;
      return filteredRuns[1]?.run_id ?? filteredRuns[0].run_id;
    });
  }, [filteredRuns]);

  const machineRows = useMemo(
    () => rows.filter((row) => row.machine_id === machine && row.metric_kind === metricKind),
    [rows, machine, metricKind]
  );

  const groupOptions = useMemo(() => ["all", ...unique(machineRows.map((row) => row.group)).sort()], [machineRows]);

  useEffect(() => {
    if (!groupOptions.length) return;
    setGroup((current) => (groupOptions.includes(current) ? current : "all"));
  }, [groupOptions]);

  const scopedRows = useMemo(
    () => machineRows.filter((row) => group === "all" || row.group === group),
    [machineRows, group]
  );

  const benchmarkOptions = useMemo(() => unique(scopedRows.map((row) => row.benchmark_key)).sort(), [scopedRows]);

  useEffect(() => {
    if (!benchmarkOptions.length) return;
    setBenchmarkKey((current) => (current && benchmarkOptions.includes(current) ? current : benchmarkOptions[0]));
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

  const focusByBenchmark = useMemo(() => new Map(focusRows.map((row) => [row.benchmark_key, row])), [focusRows]);
  const baselineByBenchmark = useMemo(() => new Map(baselineRows.map((row) => [row.benchmark_key, row])), [baselineRows]);

  const focusBenchmark = benchmarkKey ? focusByBenchmark.get(benchmarkKey) ?? null : null;
  const baselineBenchmark = benchmarkKey ? baselineByBenchmark.get(benchmarkKey) ?? null : null;

  const comparisonRows = useMemo<PairComparison[]>(() => {
    const keys = unique([...focusByBenchmark.keys(), ...baselineByBenchmark.keys()]).sort();
    return keys
      .map((key) => {
        const focus = focusByBenchmark.get(key);
        const baseline = baselineByBenchmark.get(key);
        if (!focus || !baseline) return null;
        return {
          benchmark_key: key,
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

  const trendRows = useMemo(() => {
    return scopedRows
      .filter((row) => row.benchmark_key === benchmarkKey)
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
  }, [benchmarkKey, runs, scopedRows]);

  const stats = useMemo(() => [
    {
      label: "Benchmark Rows",
      value: rows.length.toLocaleString(),
      detail: `${unique(rows.map((row) => row.benchmark_key)).length.toLocaleString()} keys in SQLite`
    },
    {
      label: "Captured Runs",
      value: filteredRuns.length.toLocaleString(),
      detail: machine && metricKind ? `filtered on ${machine} · ${metricKind}` : "Waiting for a machine slice"
    },
    {
      label: "Selected Runtime",
      value: focusBenchmark ? formatRuntime(focusBenchmark.time_ns_median) : "n/a",
      detail: focusBenchmark && baselineBenchmark ? `${formatPercent(percentageChange(focusBenchmark.time_ns_median, baselineBenchmark.time_ns_median))} vs baseline` : "Pick a comparable baseline run"
    },
    {
      label: "Dirty Snapshots",
      value: runs.filter((run) => run.is_dirty).length.toLocaleString(),
      detail: latestRun?.is_dirty ? "Latest run was recorded from a dirty worktree" : "Latest run is clean"
    }
  ], [baselineBenchmark, filteredRuns.length, focusBenchmark, latestRun?.is_dirty, machine, metricKind, rows, runs]);

  const plotTheme = useMemo(() => {
    if (theme === "dark") {
      return {
        paper: "#111827",
        plot: "#111827",
        grid: "#334155",
        axis: "#cbd5e1",
        zero: "#475569"
      };
    }
    return {
      paper: "#ffffff",
      plot: "#ffffff",
      grid: "#e2e8f0",
      axis: "#475569",
      zero: "#cbd5e1"
    };
  }, [theme]);

  const sourceDatabases = manifest?.databases ?? [];
  const currentMetadata = dataset?.metadata ?? null;
  const siteTitle = currentMetadata ? metadataTitle(currentMetadata) : manifest?.site?.title || "BenchLedger";
  const siteDescription = currentMetadata ? metadataDescription(currentMetadata) : manifest?.site?.description || "Load a benchmark SQLite database to inspect runs and trends.";

  function openLocalFilePicker() {
    fileInputRef.current?.click();
  }

  if (phase === "booting" || phase === "loading-database") {
    return <div className="state-shell">{phase === "booting" ? "Discovering benchmark sources..." : "Loading benchmark database..."}</div>;
  }

  if (!dataset || !rows.length) {
    return (
      <div className="state-shell state-shell-rich">
        <input
          ref={fileInputRef}
          type="file"
          accept=".db,.sqlite,.sqlite3,application/vnd.sqlite3"
          className="visually-hidden"
          onChange={(event) => {
            void handleLocalFileChange(event);
          }}
        />
        <div className="state-card surface-card">
          <div className="brand">
            <div className="brand-mark">BL</div>
            <div>
              <strong>{manifest?.site?.title || "BenchLedger"}</strong>
              <span>Runtime benchmark viewer</span>
            </div>
          </div>
          <div className="state-copy">
            <h1>No benchmark database is loaded</h1>
            <p>
              {error
                ? `BenchLedger could not open the default dataset. ${error}`
                : "Pick a local SQLite database or select one from the packaged manifest to start exploring benchmark history."}
            </p>
          </div>
          {sourceDatabases.length > 0 ? (
            <div className="state-section">
              <span className="state-label">Packaged Databases</span>
              <div className="source-list">
                {sourceDatabases.map((database) => (
                  <button
                    key={database.id}
                    type="button"
                    className="source-card subtle-card"
                    onClick={() => {
                      void handleDatabaseSelection(database.id);
                    }}
                  >
                    <strong>{databaseTitle(database)}</strong>
                    <span>{database.description || database.metadata_preview?.project_name || database.url}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          <div className="state-actions">
            <button type="button" className="button button-primary" onClick={openLocalFilePicker}>
              Choose Local SQLite
            </button>
          </div>
        </div>
      </div>
    );
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
          <div className="brand-mark">BL</div>
          <div>
            <strong>{siteTitle}</strong>
            <span>{formatSchemaVersion(dataset.metadata)}</span>
          </div>
        </div>
        <nav className="nav-section">
          <span className="nav-label">Navigation</span>
          <a className="nav-item nav-item-active" href="#">Executive Overview</a>
          <a className="nav-item" href="#">Run Ledger</a>
          <a className="nav-item" href="#">Benchmark Keys</a>
          <a className="nav-item" href="#">Machines</a>
        </nav>
        <nav className="nav-section">
          <span className="nav-label">Current Slice</span>
          <div className="sidebar-controls">
            <label className="sidebar-field">
              <span>Machine</span>
              <select value={machine} onChange={(event) => setMachine(event.target.value)}>
                {machineOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="sidebar-field">
              <span>Metric</span>
              <select value={metricKind} onChange={(event) => setMetricKind(event.target.value)}>
                {metricOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            <label className="sidebar-field">
              <span>Group</span>
              <select value={group} onChange={(event) => setGroup(event.target.value)}>
                {groupOptions.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </label>
            {sourceDatabases.length > 1 ? (
              <label className="sidebar-field">
                <span>Database</span>
                <select
                  value={selectedDatabaseId}
                  onChange={(event) => {
                    void handleDatabaseSelection(event.target.value);
                  }}
                >
                  {sourceDatabases.map((database) => <option key={database.id} value={database.id}>{databaseTitle(database)}</option>)}
                </select>
              </label>
            ) : null}
          </div>
        </nav>
        <div className="sidebar-note subtle-card">
          <strong>Source</strong>
          <span>{sourceSummary(dataset)}</span>
          {dataset.metadata.producer ? <p>{dataset.metadata.producer_version ? `${dataset.metadata.producer} ${dataset.metadata.producer_version}` : dataset.metadata.producer}</p> : null}
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
              <strong>{latestRun?.machine_id ?? dataset.source_label}</strong>
              <span>{latestRun ? formatDate(latestRun.date) : "No benchmark run"}</span>
            </div>
          </div>
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <div className="topbar-copy">
            <div className="breadcrumb">Benchmarking <span>›</span> Executive Overview</div>
            <h1>{siteTitle}</h1>
            <p>{siteDescription}</p>
          </div>
          <div className="topbar-actions">
            <label className="field control-card control-card-wide">
              <span>Focus run</span>
              <select value={focusRunId} onChange={(event) => setFocusRunId(event.target.value)}>
                {filteredRuns.map((run) => <option key={run.run_id} value={run.run_id}>{runHeadline(run)} · {formatDate(run.date)}</option>)}
              </select>
            </label>
            <label className="field control-card control-card-wide">
              <span>Baseline run</span>
              <select value={baselineRunId} onChange={(event) => setBaselineRunId(event.target.value)}>
                {filteredRuns.map((run) => <option key={run.run_id} value={run.run_id}>{runHeadline(run)} · {formatDate(run.date)}</option>)}
              </select>
            </label>
            <button type="button" className="button button-secondary" onClick={openLocalFilePicker}>Choose SQLite</button>
            {dataset.source_url ? (
              <a className="button button-primary" href={dataset.source_url} download={dataset.source_label}>Download</a>
            ) : null}
          </div>
        </header>
        <section className="stats-grid">
          {stats.map((stat) => (
            <article className="surface-card stat-card" key={stat.label}>
              <div className="stat-icon" />
              <div className="stat-copy">
                <span>{stat.label}</span>
                <strong>{stat.value}</strong>
                <p>{stat.detail}</p>
              </div>
            </article>
          ))}
        </section>
        <section className="content-grid">
          <article className="surface-card panel panel-wide">
            <div className="panel-head">
              <div>
                <h2>Benchmark Trend</h2>
                <p>{benchmarkKey || "No benchmark selected"} across the active machine and metric slice.</p>
              </div>
              <label className="field control-card control-card-compact">
                <span>Benchmark</span>
                <select value={benchmarkKey} onChange={(event) => setBenchmarkKey(event.target.value)}>
                  {benchmarkOptions.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </label>
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
                    mode: "lines+markers",
                    x: trendRows.map((row) => trendAxisMode === "commit" ? row.run_axis_label : row.date),
                    y: trendRows.map((row) => row.time_ns_median),
                    customdata: trendRows.map((row) => row.date),
                    line: { color: "#2563eb", width: 3, shape: "spline", smoothing: 0.75 },
                    marker: {
                      size: 8,
                      color: trendRows.map((row) => row.run_tone === "tag" ? "#1d4ed8" : row.run_tone === "master" ? "#2563eb" : "#94a3b8")
                    },
                    hovertemplate: "%{x}<br>%{customdata}<br>%{y:.2f} ns<extra></extra>"
                  }
                ]}
                layout={{
                  autosize: true,
                  margin: { t: 10, r: 16, b: 40, l: 60 },
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
                      ? `${benchmarkKey} is ${formatPercent(percentageChange(focusBenchmark.time_ns_median, baselineBenchmark.time_ns_median))}`
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
                    y: comparisonRows.slice(0, 6).map((row) => row.benchmark_key).reverse(),
                    marker: {
                      color: comparisonRows.slice(0, 6).map((row) => row.runtime_delta > 0 ? "#dc2626" : row.runtime_delta < 0 ? "#16a34a" : "#94a3b8").reverse()
                    },
                    hovertemplate: "%{y}<br>%{x:.2f}%<extra></extra>"
                  }
                ]}
                layout={{
                  autosize: true,
                  margin: { t: 10, r: 12, b: 36, l: 180 },
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
                    <th>Benchmark</th>
                    <th>Focus</th>
                    <th>Baseline</th>
                    <th>Delta</th>
                    <th>Memory</th>
                    <th>Allocs</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows.map((row) => (
                    <tr key={row.benchmark_key}>
                      <td><code>{row.benchmark_key}</code></td>
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
                    <tr key={row.benchmark_key}>
                      <td><code>{row.benchmark_key}</code></td>
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
      </main>
    </div>
  );
}

export default App;
