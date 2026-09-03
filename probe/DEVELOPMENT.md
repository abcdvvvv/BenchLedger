# benchledger-probe development

`benchledger-probe` is BenchLedger's language-independent system inventory normalizer. It invokes [Fastfetch](https://github.com/fastfetch-cli/fastfetch), removes unstable and machine-unique fields, and emits a small versioned JSON document that any language-specific BenchLedger writer can consume.

This component is intentionally language-independent. Language-specific writers consume `hardware` and `software`, add their own runtime/framework facts, and store `diagnostics` and `collector` in run metadata rather than environment identity.

## Build

A C++23-capable compiler and CMake 3.25 or newer are required. The source intentionally uses only broadly implemented language features.

```sh
cmake -S probe -B probe/build -DCMAKE_BUILD_TYPE=Release
cmake --build probe/build
ctest --test-dir probe/build --output-on-failure
```

The probe has no third-party C++ library dependency. Its strict JSON parser and deterministic serializer are part of `benchledger_probe_core`.

## Fastfetch discovery

When no `--input` fixture is supplied, the probe searches for Fastfetch in this order:

1. `--fastfetch PATH`, when explicitly supplied;
2. a `fastfetch` executable beside `benchledger-probe`;
3. `FASTFETCH_PATH`;
4. `fastfetch` from the process `PATH`.

The probe disables user Fastfetch configuration and requests only these modules:

```text
CPU:PhysicalMemory:Memory:GPU:OS:Kernel:Version
```

Fastfetch is not bundled in the source repository. The top-level release workflow resolves one latest stable Fastfetch release, verifies its GitHub-provided SHA-256 digests, and packages the appropriate binary beside `benchledger-probe` for each enabled native target. See [`packaging/DEVELOPMENT.md`](packaging/DEVELOPMENT.md).

## Usage

```sh
benchledger-probe
benchledger-probe --pretty
benchledger-probe --fastfetch /path/to/fastfetch
benchledger-probe --input fastfetch-output.json
benchledger-probe --input -
benchledger-probe --version
```

`--input` is primarily for deterministic tests and offline inspection. The input must be Fastfetch `--format json` output.

## Output contract

The current output contract is defined by [`probe-v2.schema.json`](probe-v2.schema.json):

```json
{
  "schema_version": 2,
  "hardware": {
    "architecture": "x86_64",
    "cpu": {
      "model": "AMD Ryzen 9 7950X 16-Core Processor",
      "vendor": "AMD",
      "physical_cores": 16,
      "logical_threads": 32
    },
    "memory": {"total_bytes": 68719476736},
    "gpu": [
      {
        "vendor": "NVIDIA",
        "model": "GeForce RTX 4090",
        "type": "discrete",
        "memory_bytes": 25769803776,
        "count": 1
      }
    ]
  },
  "software": {
    "platform": {
      "os": {"name": "ubuntu", "version": "24.04"},
      "kernel": {"name": "linux", "version": "6.8.0-64-generic"}
    },
    "gpu_drivers": [
      {"vendor": "NVIDIA", "name": "nvidia", "version": "555.42.02", "device_count": 1}
    ]
  },
  "diagnostics": {
    "memory_source": "physical_memory",
    "warnings": []
  },
  "collector": {"name": "fastfetch", "version": "2.64.2"}
}
```

`hardware` and `software` are normalized facts consumed by every language writer. `diagnostics` and `collector` explain how those facts were obtained and must be stored only as run metadata, never as environment identity.

## Normalization rules

### Memory

1. Use `PhysicalMemory` only when every installed module has a valid non-zero size, then preserve the exact summed capacity. Partial or errored SMBIOS data is rejected rather than silently undercounted.
2. If complete physical-module data is unavailable, read `Memory.total` (OS-visible memory) and round it upward to the next whole GiB before placing it in `hardware.memory.total_bytes`.
3. Preserve the unrounded OS-visible value as `diagnostics.memory_visible_bytes`; it must not participate in hardware identity.
4. If neither source is valid, omit `hardware.memory` and emit a warning.

The selected source appears only in `diagnostics.memory_source`. Rounding the fallback prevents small kernel-, firmware-, or reservation-dependent changes in visible memory from creating a different hardware identity.

### GPU

Architectures and common vendor aliases are canonicalized (for example, `AMD64` becomes `x86_64`, and `AuthenticAMD` becomes `AMD`). GPUs are grouped and sorted by vendor, model, type, and dedicated memory capacity. Identical devices receive a `count`.

Driver descriptions are moved to `software.gpu_drivers` and split into stable fields: `name`, optional `variant`, and optional `version`. For example, `nvidia (open source) 999.1` becomes `{"name":"nvidia","variant":"open_source","version":"999.1"}`. The raw Fastfetch driver sentence is not emitted, so harmless wording changes do not alter software identity.

### Excluded data

The probe deliberately excludes:

- temperatures, utilization, used memory, and current frequencies;
- hostnames, UUIDs, serial numbers, device IDs, DIMM locators, and part numbers;
- Fastfetch display formatting and user configuration;
- language runtime, process/thread settings, benchmark framework, and dependency lockfiles.

The last category belongs to each language-specific writer rather than the cross-language probe.

## Failure behavior

CPU model and architecture are required. Missing either causes a non-zero exit. Optional module failures preserve all usable facts and are listed in `diagnostics.warnings`. No missing value is invented or written as zero.

## Tests

Fixtures cover Linux, macOS, and Windows-shaped Fastfetch JSON, including:

- complete PhysicalMemory precedence and partial-data rejection;
- Memory.total fallback with whole-GiB normalization and raw diagnostic preservation;
- GPU driver name/variant/version normalization;
- identical multi-GPU grouping;
- separation of GPU hardware and driver data;
- filtering of dynamic and machine-unique fields;
- strict JSON parsing, duplicate-module rejection, and critical-field failures;
- schema-safe GPU type normalization;
- CLI input, explicit Fastfetch path validation, and subprocess execution paths.
