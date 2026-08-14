---
Doc Type: Report
Audience: Bill, ChatGPT, Cursor, LGFC maintainers, and reviewers
Authority Level: Program Evidence
Owns: Program #2040 Task 001 (#2049) provisional publication-support candidate inventory, mandatory manual gates, required metadata list, and Task 002 proceed/hold decision
Does Not Own: Runtime implementation, public publication, #3157 real-content trials, merge authority, or Task 002 state-model design
Canonical Reference: /docs/ops/implementation-plans/website-automatic-content-publication-capability.md
Related Issues: #2040, #2049, #1738, #2039, #2043, #2050, #3157, #2273, #2286
Last Reviewed: 2026-08-14
---

# Program #2040 Task 001 — Publication candidate inventory

## Purpose

Record Task 001 (#2049) review of Program #1738 manual-workflow evidence and classify which content-publication support steps are appropriate candidates for later software assistance.

This inventory is **provisional and design-time only**. Real Gehrig trial rows were never populated. Runtime implementation (#2055) remains gated on #3157.

## Current known truth

| Field | Value |
| --- | --- |
| Source issue | #2049 (Task 001 of Program #2040) |
| Implementation start | `5122028e` (`origin/main` 2026-08-14); branch `cursor/2049-task-001-inventory-2e48`; allowlist is this report only |
| Program Go | 2026-08-07 on #2040; Product Authority resumed remaining non-prod website implementation on 2026-08-14 (human approval still mandatory before public publication) |
| Predecessor | #1738 closed/completed 2026-08-07 |
| Admin staging surface | `/admin/clubstaging` delivered by #2043 (closed) |
| Content-pipeline runtime | #2273/#2286 artifacts on `main` (`functions/api/admin/content-pipeline/**`) |
| Real trial evidence | **Not present.** `docs/ops/reports/lou-gehrig-content-manual-workflow-evidence.md` trial, candidate, and pain-point rows are blank; handoff recommendation is unset |
| Candidate registry on `main` | `data/research/lou-gehrig-content-candidates.json` — `content_evidence_level: synthetic_demo_only`, `registry_purpose: workflow_fixture` |
| Task 001 scope used | 2026-08-07 Issue comment: classify from #1738 procedure/schema/review-rule docs; do not pretend that is operational trial evidence |
| #3157 | Required predecessor to Task 007 (#2055) only; does not block Tasks 002–006 |

## Evidence reviewed

| Artifact | Role |
| --- | --- |
| `docs/ops/reports/lou-gehrig-content-manual-workflow-evidence.md` | Intended #1738 trial ledger — unfilled template |
| `docs/how-to/website/lou-gehrig-content-intake.md` | Manual intake and staging stages |
| `docs/how-to/website/lou-gehrig-source-provenance-review.md` | Provenance, rights, credit, factual, privacy procedure |
| `docs/reference/website/lou-gehrig-content-metadata-schema.md` | Required candidate fields and review statuses |
| `docs/reference/website/lou-gehrig-rights-privacy-publication-review.md` | Clearance states and no-publish conditions |
| `docs/reference/website/lou-gehrig-editorial-conversion-workflow.md` | Conversion stages 1–4; stage 5 needs separate authorization |
| `docs/reference/content/content-publication-prep-model.md` | Approval ≠ published; public helper must fail closed |
| `docs/ops/pmo/website-automatic-content-publication-capability.md` | Program readiness package |
| `docs/ops/implementation-plans/website-automatic-content-publication-capability.md` | Child-task sequence |
| `src/app/admin/clubstaging/page.tsx` | Existing admin-only staging route (dependency, not edited here) |

## Manual workflow (as designed)

From the intake how-to, the proven **procedure** (not yet proven with real rows) is:

1. Source discovered through an approved channel.
2. Lead captured as metadata (`candidate_id`); no wholesale copy into the repo.
3. Schema fields populated.
4. Provenance, rights, credit, factual, and privacy review completed.
5. Editorial candidate created (`approved-for-reference` or `approved-for-public-copy`).
6. Staging decision recorded (`draft-editorial` / `staging-preview` / `publication-ready`).
7. Publication candidate or rejection recorded.
8. Evidence retained for #2040.

Public inventory publication (intake stage “published” / editorial stage 5) is **outside** #1738 and remains a later authorized slice.

## Candidate publication-support steps (software-assist)

These steps may be assisted by software in later approved slices. They must **fail closed** and must not grant publication authority.

| ID | Step | Assist type | Notes |
| --- | --- | --- | --- |
| A1 | Metadata completeness checks | Deterministic validation | Required schema fields present before any public-path transition |
| A2 | Missing-source / missing-credit detection | Deterministic validation | Block public exposure when `source_*` or `credit_line` empty |
| A3 | Required status-transition validation | Deterministic state machine | Reject illegal jumps (for example `candidate` → `published`) |
| A4 | Candidate table / evidence-report generation | Operator tooling | Format and export; no auto-approve |
| A5 | Admin list/filter of staged candidates | Admin UI on existing pipeline | Reuse #2286 candidates API; do not rebuild |
| A6 | Club-staging preview of approved samples | Existing `/admin/clubstaging` | Sample/rotation preview only until Task 003/004 design |
| A7 | Publication-prep staging record | Admin tooling | Separate approval from live `content_inventory.status = published` |
| A8 | CI/ops checks for public-route exposure | Fail-closed gates | Later Task 006 (#2054); require published + credit + source + allowed section |

## Mandatory manual review gates

These must remain human-controlled. Software may **block** or **prompt**; it must not decide.

| Gate | Owner | Must remain manual |
| --- | --- | --- |
| Source truth / provenance authenticity | Editor + Bill/ChatGPT on ambiguity | Yes |
| Rights / copyright / license acceptance | Editor + Bill/ChatGPT on ambiguity | Yes |
| Privacy / living-person / minors / donor | Editor; minors default-reject for public | Yes |
| Final public-copy wording | Human editor | Yes |
| Public publication approval | Human authority recorded (`approved_by` / equivalent) | Yes |
| Uncontrolled scraping / OCR / AI enrichment at scale | Out of program scope | Unsafe — do not assist |
| Automatic public publication | Explicit non-goal of #2040 | Forbidden |

## Required metadata for publication support

Minimum fields before any public-path transition (from the #1738 schema plus publication-prep model):

- `candidate_id`, `title`, `content_type`
- `source_title`, `source_owner`, `source_citation` (and `source_url` when available)
- `acquisition_method`, `date_accessed`
- `rights_status`, `credit_line`
- `provenance_confidence`, `factual_confidence`
- `privacy_flag` and privacy-review status when flagged
- `editorial_use_candidate`, `review_status`
- `reviewer`, `reviewed_at` when leaving `candidate`
- `rejection_reason` when rejected
- For public inventory: `content_inventory.status = published`, matching `allowed_sections`, and not blocked by rights/privacy flags

Missing any required public-path field **fails closed**.

## Decision for Task 002

**Proceed to Task 002 (#2050)** — publication state model and approval authority design — on this provisional classification.

Rationale:

- #1738 delivered a complete **procedure and schema** package; that is enough to design states, authority, and fail-closed rules without encoding unproven trial metrics.
- The blank trial ledger and synthetic fixture registry are **timing**, not a design-package defect. They are tracked as #3157.
- Human approval before public publication remains a hard program boundary.
- Runtime slices (#2055) stay blocked until #3157 records real candidates reviewed through the existing content-pipeline admin API.

Handoff recommendation equivalent: **ready with exceptions** — exception is “no real trial rows yet; #3157 owns that gate before implementation.”

## Explicit non-goals of this task

- No application, workflow, migration, or route changes.
- No fill-in of synthetic fixture rows as if they were real Gehrig content.
- No project-manifest file (recommended before Task 007; not required to finish Task 001).
- No start of Task 002 in this PR (one issue, one PR; stage-before-merge).

## Successor

#2050 — Publication state model and approval authority design, after this Task 001 PR is independently reviewed and merged.
