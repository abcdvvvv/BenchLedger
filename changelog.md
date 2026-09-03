# Changelog

## [Unreleased]
- Improved Probe process execution and packaging efficiency, including lower POSIX launch latency, stricter output-size limits, smaller release binaries, and reduced archive creation time and memory use.

## [0.8.2] - 2026/09/03
- Baseline and Focus revision selectors now order points by code commit date while continuing to show benchmark measurement time.

## [0.8.1] - 2026/09/03
- Dimension Selector now narrows value menus through one-way identity hierarchies: Hardware choices filter downstream identities, while clear parent-child fields such as source kind/revision, runtime name/version, OS/kernel name/version, and similar pairs filter only forward. Temporarily unavailable choices are remembered and restored.

## [0.8.0] - 2026/09/03
### Added
- Added Dimension Selector for choosing exactly one varying identity dimension for the x-axis and selecting values for all fixed dimensions across Dashboard and Trend Board, with validation for incomplete selections.
### Changed
- Dimension Selector now presents Code, Hardware, and Software dimensions hierarchically and manages fixed-dimension values directly in the table, with one selected value shown as Exact and multiple values shown as Grouped.
- Dashboard Baseline and Focus selectors now prefer tags over commit SHAs, show measurement time, and list newer measurements first.
- View-level condition controls now focus on Y-Axis, Branch, Time Range, and Display Strategy, while identity-dimension choices are managed in Dimension Selector.
- Theme selection has moved to Settings as a Light/Dark control.
- Improved responsiveness during dimension and filter changes and reduced memory use when loading large SQLite databases.
### Fixed
- Fixed Dimension Selector persistence so dimension rules and fixed-value choices survive reloads, including temporarily incomplete selections.
- Fixed dependent benchmark views so incomplete Dimension Selector configurations are reported clearly instead of continuing with a stale previous selection.
- Fixed environment labels that could display conflicting CPU core counts when a processor model already included its own core-count designation.

## [0.7.0] - 2026-08-02
### Breaking
- BenchLedger now uses schema v6. Hardware and software environments are stored separately, and benchmark results use canonical `benchmark_key` arrays. Official schema v5 databases are migrated automatically; older or customized v5 layouts are rejected instead of being modified silently.

### Added
- Added Compare for field-level orthogonal comparisons across Code, Hardware, and Software identities. Comparisons use repeated-run averages, show `run_count`, explain missing or incompatible results, list actual identity changes, and can be shared through the URL.
- Added repeated-run aggregation for Trend Board and Compare. Compatible time units are normalized before averaging, and missing measurements are excluded rather than counted as zero.
- Added `benchledger-probe` integration so benchmark runs can record detailed CPU, memory, GPU, driver, operating-system, kernel, runtime, dependency, and BLAS information.
- Added verified release and workflow assets for the frontend and supported Probe platforms.

### Changed
- Trend Board now filters raw runs before producing one aggregate point per code, hardware, and software configuration.
- Benchmark Keys now opens large trees more cleanly, supports expand/collapse-all controls, and handles path segments containing `/` correctly.
- Page navigation and Compare selections are restored through URLs, while durable preferences such as theme, filters, database selection, and plot settings remain in local storage.
- Switching databases now clears stale dataset-specific selections while preserving display preferences.
- Mobile navigation, keyboard focus, table navigation, control labels, and reduced-motion behavior have been improved.
- The About page now presents the application name, version, and repository link in one compact line, and primary actions now match the amber theme.
- Plotly is preloaded at startup so the first chart opens without an additional library-loading delay.

### Fixed
- Starting the development server without `benchledger.json` now shows the normal database picker instead of a JSON parse error.
- Compare now handles neutral metrics, missing results, incompatible units, invalid shared baselines, multi-field warnings, candidate ordering, and changed-field descriptions consistently.
- Overview now keeps statistics and pagination synchronized with the selected runs, filters, and sorting.
- Databases now reports the latest measurement time correctly and groups compatible metric units together.
- Benchmark Diff now retains benchmarks found in only one selected run, labels them as Added or Removed, and excludes them from percentage summaries.
- Long Trend Board histories no longer overflow range calculations or produce unreadable commit axes.
- Database switching and startup no longer leave stale or visually selected-but-unloaded sources in the interface.
- Keep-alive pages and Plotly charts now restore layout correctly without hidden pages intercepting interaction.
- Mobile navigation now traps and restores focus, closes predictably, and prevents interaction with the page behind it.

## [0.6.1] - 2026-07-18
### Fixed
- Fixed the frontend dev server so Plotly no longer leaves the app on a blank screen when running in the browser.
- Fixed page keep-alive wrappers so Dashboard and Trend Board preserve their intended page spacing after navigation.
- Reduced return-to-page latency for already-visited pages by keeping inactive pages mounted without forcing Plotly to fully relayout on every revisit.

### Changed
- `runbench.jl` now records richer environment and run context by default, including kernel details, BenchmarkTools version, hostname, GPU inventory/runtime/interface metadata, and a more descriptive default environment label.
- Hardened `runbench.jl` schema migration and entity persistence by backing up Schema v4 databases before migration, preserving migrated run metadata, and rejecting conflicting metadata merges instead of silently overwriting values.

## [0.6.0] — 2026-07-18
BenchLedger 0.6.0 introduces a cleaner benchmark data model, a more efficient frontend, and a substantially simpler benchmark workflow.

### Breaking
- Added automatic migration from Schema v4 databases to Schema v5.
- Introduced explicit `identity` fields for code states and benchmark environments, separating stable entity identity from extensible metadata.
- Simplified entity primary keys to `id` while keeping descriptive foreign-key names such as `code_state_id`, `environment_id`, and `run_id`.
- Updated the latest-results view to expose code-state and environment identity alongside metadata.
- `runbench.jl` is now focused exclusively on running benchmarks, collecting benchmark context, and writing results to SQLite.
- Removed automatic Git worktree creation, branch management, commits, and pushes from the benchmark writer. Repository and branch orchestration now belongs to the caller or CI workflow.
- `BENCH_DB_PATH` is now explicit, making local and CI database destinations predictable.
- Retained `BENCH_TARGET_PATH` for benchmarking code checked out separately from the benchmark harness.
- Consolidated the writer configuration surface to five inputs:
  - `BENCH_DB_PATH`
  - `BENCH_TARGET_PATH`
  - `BENCH_CODE_STATE`
  - `BENCH_ENVIRONMENT`
  - `BENCH_RUN`
- Code-state, environment, and run overrides now use structured JSON objects instead of many individual environment variables.

### Changed
- Improved database switching and refresh behavior so stale asynchronous loads can no longer overwrite newer selections.
- Reworked the frontend data model to keep benchmark results, runs, code states, environments, and benchmark definitions as separate normalized entities instead of repeating context on every result row.
- Reduced SQLite loading overhead by processing query results incrementally rather than materializing large intermediate result sets.
- Added a dedicated benchmark-definition index so benchmark paths and labels are stored and processed once, regardless of how many historical runs reference them.
- Simplified filtering into staged computations and removed large result caches, reducing memory use as benchmark histories grow.
- Pages are now kept alive after their first visit, preserving filters, component state, and Plotly interactions such as zoom and pan when navigating between sections.
- Overview and Trend Board calculations are initialized with their respective pages instead of being created globally at application startup.
- Plotly now uses a custom bundle containing only the chart types BenchLedger needs, significantly reducing the plotting bundle size while keeping charting available from application startup.
- Database branch and database path remain GitHub-workflow concerns rather than BenchLedger writer concerns.
- GitHub Pages deployment remains supported by the bundled workflow without coupling the core benchmark writer to `gh-pages`.
- Project name, description, and URL used for the generated manifest are now read directly from the SQLite database metadata instead of being configured a second time in the workflow.

The bundled GitHub Actions workflow now supports three target modes through one workflow:
- `current` — benchmark the current repository checkout.
- `ref` — benchmark a specific branch, tag, or commit from the current repository or another repository.
- `tags` — benchmark a sequence of tags from the current repository or another repository, with optional tag filtering and start/end boundaries.

## [0.5.4] - 2026-07-12

### Changed
- Trend Board now includes a built-in view toggle for `Separate` and `Combined` charts, so you can switch between per-benchmark cards and a single merged plot without relying on a separate homepage chart.
- Reworked the dashboard comparison area into a clearer `Benchmark Diff` table with pagination controls, page-size switching, page indicators, and a more natural `Baseline -> Focus -> Delta` reading order.
- Refined dashboard summary cards so the most important delta is easier to scan at a glance, with stronger emphasis on the largest percentage change and clearer improved/regressed counts.
- Improved table and control layout details across the dashboard, including better column balance in `Benchmark Diff`, adaptive action-button sizing, and cleaner segmented-control alignment.

### Fixed
- Fixed expensive environment switching in Overview and Trend Board by moving benchmark-view filtering onto an indexed and cached data path, making repeated environment changes much more responsive on large datasets.
- Removed the old homepage `Benchmark Trend` card and its duplicate data path, so trend exploration now lives in one place and stays consistent with the Trend Board controls.

## [0.5.3] - 2026-07-11

### Changed
- Reworked commit-axis trend spacing in Overview and Trend Board so tagged commits evenly partition the axis and intervening commits are evenly distributed within each tagged segment.

## [0.5.2] - 2026-06-27

### Fixed
- Fixed commit-axis trend charts to use real code timestamps for x-positioning while preserving commit/tag labels, eliminating misordered multi-series plots and Z-shaped line reversals.

## [0.5.1] - 2026-06-26

### Changed
- Plot hover text no longer shows environment information, making trend tooltips simpler to read.
- `BenchmarkTools.jl` version is no longer part of environment identity, so unrelated benchmark-tool upgrades will not split one environment into multiple trend lines.

## [0.5.0] - 2026-06-25

### Changed
- Migrated the frontend and Julia template to schema v4, replacing machine-specific and Julia-specific assumptions with generalized code-state, environment, and run metadata handling.
- Reworked the generic Julia writer to consume only public `BENCH_*` inputs plus local git and system state, and moved GitHub Actions-specific metadata mapping into `templates/Benchmarks.yml`.
- Tightened environment identity handling by removing dependency lock digests and manual environment ID overrides, and by excluding descriptive fields such as `platform.kernel` from environment hashing.

### Breaking
- BenchLedger now expects schema version 4 benchmark databases.
- Schema version 3 databases are not migrated by this release and are rejected by the frontend/template validation path.
- The generic Julia writer no longer recognizes `GITHUB_*`, `RUNNER_NAME`, `BENCH_BRANCH`, or `BENCH_ENVIRONMENT_ID`; callers must use the public `BENCH_SOURCE_*` and metadata override inputs instead.

## [0.4.2] - 2026-06-25

### Changed
- Added an `About` page to the sidebar navigation so the frontend can show the software name, current version, and repository URL in a dedicated basic-information view.
- Refined metric-family filtering so time-based metrics now group by metric and statistic across compatible time units instead of splitting `ns`, `μs`, `ms`, and `s` into separate Metric options, while non-convertible unit families remain distinct.
- Fixed commit-axis trend ordering in Overview and Trend Board by explicitly locking Plotly category order to `code_date`, preventing multi-machine commit plots from drawing Z-shaped backtracking segments when traces expose commit labels in different subsets.

## [0.4.0] - 2026-06-20

### Changed
- Reworked the frontend UI system around more consistent shared control primitives, including unified menu triggers, disclosure content, picker borders, and filter-button alignment across Overview and Trend Board.

## [0.3.4] - 2026-06-19

### Changed
- Improved Time Range popovers in both Dashboard and Trend Board so they now stay within the viewport near the right edge instead of overflowing off-screen.
- Refined empty states for Benchmark Trend and Trend Board with shorter copy, cleaner centered presentation, and more consistent no-selection behavior.
- Updated benchmark-key pickers so the closed control reads more naturally, switches to a search-oriented placeholder when opened, and better matches the rest of the control styling.
- Smoothed out topbar control styling and KPI card typography, including more consistent X-Axis button text weight and responsive metric-value sizing to reduce unwanted line wrapping.
- Improved trend-building performance on larger datasets, making Overview and Trend Board interactions more responsive when many runs are loaded.
- Unified more of the shared filtering and benchmark-selection pipeline so Overview and Trend Board now behave more consistently across machine, branch, group, and time-range filters.
- Reduced duplicated internal sorting and trend-building logic.
- Added a small automated test layer for core data and dashboard helpers, plus a lightweight lint workflow to make future refactors safer.

## [0.3.3] - 2026-06-18

### Changed
- BenchLedger benchmark databases now refresh project metadata like names, links, and logos on every run while preserving the original `created_at` timestamp.
- Reworked the dashboard focus and baseline run selectors into scrollable Ariakit menus and added an `All machines` default filter option for both dashboard views.
- Refined Trend Board presentation with split path titles, transparent Plotly backgrounds, dedicated card spacing controls, and more consistent topbar control styling.

## [0.3.2] - 2026-06-17

### Changed
- Added theme-aware custom project logos with `logo_url` for light mode and `logo_url_dark` for dark mode.
- Hardened the benchmark runner templates for mixed first-call and `BenchmarkGroup` result collection in external benchmark repositories.
- Fixed SQLite metadata schema validation to avoid materializing `schema_version` as `missing` on repeated runs.

## [0.3.1] - 2026-06-17

### Changed
- Fixed the default time-range end filter so local dev no longer hides valid benchmark rows on first load.
- Cleaned up the shared page-topbar naming, dashboard topbar layout, and benchmark run selector date display.
- Refined sidebar navigation spacing and the dashboard download action styling to better match the updated UI scale.

## [0.3.0] - 2026-06-17

### Changed
- Moved the dashboard download action into the top-right control row and aligned it with the header action sizing and layout.
- BenchLedger now stores benchmark runs and metric rows separately, with the frontend reading from `benchmark_results_latest` by default.
- Added run-level timestamps, schema validation hardening, and generalized metric display/sorting in the dashboard.

## [0.2.0] - 2026-06-17

Initial usable release of BenchLedger.

[Unreleased]: https://github.com/abcdvvvv/BenchLedger/compare/v0.8.2...HEAD
[0.8.2]: https://github.com/abcdvvvv/BenchLedger/compare/v0.8.1...v0.8.2
[0.8.1]: https://github.com/abcdvvvv/BenchLedger/compare/v0.8.0...v0.8.1
[0.8.0]: https://github.com/abcdvvvv/BenchLedger/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/abcdvvvv/BenchLedger/compare/v0.6.1...v0.7.0
[0.6.1]: https://github.com/abcdvvvv/BenchLedger/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/abcdvvvv/BenchLedger/compare/v0.5.4...v0.6.0
[0.5.4]: https://github.com/abcdvvvv/BenchLedger/compare/v0.5.3...v0.5.4
[0.5.3]: https://github.com/abcdvvvv/BenchLedger/compare/v0.5.2...v0.5.3
[0.5.2]: https://github.com/abcdvvvv/BenchLedger/compare/v0.5.1...v0.5.2
[0.5.1]: https://github.com/abcdvvvv/BenchLedger/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/abcdvvvv/BenchLedger/compare/v0.4.2...v0.5.0
[0.4.2]: https://github.com/abcdvvvv/BenchLedger/compare/v0.4.1...v0.4.2
[0.4.0]: https://github.com/abcdvvvv/BenchLedger/compare/v0.3.4...v0.4.0
[0.3.4]: https://github.com/abcdvvvv/BenchLedger/compare/v0.3.3...v0.3.4
[0.3.3]: https://github.com/abcdvvvv/BenchLedger/compare/v0.3.2...v0.3.3
[0.3.2]: https://github.com/abcdvvvv/BenchLedger/compare/v0.3.1...v0.3.2
[0.3.1]: https://github.com/abcdvvvv/BenchLedger/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/abcdvvvv/BenchLedger/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/abcdvvvv/BenchLedger/compare/v0.1.2...v0.2.0
