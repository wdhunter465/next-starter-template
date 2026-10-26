---
Doc Type: Reference
Audience: LGFC maintainers, Governance, Bill, and implementation agents
Authority Level: Controlled
Owns: D1/B2/storage boundary model for Lou Gehrig content candidates without implementing ingestion
Does Not Own: Migrations, API implementation, admin UI, or B2 uploads
Canonical Reference: /docs/reference/architecture/fan-club-data-surface-inventory.md
Related issues: #1738, #1744, #1685
Last Reviewed: 2026-10-26
---

# Lou Gehrig Content Data Surface Boundary

## Purpose

Define storage, naming, and indexing boundaries for Lou Gehrig content candidates
without implementing large-scale ingestion.

## Candidate record naming convention

| Element | Convention | Example |
| --- | --- | --- |
| Prefix | `lgfc-gehrig-` | `lgfc-gehrig-2026-001` |
| ID body | `{year}-{sequence}` | zero-padded sequence per year |
| Document files | `{candidate_id}.md` in operator tracker only | not in repo for copyrighted material |
| Notes | append-only operator notes field | in metadata schema |

Phase 1 uses operator-managed records (spreadsheet, issue tracker, or future admin
surface). No D1 table is authorized by #1738.

## Media and reference handling

| Asset type | Storage rule |
| --- | --- |
| LGFC-owned photos | Existing `photos` / B2 path when authorized by separate task |
| External images | Link/citation only in Phase 1; no binary import without rights |
| PDFs / documents | External citation; no paywalled copies in repo |
| Audio/video | Link-only unless LGFC-owned and separately authorized |
| Research notes | Operator workspace; internal reference tier only |

## D1 boundary

Current D1 surfaces relevant to future Gehrig content:

| Table | Phase 1 use | Future candidate (deferred) |
| --- | --- | --- |
| `submission_queue` | Member/editor intake | Gehrig leads may enter existing queue |
| `content_inventory` | Published stories | Destination after editorial conversion |
| `photos` | Gallery/memorabilia | Media after rights clearance |
| `library_entries` | Legacy reads | Migration path per content inventory model |

**No new D1 tables** are authorized by Program #1738 Task 006.

A future `research_candidates` or equivalent table requires a separate child issue
with migration authorization and Project 11 admin/tools alignment.

## B2 boundary

B2 stores LGFC-managed media binaries per `docs/reference/platform/Backblaze_B2.md`.
Phase 1 Gehrig collection does not authorize B2 uploads for external archive material.

## External link/citation only

Must remain external (no local binary storage):

- paywalled articles;
- institution catalog entries;
- social media references (generally disallowed as sources);
- third-party photos without license;
- newspaper scans without reproduction rights.

## Local storage allowance

May be stored locally in repository **only** when:

- LGFC-created operator documentation (this program's docs);
- LGFC-owned media already in approved asset paths;
- redacted operator evidence templates without third-party copyrighted body text.

May **not** be stored:

- wholesale copyrighted text;
- scraped page dumps;
- unlicensed image binaries.

## Evidence retention for #2040

Retain in operator evidence reports:

- candidate metadata exports;
- review decision history;
- rejection reason statistics;
- staging preview notes;
- automation pain points.

Location: `docs/ops/reports/lou-gehrig-content-manual-workflow-evidence.md` and
Task 008 handoff report.

## Project 11 dependency

Admin page and tools design readiness (Project 11) remains ahead of any admin UI
implementation for research queue management. This task inventories needs only.

## Acceptance checklist

- [x] Candidate naming convention defined
- [x] D1/B2 boundary documented
- [x] External-only rules documented
- [x] No code changes in this task
