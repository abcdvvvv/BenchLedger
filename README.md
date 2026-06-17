<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/LightLogo.png">
    <source media="(prefers-color-scheme: light)" srcset="public/DarkLogo.png">
    <img alt="BenchLedger" src="public/DarkLogo.png" width="720">
  </picture>
</p>

# BenchLedger

Store, query, and visualize benchmark history.

It is designed for library performance tracking: run benchmarks elsewhere, write the results to SQLite, and use BenchLedger to inspect trends, run context, and benchmark deltas directly in the browser.

## Example Projects

- [ComponentLogging.jl](https://github.com/JuliaLogging/ComponentLogging.jl): [benchmark dashboard](https://julialogging.github.io/ComponentLogging.jl/benchledger/)

## Quick Start

For Julia packages, the fastest way to get started is to copy the two template files in [`templates/`](./templates):

```text
templates/runbench.jl
templates/Benchmarks.yml
```

Recommended destination:

```text
YourPackage/
├── benchmark/
│   └── runbench.jl
└── .github/
    └── workflows/
        └── Benchmarks.yml
```

Then edit:

- [`benchmark/runbench.jl`](./templates/runbench.jl): replace the arrow-marked block with your benchmark suite, and update the metadata defaults in that same block.
- [`.github/workflows/Benchmarks.yml`](./templates/Benchmarks.yml): set your main benchmark branch, BenchLedger version, package name, description, and project URL in the top-level `env:` section.

After that, commit the two files, push to your default branch, and let GitHub Actions generate and publish your benchmark database to `gh-pages`.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## License

This repository is MIT-licensed by default.
Files under [`templates/`](./templates) are separately marked as `MIT-0` with file-level SPDX headers so Julia users can copy them into their own packages with minimal friction.

See [changelog.md](./changelog.md) for release history.

## Release

Versioned frontend distributions are published from Git tags. For a new release,
commit the changes, create a `v*` tag, and push the tag:

```bash
git tag v0.3.0
git push origin main
git push origin v0.3.0
```

The release workflow builds the Vite app and uploads a static dist archive named
`BenchLedger-0.3.0-dist.tar.gz` to the matching GitHub Release.

### Recommended `benchledger.json`

```json
{
  "manifest_version": 1,
  "benchledger_web_version": "0.3.0",
  "generated_at": "2026-06-15T06:30:00.000Z",
  "site": {
    "title": "BenchLedger",
    "description": "Benchmark history dashboard"
  },
  "databases": [
    {
      "id": "core",
      "name": "Core benchmarks",
      "description": "Main benchmark suite",
      "url": "./benchledger-data/core-a1b2c3.db",
      "sha256": "a1b2c3...",
      "size_bytes": 12345678,
      "packed_at": "2026-06-15T06:30:00.000Z",
      "schema_version": 3,
      "metadata_preview": {
        "name": "MyPkg",
        "project_url": "https://example.com",
        "logo_url": null
      }
    }
  ]
}
```

Database metadata remains the source of truth. Manifest fields such as `name`,
`description`, `schema_version`, and `metadata_preview` are preview/cache fields
used before the SQLite file is downloaded. After opening a database, the viewer
uses metadata stored in the SQLite file itself.

## SQLite Metadata

BenchLedger databases should include a key-value metadata table:

```sql
CREATE TABLE IF NOT EXISTS benchledger_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

The metadata key set is intentionally small and generic:

```text
schema_version
name
description
project_url
logo_url
created_at
updated_at
notes
```

These are the metadata keys used by the current BenchLedger schema.

## SQLite Schema v3

BenchLedger v3 separates benchmark execution metadata from benchmark result rows.

```sql
CREATE TABLE benchmark_runs (
  run_id TEXT PRIMARY KEY,
  code_state_id TEXT NOT NULL,
  branch TEXT NOT NULL,
  tag TEXT NOT NULL,
  label TEXT NOT NULL,
  "commit" TEXT NOT NULL,
  code_date TEXT NOT NULL,
  measured_at TEXT NOT NULL,
  machine_id TEXT NOT NULL,
  cpu_model TEXT NOT NULL,
  cpu_threads INTEGER NOT NULL,
  arch TEXT NOT NULL,
  os TEXT NOT NULL,
  julia_version TEXT NOT NULL,
  is_dirty INTEGER NOT NULL,
  notes TEXT NOT NULL
);

CREATE TABLE benchmark_results (
  run_id TEXT NOT NULL,
  benchmark_id TEXT NOT NULL,
  benchmark_path TEXT NOT NULL,
  benchmark_label TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  statistic TEXT NOT NULL,
  unit TEXT NOT NULL,
  value REAL NOT NULL,
  better TEXT NOT NULL,
  PRIMARY KEY (run_id, benchmark_id, metric_name, statistic)
);

CREATE VIEW benchmark_results_latest AS
SELECT
  run_id,
  branch,
  tag,
  code_state_id,
  label,
  "commit",
  code_date,
  measured_at,
  machine_id,
  cpu_model,
  cpu_threads,
  arch,
  os,
  julia_version,
  is_dirty,
  notes,
  benchmark_path,
  benchmark_id,
  benchmark_label,
  metric_name,
  statistic,
  unit,
  value,
  better
FROM (
  SELECT
    runs.*,
    results.benchmark_path,
    results.benchmark_id,
    results.benchmark_label,
    results.metric_name,
    results.statistic,
    results.unit,
    results.value,
    results.better,
    ROW_NUMBER() OVER (
      PARTITION BY runs.code_state_id, runs.machine_id, results.benchmark_id, results.metric_name, results.statistic
      ORDER BY runs.measured_at DESC, results.run_id DESC
    ) AS rn
  FROM benchmark_results AS results
  JOIN benchmark_runs AS runs USING (run_id)
)
WHERE rn = 1;
```

The frontend currently reads `benchmark_results_latest` by default. Raw facts
exist only once in `benchmark_runs` and `benchmark_results`, while the view
provides the latest deduplicated row for each
`(code_state_id, machine_id, benchmark_id, metric_name, statistic)` slice.

## Backfill Old Versions

Sometimes BenchLedger is added after a project already has released versions.
In that case, old versions do not have BenchLedger scripts yet. The recommended
approach is to run the current benchmark suite against each historical tag and
write every result into the same SQLite database.

The benchmark runner should support these environment variables:

```text
BENCH_TARGET_PATH  Package source tree to benchmark.
BENCH_DB_PATH      SQLite database path to write.
BENCH_DATE         Historical code timestamp for the version being measured.
BENCH_NOTES        Per-run note.
```

Example backfill script:

```bash
REPO=/path/to/MyPackage
WT=/tmp/mypackage-version-worktree
HARNESS=/tmp/mypackage-current-benchmark
DB="$REPO/benchmark/results.sqlite"

rm -rf "$WT" "$HARNESS"
rm -f "$DB" "$DB-wal" "$DB-shm"

cp -a "$REPO/benchmark" "$HARNESS"
git -C "$REPO" worktree add --detach "$WT" "$(git -C "$REPO" tag --sort=v:refname | head -n 1)"

for tag in $(git -C "$REPO" tag --sort=v:refname); do
  echo "Running current benchmark suite against $tag"
  git -C "$WT" checkout --detach "$tag"

  commit=$(git -C "$WT" rev-parse HEAD)
  date=$(git -C "$WT" show -s --format=%cI HEAD)

  GITHUB_REF_TYPE=tag \
  GITHUB_REF_NAME="$tag" \
  GITHUB_SHA="$commit" \
  BENCH_DATE="$date" \
  BENCH_TARGET_PATH="$WT" \
  BENCH_DB_PATH="$DB" \
  BENCH_NOTES="current benchmark suite against $tag" \
  julia --project="$HARNESS" "$HARNESS/runbench.jl"
done

git -C "$REPO" worktree remove "$WT"
rm -rf "$HARNESS"
```

This keeps the user's main checkout untouched. The temporary worktree supplies
the historical package source, while `HARNESS` supplies the current benchmark
runner and benchmark definitions. `BENCH_DATE` keeps trend charts ordered by the
version history, while the runner records the actual execution time at insert
time. That means the same historical tag can be measured multiple times without
overwriting earlier runs.

## Colors

Graphite black #18181B  
Amber          #F59E0B  
Copper         #B45309  
Sand           #FFFBEB  
Stone gray     #78716C
