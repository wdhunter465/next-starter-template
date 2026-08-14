---
Doc Type: Report
Audience: Bill, ChatGPT, Cursor, LGFC maintainers, and reviewers
Authority Level: Program Evidence
Owns: Program #2040 Task 002 (#2050) publication state model, approval authority, legal transitions, required public-path metadata, and fail-closed stop conditions
Does Not Own: Runtime implementation, admin UI, scheduled-publication mechanics (#2052), audit/rollback procedures (#2053), safety CI (#2054), Task 007 slices (#2055), or public publication
Canonical Reference: /docs/ops/implementation-plans/website-automatic-content-publication-capability.md
Related Issues: #2040, #2050, #2049, #2051, #1738, #2039, #3157, #2273, #2286
Last Reviewed: 2026-08-14
---

# Program #2040 Task 002 — Publication state model and approval authority

## Purpose

Define the operational publication states, who may move content between them, required metadata before any public-path transition, and fail-closed stop conditions.

This is **design-time only**. It does not publish content, write D1, or change routes.

## Scope

This report covers Task 002 (#2050) only:

- the nine required operational states;
- mapping onto existing candidate, publication-prep, and `content_inventory` fields;
- approval authority for each transition;
- required metadata before public exposure;
- fail-closed stops for missing source, credit, rights, or review data.

It does not implement Task 003 admin surfaces, Task 004 scheduling, Task 005 audit/rollback, Task 006 CI, or Task 007 runtime slices.

## Intended final state

After Task 002 is accepted:

- every public-path transition has a named state, actor, and metadata gate;
- human approval is required before `published`;
- software may block illegal jumps and must not grant publication authority;
- Task 003 may design admin review/rotation surfaces against this model.

## Current known truth

| Field | Value |
| --- | --- |
| Source issue | #2050 (Task 002 of Program #2040) |
| Predecessor | #2049 Task 001 inventory on `main` via PR #3466 / #3469 |
| Implementation start | `7876c24c` (`origin/main`); branch `cursor/2050-publication-state-model-2e48`; allowlist is this report only |
| Existing prep model | `docs/reference/content/content-publication-prep-model.md` — approval ≠ published |
| Existing candidate schema | `docs/reference/website/lou-gehrig-content-metadata-schema.md` |
| Public helper rule | `content_inventory.status = published` plus source, credit, `allowed_sections`, and no rights/privacy block |
| Human approval | Mandatory before public publication (`approved_by` / `approved_at`) |
| Real trial rows | Still absent; #3157 remains the gate before Task 007 |

## Operational states

These nine states are the Program #2040 operational vocabulary. They map onto existing fields; they do not replace `content_inventory.status` at runtime in this task.

| State | Meaning | Maps toward |
| --- | --- | --- |
| `draft` | Lead or copy exists; not ready for operator preview | candidate `review_status = candidate` / prep `draft_candidate` |
| `staged` | Operator preview only; no public route | prep `staged`; admin `/admin/clubstaging` or pipeline preview |
| `reviewed` | Human review of provenance, rights, credit, factual, and privacy completed | candidate `approved-for-reference` or `approved-for-public-copy` with `reviewer` / `reviewed_at` |
| `approved` | Named human authority signed off for a specific publication target | prep `approved_for_publish` with `approved_by` / `approved_at` |
| `scheduled` | Approved and queued for a future public transition | no current runtime field; Task 004 owns the mechanism |
| `published` | Live on an allowed public surface | `content_inventory.status = published` |
| `archived` | Inactive retained record; not on public surfaces | prep `archived` |
| `rejected` | Must not be used; reason required | candidate `review_status = rejected` |
| `unpublished` | Was public; withdrawn from public surfaces | prep `unpublished`; inventory no longer `published` |

Core rule: **approved ≠ published**. `scheduled` is still not public.

## Approval authority

Software may **block** or **prompt**. It must not decide source truth, rights, privacy, wording, or public publication.

| Actor | May set | Must not set alone |
| --- | --- | --- |
| Capturing editor | `draft` | any public-path state |
| Reviewing editor | `staged`, `reviewed`, `rejected` (with reason) | `approved`, `scheduled`, `published` |
| Product Authority / Bill (or a named delegate recorded on the Issue) | `approved`, `scheduled`, `published`, `unpublished`, `archived` | nothing that skips required metadata |
| Automation | reject illegal transitions; fail closed | `approved`, `published`, or any public exposure |

`reviewed` is editorial completeness. `approved` is the recorded publication decision for a named target. Both are required before `published`.

Self-approval of public publication is prohibited: the actor who records `approved_by` must not be the only verifier of the live public result when Task 007 later implements slices.

## Legal transitions

| From | To | Authority | Gate |
| --- | --- | --- | --- |
| `draft` | `staged` | reviewing editor | required candidate metadata present |
| `draft` | `rejected` | reviewing editor | `rejection_reason` |
| `staged` | `reviewed` | reviewing editor | provenance, rights, credit, factual, privacy complete |
| `staged` | `draft` | reviewing editor | none |
| `staged` | `rejected` | reviewing editor | `rejection_reason` |
| `reviewed` | `approved` | Product Authority / Bill | `approved_by`, `approved_at`, publication target |
| `reviewed` | `staged` or `draft` | reviewing editor | none |
| `reviewed` | `rejected` | reviewing editor or Product Authority | `rejection_reason` |
| `approved` | `scheduled` | Product Authority / Bill | Task 004 schedule fields when that task exists |
| `approved` | `published` | Product Authority / Bill | public-path metadata + inventory conversion |
| `approved` | `unpublished` / `archived` / `rejected` | Product Authority / Bill | reason recorded |
| `scheduled` | `published` | Product Authority / Bill or a later authorized scheduler that still requires the recorded approval | public-path metadata; approval must already exist |
| `scheduled` | `approved` | Product Authority / Bill | pause/cancel schedule |
| `published` | `unpublished` | Product Authority / Bill | audit reason; Task 005 owns recovery detail |
| `published` | `archived` | Product Authority / Bill | audit reason |
| `unpublished` | `archived` | Product Authority / Bill | none beyond audit |
| `unpublished` | `approved` | Product Authority / Bill | re-approval; do not jump to `published` |
| `archived` | `draft` | Product Authority / Bill | explicit reopen |
| `rejected` | `draft` | Product Authority / Bill | explicit reopen; prior rejection retained |

Illegal examples (must fail closed): `draft` → `published`; `staged` → `published`; `reviewed` → `published`; `rejected` → `published`; any jump that skips `approved_by` / `approved_at`.

## Required metadata before public-path transition

Public-path means `scheduled` → `published` or `approved` → `published`.

- `candidate_id`, `title`, `content_type`
- `source_title`, `source_owner`, `source_citation` (and `source_url` when available)
- `acquisition_method`, `date_accessed`
- `rights_status`, `credit_line`
- `provenance_confidence`, `factual_confidence`
- `privacy_flag` and privacy-review status when flagged
- `editorial_use_candidate`, `review_status`
- `reviewer`, `reviewed_at`
- `approved_by`, `approved_at`
- publication target / matching `allowed_sections`
- For live inventory: `content_inventory.status = published`, source name, credit line, matching `allowed_sections`, and not blocked by rights/privacy flags
- `rejection_reason` when `rejected`

Missing any required public-path field **fails closed**. `approved-for-public-copy` is not sufficient without `approved_by` / `approved_at`.

## Fail-closed stop conditions

Stop the affected transition (not the whole program) when:

- source, credit, rights, or review data is missing or `unknown` where public copy is requested;
- privacy flag is `minors` (default-reject for public) or unresolved living-person/donor risk;
- `rights_status` is `permission-needed`, `rejected`, or `link-only` for a public-copy target;
- `approved_by` / `approved_at` is missing;
- proposed inventory `status` is `published` while operational state is not `approved` or `scheduled`;
- `allowed_sections` includes a public surface the approval target did not name;
- duplicate `canonical` tag collision or unexpected field drift (existing Dev fail-closed pattern);
- Task 007 runtime is attempted before #3157 records real trial rows.

## Explicit non-goals of this task

- No application, workflow, migration, or route changes.
- No fill-in of `changeWindowStart` or other Production deployment fields.
- No start of Task 003 in this PR (one issue, one PR; stage-before-merge).
- No public publication.

## Successor

#2051 — Admin staged-content review and rotation control surface design, after this Task 002 PR is independently reviewed and merged.
