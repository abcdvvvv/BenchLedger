# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.2] - 2026-06-17

### Changed

- Added theme-aware custom project logos with `logo_url_light` and `logo_url_dark`, while keeping `logo_url` as the fallback.
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

[Unreleased]: https://github.com/abcdvvvv/BenchLedger/compare/v0.3.2...HEAD
[0.3.2]: https://github.com/abcdvvvv/BenchLedger/releases/tag/v0.3.2
[0.3.1]: https://github.com/abcdvvvv/BenchLedger/releases/tag/v0.3.1
[0.3.0]: https://github.com/abcdvvvv/BenchLedger/releases/tag/v0.3.0
[0.2.0]: https://github.com/abcdvvvv/BenchLedger/releases/tag/v0.2.0
