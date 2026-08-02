from __future__ import annotations

import argparse
import hashlib
import io
import json
import stat
import sys
import tarfile
import tempfile
import time
import unittest
import warnings
import zipfile
from pathlib import Path
from types import SimpleNamespace

PACKAGING_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PACKAGING_DIR))

import package_probe  # noqa: E402
import release  # noqa: E402


class PackagingTests(unittest.TestCase):
    def test_safe_archive_paths(self):
        self.assertEqual(package_probe._safe_member_path("usr/bin/fastfetch").as_posix(), "usr/bin/fastfetch")
        with self.assertRaises(RuntimeError):
            package_probe._safe_member_path("../../escape")
        with self.assertRaises(RuntimeError):
            package_probe._safe_member_path("/absolute")

    def test_extract_zip_and_find_binary(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            archive = root / "fastfetch.zip"
            with zipfile.ZipFile(archive, "w") as target:
                target.writestr("fastfetch/usr/bin/fastfetch.exe", b"binary")
                target.writestr("fastfetch/usr/share/licenses/fastfetch/LICENSE", b"MIT")
            destination = root / "out"
            package_probe.extract_archive(archive, destination)
            binary = package_probe._choose_file(destination, ["fastfetch.exe"])
            license_file = package_probe._choose_file(destination, ["LICENSE"], license_file=True)
            self.assertEqual(binary.read_bytes(), b"binary")
            self.assertEqual(license_file.read_text(), "MIT")

    def test_extract_zip_rejects_duplicate_files_and_links(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)

            duplicate = root / "duplicate.zip"
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", UserWarning)
                with zipfile.ZipFile(duplicate, "w") as target:
                    target.writestr("fastfetch/bin/fastfetch", b"first")
                    target.writestr("FASTFETCH/bin/fastfetch", b"second")
            with self.assertRaisesRegex(RuntimeError, "duplicate file path"):
                package_probe.extract_archive(duplicate, root / "duplicate-out")

            link = root / "link.zip"
            with zipfile.ZipFile(link, "w") as target:
                info = zipfile.ZipInfo("fastfetch/bin/fastfetch")
                info.create_system = 3
                info.external_attr = (stat.S_IFLNK | 0o777) << 16
                target.writestr(info, "../outside")
            with self.assertRaisesRegex(RuntimeError, "unsupported link"):
                package_probe.extract_archive(link, root / "link-out")

    def test_copy_fastfetch_runtime_includes_sibling_libraries(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "source"
            destination = root / "bundle"
            source.mkdir()
            destination.mkdir()
            binary = source / "fastfetch.exe"
            binary.write_bytes(b"exe")
            (source / "lua55.dll").write_bytes(b"dll")
            (source / "presets.json").write_bytes(b"not-runtime")
            copied = package_probe._copy_fastfetch_runtime(binary, destination, "fastfetch.exe")
            self.assertEqual(copied, ["fastfetch.exe", "lua55.dll"])
            self.assertTrue((destination / "lua55.dll").is_file())
            self.assertFalse((destination / "presets.json").exists())

    def test_extract_tar_rejects_links(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            archive = root / "fastfetch.tar.gz"
            with tarfile.open(archive, "w:gz") as target:
                info = tarfile.TarInfo("fastfetch")
                info.type = tarfile.SYMTYPE
                info.linkname = "/tmp/escape"
                target.addfile(info)
            with self.assertRaises(RuntimeError):
                package_probe.extract_archive(archive, root / "out")

    def test_resolve_release_pins_all_requested_assets(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "manifest.json"
            assets = [
                {
                    "name": name,
                    "state": "uploaded",
                    "digest": "sha256:" + (str(index) * 64),
                    "browser_download_url": f"https://github.com/fastfetch-cli/fastfetch/releases/download/2.0/{name}",
                    "size": index,
                }
                for index, name in enumerate(("one.zip", "two.tar.gz"), start=1)
            ]
            original_request = release._request_json
            release._request_json = lambda *_args, **_kwargs: {
                "id": 7,
                "tag_name": "2.0",
                "draft": False,
                "prerelease": False,
                "published_at": "2026-01-01T00:00:00Z",
                "assets": assets,
            }
            try:
                args = argparse.Namespace(
                    repository="fastfetch-cli/fastfetch",
                    api_version="2026-03-10",
                    token=None,
                    asset=["one.zip", "two.tar.gz"],
                    output=str(output),
                    github_output=None,
                )
                self.assertEqual(release.resolve_fastfetch(args), 0)
            finally:
                release._request_json = original_request
            manifest = json.loads(output.read_text())
            self.assertEqual(manifest["tag"], "2.0")
            self.assertEqual(sorted(manifest["assets"]), ["one.zip", "two.tar.gz"])

    def test_github_asset_url_is_bound_to_repository_and_asset(self):
        url = "https://github.com/fastfetch-cli/fastfetch/releases/download/2.66.0/fastfetch-linux-amd64.tar.gz"
        self.assertEqual(
            release.validate_github_asset_url(
                "fastfetch-cli/fastfetch", url, "fastfetch-linux-amd64.tar.gz"
            ),
            url,
        )
        with self.assertRaisesRegex(RuntimeError, "unexpected download URL"):
            release.validate_github_asset_url(
                "other/project", url, "fastfetch-linux-amd64.tar.gz"
            )
        with self.assertRaisesRegex(RuntimeError, "unexpected download URL"):
            release.validate_github_asset_url(
                "fastfetch-cli/fastfetch", url, "fastfetch-linux-aarch64.tar.gz"
            )

    def test_release_manifest_digest_format(self):
        digest = "a" * 64
        self.assertIsNotNone(release.GITHUB_DIGEST_RE.fullmatch(f"sha256:{digest}"))
        self.assertIsNone(release.GITHUB_DIGEST_RE.fullmatch(digest))

    def test_sha256(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "value"
            path.write_bytes(b"BenchLedger")
            self.assertEqual(release.sha256(path), hashlib.sha256(b"BenchLedger").hexdigest())

    def test_release_archives_are_reproducible_and_zip_is_deflated(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            package = root / "bundle"
            package.mkdir()
            (package / "probe").write_bytes(b"probe")
            (package / "THIRD_PARTY.json").write_text("{}\n", encoding="utf-8")

            first = package_probe.create_archive(package, root / "first", "tar.gz")
            time.sleep(0.01)
            second = package_probe.create_archive(package, root / "second", "tar.gz")
            self.assertEqual(release.sha256(first), release.sha256(second))

            zipped = package_probe.create_archive(package, root / "zip", "zip")
            with zipfile.ZipFile(zipped) as source:
                self.assertTrue(source.infolist())
                self.assertTrue(all(member.compress_type == zipfile.ZIP_DEFLATED for member in source.infolist()))


class ReleaseOrchestrationTests(unittest.TestCase):
    def test_release_plan_builds_only_enabled_targets(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "release-plan.json"
            args = SimpleNamespace(
                tag="v0.7.0",
                commit="a" * 40,
                enable=["windows-amd64", "linux-amd64", "macos-amd64"],
                output=str(output),
                github_output=None,
            )
            self.assertEqual(release.create_plan(args), 0)
            plan = json.loads(output.read_text())
            self.assertEqual(plan["benchledger"]["version"], "0.7.0")
            self.assertEqual(
                [target["target"] for target in plan["probe_targets"]],
                ["windows-amd64", "linux-amd64", "macos-amd64"],
            )
            self.assertEqual(
                [target["fastfetch_asset"] for target in plan["probe_targets"]],
                [
                    "fastfetch-windows-amd64.zip",
                    "fastfetch-linux-amd64.tar.gz",
                    "fastfetch-macos-amd64.tar.gz",
                ],
            )
            self.assertTrue(
                all(
                    set(target)
                    == {"target", "runner", "fastfetch_asset", "probe_binary", "archive_extension"}
                    for target in plan["probe_targets"]
                )
            )

    def test_release_plan_requires_at_least_one_probe_target(self):
        with tempfile.TemporaryDirectory() as temporary:
            args = SimpleNamespace(
                tag="v0.7.0",
                commit="a" * 40,
                enable=[],
                output=str(Path(temporary) / "release-plan.json"),
                github_output=None,
            )
            with self.assertRaises(RuntimeError):
                release.create_plan(args)

    def test_verify_release_assets_checks_selected_asset_set(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            assets = root / "assets"
            assets.mkdir()
            plan_path = root / "release-plan.json"
            fastfetch_path = root / "fastfetch-release.json"

            target = {
                "target": "linux-amd64",
                "runner": "ubuntu-24.04",
                "fastfetch_asset": "fastfetch-linux-amd64.tar.gz",
                "probe_binary": "build/probe/benchledger-probe",
                "archive_extension": "tar.gz",
            }
            plan_path.write_text(json.dumps({
                "schema_version": 1,
                "benchledger": {"tag": "v0.7.0", "version": "0.7.0", "commit": "a" * 40},
                "frontend": {"asset": "BenchLedger-0.7.0-dist.tar.gz"},
                "probe_targets": [target],
            }))
            fastfetch_path.write_text(json.dumps({
                "repository": "fastfetch-cli/fastfetch",
                "tag": "2.66.0",
                "version": "2.66.0",
                "published_at": "2026-01-01T00:00:00Z",
                "assets": {
                    "fastfetch-linux-amd64.tar.gz": {
                        "digest": "sha256:" + "b" * 64,
                        "browser_download_url": "https://github.com/fastfetch-cli/fastfetch/releases/download/2.66.0/fastfetch-linux-amd64.tar.gz",
                    }
                },
            }))

            frontend = assets / "BenchLedger-0.7.0-dist.tar.gz"
            with tarfile.open(frontend, "w:gz") as archive:
                info = tarfile.TarInfo("index.html")
                payload = b"frontend"
                info.size = len(payload)
                archive.addfile(info, io.BytesIO(payload))
            (assets / f"{frontend.name}.sha256").write_text(
                f"{release.sha256(frontend)}  {frontend.name}\n"
            )

            probe_archive = assets / "BenchLedger-probe-v0.7.0-linux-amd64.tar.gz"
            bundle = json.dumps({
                "package": "benchledger-probe",
                "benchledger_version": "v0.7.0",
                "probe_version": "benchledger-probe 0.2.1",
                "target": "linux-amd64",
                "fastfetch": {
                    "repository": "fastfetch-cli/fastfetch",
                    "tag": "2.66.0",
                    "version": "2.66.0",
                    "asset": "fastfetch-linux-amd64.tar.gz",
                    "sha256": "b" * 64,
                    "source_url": "https://github.com/fastfetch-cli/fastfetch/releases/download/2.66.0/fastfetch-linux-amd64.tar.gz",
                },
            }).encode()
            with tarfile.open(probe_archive, "w:gz") as archive:
                info = tarfile.TarInfo("bundle/THIRD_PARTY.json")
                info.size = len(bundle)
                archive.addfile(info, io.BytesIO(bundle))
            (assets / f"{probe_archive.name}.sha256").write_text(
                f"{release.sha256(probe_archive)}  {probe_archive.name}\n"
            )

            args = SimpleNamespace(
                plan=str(plan_path),
                fastfetch_manifest=str(fastfetch_path),
                assets_dir=str(assets),
            )
            asset_names = {path.name for path in assets.iterdir()}
            self.assertEqual(release.verify_release_assets(args), 0)
            self.assertEqual({path.name for path in assets.iterdir()}, asset_names)

            (assets / "unexpected.txt").write_text("not a release asset", encoding="utf-8")
            with self.assertRaisesRegex(RuntimeError, "release input asset set mismatch"):
                release.verify_release_assets(args)


if __name__ == "__main__":
    unittest.main()
