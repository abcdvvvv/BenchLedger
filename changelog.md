# Changelog

## [Unreleased]

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

[Unreleased]: https://github.com/abcdvvvv/BenchLedger/compare/v0.4.2...HEAD
[0.4.2]: https://github.com/abcdvvvv/BenchLedger/releases/tag/v0.4.2
[0.4.0]: https://github.com/abcdvvvv/BenchLedger/releases/tag/v0.4.0
[0.3.4]: https://github.com/abcdvvvv/BenchLedger/releases/tag/v0.3.4
[0.3.3]: https://github.com/abcdvvvv/BenchLedger/releases/tag/v0.3.3
[0.3.2]: https://github.com/abcdvvvv/BenchLedger/releases/tag/v0.3.2
[0.3.1]: https://github.com/abcdvvvv/BenchLedger/releases/tag/v0.3.1
[0.3.0]: https://github.com/abcdvvvv/BenchLedger/releases/tag/v0.3.0
[0.2.0]: https://github.com/abcdvvvv/BenchLedger/releases/tag/v0.2.0
