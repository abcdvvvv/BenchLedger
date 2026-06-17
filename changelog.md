# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-06-17

### Changed

- Moved the dashboard download action into the top-right control row and aligned it with the header action sizing and layout.
- BenchLedger now stores benchmark runs and metric rows separately, with the frontend reading from `benchmark_results_latest` by default.
- Added run-level timestamps, schema validation hardening, and generalized metric display/sorting in the dashboard.

## [0.2.0] - 2026-06-17

Initial usable release of BenchLedger.

[Unreleased]: https://github.com/abcdvvvv/BenchLedger/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/abcdvvvv/BenchLedger/releases/tag/v0.3.0
[0.2.0]: https://github.com/abcdvvvv/BenchLedger/releases/tag/v0.2.0
