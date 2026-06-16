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

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Release

Versioned frontend distributions are published from Git tags. For a new release,
commit the changes, create a `v*` tag, and push the tag:

```bash
git tag v0.1.0
git push origin main
git push origin v0.1.0
```

The release workflow builds the Vite app and uploads a static dist archive named
`BenchLedger-0.1.0-dist.tar.gz` to the matching GitHub Release.

### Recommended `benchledger.json`

```json
{
  "manifest_version": 1,
  "benchledger_web_version": "0.1.0",
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
      "schema_version": 1,
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

These are the only BenchLedger metadata keys defined by the v1 protocol.

## Backfill Old Versions

Sometimes BenchLedger is added after a project already has released versions.
In that case, old versions do not have BenchLedger scripts yet. The recommended
approach is to run the current benchmark suite against each historical tag and
write every result into the same SQLite database.

The benchmark runner should support these environment variables:

```text
BENCH_TARGET_PATH  Package source tree to benchmark.
BENCH_DB_PATH      SQLite database path to write.
BENCH_DATE         Timestamp to store for this benchmark run.
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
runner and benchmark definitions. `BENCH_DATE` uses the historical commit date so
trend charts are ordered by the version history instead of the backfill date.

## Colors

Graphite black #18181B  
Amber          #F59E0B  
Copper         #B45309  
Sand           #FFFBEB  
Stone gray     #78716C
