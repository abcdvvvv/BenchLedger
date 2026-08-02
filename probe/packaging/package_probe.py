#!/usr/bin/env python3
"""Assemble a BenchLedger probe release bundle with a verified Fastfetch binary."""

from __future__ import annotations

import argparse
import gzip
import json
import os
import shutil
import stat
import subprocess
import sys
import tarfile
import tempfile
import zipfile
from pathlib import Path, PurePosixPath
from typing import Iterable

from release import (
    SHA256_RE,
    TAG_RE,
    TARGETS,
    read_json,
    sha256,
    validate_github_asset_url,
    write_checksum,
    write_json,
)


def _safe_member_path(name: str) -> PurePosixPath:
    path = PurePosixPath(name.replace("\\", "/"))
    if path.is_absolute() or ".." in path.parts:
        raise RuntimeError(f"archive contains unsafe path: {name}")
    return path


def extract_archive(archive: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    extracted_files: set[str] = set()

    def output_path(name: str) -> Path:
        relative = _safe_member_path(name)
        key = relative.as_posix().casefold()
        if key in extracted_files:
            raise RuntimeError(f"archive contains duplicate file path: {name}")
        extracted_files.add(key)
        return destination.joinpath(*relative.parts)

    if zipfile.is_zipfile(archive):
        with zipfile.ZipFile(archive) as source:
            for member in source.infolist():
                relative = _safe_member_path(member.filename)
                output = destination.joinpath(*relative.parts)
                if member.is_dir():
                    output.mkdir(parents=True, exist_ok=True)
                    continue
                mode = member.external_attr >> 16
                if mode and stat.S_ISLNK(mode):
                    raise RuntimeError(f"archive contains unsupported link: {member.filename}")
                output = output_path(member.filename)
                output.parent.mkdir(parents=True, exist_ok=True)
                with source.open(member) as input_stream, output.open("wb") as output_stream:
                    shutil.copyfileobj(input_stream, output_stream)
                if mode:
                    output.chmod(mode & 0o777)
        return

    if tarfile.is_tarfile(archive):
        with tarfile.open(archive, "r:*") as source:
            for member in source.getmembers():
                relative = _safe_member_path(member.name)
                if member.issym() or member.islnk():
                    raise RuntimeError(f"archive contains unsupported link: {member.name}")
                output = destination.joinpath(*relative.parts)
                if member.isdir():
                    output.mkdir(parents=True, exist_ok=True)
                    continue
                if not member.isfile():
                    continue
                output = output_path(member.name)
                output.parent.mkdir(parents=True, exist_ok=True)
                input_stream = source.extractfile(member)
                if input_stream is None:
                    raise RuntimeError(f"cannot read archive member: {member.name}")
                with input_stream, output.open("wb") as output_stream:
                    shutil.copyfileobj(input_stream, output_stream)
                output.chmod(member.mode & 0o777)
        return

    raise RuntimeError(f"unsupported Fastfetch archive format: {archive}")


def _choose_file(root: Path, names: Iterable[str], *, license_file: bool = False) -> Path:
    expected = {name.lower() for name in names}
    candidates = [path for path in root.rglob("*") if path.is_file() and path.name.lower() in expected]
    if license_file:
        candidates.extend(
            path
            for path in root.rglob("*")
            if path.is_file() and path.name.lower().startswith("license")
        )
        candidates = list(dict.fromkeys(candidates))
    if not candidates:
        raise RuntimeError(f"could not find {'license' if license_file else '/'.join(names)} in Fastfetch archive")

    def score(path: Path) -> tuple[int, int, str]:
        lower_parts = [part.lower() for part in path.parts]
        preferred = 0
        if license_file:
            preferred += 0 if "fastfetch" in lower_parts else 10
            preferred += 0 if any(part in {"licenses", "license"} for part in lower_parts) else 5
        else:
            preferred += 0 if "bin" in lower_parts else 5
            preferred += 0 if "usr" in lower_parts else 1
        return preferred, len(path.parts), path.as_posix()

    return min(candidates, key=score)


def _copy_executable(source: Path, destination: Path) -> None:
    shutil.copy2(source, destination)
    if os.name != "nt":
        destination.chmod(destination.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)



def _copy_fastfetch_runtime(source_binary: Path, package_dir: Path, destination_name: str) -> list[str]:
    copied: list[str] = []
    destination = package_dir / destination_name
    _copy_executable(source_binary, destination)
    copied.append(destination.name)

    runtime_suffixes = {".dll", ".dylib", ".so"}
    for sibling in sorted(source_binary.parent.iterdir(), key=lambda path: path.name.lower()):
        if not sibling.is_file() or sibling == source_binary:
            continue
        lower_name = sibling.name.lower()
        if sibling.suffix.lower() not in runtime_suffixes and ".so." not in lower_name:
            continue
        target = package_dir / sibling.name
        shutil.copy2(sibling, target)
        if os.name != "nt":
            target.chmod(target.stat().st_mode | stat.S_IRUSR | stat.S_IRGRP | stat.S_IROTH)
        copied.append(target.name)
    return copied


def _write_bundle_manifest(
    destination: Path,
    target: str,
    benchledger_version: str,
    fastfetch_metadata: dict,
    probe_binary: Path,
    fastfetch_runtime_files: list[str],
) -> None:
    manifest = {
        "package": "benchledger-probe",
        "benchledger_version": benchledger_version,
        "probe_version": _probe_version(probe_binary),
        "target": target,
        "fastfetch": {
            "repository": fastfetch_metadata["repository"],
            "tag": fastfetch_metadata["tag"],
            "version": fastfetch_metadata["version"],
            "asset": fastfetch_metadata["asset"],
            "sha256": fastfetch_metadata["sha256"],
            "source_url": fastfetch_metadata["source_url"],
            "runtime_files": fastfetch_runtime_files,
        },
    }
    write_json(destination, manifest)


def _probe_version(probe_binary: Path) -> str:
    result = subprocess.run(
        [str(probe_binary), "--version"],
        check=True,
        capture_output=True,
        text=True,
        timeout=30,
    )
    version = result.stdout.strip()
    if not version.startswith("benchledger-probe ") or len(version.split()) != 2:
        raise RuntimeError(f"unexpected probe --version output: {version!r}")
    return version


def smoke_test(package_dir: Path, probe_name: str, expected_collector_version: str) -> None:
    probe = package_dir / probe_name
    environment = os.environ.copy()
    environment.pop("FASTFETCH_PATH", None)
    environment["PATH"] = "" if os.name == "nt" else "/nonexistent"
    result = subprocess.run(
        [str(probe), "--pretty"],
        cwd=package_dir,
        env=environment,
        check=True,
        capture_output=True,
        text=True,
        timeout=120,
    )
    output = json.loads(result.stdout)
    if output.get("schema_version") != 2:
        raise RuntimeError("bundled probe smoke test returned an unexpected schema_version")
    if not output.get("hardware", {}).get("architecture"):
        raise RuntimeError("bundled probe smoke test returned no hardware architecture")
    if not output.get("hardware", {}).get("cpu", {}).get("model"):
        raise RuntimeError("bundled probe smoke test returned no CPU model")
    collector = output.get("collector", {})
    if collector.get("name") != "fastfetch":
        raise RuntimeError("bundled probe smoke test did not use Fastfetch")
    if collector.get("version") != expected_collector_version:
        raise RuntimeError(
            "bundled probe smoke test used Fastfetch version "
            f"{collector.get('version')!r}; expected {expected_collector_version!r}"
        )


def _iter_files(root: Path) -> list[Path]:
    return sorted((path for path in root.rglob("*") if path.is_file()), key=lambda path: path.as_posix())


def create_archive(package_dir: Path, output_dir: Path, archive_format: str) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    if archive_format == "zip":
        archive = output_dir / f"{package_dir.name}.zip"
        with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as target:
            for path in _iter_files(package_dir):
                arcname = (Path(package_dir.name) / path.relative_to(package_dir)).as_posix()
                info = zipfile.ZipInfo.from_file(path, arcname=arcname)
                info.date_time = (1980, 1, 1, 0, 0, 0)
                with path.open("rb") as stream:
                    target.writestr(info, stream.read(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
        return archive

    archive = output_dir / f"{package_dir.name}.tar.gz"
    with archive.open("wb") as raw_stream:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw_stream, compresslevel=9, mtime=0) as gzip_stream:
            with tarfile.open(fileobj=gzip_stream, mode="w") as target:
                for path in [package_dir, *_iter_files(package_dir)]:
                    arcname = Path(package_dir.name) / path.relative_to(package_dir)
                    info = target.gettarinfo(str(path), arcname.as_posix())
                    info.uid = info.gid = 0
                    info.uname = info.gname = ""
                    info.mtime = 0
                    if path.is_file():
                        with path.open("rb") as stream:
                            target.addfile(info, stream)
                    else:
                        target.addfile(info)
    return archive


def package(args: argparse.Namespace) -> int:
    target_config = TARGETS.get(args.target)
    if target_config is None:
        raise RuntimeError(f"unsupported release target: {args.target}")

    probe_binary = Path(args.probe_binary).resolve()
    if not probe_binary.is_file():
        raise RuntimeError(f"probe binary does not exist: {probe_binary}")

    if TAG_RE.fullmatch(args.benchledger_version) is None:
        raise RuntimeError("BenchLedger version must be a v-prefixed release tag")

    fastfetch_archive = Path(args.fastfetch_archive).resolve()
    if not fastfetch_archive.is_file():
        raise RuntimeError(f"Fastfetch archive does not exist: {fastfetch_archive}")
    fastfetch_metadata = read_json(args.fastfetch_metadata)
    expected_asset = target_config["fastfetch_asset"]
    if fastfetch_metadata.get("asset") != expected_asset:
        raise RuntimeError(
            f"Fastfetch metadata asset does not match {args.target}: expected {expected_asset}"
        )
    expected_sha = fastfetch_metadata.get("sha256")
    if not isinstance(expected_sha, str) or SHA256_RE.fullmatch(expected_sha) is None:
        raise RuntimeError("Fastfetch metadata has no valid SHA-256")
    expected_sha = expected_sha.lower()
    if sha256(fastfetch_archive) != expected_sha:
        raise RuntimeError("Fastfetch archive no longer matches its verified metadata")

    repository = fastfetch_metadata.get("repository")
    fastfetch_tag = fastfetch_metadata.get("tag")
    expected_collector_version = fastfetch_metadata.get("version")
    source_url = fastfetch_metadata.get("source_url")
    if not all(
        isinstance(value, str) and value
        for value in (repository, fastfetch_tag, expected_collector_version, source_url)
    ):
        raise RuntimeError("Fastfetch metadata has incomplete release information")
    if (fastfetch_tag[1:] if fastfetch_tag.startswith("v") else fastfetch_tag) != expected_collector_version:
        raise RuntimeError("Fastfetch metadata has inconsistent tag/version information")
    validate_github_asset_url(repository, source_url, expected_asset)
    fastfetch_metadata["sha256"] = expected_sha

    probe_license = Path(args.probe_license).resolve()
    if not probe_license.is_file():
        raise RuntimeError(f"probe license does not exist: {probe_license}")
    schema = Path(args.schema).resolve()
    if not schema.is_file():
        raise RuntimeError(f"probe schema does not exist: {schema}")

    output_dir = Path(args.output_dir).resolve()
    package_name = f"BenchLedger-probe-{args.benchledger_version}-{args.target}"
    package_dir = output_dir / "stage" / package_name
    if package_dir.exists():
        shutil.rmtree(package_dir)
    package_dir.mkdir(parents=True)

    with tempfile.TemporaryDirectory(prefix="benchledger-fastfetch-") as temporary:
        extracted = Path(temporary)
        extract_archive(fastfetch_archive, extracted)
        fastfetch_binary = _choose_file(extracted, [target_config["fastfetch"]])
        fastfetch_license = _choose_file(extracted, ["LICENSE", "LICENSE.txt", "COPYING"], license_file=True)

        bundled_probe = package_dir / target_config["probe"]
        _copy_executable(probe_binary, bundled_probe)
        fastfetch_runtime_files = _copy_fastfetch_runtime(
            fastfetch_binary, package_dir, target_config["fastfetch"]
        )

        licenses = package_dir / "LICENSES"
        licenses.mkdir()
        shutil.copy2(probe_license, licenses / "BenchLedger-MIT.txt")
        shutil.copy2(fastfetch_license, licenses / "Fastfetch-MIT.txt")

    shutil.copy2(schema, package_dir / schema.name)
    _write_bundle_manifest(
        package_dir / "THIRD_PARTY.json",
        args.target,
        args.benchledger_version,
        fastfetch_metadata,
        package_dir / target_config["probe"],
        fastfetch_runtime_files,
    )

    if not args.skip_smoke_test:
        smoke_test(package_dir, target_config["probe"], expected_collector_version)

    archive = create_archive(package_dir, output_dir / "assets", target_config["format"])
    write_checksum(archive)

    print(f"Created {archive}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", required=True, choices=sorted(TARGETS))
    parser.add_argument("--benchledger-version", required=True)
    parser.add_argument("--probe-binary", required=True)
    parser.add_argument("--fastfetch-archive", required=True)
    parser.add_argument("--fastfetch-metadata", required=True)
    parser.add_argument("--probe-license", required=True)
    parser.add_argument("--schema", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--skip-smoke-test", action="store_true", help=argparse.SUPPRESS)
    return parser


def main() -> int:
    try:
        return package(build_parser().parse_args())
    except (OSError, ValueError, KeyError, RuntimeError, subprocess.SubprocessError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
