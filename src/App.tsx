import { useEffect, useMemo, useRef, useState } from "react";
import { FiActivity, FiClock, FiDatabase, FiGitBranch } from "react-icons/fi";
import { AppSidebar } from "./components/AppSidebar";
import { type BenchmarkKeyFilterOption } from "./components/BenchmarkKeyCascadeFilter";
import { BenchmarkKeysPage } from "./components/BenchmarkKeysPage";
import { ChartTuningPage } from "./components/ChartTuningPage";
import { DatabaseCatalogPage } from "./components/DatabaseCatalogPage";
import { type GroupMenuOption } from "./components/GroupCascadeMenu";
import { OverviewPage, type OverviewStat } from "./components/OverviewPage";
import { TrendBoardPage, type TrendBoardCard } from "./components/TrendBoardPage";
import { formatMetricValue, formatPercent, metricDeltaClass, parseDate, percentageChange, unique } from "./lib/format";
import {
  loadBenchmarkRowsFromFile,
  loadBenchmarkRowsFromManifestDatabase,
  loadBenchmarkRowsFromUrl,
  loadManifest
} from "./lib/sqlite";
import type {
  BenchmarkRow,
  BenchLedgerManifest,
  BenchLedgerManifestDatabase,
  LoadedBenchmarkDataset,
  PairComparison
} from "./lib/types";
import {
  Trend_Y_Padding_Ratio,
  Asset_Base_URL,
  buildRuns,
  buildTrendTrace,
  colorForBenchmark,
  colorWithAlpha,
  comparePath,
  databaseDescription,
  databaseTitle,
  dateInputValue,
  dateRangeEnd,
  dateRangeStart,
  defaultRunPairSortDirection,
  formatDateRangePart,
  metadataDescription,
  metadataTitle,
  readUISettings,
  metricLabel,
  rowMatchesDisplayStrategy,
  runAxisLabel,
  runHeadline,
  runId,
  runPairSortValue,
  runTone,
  statDeltaTone,
  type ActivePage,
  type AppPhase,
  type DatabaseCatalogEntry,
  type DatabaseCatalogStats,
  type DisplayStrategy,
  type PlotTheme,
  type RunPairSort,
  type RunPairSortKey,
  type ThemeMode,
  type TrendAxisMode,
  type TrendLineShape,
  type TrendPlotRow,
  type UISettings
} from "./lib/dashboard";

function App() {
  const initialSettings = useMemo(readUISettings, []);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const timeRangePickerRef = useRef<HTMLDetailsElement | null>(null);
  const timeStartInputRef = useRef<HTMLInputElement | null>(null);
  const trendBoardTimeRangePickerRef = useRef<HTMLDetailsElement | null>(null);
  const trendBoardTimeStartInputRef = useRef<HTMLInputElement | null>(null);
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
  const [trendBoardMachine, setTrendBoardMachine] = useState(initialSettings.trendBoardMachine);
  const [trendBoardMetricKind, setTrendBoardMetricKind] = useState(initialSettings.trendBoardMetricKind);
  const [trendBoardDisplayStrategy, setTrendBoardDisplayStrategy] = useState<DisplayStrategy>(initialSettings.trendBoardDisplayStrategy);
  const [focusRunId, setFocusRunId] = useState(initialSettings.focusRunId);
  const [baselineRunId, setBaselineRunId] = useState(initialSettings.baselineRunId);
  const [group, setGroup] = useState(initialSettings.group);
  const [trendBoardGroup, setTrendBoardGroup] = useState(initialSettings.trendBoardGroup);
  const [branch, setBranch] = useState(initialSettings.branch);
  const [trendBoardBranch, setTrendBoardBranch] = useState(initialSettings.trendBoardBranch);
  const [timeStart, setTimeStart] = useState(initialSettings.timeStart);
  const [timeEnd, setTimeEnd] = useState(initialSettings.timeEnd);
  const [trendBoardTimeStart, setTrendBoardTimeStart] = useState(initialSettings.trendBoardTimeStart);
  const [trendBoardTimeEnd, setTrendBoardTimeEnd] = useState(initialSettings.trendBoardTimeEnd);
  const [displayStrategy, setDisplayStrategy] = useState<DisplayStrategy>(initialSettings.displayStrategy);
  const [overviewSelectedBenchmarkIds, setOverviewSelectedBenchmarkIds] = useState(initialSettings.overviewSelectedBenchmarkIds);
  const [trendBoardSelectedBenchmarkIds, setTrendBoardSelectedBenchmarkIds] = useState(initialSettings.trendBoardSelectedBenchmarkIds);
  const [trendLineShape, setTrendLineShape] = useState<TrendLineShape>(initialSettings.trendLineShape);
  const [trendAxisMode, setTrendAxisMode] = useState<TrendAxisMode>(initialSettings.trendAxisMode);
  const [trendBoardColumns, setTrendBoardColumns] = useState(initialSettings.trendBoardColumns);
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

    function closeTrendBoardTimeRangePicker(event: PointerEvent) {
      const picker = trendBoardTimeRangePickerRef.current;
      if (!picker?.open) return;
      if (event.target instanceof Node && picker.contains(event.target)) return;
      picker.open = false;
    }

    document.addEventListener("pointerdown", closeTimeRangePicker);
    document.addEventListener("pointerdown", closeTrendBoardTimeRangePicker);
    return () => {
      document.removeEventListener("pointerdown", closeTimeRangePicker);
      document.removeEventListener("pointerdown", closeTrendBoardTimeRangePicker);
    };
  }, []);

  useEffect(() => {
    const settings: UISettings = {
      activePage,
      theme,
      selectedDatabaseId,
      machine,
      metricKind,
      trendBoardMachine,
      trendBoardMetricKind,
      trendBoardDisplayStrategy,
      focusRunId,
      baselineRunId,
      group,
      trendBoardGroup,
      branch,
      trendBoardBranch,
      timeStart,
      timeEnd,
      trendBoardTimeStart,
      trendBoardTimeEnd,
      displayStrategy,
      overviewSelectedBenchmarkIds,
      trendBoardSelectedBenchmarkIds,
      trendLineShape,
      trendAxisMode,
      trendBoardColumns
    };
    window.localStorage.setItem("benchledger-ui-settings", JSON.stringify(settings));
  }, [
    activePage,
    baselineRunId,
    branch,
    displayStrategy,
    focusRunId,
    group,
    machine,
    metricKind,
    trendBoardBranch,
    trendBoardDisplayStrategy,
    trendBoardGroup,
    trendBoardMachine,
    trendBoardMetricKind,
    overviewSelectedBenchmarkIds,
    selectedDatabaseId,
    theme,
    timeEnd,
    timeStart,
    trendBoardTimeEnd,
    trendBoardTimeStart,
    trendBoardSelectedBenchmarkIds,
    trendBoardColumns,
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

  useEffect(() => {
    if (!dataset?.source_url) return;
    if (phase !== "ready") return;

    const hostname = window.location.hostname;
    const isLocalHost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
    if (!isLocalHost) return;

    let cancelled = false;

    function datasetSignature(sourceDataset: LoadedBenchmarkDataset): string {
      const lastRow = sourceDataset.rows[sourceDataset.rows.length - 1];
      return [
        sourceDataset.metadata.updated_at,
        sourceDataset.rows.length,
        lastRow?.run_id ?? "",
        lastRow?.measured_at ?? "",
        lastRow?.benchmark_id ?? "",
        lastRow?.value ?? ""
      ].join("|");
    }

    const refreshInterval = window.setInterval(() => {
      void (async () => {
        try {
          const loadedDataset = await loadBenchmarkRowsFromUrl(dataset.source_url!, dataset.source_label);
          if (cancelled) return;
          if (datasetSignature(loadedDataset) === datasetSignature(dataset)) return;
          setDataset(loadedDataset);
          setRows(loadedDataset.rows);
          setError("");
        } catch (refreshError) {
          if (!cancelled) console.warn("BenchLedger auto-refresh failed:", refreshError);
        }
      })();
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
    };
  }, [dataset, phase]);

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
  const machineOptions = useMemo(() => ["all", ...unique(allRuns.map((run) => run.machine_id)).sort()], [allRuns]);
  const metricOptions = useMemo(() => {
    const metricRows = machine && machine !== "all" ? rows.filter((row) => row.machine_id === machine) : rows;
    return unique(metricRows.map((row) => metricLabel(row))).sort();
  }, [machine, rows]);
  const trendBoardMetricOptions = useMemo(() => {
    const metricRows = trendBoardMachine && trendBoardMachine !== "all"
      ? rows.filter((row) => row.machine_id === trendBoardMachine)
      : rows;
    return unique(metricRows.map((row) => metricLabel(row))).sort();
  }, [rows, trendBoardMachine]);
  const branchOptions = useMemo(() => ["all", ...unique(rows.map((row) => row.branch).filter(Boolean)).sort()], [rows]);
  const trendBoardBranchOptions = branchOptions;
  const timeStartValue = useMemo(() => dateRangeStart(timeStart), [timeStart]);
  const timeEndValue = useMemo(() => dateRangeEnd(timeEnd), [timeEnd]);
  const trendBoardTimeStartValue = useMemo(() => dateRangeStart(trendBoardTimeStart), [trendBoardTimeStart]);
  const trendBoardTimeEndValue = useMemo(() => dateRangeEnd(trendBoardTimeEnd), [trendBoardTimeEnd]);
  const datasetTimeStart = useMemo(() => dateInputValue(rows.reduce((earliest, row) => {
    const rowDate = parseDate(row.code_date)?.valueOf() ?? Number.POSITIVE_INFINITY;
    const earliestDate = parseDate(earliest)?.valueOf() ?? Number.POSITIVE_INFINITY;
    return rowDate < earliestDate ? row.code_date : earliest;
  }, "")), [rows]);
  const datasetTimeEnd = useMemo(() => dateInputValue(rows.reduce((latest, row) => {
    const rowDate = parseDate(row.code_date)?.valueOf() ?? Number.NEGATIVE_INFINITY;
    const latestDate = parseDate(latest)?.valueOf() ?? Number.NEGATIVE_INFINITY;
    return rowDate > latestDate ? row.code_date : latest;
  }, "")), [rows]);

  useEffect(() => {
    setMachine((current) => (current && machineOptions.includes(current) ? current : "all"));
  }, [machineOptions]);

  useEffect(() => {
    if (!metricOptions.length) return;
    setMetricKind((current) => {
      if (current && metricOptions.includes(current)) return current;
      return metricOptions[0];
    });
  }, [metricOptions]);

  useEffect(() => {
    setTrendBoardMachine((current) => (current && machineOptions.includes(current) ? current : "all"));
  }, [machineOptions]);

  useEffect(() => {
    if (!trendBoardMetricOptions.length) return;
    setTrendBoardMetricKind((current) => {
      if (current && trendBoardMetricOptions.includes(current)) return current;
      return trendBoardMetricOptions[0];
    });
  }, [trendBoardMetricOptions]);

  useEffect(() => {
    if (!branchOptions.length) return;
    setBranch((current) => (branchOptions.includes(current) ? current : "all"));
  }, [branchOptions]);

  useEffect(() => {
    if (!trendBoardBranchOptions.length) return;
    setTrendBoardBranch((current) => (trendBoardBranchOptions.includes(current) ? current : "all"));
  }, [trendBoardBranchOptions]);

  const filteredRows = useMemo(() => rows.filter((row) => {
    if (machine !== "all" && row.machine_id !== machine) return false;
    if (metricLabel(row) !== metricKind) return false;
    if (branch !== "all" && row.branch !== branch) return false;
    if (!rowMatchesDisplayStrategy(row, displayStrategy)) return false;
    const rowDate = parseDate(row.code_date)?.valueOf() ?? null;
    if (timeStartValue !== null && (rowDate === null || rowDate < timeStartValue)) return false;
    if (timeEndValue !== null && (rowDate === null || rowDate > timeEndValue)) return false;
    return true;
  }), [branch, displayStrategy, machine, metricKind, rows, timeEndValue, timeStartValue]);

  const groupOptions = useMemo<GroupMenuOption[]>(() => {
    const optionsByValue = new Map<string, GroupMenuOption>();
    for (const row of filteredRows) {
      for (let depth = 1; depth <= row.benchmark_path.length; depth += 1) {
        const path = row.benchmark_path.slice(0, depth);
        const value = JSON.stringify(path);
        if (optionsByValue.has(value)) continue;
        optionsByValue.set(value, { value, path });
      }
    }
    return Array.from(optionsByValue.values()).sort((left, right) => comparePath(left.path, right.path));
  }, [filteredRows]);
  const trendBoardFilteredRows = useMemo(() => rows.filter((row) => {
    if (trendBoardMachine !== "all" && row.machine_id !== trendBoardMachine) return false;
    if (metricLabel(row) !== trendBoardMetricKind) return false;
    if (trendBoardBranch !== "all" && row.branch !== trendBoardBranch) return false;
    if (!rowMatchesDisplayStrategy(row, trendBoardDisplayStrategy)) return false;
    const rowDate = parseDate(row.code_date)?.valueOf() ?? null;
    if (trendBoardTimeStartValue !== null && (rowDate === null || rowDate < trendBoardTimeStartValue)) return false;
    if (trendBoardTimeEndValue !== null && (rowDate === null || rowDate > trendBoardTimeEndValue)) return false;
    return true;
  }), [
    rows,
    trendBoardBranch,
    trendBoardDisplayStrategy,
    trendBoardMachine,
    trendBoardMetricKind,
    trendBoardTimeEndValue,
    trendBoardTimeStartValue
  ]);
  const trendBoardGroupOptions = useMemo<GroupMenuOption[]>(() => {
    const optionsByValue = new Map<string, GroupMenuOption>();
    for (const row of trendBoardFilteredRows) {
      for (let depth = 1; depth <= row.benchmark_path.length; depth += 1) {
        const path = row.benchmark_path.slice(0, depth);
        const value = JSON.stringify(path);
        if (optionsByValue.has(value)) continue;
        optionsByValue.set(value, { value, path });
      }
    }
    return Array.from(optionsByValue.values()).sort((left, right) => comparePath(left.path, right.path));
  }, [trendBoardFilteredRows]);

  const groupOptionsByValue = useMemo(
    () => new Map(groupOptions.map((option) => [option.value, option])),
    [groupOptions]
  );
  const trendBoardGroupOptionsByValue = useMemo(
    () => new Map(trendBoardGroupOptions.map((option) => [option.value, option])),
    [trendBoardGroupOptions]
  );

  useEffect(() => {
    setGroup((current) => (current === "all" || groupOptionsByValue.has(current) ? current : "all"));
  }, [groupOptionsByValue]);
  useEffect(() => {
    setTrendBoardGroup((current) => (current === "all" || trendBoardGroupOptionsByValue.has(current) ? current : "all"));
  }, [trendBoardGroupOptionsByValue]);

  const selectedGroupPath = useMemo(
    () => (group === "all" ? null : groupOptionsByValue.get(group)?.path ?? null),
    [group, groupOptionsByValue]
  );
  const selectedTrendBoardGroupPath = useMemo(
    () => (trendBoardGroup === "all" ? null : trendBoardGroupOptionsByValue.get(trendBoardGroup)?.path ?? null),
    [trendBoardGroup, trendBoardGroupOptionsByValue]
  );

  const selectedGroupLabel = useMemo(() => {
    if (group === "all") return "All groups";
    const option = groupOptionsByValue.get(group);
    return option ? option.path.join(" > ") : "All groups";
  }, [group, groupOptionsByValue]);
  const selectedTrendBoardGroupLabel = useMemo(() => {
    if (trendBoardGroup === "all") return "All groups";
    const option = trendBoardGroupOptionsByValue.get(trendBoardGroup);
    return option ? option.path.join(" > ") : "All groups";
  }, [trendBoardGroup, trendBoardGroupOptionsByValue]);

  const scopedRows = useMemo(
    () => filteredRows.filter((row) => {
      if (!selectedGroupPath) return true;
      return selectedGroupPath.every((segment, index) => row.benchmark_path[index] === segment);
    }),
    [filteredRows, selectedGroupPath]
  );
  const trendBoardScopedRows = useMemo(
    () => trendBoardFilteredRows.filter((row) => {
      if (!selectedTrendBoardGroupPath) return true;
      return selectedTrendBoardGroupPath.every((segment, index) => row.benchmark_path[index] === segment);
    }),
    [selectedTrendBoardGroupPath, trendBoardFilteredRows]
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

  const benchmarkOptionRows = useMemo(
    () => Array.from(new Map(scopedRows.map((row) => [row.benchmark_id, row])).values()),
    [scopedRows]
  );
  const trendBoardBenchmarkOptionRows = useMemo(
    () => Array.from(new Map(trendBoardScopedRows.map((row) => [row.benchmark_id, row])).values()),
    [trendBoardScopedRows]
  );
  const benchmarkOptions = useMemo<BenchmarkKeyFilterOption[]>(() => {
    return benchmarkOptionRows
      .map((row) => ({
        value: row.benchmark_id,
        label: row.benchmark_label,
        path: row.benchmark_path.length ? row.benchmark_path : [row.benchmark_label]
      }))
      .sort((left, right) => comparePath(left.path, right.path) || left.label.localeCompare(right.label) || left.value.localeCompare(right.value));
  }, [benchmarkOptionRows]);
  const trendBoardBenchmarkOptions = useMemo<BenchmarkKeyFilterOption[]>(() => {
    return trendBoardBenchmarkOptionRows
      .map((row) => ({
        value: row.benchmark_id,
        label: row.benchmark_label,
        path: row.benchmark_path.length ? row.benchmark_path : [row.benchmark_label]
      }))
      .sort((left, right) => comparePath(left.path, right.path) || left.label.localeCompare(right.label) || left.value.localeCompare(right.value));
  }, [trendBoardBenchmarkOptionRows]);

  useEffect(() => {
    const availableValues = new Set(benchmarkOptions.map((option) => option.value));
    setOverviewSelectedBenchmarkIds((current) => current.filter((value) => availableValues.has(value)));
  }, [benchmarkOptions]);
  useEffect(() => {
    const availableValues = new Set(trendBoardBenchmarkOptions.map((option) => option.value));
    setTrendBoardSelectedBenchmarkIds((current) => current.filter((value) => availableValues.has(value)));
  }, [trendBoardBenchmarkOptions]);

  const currentBenchmarkId = overviewSelectedBenchmarkIds[0] ?? "";
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
  const focusBenchmark = currentBenchmarkId ? focusByBenchmark.get(currentBenchmarkId) ?? null : null;
  const baselineBenchmark = currentBenchmarkId ? baselineByBenchmark.get(currentBenchmarkId) ?? null : null;

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
          focus_value: focus.value,
          baseline_value: baseline.value,
          delta: percentageChange(focus.value, baseline.value),
          unit: focus.unit,
          better: focus.better
        };
      })
      .filter((row): row is PairComparison => row !== null)
      .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));
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

  const overviewTrendRowsByBenchmark = useMemo(() => {
    const rowsByBenchmark = new Map<string, TrendPlotRow[]>();
    const selectedBenchmarkIdSet = new Set(overviewSelectedBenchmarkIds);

    for (const row of scopedRows) {
      if (!selectedBenchmarkIdSet.has(row.benchmark_id)) continue;
      const run = runs.find((candidate) => candidate.run_id === runId(row));
      const entry = {
        ...row,
        date_value: parseDate(row.code_date),
        run_axis_label: runAxisLabel(row),
        run_headline: run ? runHeadline(run) : row.label,
        run_tone: run ? runTone(run) : "branch"
      };
      if (!entry.date_value) continue;
      const bucket = rowsByBenchmark.get(row.benchmark_id) ?? [];
      bucket.push(entry);
      rowsByBenchmark.set(row.benchmark_id, bucket);
    }

    for (const entries of rowsByBenchmark.values()) {
      entries.sort((left, right) => left.date_value!.valueOf() - right.date_value!.valueOf());
    }

    return rowsByBenchmark;
  }, [overviewSelectedBenchmarkIds, runs, scopedRows]);
  const trendBoardRuns = useMemo(() => buildRuns(trendBoardScopedRows), [trendBoardScopedRows]);
  const trendBoardRowsByBenchmark = useMemo(() => {
    const rowsByBenchmark = new Map<string, TrendPlotRow[]>();
    const selectedBenchmarkIdSet = new Set(trendBoardSelectedBenchmarkIds);

    for (const row of trendBoardScopedRows) {
      if (!selectedBenchmarkIdSet.has(row.benchmark_id)) continue;
      const run = trendBoardRuns.find((candidate) => candidate.run_id === runId(row));
      const entry = {
        ...row,
        date_value: parseDate(row.code_date),
        run_axis_label: runAxisLabel(row),
        run_headline: run ? runHeadline(run) : row.label,
        run_tone: run ? runTone(run) : "branch"
      };
      if (!entry.date_value) continue;
      const bucket = rowsByBenchmark.get(row.benchmark_id) ?? [];
      bucket.push(entry);
      rowsByBenchmark.set(row.benchmark_id, bucket);
    }

    for (const entries of rowsByBenchmark.values()) {
      entries.sort((left, right) => left.date_value!.valueOf() - right.date_value!.valueOf());
    }

    return rowsByBenchmark;
  }, [trendBoardRuns, trendBoardScopedRows, trendBoardSelectedBenchmarkIds]);

  const selectedMetricDelta = focusBenchmark && baselineBenchmark
    ? percentageChange(focusBenchmark.value, baselineBenchmark.value)
    : null;

  const stats = useMemo<OverviewStat[]>(() => [
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
      delta: "",
      deltaTone: "neutral",
      detail: machine && metricKind ? `filtered on ${machine} · ${metricKind}` : "Waiting for a machine slice"
    },
    {
      Icon: FiClock,
      label: "Selected Metric",
      value: focusBenchmark ? formatMetricValue(focusBenchmark.value, focusBenchmark.unit) : "n/a",
      delta: selectedMetricDelta === null ? "" : formatPercent(selectedMetricDelta),
      deltaTone: selectedMetricDelta === null || !focusBenchmark
        ? "neutral"
        : statDeltaTone[metricDeltaClass(selectedMetricDelta, focusBenchmark.better)],
      detail: focusBenchmark && baselineBenchmark ? "vs baseline" : "Pick a comparable baseline run"
    },
    {
      Icon: FiGitBranch,
      label: "Dirty Snapshots",
      value: filteredRuns.filter((run) => run.is_dirty).length.toLocaleString(),
      delta: "",
      deltaTone: "neutral",
      detail: latestRun?.is_dirty ? "Latest run was recorded from a dirty worktree" : "Latest run is clean"
    }
  ], [baselineBenchmark, filteredRuns, focusBenchmark, latestRun, machine, metricKind, scopedRows, selectedMetricDelta]);

  const plotTheme = useMemo<PlotTheme>(() => {
    if (theme === "dark") {
      return {
        paper: "transparent",
        plot: "transparent",
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
      paper: "transparent",
      plot: "transparent",
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
      metrics: unique(rows.map((row) => `${row.metric_name} ${row.statistic} ${row.unit}`)).sort(),
      latestRunDate: latestDatabaseRun?.measured_at ?? "",
      dirtyRunCount: allRuns.filter((run) => run.is_dirty).length
    };
  }, [allRuns, dataset, latestDatabaseRun?.measured_at, rows]);

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
  const trendRows = useMemo(
    () => benchmarkOptions.flatMap((option) => overviewTrendRowsByBenchmark.get(option.value) ?? []),
    [benchmarkOptions, overviewTrendRowsByBenchmark]
  );
  const trendPlotMargin = trendRows.length ? { t: 10, r: 16, b: 40, l: 55 } : { t: 10, r: 16, b: 40, l: 20 };
  const deltaPlotMargin = comparisonRows.length ? { t: 10, r: 12, b: 36, l: 170 } : { t: 10, r: 12, b: 36, l: 20 };
  const trendY = trendRows.map((row) => row.value);
  const trendYMin = trendY.length ? Math.min(...trendY) : 0;
  const trendYMax = trendY.length ? Math.max(...trendY) : 0;
  const trendYSpan = trendYMax - trendYMin;
  const trendYPadding = trendYSpan > 0
    ? trendYSpan * Trend_Y_Padding_Ratio
    : Math.max(Math.abs(trendYMin) * Trend_Y_Padding_Ratio, 1);
  const timeRangeLabel = timeStart || timeEnd
    ? `${formatDateRangePart(timeStart, "Any start")} - ${formatDateRangePart(timeEnd, "Any end")}`
    : "All time";

  const trendTraces = useMemo(() => {
    if (!overviewSelectedBenchmarkIds.length) return [];
    return overviewSelectedBenchmarkIds.flatMap((benchmarkKey, index) => {
      const traceRows = overviewTrendRowsByBenchmark.get(benchmarkKey) ?? [];
      const color = colorForBenchmark(index);
      const label = benchmarkOptions.find((option) => option.value === benchmarkKey)?.label ?? benchmarkKey;
      return buildTrendTrace(traceRows, {
        axisMode: trendAxisMode,
        lineShape: trendLineShape,
        color,
        label,
        plotTheme,
        theme,
        yMin: trendYMin,
        yPadding: trendYPadding,
        showLegend: overviewSelectedBenchmarkIds.length > 1
      });
    });
  }, [
    benchmarkOptions,
    overviewSelectedBenchmarkIds,
    plotTheme,
    theme,
    trendAxisMode,
    trendLineShape,
    overviewTrendRowsByBenchmark,
    trendYMin,
    trendYPadding
  ]);
  const trendBoardRows = useMemo(
    () => trendBoardBenchmarkOptions.flatMap((option) => trendBoardRowsByBenchmark.get(option.value) ?? []),
    [trendBoardBenchmarkOptions, trendBoardRowsByBenchmark]
  );
  const trendBoardPlotMargin = trendBoardRows.length ? { t: 2, r: 12, b: 50, l: 52 } : { t: 2, r: 12, b: 50, l: 20 };
  const trendBoardTimeRangeLabel = trendBoardTimeStart || trendBoardTimeEnd
    ? `${formatDateRangePart(trendBoardTimeStart, "Any start")} - ${formatDateRangePart(trendBoardTimeEnd, "Any end")}`
    : "All time";

  const trendBoardCards = useMemo<TrendBoardCard[]>(() => {
    return trendBoardSelectedBenchmarkIds.flatMap((benchmarkKey, index) => {
      const cardRows = trendBoardRowsByBenchmark.get(benchmarkKey) ?? [];
      if (!cardRows.length) return [];
      const color = colorForBenchmark(index);
      const option = trendBoardBenchmarkOptions.find((entry) => entry.value === benchmarkKey);
      const path = option?.path?.length ? option.path : [option?.label ?? benchmarkKey];
      const label = path.length > 1 ? path.slice(0, -1).join(" | ") : path[0] ?? benchmarkKey;
      const yValues = cardRows.map((row) => row.value);
      const yMin = Math.min(...yValues);
      const yMax = Math.max(...yValues);
      const ySpan = yMax - yMin;
      const yPadding = ySpan > 0
        ? ySpan * Trend_Y_Padding_Ratio
        : Math.max(Math.abs(yMin) * Trend_Y_Padding_Ratio, 1);
      return [{
        benchmarkId: benchmarkKey,
        label,
        path,
        traces: buildTrendTrace(cardRows, {
          axisMode: trendAxisMode,
          lineShape: trendLineShape,
          color,
          label,
          plotTheme,
          theme,
          yMin,
          yPadding,
          showLegend: false,
          fillGradientScale: [
            [0, colorWithAlpha(color, 0)],
            [1, colorWithAlpha(color, theme === "dark" ? 0.2 : 0.2)]
          ]
        })
      }];
    });
  }, [
    plotTheme,
    theme,
    trendAxisMode,
    trendLineShape,
    trendBoardBenchmarkOptions,
    trendBoardRowsByBenchmark,
    trendBoardSelectedBenchmarkIds
  ]);

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
      <AppSidebar
        activePage={activePage}
        onPageChange={setActivePage}
        sourceDatabases={sourceDatabases}
        selectedDatabaseId={selectedDatabaseId}
        onDatabaseChange={handleDatabaseSelection}
        dataset={dataset}
        currentMetadata={currentMetadata}
        theme={theme}
        onThemeToggle={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
        latestRun={latestRun}
        assetBaseUrl={Asset_Base_URL}
        siteTitle={siteTitle}
      />
      <main className="main">
        {activePage === "overview" ? (
          <OverviewPage
            siteTitle={siteTitle}
            siteDescription={siteDescription}
            focusRunId={focusRunId}
            baselineRunId={baselineRunId}
            filteredRuns={filteredRuns}
            onFocusRunChange={setFocusRunId}
            onBaselineRunChange={setBaselineRunId}
            onOpenLocalFilePicker={openLocalFilePicker}
            downloadUrl={dataset?.source_url ?? null}
            downloadLabel={dataset?.source_label ?? "benchledger.sqlite"}
            hasLoadedDatabase={Boolean(dataset)}
            hasDataset={hasDataset}
            error={error}
            machine={machine}
            machineOptions={machineOptions}
            onMachineChange={setMachine}
            metricKind={metricKind}
            metricOptions={metricOptions}
            onMetricKindChange={setMetricKind}
            group={group}
            groupOptions={groupOptions}
            selectedGroupLabel={selectedGroupLabel}
            onGroupChange={setGroup}
            branch={branch}
            branchOptions={branchOptions}
            onBranchChange={setBranch}
            timeRangePickerRef={timeRangePickerRef}
            timeStartInputRef={timeStartInputRef}
            timeRangeLabel={timeRangeLabel}
            timeStart={timeStart}
            timeEnd={timeEnd}
            datasetTimeStart={datasetTimeStart}
            datasetTimeEnd={datasetTimeEnd}
            onTimeStartChange={setTimeStart}
            onTimeEndChange={setTimeEnd}
            displayStrategy={displayStrategy}
            onDisplayStrategyChange={setDisplayStrategy}
            stats={stats}
            benchmarkOptions={benchmarkOptions}
            selectedBenchmarkIds={overviewSelectedBenchmarkIds}
            onSelectedBenchmarkIdsChange={setOverviewSelectedBenchmarkIds}
            selectedMetricLabel={metricKind}
            trendAxisMode={trendAxisMode}
            onToggleTrendAxisMode={() => setTrendAxisMode((current) => (current === "commit" ? "time" : "commit"))}
            trendTraces={trendTraces}
            trendPlotMargin={trendPlotMargin}
            plotTheme={plotTheme}
            focusRun={focusRun}
            comparisonRows={comparisonRows}
            deltaPlotMargin={deltaPlotMargin}
            sortedComparisonRows={sortedComparisonRows}
            runPairSort={runPairSort}
            onToggleRunPairSort={toggleRunPairSort}
          />
        ) : activePage === "trend-board" ? (
          <TrendBoardPage
            benchmarkOptions={trendBoardBenchmarkOptions}
            selectedBenchmarkIds={trendBoardSelectedBenchmarkIds}
            onSelectedBenchmarkIdsChange={setTrendBoardSelectedBenchmarkIds}
            hasDataset={hasDataset}
            machine={trendBoardMachine}
            machineOptions={machineOptions}
            onMachineChange={setTrendBoardMachine}
            metricKind={trendBoardMetricKind}
            metricOptions={trendBoardMetricOptions}
            onMetricKindChange={setTrendBoardMetricKind}
            displayStrategy={trendBoardDisplayStrategy}
            onDisplayStrategyChange={setTrendBoardDisplayStrategy}
            group={trendBoardGroup}
            groupOptions={trendBoardGroupOptions}
            selectedGroupLabel={selectedTrendBoardGroupLabel}
            onGroupChange={setTrendBoardGroup}
            branch={trendBoardBranch}
            branchOptions={trendBoardBranchOptions}
            onBranchChange={setTrendBoardBranch}
            timeRangePickerRef={trendBoardTimeRangePickerRef}
            timeStartInputRef={trendBoardTimeStartInputRef}
            timeRangeLabel={trendBoardTimeRangeLabel}
            timeStart={trendBoardTimeStart}
            timeEnd={trendBoardTimeEnd}
            datasetTimeStart={datasetTimeStart}
            datasetTimeEnd={datasetTimeEnd}
            onTimeStartChange={setTrendBoardTimeStart}
            onTimeEndChange={setTrendBoardTimeEnd}
            trendBoardColumns={trendBoardColumns}
            onTrendBoardColumnsChange={setTrendBoardColumns}
            selectedMetricLabel={trendBoardMetricKind}
            trendAxisMode={trendAxisMode}
            onToggleTrendAxisMode={() => setTrendAxisMode((current) => (current === "commit" ? "time" : "commit"))}
            trendBoardCards={trendBoardCards}
            trendPlotMargin={trendBoardPlotMargin}
            plotTheme={plotTheme}
          />
        ) : activePage === "benchmark-keys" ? (
          <BenchmarkKeysPage
            rows={rows}
            plotTheme={plotTheme}
            theme={theme}
          />
        ) : activePage === "chart-tuning" ? (
          <ChartTuningPage
            trendLineShape={trendLineShape}
            onTrendLineShapeChange={setTrendLineShape}
          />
        ) : (
          <DatabaseCatalogPage
            databaseCatalog={databaseCatalog}
            onOpenLocalFilePicker={openLocalFilePicker}
          />
        )}
      </main>
    </div>
  );
}

export default App;
