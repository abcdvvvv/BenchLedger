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

- [ComponentLogging.jl](https://github.com/JuliaLogging/ComponentLogging.jl): [benchmark dashboard](https://julialogging.github.io/ComponentLogging.jl/benchmarks/)

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

Then, in a separate terminal from your package repository:

```bash
BENCH_DB_PATH="$(pwd)/../yourpkg-gh-pages/benchmarks/data/benchledger.sqlite" julia --project=benchmark benchmark/runbench.jl
```

In this setup, BenchLedger on `localhost` will automatically poll the current SQLite URL
and refresh the UI when the database changes.

If you instead load a database through `Choose SQLite`, the browser treats it as a one-off
local file selection and automatic refresh is not available.

## Backfill Old Versions

Sometimes BenchLedger is added after a project already has released versions.
In that case, the provided workflow can backfill historical releases by running
the current benchmark harness against older tags and appending the results into
the same SQLite database.

To run a backfill:

1. Open your repository on GitHub.
2. Go to the `Actions` tab.
3. Select the `Benchmarks` workflow.
4. Click `Run workflow`.
5. Set the `backfill` input to `true`.
6. Start the workflow and wait for it to finish.

The workflow will iterate through the repository's tags, benchmark each
historical version, update the shared SQLite database, and publish the refreshed
BenchLedger page back to `gh-pages`.

## License

This repository is MIT-licensed by default.
Files under [`templates/`](./templates) are separately marked as `MIT-0` with file-level SPDX headers so Julia users can copy them into their own packages with minimal friction.
