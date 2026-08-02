# Probe release packaging

This directory contains the release tooling used by GitHub Actions to assemble native `benchledger-probe` bundles. It is not part of the probe runtime.

## Responsibilities

The release workflows are split by concern:

- `.github/workflows/release.yml` selects targets, pins one Fastfetch release, coordinates all builds, verifies artifacts, and publishes the GitHub Release.
- `.github/workflows/release-dist.yml` builds the platform-independent frontend archive once.
- `.github/workflows/release-probe.yml` builds and packages only the selected native probe targets.

Automatic releases currently enable Windows amd64, Linux amd64, and macOS amd64. Linux aarch64 and macOS aarch64 are disabled by default. Manual runs can override all five target switches.
Manual dispatches must be run from the same commit referenced by the release tag, so the caller and reusable workflow definitions cannot drift from the checked-out release source.

## Python tools

- `release.py` creates the release plan, resolves and downloads pinned Fastfetch assets, then validates checksums, bundle metadata, and the final release asset set before publication.
- `package_probe.py` safely extracts Fastfetch, copies the probe and required runtime files, adds licenses and `probe-v2.schema.json`, writes `THIRD_PARTY.json`, performs the same-directory smoke test, and creates a deterministic archive plus `.sha256` sidecar.

A probe bundle contains only runtime artifacts:

```text
benchledger-probe[.exe]
fastfetch[.exe]
Fastfetch runtime libraries when required
probe-v2.schema.json
THIRD_PARTY.json
LICENSES/
```

No source documentation is copied into release bundles.

## Release behavior

For each enabled target, the native job:

1. builds and tests `benchledger-probe`;
2. downloads the Fastfetch asset pinned by the top-level release plan;
3. verifies its SHA-256 before extraction;
4. assembles the bundle and clears `PATH` for the same-directory discovery smoke test;
5. creates a reproducible archive and checksum sidecar.

The top-level workflow publishes only after the frontend archive and every selected probe bundle pass verification. Existing published releases are never overwritten.

## Local tests

Run the packaging tests from the repository root:

```sh
python3 -m unittest discover -s probe/packaging/tests -v
```

The tools can also be invoked directly with `--help` when debugging a release:

```sh
python3 probe/packaging/release.py --help
python3 probe/packaging/package_probe.py --help
```

## Release checklist

Before creating a version tag:

1. keep `package.json`, `package-lock.json`, and `templates/Benchmarks.yml` on the same BenchLedger version;
2. run `npm run check`;
3. run `python3 -m unittest discover -s probe/packaging/tests -v`;
4. build the probe and run `ctest --test-dir <build-dir> --output-on-failure`;
5. push the matching `vX.Y.Z` tag and let `release.yml` publish the verified artifacts.

The release workflow rejects a tag whose source version declarations do not match.
