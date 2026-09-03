#!/usr/bin/env python3
"""Plan, pin, download, and verify one BenchLedger release."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import tarfile
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any

DEFAULT_FASTFETCH_REPOSITORY = "fastfetch-cli/fastfetch"
DEFAULT_GITHUB_API_VERSION = "2026-03-10"
TAG_RE = re.compile(r"^v(?P<version>[0-9A-Za-z][0-9A-Za-z._+-]*)$")
COMMIT_RE = re.compile(r"^[0-9a-fA-F]{40}$")
SHA256_RE = re.compile(r"^([0-9a-fA-F]{64})$")
GITHUB_DIGEST_RE = re.compile(r"^sha256:([0-9a-fA-F]{64})$")

TARGETS: dict[str, dict[str, str]] = {
    "windows-amd64": {
        "runner": "windows-2025",
        "fastfetch_asset": "fastfetch-windows-amd64.zip",
        "probe_binary": "build/probe/Release/benchledger-probe.exe",
        "archive_extension": "zip",
        "fastfetch": "fastfetch.exe",
        "probe": "benchledger-probe.exe",
        "format": "zip",
    },
    "linux-amd64": {
        "runner": "ubuntu-24.04",
        "fastfetch_asset": "fastfetch-linux-amd64.tar.gz",
        "probe_binary": "build/probe/benchledger-probe",
        "archive_extension": "tar.gz",
        "fastfetch": "fastfetch",
        "probe": "benchledger-probe",
        "format": "tar.gz",
    },
    "linux-aarch64": {
        "runner": "ubuntu-24.04-arm",
        "fastfetch_asset": "fastfetch-linux-aarch64.tar.gz",
        "probe_binary": "build/probe/benchledger-probe",
        "archive_extension": "tar.gz",
        "fastfetch": "fastfetch",
        "probe": "benchledger-probe",
        "format": "tar.gz",
    },
    "macos-amd64": {
        "runner": "macos-15-intel",
        "fastfetch_asset": "fastfetch-macos-amd64.tar.gz",
        "probe_binary": "build/probe/benchledger-probe",
        "archive_extension": "tar.gz",
        "fastfetch": "fastfetch",
        "probe": "benchledger-probe",
        "format": "tar.gz",
    },
    "macos-aarch64": {
        "runner": "macos-15",
        "fastfetch_asset": "fastfetch-macos-aarch64.tar.gz",
        "probe_binary": "build/probe/benchledger-probe",
        "archive_extension": "tar.gz",
        "fastfetch": "fastfetch",
        "probe": "benchledger-probe",
        "format": "tar.gz",
    },
}


def read_json(path: str | Path) -> dict[str, Any]:
    value = json.loads(Path(path).read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise RuntimeError(f"expected a JSON object in {path}")
    return value


def write_json(path: str | Path, value: dict[str, Any]) -> None:
    destination = Path(path)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def append_github_output(path: str | None, **values: str) -> None:
    if not path:
        return
    with open(path, "a", encoding="utf-8", newline="\n") as stream:
        for key, value in values.items():
            stream.write(f"{key}={value}\n")


def sha256(path: str | Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as stream:
        while chunk := stream.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def write_checksum(path: str | Path) -> Path:
    asset = Path(path)
    checksum = asset.with_name(f"{asset.name}.sha256")
    checksum.write_text(f"{sha256(asset)}  {asset.name}\n", encoding="utf-8")
    return checksum


def verify_checksum(asset: Path) -> str:
    checksum = asset.with_name(f"{asset.name}.sha256")
    if not asset.is_file():
        raise RuntimeError(f"missing release asset: {asset.name}")
    if not checksum.is_file():
        raise RuntimeError(f"missing release checksum: {checksum.name}")
    digest_text, separator, filename = checksum.read_text(encoding="utf-8").strip().partition("  ")
    match = SHA256_RE.fullmatch(digest_text)
    if separator != "  " or filename != asset.name or match is None:
        raise RuntimeError(f"invalid checksum file: {checksum.name}")
    expected = match.group(1).lower()
    actual = sha256(asset)
    if actual != expected:
        raise RuntimeError(f"SHA-256 mismatch for {asset.name}: expected {expected}, got {actual}")
    return actual


def validate_github_asset_url(repository: str, url: object, asset_name: str) -> str:
    if not isinstance(url, str):
        raise RuntimeError(f"Fastfetch asset {asset_name} has no download URL")
    parsed = urllib.parse.urlparse(url)
    expected_prefix = f"/{repository}/releases/download/"
    if (
        parsed.scheme != "https"
        or parsed.netloc != "github.com"
        or not parsed.path.startswith(expected_prefix)
        or PurePosixPath(parsed.path).name != asset_name
    ):
        raise RuntimeError(f"Fastfetch asset {asset_name} has an unexpected download URL")
    return url


def _request_json(url: str, token: str | None, api_version: str) -> dict[str, Any]:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "benchledger-release-packager",
        "X-GitHub-Api-Version": api_version,
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            value = json.load(response)
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"GitHub API request failed ({exc.code}): {body}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"GitHub API request failed: {exc.reason}") from exc
    if not isinstance(value, dict):
        raise RuntimeError("GitHub API returned a non-object response")
    return value


def create_plan(args: argparse.Namespace) -> int:
    match = TAG_RE.fullmatch(args.tag)
    if match is None:
        raise RuntimeError("release tag must start with v and contain a nonempty version")
    if COMMIT_RE.fullmatch(args.commit) is None:
        raise RuntimeError("release commit must be a full 40-character Git commit SHA")

    enabled = list(dict.fromkeys(args.enable))
    unknown = sorted(set(enabled) - TARGETS.keys())
    if unknown:
        raise RuntimeError(f"unknown release targets: {', '.join(unknown)}")
    if not enabled:
        raise RuntimeError("at least one probe target must be enabled")

    plan_fields = ("runner", "fastfetch_asset", "probe_binary", "archive_extension")
    selected = [
        {"target": name, **{field: TARGETS[name][field] for field in plan_fields}}
        for name in TARGETS
        if name in enabled
    ]
    version = match.group("version")
    plan = {
        "schema_version": 1,
        "benchledger": {"tag": args.tag, "version": version, "commit": args.commit.lower()},
        "frontend": {"asset": f"BenchLedger-{version}-dist.tar.gz"},
        "probe_targets": selected,
    }
    write_json(args.output, plan)
    append_github_output(
        args.github_output,
        release_tag=args.tag,
        targets_json=json.dumps({"include": selected}, separators=(",", ":"), sort_keys=True),
    )
    print(f"Prepared BenchLedger {args.tag} for {len(selected)} probe targets")
    return 0


def resolve_fastfetch(args: argparse.Namespace) -> int:
    repository = args.repository
    token = args.token or os.environ.get("GITHUB_TOKEN")
    release = _request_json(
        f"https://api.github.com/repos/{repository}/releases/latest",
        token,
        args.api_version,
    )
    if release.get("draft") or release.get("prerelease"):
        raise RuntimeError("GitHub returned a draft or prerelease from the latest-release endpoint")
    tag = release.get("tag_name")
    if not isinstance(tag, str) or not tag:
        raise RuntimeError("Fastfetch release response has no tag_name")

    assets_by_name = {
        asset.get("name"): asset
        for asset in release.get("assets", [])
        if isinstance(asset, dict) and isinstance(asset.get("name"), str)
    }
    selected_assets: dict[str, dict[str, Any]] = {}
    for asset_name in args.asset:
        asset = assets_by_name.get(asset_name)
        if not isinstance(asset, dict):
            raise RuntimeError(f"Fastfetch release {tag} has no asset named {asset_name}")
        if asset.get("state") != "uploaded":
            raise RuntimeError(f"Fastfetch asset {asset_name} is not fully uploaded")
        digest = asset.get("digest")
        match = GITHUB_DIGEST_RE.fullmatch(str(digest))
        if match is None:
            raise RuntimeError(f"Fastfetch asset {asset_name} has no valid SHA-256 digest")
        download_url = validate_github_asset_url(repository, asset.get("browser_download_url"), asset_name)
        size = asset.get("size")
        if isinstance(size, bool) or not isinstance(size, int) or size < 0:
            raise RuntimeError(f"Fastfetch asset {asset_name} has no valid size")
        selected_assets[asset_name] = {
            "browser_download_url": download_url,
            "digest": f"sha256:{match.group(1).lower()}",
            "size": size,
        }

    version = tag[1:] if tag.startswith("v") else tag
    write_json(args.output, {
        "repository": repository,
        "release_id": release.get("id"),
        "tag": tag,
        "version": version,
        "published_at": release.get("published_at"),
        "assets": selected_assets,
    })
    print(f"Resolved Fastfetch {tag} with {len(selected_assets)} required assets")
    return 0


def _stream_download(url: str, output: Path, expected_sha256: str, expected_size: int, asset_name: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": "benchledger-release-packager"})
    digest = hashlib.sha256()
    downloaded = 0
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(mode="wb", dir=output.parent, prefix=f".{output.name}.", suffix=".part", delete=False) as stream:
            temporary_path = Path(stream.name)
            with urllib.request.urlopen(request, timeout=120) as response:
                while chunk := response.read(1024 * 1024):
                    downloaded += len(chunk)
                    if downloaded > expected_size:
                        raise RuntimeError(f"Fastfetch asset {asset_name} exceeds expected size {expected_size} bytes")
                    stream.write(chunk)
                    digest.update(chunk)
        if downloaded != expected_size:
            raise RuntimeError(f"Fastfetch asset {asset_name} size mismatch: expected {expected_size} bytes, got {downloaded}")
        actual = digest.hexdigest()
        if actual != expected_sha256:
            raise RuntimeError(f"SHA-256 mismatch for {asset_name}: expected {expected_sha256}, got {actual}")
        os.replace(temporary_path, output)
        return actual
    except (urllib.error.HTTPError, urllib.error.URLError) as exc:
        raise RuntimeError(f"Fastfetch asset download failed: {exc}") from exc
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def download_fastfetch(args: argparse.Namespace) -> int:
    manifest = read_json(args.manifest)
    asset = manifest.get("assets", {}).get(args.asset_name)
    if not isinstance(asset, dict):
        raise RuntimeError(f"release manifest has no asset named {args.asset_name}")
    match = GITHUB_DIGEST_RE.fullmatch(str(asset.get("digest", "")))
    if match is None:
        raise RuntimeError(f"release manifest has an invalid digest for {args.asset_name}")
    expected = match.group(1).lower()
    expected_size = asset.get("size")
    if isinstance(expected_size, bool) or not isinstance(expected_size, int) or expected_size < 0:
        raise RuntimeError(f"release manifest has an invalid size for {args.asset_name}")
    output = Path(args.output)
    actual = _stream_download(str(asset["browser_download_url"]), output, expected, expected_size, args.asset_name)
    write_json(args.metadata_output, {
        "repository": manifest["repository"],
        "tag": manifest["tag"],
        "version": manifest["version"],
        "asset": args.asset_name,
        "sha256": actual,
        "source_url": asset["browser_download_url"],
    })
    print(f"Downloaded and verified {args.asset_name} ({actual})")
    return 0


def _read_bundle_manifest(archive: Path) -> dict[str, Any]:
    if archive.suffix == ".zip":
        with zipfile.ZipFile(archive) as source:
            candidates = [name for name in source.namelist() if name.endswith("/THIRD_PARTY.json")]
            if len(candidates) != 1:
                raise RuntimeError(f"{archive.name} must contain exactly one THIRD_PARTY.json")
            value = json.loads(source.read(candidates[0]).decode("utf-8"))
    elif archive.suffixes[-2:] == [".tar", ".gz"]:
        with tarfile.open(archive, "r:gz") as source:
            candidates = [member for member in source.getmembers() if member.name.endswith("/THIRD_PARTY.json")]
            if len(candidates) != 1:
                raise RuntimeError(f"{archive.name} must contain exactly one THIRD_PARTY.json")
            stream = source.extractfile(candidates[0])
            if stream is None:
                raise RuntimeError(f"cannot read THIRD_PARTY.json from {archive.name}")
            with stream:
                value = json.loads(stream.read().decode("utf-8"))
    else:
        raise RuntimeError(f"unsupported release archive: {archive.name}")
    if not isinstance(value, dict):
        raise RuntimeError(f"{archive.name} contains a non-object THIRD_PARTY.json")
    return value


def verify_release_assets(args: argparse.Namespace) -> int:
    plan = read_json(args.plan)
    fastfetch = read_json(args.fastfetch_manifest)
    if plan.get("schema_version") != 1:
        raise RuntimeError("unsupported release-plan schema_version")
    if not isinstance(plan.get("benchledger"), dict) or not isinstance(plan.get("frontend"), dict):
        raise RuntimeError("release plan is missing BenchLedger or frontend metadata")
    if not isinstance(plan.get("probe_targets"), list) or not plan["probe_targets"]:
        raise RuntimeError("release plan must contain at least one probe target")
    if not isinstance(fastfetch.get("assets"), dict):
        raise RuntimeError("Fastfetch manifest has no assets object")

    assets_dir = Path(args.assets_dir)
    if not assets_dir.is_dir():
        raise RuntimeError(f"release assets directory does not exist: {assets_dir}")

    benchledger = plan["benchledger"]
    benchledger_tag = benchledger.get("tag")
    benchledger_version = benchledger.get("version")
    benchledger_commit = benchledger.get("commit")
    tag_match = TAG_RE.fullmatch(str(benchledger_tag))
    if tag_match is None or tag_match.group("version") != benchledger_version:
        raise RuntimeError("release plan has inconsistent BenchLedger tag/version metadata")
    if COMMIT_RE.fullmatch(str(benchledger_commit)) is None:
        raise RuntimeError("release plan has an invalid BenchLedger commit")

    frontend_name = plan["frontend"].get("asset")
    expected_frontend_name = f"BenchLedger-{benchledger_version}-dist.tar.gz"
    if frontend_name != expected_frontend_name:
        raise RuntimeError("release plan has an unexpected frontend asset name")

    fastfetch_repository = fastfetch.get("repository")
    fastfetch_tag = fastfetch.get("tag")
    fastfetch_version = fastfetch.get("version")
    if not all(isinstance(value, str) and value for value in (fastfetch_repository, fastfetch_tag, fastfetch_version)):
        raise RuntimeError("Fastfetch manifest has incomplete release metadata")
    if (fastfetch_tag[1:] if fastfetch_tag.startswith("v") else fastfetch_tag) != fastfetch_version:
        raise RuntimeError("Fastfetch manifest has inconsistent tag/version metadata")
    verify_checksum(assets_dir / frontend_name)
    expected_primary_assets = {frontend_name}
    expected_fastfetch_assets: set[str] = set()
    probe_versions: set[str] = set()
    bundled_repositories: set[str] = set()
    bundled_fastfetch_versions: set[str] = set()
    target_names: set[str] = set()

    for target in plan["probe_targets"]:
        if not isinstance(target, dict):
            raise RuntimeError("release plan contains a non-object probe target")
        target_name = target.get("target")
        if not isinstance(target_name, str) or target_name not in TARGETS:
            raise RuntimeError(f"release plan contains an unsupported probe target: {target_name}")
        if target_name in target_names:
            raise RuntimeError(f"release plan contains duplicate probe target: {target_name}")
        target_names.add(target_name)

        archive_extension = target.get("archive_extension")
        if archive_extension != TARGETS[target_name]["archive_extension"]:
            raise RuntimeError(f"release plan contains the wrong archive extension for {target_name}")
        archive_name = f"BenchLedger-probe-{benchledger_tag}-{target_name}.{archive_extension}"
        expected_primary_assets.add(archive_name)
        verify_checksum(assets_dir / archive_name)
        bundle = _read_bundle_manifest(assets_dir / archive_name)
        if bundle.get("package") != "benchledger-probe":
            raise RuntimeError(f"{archive_name} is not a BenchLedger probe bundle")
        if bundle.get("target") != target_name:
            raise RuntimeError(f"{archive_name} declares the wrong target")
        if bundle.get("benchledger_version") != benchledger_tag:
            raise RuntimeError(f"{archive_name} declares the wrong BenchLedger version")
        probe_version = bundle.get("probe_version")
        if not isinstance(probe_version, str) or not probe_version:
            raise RuntimeError(f"{archive_name} has no probe version")
        probe_versions.add(probe_version)

        bundled = bundle.get("fastfetch")
        if not isinstance(bundled, dict):
            raise RuntimeError(f"{archive_name} has no Fastfetch metadata")
        asset_name = target.get("fastfetch_asset")
        if asset_name != TARGETS[target_name]["fastfetch_asset"]:
            raise RuntimeError(f"release plan contains the wrong Fastfetch asset for {target_name}")
        pinned = fastfetch["assets"].get(asset_name)
        if not isinstance(pinned, dict):
            raise RuntimeError(f"pinned Fastfetch manifest has no asset: {asset_name}")
        digest_match = GITHUB_DIGEST_RE.fullmatch(str(pinned.get("digest", "")))
        if digest_match is None:
            raise RuntimeError(f"pinned Fastfetch asset has no valid digest: {asset_name}")
        expected_sha = digest_match.group(1).lower()
        source_url = validate_github_asset_url(
            fastfetch_repository, pinned.get("browser_download_url"), asset_name
        )
        checks = {
            "repository": fastfetch.get("repository"),
            "tag": fastfetch.get("tag"),
            "version": fastfetch.get("version"),
            "asset": asset_name,
            "sha256": expected_sha,
            "source_url": source_url,
        }
        for key, expected in checks.items():
            if bundled.get(key) != expected:
                raise RuntimeError(f"{archive_name} contains mismatched Fastfetch {key}")
        bundled_repositories.add(str(bundled["repository"]))
        bundled_fastfetch_versions.add(str(bundled["version"]))
        expected_fastfetch_assets.add(asset_name)

    if len(probe_versions) != 1:
        raise RuntimeError("selected probe bundles do not contain one consistent probe version")
    if bundled_repositories != {str(fastfetch.get("repository"))}:
        raise RuntimeError("selected probe bundles do not contain one consistent Fastfetch repository")
    if bundled_fastfetch_versions != {str(fastfetch.get("version"))}:
        raise RuntimeError("selected probe bundles do not contain one consistent Fastfetch version")
    if expected_fastfetch_assets != set(fastfetch["assets"]):
        raise RuntimeError("Fastfetch manifest does not exactly match the selected target set")

    expected_input_files = expected_primary_assets | {
        f"{name}.sha256" for name in expected_primary_assets
    }
    actual_entries = {path.name for path in assets_dir.iterdir()}
    if actual_entries != expected_input_files:
        missing = sorted(expected_input_files - actual_entries)
        unexpected = sorted(actual_entries - expected_input_files)
        raise RuntimeError(f"release input asset set mismatch; missing={missing}, unexpected={unexpected}")
    if any(not (assets_dir / name).is_file() for name in expected_input_files):
        raise RuntimeError("release input assets must all be regular files")

    print(f"Verified {len(expected_primary_assets)} release assets")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest="command", required=True)

    plan = subparsers.add_parser("plan")
    plan.add_argument("--tag", required=True)
    plan.add_argument("--commit", required=True)
    plan.add_argument("--enable", action="append", default=[], choices=sorted(TARGETS))
    plan.add_argument("--output", required=True)
    plan.add_argument("--github-output")
    plan.set_defaults(func=create_plan)

    resolve = subparsers.add_parser("resolve-fastfetch")
    resolve.add_argument("--repository", default=DEFAULT_FASTFETCH_REPOSITORY)
    resolve.add_argument("--api-version", default=DEFAULT_GITHUB_API_VERSION)
    resolve.add_argument("--token")
    resolve.add_argument("--asset", action="append", required=True)
    resolve.add_argument("--output", required=True)
    resolve.set_defaults(func=resolve_fastfetch)

    download = subparsers.add_parser("download-fastfetch")
    download.add_argument("--manifest", required=True)
    download.add_argument("--asset-name", required=True)
    download.add_argument("--output", required=True)
    download.add_argument("--metadata-output", required=True)
    download.set_defaults(func=download_fastfetch)

    verify = subparsers.add_parser("verify")
    verify.add_argument("--plan", required=True)
    verify.add_argument("--fastfetch-manifest", required=True)
    verify.add_argument("--assets-dir", required=True)
    verify.set_defaults(func=verify_release_assets)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        return args.func(args)
    except (OSError, ValueError, KeyError, RuntimeError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
