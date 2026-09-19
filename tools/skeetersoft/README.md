# Skeetersoft Replay Ledger (#3124)

Isolated one-time utility. All paths in this folder only. Do **not** merge to `main`.

Retrosheet notice: see `NOTICE`. Event archives stay in `input/cache/` and are not committed.

## Commands

From the repository root, with `TZ=UTC LC_ALL=C`:

```text
PYTHONPATH=tools python3 tools/skeetersoft/run.py test
PYTHONPATH=tools python3 tools/skeetersoft/run.py compile --out tools/skeetersoft/out
PYTHONPATH=tools python3 tools/skeetersoft/run.py pilot --out tools/skeetersoft/out
PYTHONPATH=tools python3 tools/skeetersoft/run.py full
```

`pilot` runs unit tests, compiles the synthetic #3969 fixture set, writes evidence under `out/`, and repeats the compile for a byte-identical reproducibility check.

`full` downloads Retrosheet regular-season event files for 1976–1985 into `input/cache/`, compiles starting lineups, and writes per-season HTML/JSON under `out/full/` plus a small committed summary at `evidence/1976-1985-coverage.md`.

## Pilot vs full range

The sandbox children (#3969–#3971) used **synthetic 1985 fixtures**. Product Authority GO 2026-09-19 authorized Active continuation of the licensed 1976–1985 run. HTML is the canonical print source. PDF is not produced until a pinned headless renderer is authorized.

## Rollback

Delete or revert `tools/skeetersoft/**` on `sandbox/skeetersoft-replay-ledger`.
