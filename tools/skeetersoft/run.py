#!/usr/bin/env python3
"""Sandbox CLI for the Skeetersoft Replay Ledger pilot (#3970)."""

from __future__ import annotations

import argparse
import hashlib
import json
import locale
import os
import sys
import time
import traceback
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT.parent) not in sys.path:
    sys.path.insert(0, str(ROOT.parent))

os.environ.setdefault("TZ", "UTC")
os.environ.setdefault("LC_ALL", "C")
try:
    locale.setlocale(locale.LC_ALL, "C")
except locale.Error:
    pass

from skeetersoft import __version__
from skeetersoft.compile import compile_records, coverage_report
from skeetersoft.pilot_data import ACCEPTED_GAMES, FAILURE_GAMES
from skeetersoft.render import render_ledger
from skeetersoft.validate import validate_print_stream


def dump_json(path: Path, payload) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, indent=2, sort_keys=True, ensure_ascii=False) + "\n"
    path.write_text(text, encoding="utf-8", newline="\n")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    digest.update(path.read_bytes())
    return digest.hexdigest()


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def write_run_log(path: Path, lines: list[str]) -> None:
    path.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")


def compile_pilot(out_dir: Path) -> dict:
    started = time.time()
    accepted_result = compile_records(ACCEPTED_GAMES)
    invariant_errors = validate_print_stream(accepted_result["accepted"])
    failure_result = compile_records(FAILURE_GAMES)
    html = render_ledger(accepted_result["accepted"])
    coverage = coverage_report(accepted_result)
    expected_failure_codes = {
        "F-MISS-LINEUP": "missing_lineup",
        "F-BAD-DATE": "invalid_date",
        "F-DUP-GAME": "duplicate_game_id",
        "F-DUP-PLAYER": "duplicate_player_id",
        "F-BAD-ALIAS": "unknown_team_alias",
    }
    observed_codes = {
        (item.get("fixture_id"), item.get("code")) for item in failure_result["exceptions"]
    }
    missing_failure_codes = [
        f"{fixture_id}:{code}"
        for fixture_id, code in expected_failure_codes.items()
        if (fixture_id, code) not in observed_codes
    ]
    incorrectly_accepted = [
        game["game_id"]
        for game in failure_result["accepted"]
        if game.get("fixture_id") != "F-DUP-GAME"
    ]
    coverage["failure_path"] = {
        "input_records": len(FAILURE_GAMES),
        "rejected": len(failure_result["exceptions"]),
        "incorrectly_accepted": incorrectly_accepted,
        "missing_failure_codes": missing_failure_codes,
        "note": "F-DUP-GAME is a pair: the first record parses, the second must raise duplicate_game_id.",
    }

    out_dir.mkdir(parents=True, exist_ok=True)
    stream_path = out_dir / "master_print_stream.json"
    html_path = out_dir / "ledger.html"
    coverage_json = out_dir / "coverage-report.json"
    coverage_md = out_dir / "coverage-report.md"
    exceptions_path = out_dir / "exceptions.json"
    dump_json(stream_path, accepted_result["accepted"])
    html_path.write_text(html, encoding="utf-8", newline="\n")
    dump_json(coverage_json, coverage)
    dump_json(exceptions_path, failure_result["exceptions"] + accepted_result["exceptions"])
    coverage_md.write_text(
        "\n".join(
            [
                "# Skeetersoft pilot coverage",
                "",
                f"- accepted games: {coverage['accepted_games']}",
                f"- rejected failure-path records: {coverage['failure_path']['rejected']}",
                f"- series: {coverage['series_count']}",
                f"- collision games: {coverage['collision_games']}",
                f"- unavailable seasons (expected for pilot): {', '.join(str(y) for y in coverage['unavailable_seasons'])}",
                "",
                coverage["note"],
                "",
            ]
        ),
        encoding="utf-8",
        newline="\n",
    )

    complete_ok = (
        not accepted_result["exceptions"]
        and not invariant_errors
        and not coverage["failure_path"]["incorrectly_accepted"]
        and not coverage["failure_path"]["missing_failure_codes"]
        and len(accepted_result["accepted"]) > 0
    )
    if not complete_ok:
        (out_dir / "COMPLETE.forbidden").write_text(
            "Pilot did not meet complete-package criteria.\n", encoding="utf-8"
        )
        (out_dir / "COMPLETE").unlink(missing_ok=True)
    else:
        (out_dir / "COMPLETE.forbidden").unlink(missing_ok=True)
        (out_dir / "COMPLETE").write_text("pilot-accepted-games-only\n", encoding="utf-8")

    elapsed = time.time() - started
    log_lines = [
        "Skeetersoft Replay Ledger sandbox pilot",
        f"version: {__version__}",
        f"python: {sys.version.replace(chr(10), ' ')}",
        "tz: UTC",
        "locale: C",
        f"elapsed_s: {elapsed:.3f}",
        f"accepted: {len(accepted_result['accepted'])}",
        f"accepted_exceptions: {len(accepted_result['exceptions'])}",
        f"failure_rejected: {len(failure_result['exceptions'])}",
        f"failure_incorrectly_accepted: {coverage['failure_path']['incorrectly_accepted']}",
        f"invariant_errors: {invariant_errors}",
        "pdf: not produced (HTML is canonical; no pinned headless renderer)",
        "network: not used",
        "secrets: none",
    ]
    write_run_log(out_dir / "run.log", log_lines)
    return {
        "ok": complete_ok,
        "accepted_result": accepted_result,
        "failure_result": failure_result,
        "invariant_errors": invariant_errors,
        "html": html,
        "coverage": coverage,
        "paths": {
            "stream": stream_path,
            "html": html_path,
            "coverage": coverage_json,
            "exceptions": exceptions_path,
        },
    }


def write_manifest(out_dir: Path, repo_root: Path) -> None:
    files = []
    for path in sorted(ROOT.rglob("*")):
        if path.is_file() and "__pycache__" not in path.parts and path.name != ".gitignore":
            rel = path.relative_to(repo_root).as_posix()
            files.append(
                {
                    "path": rel,
                    "sha256": sha256_file(path),
                    "bytes": path.stat().st_size,
                }
            )
    payload = {
        "project": "Skeetersoft Replay Ledger sandbox pilot",
        "source_issue": "#3970",
        "parent_issue": "#3124",
        "mode": "pilot-synthetic-only",
        "licensing": {
            "retrosheet": "not ingested",
            "chadwick": "not ingested",
            "note": "Synthetic fixtures only. Do not commit upstream archives until terms and Product approval are recorded.",
        },
        "files": files,
    }
    dump_json(out_dir / "source-manifest.json", payload)
    inventory_lines = [f"{item['sha256']}  {item['path']}" for item in files]
    (out_dir / "inventory.sha256").write_text("\n".join(inventory_lines) + "\n", encoding="utf-8")


def run_tests() -> int:
    loader = unittest.TestLoader()
    suite = loader.discover(str(ROOT / "tests"), pattern="test_*.py")
    result = unittest.TextTestRunner(verbosity=2).run(suite)
    return 0 if result.wasSuccessful() else 1


def reproducibility_check(out_dir: Path) -> list[str]:
    first = compile_pilot(out_dir / "run-a")
    second = compile_pilot(out_dir / "run-b")
    errors = []
    for name in ("master_print_stream.json", "ledger.html", "coverage-report.json", "exceptions.json"):
        a = sha256_file(out_dir / "run-a" / name)
        b = sha256_file(out_dir / "run-b" / name)
        if a != b:
            errors.append(f"{name} hash mismatch: {a} vs {b}")
    if first["html"] != second["html"]:
        errors.append("rendered HTML text mismatch")
    return errors


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="skeetersoft")
    parser.add_argument("command", choices=["test", "compile", "pilot", "inventory"])
    parser.add_argument("--out", default=str(ROOT / "out"))
    args = parser.parse_args(argv)
    out_dir = Path(args.out)
    repo_root = ROOT.parent.parent

    if args.command == "test":
        return run_tests()

    if args.command == "compile":
        result = compile_pilot(out_dir)
        write_manifest(out_dir, repo_root)
        print(f"accepted={len(result['accepted_result']['accepted'])} ok={result['ok']}")
        return 0 if result["ok"] else 1

    if args.command == "inventory":
        if not out_dir.exists():
            print("out dir missing; run compile first", file=sys.stderr)
            return 1
        write_manifest(out_dir, repo_root)
        print(out_dir / "inventory.sha256")
        return 0

    test_rc = run_tests()
    if test_rc != 0:
        print("unit tests failed; refusing complete package", file=sys.stderr)
        dump_json(out_dir / "exceptions.json", [{"code": "unit_test_failure"}])
        (out_dir / "COMPLETE").unlink(missing_ok=True)
        return test_rc
    result = compile_pilot(out_dir)
    write_manifest(out_dir, repo_root)
    repro_errors = reproducibility_check(out_dir / "repro")
    if repro_errors:
        result["ok"] = False
        dump_json(out_dir / "repro-errors.json", repro_errors)
        (out_dir / "COMPLETE").unlink(missing_ok=True)
        print("reproducibility check failed", file=sys.stderr)
        for err in repro_errors:
            print(err, file=sys.stderr)
        return 1
    print(json.dumps({"ok": result["ok"], "accepted": result["coverage"]["accepted_games"]}, indent=2))
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception:
        traceback.print_exc()
        sys.exit(1)
