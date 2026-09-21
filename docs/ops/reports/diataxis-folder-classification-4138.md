---
Doc Type: Report
Audience: Product Authority, PMO, Engineering, and implementation agents
Authority Level: Program Evidence
Owns: Frozen #4138-001 folder-classification table and Product confirmation record for DIATAXIS vs authorized-adjacent vs undecided `docs/` folders
Does Not Own: File moves; CI wiring; Task-4 rules migration; disposition-map extension; a 621-file rewrite
Canonical Reference: /docs/governance/standards/DIATAXIS-FOLDER-AUTHORITY.md
Related Issues: #4138, #4196, #4137, #2486
Last Reviewed: 2026-09-21
---

# DIATAXIS folder classification freeze (#4138-001)

## Purpose

Record the canonical folder-classification table for program #4138 child #4196. This freeze is documentation only. It does not move, delete, or archive live files.

## Scope

In scope: classification of top-level `docs/` folders into DIATAXIS core, authorized adjacent, and undecided, plus explicit later-child dispositions for `as-built/`, `postmortems/`, `reports/`, and `templates/`.

Out of scope: migrating the ~621-file tree; deleting live docs; wiring CI (#4197); moving Task-4 binding rules (#4198); extending the two-model disposition map (#4199); mixing #4135 naming work.

## Current known truth

- Product Graduation **GO** 2026-09-20 placed parent #4138 Active at `pmo:priority:6` with Cursor as implementation owner. First executable child is #4196.
- Product assignment of #4138 on 2026-09-21 authorizes this freeze using the launch-package table. No amendment is recorded on #4196.
- Live inventory on 2026-09-21: `docs/as-built/` 7 files, `docs/postmortems/` 2 files, `docs/reports/` 3 files, `docs/archive/` 11 files, `docs/templates/` 12 files. DIATAXIS cores `tutorials/`, `how-to/`, `reference/`, `explanation/` are present.
- `docs/archive/` remains a permanent top-level sibling. It is not nested inside a DIATAXIS type folder.
- This child does not declare migration complete.

## Intended final state

`docs/governance/standards/DIATAXIS-FOLDER-AUTHORITY.md` lists `templates/` in Structure and states the same classification table. Later children execute CI, Task-4, and map work against this freeze. File moves wait for the child that owns them.

## Product confirmation

| Decision | Record |
| --- | --- |
| Confirm or amend the folder table | Confirmed as written. No amendment on #4196. |
| `docs/archive/` placement | Permanent top-level sibling, not nested. |
| This child moves files | No. |

## Frozen classification table

| Folder | Classification | Disposition (this freeze) |
| --- | --- | --- |
| `docs/tutorials/` | DIATAXIS core | Retain |
| `docs/how-to/` | DIATAXIS core | Retain |
| `docs/reference/` | DIATAXIS core | Retain |
| `docs/explanation/` | DIATAXIS core | Retain |
| `docs/governance/` | Authorized adjacent, permanent | Retain |
| `docs/ops/` | Authorized adjacent, permanent | Retain; later reclassification pass for rules/authority content per #4137, not this child |
| `docs/archive/` | Authorized adjacent, permanent sibling | Retain at top level |
| `docs/templates/` | Authorized (Model C write surface) | Retain; add to the Structure list in folder-authority (this child) |
| `docs/as-built/` (7 files) | Undecided | Fold into `docs/reference/` in a later child after the map names the rows. No move here. |
| `docs/postmortems/` (2 files) | Undecided | Fold into `docs/ops/incident-response/` in a later child after the map names the rows. No move here. |
| `docs/reports/` (3 files) | Undecided, duplicates `docs/ops/reports/` | Merge into `docs/ops/reports/` and remove the top-level duplicate in a later child. No move here. |

## Inventory named by this freeze

### `docs/as-built/` (fold into `docs/reference/` later)

- `accelerated-webpage-implementations-log.md`
- `cloudflare-frontend.md`
- `DEPLOYMENT_GUIDE.md`
- `DOCS_CLEANUP_RECORD_2026-02-17.md`
- `RECONCILIATION-NOTES_2026-02.md`
- `weekly-matchup-auto-rotation.md`
- `weekly-matchup-photo-url-normalization.md`

### `docs/postmortems/` (fold into `docs/ops/incident-response/` later)

- `2025-11-white-screen.md`
- `2026-05-11-reviewer-gate-incident.md`

### `docs/reports/` (merge into `docs/ops/reports/` later)

- `2025-12-28-repo-cleanup.md`
- `documentation-inventory-report-1132.md`
- `program-1-diataxis-transition-status.md`

## What later children own

| Child | Owns |
| --- | --- |
| #4197 | Required header and canonical-hash CI |
| #4198 | Task-4 binding-authority moves into `docs/governance/` |
| #4199 | Two-model disposition-map rows for remaining undecided inventory |

## Protected stops

Do not migrate the ~621-file tree in this child. Do not delete live docs without the recorded later-child disposition. Do not mix workflow/CI into this docs-only PR.
