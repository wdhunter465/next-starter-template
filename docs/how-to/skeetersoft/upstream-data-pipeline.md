---
Doc Type: How-To
Audience: Project maintainers and future SKEETERSOFT implementers
Authority Level: Procedure
Owns: SKEETERSOFT upstream data pipeline placement, output path, print bridge requirements, and review checklist
Does Not Own: LGFC production website behavior, launch scope, application runtime implementation, or source-data licensing decisions
Canonical Reference: docs/how-to/skeetersoft/upstream-data-pipeline.md
Last Reviewed: 2026-05-31
---

# SKEETERSOFT Upstream Data Pipeline

## Purpose

SKEETERSOFT is a side project temporarily documented inside the LGFC repository. This document captures the intended repository layout, script placement, generated output location, Next.js print bridge, and review expectations for the upstream schedule clustering and name-collision compilation pipeline.

This documentation is stored under the Diataxis how-to section because it describes an operational implementation path rather than LGFC website design authority.

## Execution

This document is design-stage guidance only. Do not create runtime SKEETERSOFT files from this document until SKEETERSOFT receives explicit implementation approval after LGFC website and repository buildout completion.

When implementation is approved, execute the work in this order:

1. Add the compiler at `scripts/compile_ledger.py`.
2. Add or generate output at `data/master_print_stream.json`.
3. Add the scoresheet layout component at `src/components/ScoresheetPrintLayout.tsx`, or update the route to import an approved existing scoresheet component.
4. Add the print route at `src/app/print/page.tsx`.
5. Add global print CSS support in `src/app/globals.css`.
6. Verify the compiler uses real ingested source data rather than mock data.

## Repository Layout

The intended final structure is:

```text
├── data/
│   └── master_print_stream.json
├── scripts/
│   └── compile_ledger.py
└── src/
    ├── app/
    │   ├── globals.css
    │   ├── page.tsx
    │   └── print/
    │       └── page.tsx
    └── components/
        └── ScoresheetPrintLayout.tsx
```

## Script Location

Place the Python compilation script at:

```text
scripts/compile_ledger.py
```

The `scripts` folder houses executable project utilities and keeps compilation logic separate from application code.

## Output Location

The compiled static JSON output should be written to:

```text
data/master_print_stream.json
```

The `data` folder keeps generated static artifacts separate from script logic and provides a stable import/read path for later build-phase use.

## Required Output Path Update

When the script is finalized for execution, update the output section to write into the root-level `data` folder:

```python
# Output path for the static Next.js assets
output_filename = "data/master_print_stream.json"

# Ensure the directory exists before writing to prevent errors
os.makedirs(os.path.dirname(output_filename), exist_ok=True)

with open(output_filename, "w") as outfile:
    json.dump(compiled_stream, outfile, indent=2)
```

## Pipeline Scope

The script is expected to provide:

- Upstream schedule ingestion.
- Roster name optimization.
- Last-name collision handling, including preserving first initials only where needed.
- Multi-token surname handling, such as `Van Slyke`.
- Starting pitcher surname normalization.
- Sequential series clustering.
- Deterministic sort order by series start date, then home team.
- Static JSON export for printer/PDF layout workflows.

## Missing Piece 1: Real Ingested Data

The current Python prototype uses a `mock_raw_data` array for testing. A complete implementation must replace that test array with a file reader that ingests the actual raw source file, such as a 1985 schedule CSV or Retrosheet-derived text file.

The implementation should keep mock data out of production flow and make source input explicit.

## Missing Piece 2: Next.js Print Page

The intended print route is:

```text
src/app/print/page.tsx
```

The print page should import the compiled JSON and map each game into the scoresheet layout component. The scoresheet component must be created or selected before adding the route; do not leave the route pointed at a component that does not exist.

Reference wrapper:

```tsx
import React from 'react';
import masterPrintStream from '../../../data/master_print_stream.json';
import ScoresheetPrintLayout from '@/components/ScoresheetPrintLayout';

export default function PrintPage() {
  return (
    <div className="bg-white min-h-screen">
      {masterPrintStream.map((series) => (
        <div key={`${series.Series_Start_Date}_${series.Home_Team}`}>
          {series.Series_Games.map((game) => (
            <div
              key={game.Season_Game_Number}
              className="break-after-page"
            >
              <ScoresheetPrintLayout game={game} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

## Missing Piece 3: Global Print CSS

The global stylesheet should define print page-break behavior.

Target file:

```text
src/app/globals.css
```

Reference CSS:

```css
@media print {
  body {
    background: white;
    color: black;
  }

  .break-after-page {
    page-break-after: always !important;
    break-after: page !important;
  }
}
```

## Review Checklist

- [ ] Script lives at `scripts/compile_ledger.py`.
- [ ] Generated JSON writes to `data/master_print_stream.json`.
- [ ] Mock data is replaced by explicit raw schedule ingestion before production use.
- [ ] Scoresheet component lives at `src/components/ScoresheetPrintLayout.tsx`, or the print route imports another approved existing scoresheet component.
- [ ] Print route lives at `src/app/print/page.tsx`.
- [ ] Print route imports `data/master_print_stream.json` by relative path or approved alias.
- [ ] Print route maps each series and game to an implemented scoresheet component.
- [ ] Global CSS contains print-safe page-break rules.
- [ ] No dependencies outside standard Python libraries for the compiler.
- [ ] Multi-token surnames are preserved correctly.
- [ ] Same-last-name collisions preserve first initials.
- [ ] Starting pitcher surnames are normalized consistently.
- [ ] Series sorting is deterministic.

## Status

This document records the intended SKEETERSOFT side-project structure. The folder names are preferred, not hard locks. If the implementation needs variants later, update this document and the Python script together.
