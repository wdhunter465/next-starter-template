# Skeetersoft Replay Ledger — sandbox pilot (#3124 / #3970)

Isolated one-time utility. All paths in this folder only. Do **not** merge to `main`.

## Commands

From the repository root, with `TZ=UTC LC_ALL=C`:

```text
PYTHONPATH=tools python3 tools/skeetersoft/run.py test
PYTHONPATH=tools python3 tools/skeetersoft/run.py compile --out tools/skeetersoft/out
PYTHONPATH=tools python3 tools/skeetersoft/run.py pilot --out tools/skeetersoft/out
```

`pilot` runs unit tests, compiles the synthetic #3969 fixture set, writes evidence under `out/`, and repeats the compile for a byte-identical reproducibility check.

## Pilot vs full range

This increment is **synthetic 1985 fixtures only**. Retrosheet/Chadwick archives are not ingested. The full 1976–1985 run is blocked until PMO/Product records pilot acceptance.

HTML (`out/ledger.html`) is the canonical print source. PDF is not produced until a pinned headless renderer is authorized.

## Rollback

Delete or revert `tools/skeetersoft/**` on `sandbox/skeetersoft-replay-ledger`.
