# Skeetersoft Replay Ledger (#3124)

Isolated one-time utility. All paths in this folder only. Do **not** merge to `main` unless Product later gives an explicit `main` Go.

**This app runs on your machine from the git checkout.** It does not run from Google Drive. Drive is only an optional place to store the finished PDF files after they are generated.

## Commands

From the repository root, with `TZ=UTC LC_ALL=C`:

```text
PYTHONPATH=tools python3 tools/skeetersoft/run.py test
PYTHONPATH=tools python3 tools/skeetersoft/run.py compile --out tools/skeetersoft/out
PYTHONPATH=tools python3 tools/skeetersoft/run.py pilot --out tools/skeetersoft/out
PYTHONPATH=tools python3 tools/skeetersoft/run.py full
PYTHONPATH=tools python3 tools/skeetersoft/run.py pdf
```

`pilot` runs unit tests and the synthetic 1985 fixtures.

`full` downloads Retrosheet 1976–1985 event files into `input/cache/` (not committed), compiles starting lineups, and writes the print PDFs under `out/full/ledger-YYYY.pdf`.

`pdf` rebuilds those PDFs from already-compiled season JSON without downloading again.

## Print output

The print deliverable is **PDF**, one file per season:

- `tools/skeetersoft/out/full/ledger-1976.pdf`
- …
- `tools/skeetersoft/out/full/ledger-1985.pdf`

HTML/JSON next to those files are working intermediates. Copy the PDFs wherever you print or archive them. Google Drive is not required to create or open them.

## Rollback

Delete or revert `tools/skeetersoft/**` on `sandbox/skeetersoft-replay-ledger`.
