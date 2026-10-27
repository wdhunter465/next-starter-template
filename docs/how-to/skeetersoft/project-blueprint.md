---
Doc Type: How-To
Audience: Project maintainers and future SKEETERSOFT implementers
Authority Level: Procedure
Owns: SKEETERSOFT project folder placement, design status, launch deferral, and future implementation targets
Does Not Own: LGFC production website behavior, active LGFC launch scope, runtime implementation, or generated project artifacts
Canonical Reference: docs/how-to/skeetersoft/project-blueprint.md
Last Reviewed: 2026-05-31
---

# SKEETERSOFT project blueprint

## Status

SKEETERSOFT is a side project in design and requirements discussion only.

It is not ready to launch. Launch is deferred until after the LGFC website and repository buildouts are completed.

## Execution

This document controls design-stage project organization only. Do not add SKEETERSOFT runtime code, generated output files, or production routes until LGFC website and repository buildouts are complete and SKEETERSOFT receives explicit implementation approval.

During the design stage, execute SKEETERSOFT documentation work in this order:

1. Keep all SKEETERSOFT files under `docs/how-to/skeetersoft/`.
2. Record requirements and design decisions in project-specific documents.
3. Keep runtime paths documented as future targets only.
4. Do not mix SKEETERSOFT implementation with LGFC launch-critical work.
5. Revisit launch readiness only after the LGFC website and repository buildouts are complete.

## Repository Placement

All SKEETERSOFT project material should be kept under this project folder while design is still in progress:

```text
docs/how-to/skeetersoft/
```

This keeps SKEETERSOFT data and requirements separated from active LGFC website implementation work.

## Intended Future Runtime Structure

When SKEETERSOFT moves from design to implementation, the expected application structure is:

```text
├── data/
│   └── master_print_stream.json
├── scripts/
│   └── compile_ledger.py
└── src/
    └── app/
        ├── globals.css
        ├── page.jsx
        └── print/
            └── page.jsx
```

Until launch planning begins, these runtime files should remain design targets, not required live implementation files.

## project objective

Build an upstream schedule compilation pipeline that prepares baseball replay ledger data for deterministic static PDF/print rendering.

The pipeline will eventually:

- Ingest raw schedule/source data.
- Normalize roster and pitcher names.
- Preserve initials only when last-name collisions exist.
- Preserve multi-token surnames.
- Cluster games into series blocks.
- Sort series chronologically and by home team.
- Emit `master_print_stream.json`.
- Feed a Next.js print dashboard/page.

## Current Design Requirements

### Compiler

Preferred future path:

```text
scripts/compile_ledger.py
```

The Python compiler should remain standard-library only unless a later design decision explicitly approves dependencies.

### Output Data

Preferred future path:

```text
data/master_print_stream.json
```

The output file is intended for static import or build-time read by the Next.js print route.

### Print Route

Preferred future path:

```text
src/app/print/page.jsx
```

The print page will map each series and each game to a scoresheet component.

### Global Print CSS

Preferred future path:

```text
src/app/globals.css
```

The stylesheet must include print-safe page break behavior for PDF generation.

## Deferred Launch Rule

Do not treat SKEETERSOFT as an active LGFC launch dependency.

No SKEETERSOFT runtime routes, generated data files, or production scripts should be added to the active LGFC application until the LGFC website and repository buildouts are completed and SKEETERSOFT receives its own implementation approval.

## Governance Notes

- This is project data, not LGFC production behavior.
- Keep SKEETERSOFT work isolated in the SKEETERSOFT folder during design.
- Future implementation PRs should be scoped one step at a time.
- Do not mix SKEETERSOFT launch work with LGFC launch-critical work.
