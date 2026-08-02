<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="public/LightLogo.png">
    <source media="(prefers-color-scheme: light)" srcset="public/DarkLogo.png">
    <img alt="BenchLedger" src="public/DarkLogo.png" width="720">
  </picture>
</p>

# BenchLedger

Store, query, and visualize benchmark history.

It is designed for library performance tracking: run benchmarks elsewhere, write the results to SQLite, and use BenchLedger to inspect trends, environment context, code-state metadata, and benchmark deltas directly in the browser.

See [changelog.md](./changelog.md) for release history.

## Why BenchLedger

Benchmark history dashboards already exist. Tools such as Conbench, Bencher,
Airspeed Velocity, Horreum, and github-action-benchmark all cover parts of this
space. BenchLedger's difference is not the general idea of storing benchmark
history. The difference is that all data is stored and handled in open, portable formats.

BenchLedger is built around a simple combination:

- a static frontend artifact
- a project-owned SQLite database
- a language-agnostic schema and viewer

That gives it a different role from platform-style systems:

- It is not a benchmark runner. Benchmarks can be produced by Julia, Python,
  Rust, C++, or any other language as long as they write the agreed schema.
- It is not a hosted service. Projects keep their own benchmark data instead of
  pushing it into a central backend.
- It is not platform-bound. GitHub Pages is a convenient deployment target, but
  the viewer itself is just static web output plus a SQLite file. You can run
  benchmarks on your own machine, in any other CI system that can produce the same artifacts.
- It is not ecosystem-specific. The same viewer can be reused across projects
  and languages without rewriting the frontend.
- It is embeddable. Package authors can ship the built frontend together with
  their own benchmark database and immediately get a usable history dashboard.

In short: BenchLedger is a schema-first, language-agnostic benchmark ledger
that can be deployed as a static viewer with project-owned SQLite data.

## Example Projects

- [ClapeyronBenchmarks](https://github.com/ClapeyronThermo/ClapeyronBenchmarks): [benchmark dashboard](https://clapeyronthermo.github.io/ClapeyronBenchmarks/benchmarks/index.html)
- [ComponentLogging.jl](https://github.com/JuliaLogging/ComponentLogging.jl): [benchmark dashboard](https://julialogging.github.io/ComponentLogging.jl/benchmarks/)

## Quick Start

To get started with the bundled templates, copy the two template files in [`templates/`](./templates):

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
- [`.github/workflows/Benchmarks.yml`](./templates/Benchmarks.yml): set your main benchmark branch, BenchLedger version, database branch, and database file in the workflow.

After that, commit the two files, push to your default branch, and let GitHub Actions run the current target and update the configured benchmark database. With the default `gh-pages` database branch, the workflow also installs and publishes the BenchLedger viewer.

The generic `runbench.jl` writer reads `BENCH_*` inputs plus local Git and Julia state. Stable hardware and platform facts come from the separately packaged `benchledger-probe`; the bundled workflow downloads the matching Linux amd64 probe bundle automatically. For local runs, place `benchledger-probe` beside `benchmark/runbench.jl`, put it on `PATH`, or set `BENCH_PROBE_PATH` explicitly. Each probe bundle already contains the matching Fastfetch executable.

### Common `BENCH_*` inputs

The bundled writer understands seven public inputs:

- `BENCH_DB_PATH`: required SQLite database file to update
- `BENCH_TARGET_PATH`: optional target project path to benchmark; defaults to the project containing the benchmark directory
- `BENCH_PROBE_PATH`: optional path to `benchledger-probe`; otherwise the writer checks beside `runbench.jl` and then `PATH`
- `BENCH_CODE_STATE`: optional JSON object with `id`, `label`, `code_date`, `identity`, and `metadata`
- `BENCH_HARDWARE_ENVIRONMENT`: optional JSON object with `label`, `identity`, and `metadata`
- `BENCH_SOFTWARE_ENVIRONMENT`: optional JSON object with `label`, `identity`, and `metadata`
- `BENCH_RUN`: optional JSON object with `notes` and `metadata`

Git revision, tags, branch, and code date are detected by the Julia writer. The writer also records the Julia runtime, thread count, BenchmarkTools version, and loaded Julia GPU interface. CPU, memory, GPU inventory, architecture, OS, kernel, and GPU drivers come from `benchledger-probe`. Probe diagnostics and collector information are stored in run metadata and do not participate in hardware or software environment identity.

## Data Layout

### Schema v6

#### `benchledger_metadata`

```text
benchledger_metadata
├── key
└── value
```

#### `code_states`

```text
code_states
├── id
├── label
├── code_date
├── identity
└── metadata
```

#### `hardware_environments`

```text
hardware_environments
├── id
├── label
├── identity
└── metadata
```

#### `software_environments`

```text
software_environments
├── id
├── label
├── identity
└── metadata
```

#### `runs`

```text
runs
├── id
├── code_state_id
├── hardware_environment_id
├── software_environment_id
├── measured_at
└── metadata
```

#### `benchmark_results`

```text
benchmark_results
├── run_id
├── benchmark_key
├── metric_name
├── statistic
├── unit
├── value
└── better
```

`benchmark_key` is a canonical JSON array of nonempty string segments. Each run references one code state, one hardware environment, and one software environment, while repeated runs remain separate measurement batches. Overview uses raw rows for direct run-to-run comparison; Trend Board and Compare use configuration aggregates keyed by code state, hardware environment, software environment, benchmark key, metric, and statistic. Repeated runs contribute their arithmetic mean after compatible time-unit normalization, missing results are excluded rather than treated as zero, and each aggregate records its contributing `run_count`. Trend Board applies its active filters before aggregation, while page and Compare sharing state is stored in the URL and durable display preferences remain in `localStorage`.

### Compare

Compare provides field-level orthogonal comparisons against an existing code/hardware/software configuration. Uncheck the identity fields that may vary; all checked fields must match the baseline, and only one of Code, Hardware, or Software can vary at a time. Identity arrays are compared without relying on element order while preserving relationships inside arrays of objects. Charts and tables use repeated-run aggregates, show `run_count`, exclude missing or incompatible results from delta calculations, list each baseline-to-candidate identity change, and restore the selected baseline, fields, benchmark, and metric from shared URLs.

### benchledger.json

`benchledger.json` is a manifest file outside the SQLite database. The bundled workflow writes it to `gh-pages/benchmarks/benchledger.json`, alongside the database directory that typically contains `gh-pages/benchmarks/data/benchledger.sqlite`.

```text
benchledger.json
├── benchledger_web_version
├── generated_at
├── site
└── databases[]
```

Each `databases[]` entry describes how to locate and verify a database file (`id`, optional display metadata, `url`, `sha256`, `size_bytes`, `packed_at`, and `metadata_preview`). The database schema version is not duplicated in the manifest; the frontend reads and validates the authoritative `benchledger_metadata.schema_version` value from SQLite after loading the verified file.

## Local Preview

If your package already uses [`templates/Benchmarks.yml`](./templates/Benchmarks.yml) to
build and publish BenchLedger into `gh-pages`, the easiest local setup is:

1. Check out your package's `gh-pages` branch as a local git worktree.
2. Serve the generated `benchmarks/` directory from that worktree with a local static server.
3. Keep running `benchmark/runbench.jl` locally to update the same SQLite file that the static site is already serving.

```bash
git worktree add ../yourpkg-gh-pages gh-pages
cd ../yourpkg-gh-pages/benchmarks
npx serve . # or python3 -m http.server 8000
```

Then, in a separate terminal from your package repository, point the writer at the platform-specific Probe bundle when it is not already beside `runbench.jl` or on `PATH`:

```bash
BENCH_DB_PATH="$(pwd)/../yourpkg-gh-pages/benchmarks/data/benchledger.sqlite" \
BENCH_PROBE_PATH="/path/to/BenchLedger-probe/benchledger-probe" \
julia --project=benchmark benchmark/runbench.jl
```

In this setup, BenchLedger on `localhost` will automatically poll the current SQLite URL
and refresh the UI when the database changes.

If you instead load a database through `Choose SQLite`, the browser treats it as a one-off
local file selection and automatic refresh is not available.

## Local Validation

Before creating a BenchLedger release, run the checks that are available on your platform:

```bash
npm run check
cmake -S probe -B probe/build -DCMAKE_BUILD_TYPE=Release
cmake --build probe/build
ctest --test-dir probe/build --output-on-failure
python3 -m unittest discover -s probe/packaging/tests -v
```

`npm run check` runs lint, frontend tests, TypeScript checking, and the production Vite build. The release workflow repeats these checks, builds the selected native Probe targets, pins one Fastfetch release, validates every checksum and bundle manifest, and publishes only after the complete selected artifact set is present.

## Target Modes and Backfill

The bundled GitHub Actions workflow uses the same benchmark harness for three target modes:

- `current`: benchmark the source checked out for the workflow run. This is also the mode used by normal push and tag triggers.
- `ref`: benchmark one commit, tag, or branch selected by `target_ref`. Set `target_repository` to benchmark another repository, or leave it empty to benchmark another ref from the current repository.
- `tags`: benchmark a sequence of tags using the current benchmark harness. This is the backfill mode. It can target the current repository or another repository.

For `tags`, `tag_pattern` filters the available tags first. `tag_start` and `tag_end` then select an inclusive range in Git version-sort order. Either boundary may be left empty.

Examples:

```text
target_mode=current
→ benchmark the current workflow checkout

target_mode=ref, target_ref=v1.2.0
→ benchmark v1.2.0 from the current repository

target_mode=ref, target_repository=OtherOrg/OtherRepo, target_ref=abc123
→ benchmark commit abc123 from another repository

target_mode=tags, tag_pattern=v*, tag_start=v1.0.0, tag_end=v2.0.0
→ backfill the selected tag range from the current repository

target_mode=tags, target_repository=OtherOrg/OtherRepo, tag_pattern=v*
→ backfill matching tags from another repository
```

The workflow always keeps the benchmark harness in the current repository checkout and checks non-current targets out separately. The writer only receives the resulting target path and database path; checkout, branch management, commits, and pushes remain workflow responsibilities.

## License

This repository is MIT-licensed by default.
Files under [`templates/`](./templates) are separately marked as `MIT-0` with file-level SPDX headers so Julia users can copy them into their own packages with minimal friction.
