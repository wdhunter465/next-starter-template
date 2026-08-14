---
Doc Type: Report
Audience: Bill, ChatGPT, Cursor, LGFC maintainers, and reviewers
Authority Level: Program Evidence
Owns: Program #2040 Task 003 (#2051) admin staged-content review and rotation-control surface design, staging-to-public movement, and public exposure boundaries
Does Not Own: Runtime UI implementation, scheduled-publication mechanics (#2052), audit/rollback (#2053), safety CI (#2054), Task 007 slices (#2055), or public publication
Canonical Reference: /docs/ops/implementation-plans/website-automatic-content-publication-capability.md
Related Issues: #2040, #2051, #2050, #2043, #2049, #2052, #2039, #3157, #2273, #2286
Last Reviewed: 2026-08-14
---

# Program #2040 Task 003 — Admin staged-content review and rotation-control surfaces

## Purpose

Design the admin review and rotation-control surfaces that build on `/admin/clubstaging` and the Task 002 state model, so staged content can be reviewed before any approved public placement.

This is **design-time only**. It does not add routes, write D1, or publish content.

## Scope

This report covers Task 003 (#2051) only:

- staged-content review surfaces;
- rotation-control requirements;
- movement from staging to approved public placement using Task 002 states;
- public and member route exposure boundaries.

It does not implement Task 004 scheduling, Task 005 audit/rollback, Task 006 CI, or Task 007 runtime.

## Intended final state

After Task 003 is accepted:

- operators have a named admin path to list, preview, and review staged candidates;
- rotation is controlled and visible before public placement;
- staging → `reviewed` → `approved` → `published` is explicit;
- public routes still read only published inventory;
- Task 004 may plan schedule and rotation timing against this surface design.

## Current known truth

| Field | Value |
| --- | --- |
| Source issue | #2051 (Task 003 of Program #2040) |
| Predecessor | #2050 merged PR #3470 (`950cc3c0`); #2043 closed (`/admin/clubstaging`) |
| Implementation start | `950cc3c0`; branch `cursor/2051-admin-review-rotation-surfaces-2e48`; allowlist is this report only |
| Existing staging route | `/admin/clubstaging` — admin-only visual preview of **sample** club content; banner states it is not published |
| Existing candidate API | `functions/api/admin/content-pipeline/candidates/**` — ADMIN_TOKEN list/review; not wired into clubstaging |
| Placement/rotation reference | `docs/reference/website/editorial-placement-and-rotation.md` |
| State model | `docs/ops/reports/program-2040-task-002-publication-state-and-authority.md` |
| Human approval | Mandatory before public publication |

## Existing surfaces (do not rebuild)

| Surface | Role now | Task 003 use |
| --- | --- | --- |
| `/admin/clubstaging` | Production-like Club Home preview with fixture samples | Keep as **preview frame**. Later Task 007 may bind real staged rows; do not replace with a second preview shell |
| `/admin/homestaging` | Reserved, not implemented (#2043) | Out of this task; homepage staging remains reserved |
| Content-pipeline candidates API | Admin list/filter/review of candidates | Reuse for the staged-candidate table; do not invent a parallel candidate store |
| Public/member routes | Published `content_inventory` only | Unchanged; staging must never populate them |

## Staged-content review requirements

Later implementation (Task 007) must add an **admin-only** review workspace that is not a public route. Preferred attachment: extend `/admin/clubstaging` (or an adjacent admin path under `/admin/`) rather than a new public URL.

Required capabilities:

1. **List/filter staged candidates** from the existing pipeline API (`staged` / `reviewed` operational states; exclude `rejected` unless an explicit reject-queue view).
2. **Show required metadata** from Task 001/002: source, credit, rights, privacy, reviewer, `approved_by` when present, publication target / intended `allowed_sections`.
3. **Preview** the candidate in the existing clubstaging production-like frame **without** writing `content_inventory.status = published`.
4. **Record review outcome**: remain `staged`, move to `reviewed`, or `rejected` with `rejection_reason`. Editors may do these; they must not set `published`.
5. **Fail closed** if source, credit, rights, or privacy data is missing — the preview may still render with a blocking banner, but the `reviewed` action must refuse.
6. **Admin auth only** (`requireAdmin` / existing AdminNav gating). No member or anonymous access.

The current fixture banner copy remains true until Task 007 binds real rows: sample content on `/admin/clubstaging` is not published.

## Rotation-control requirements

Rotation here is **editorial placement among staged/approved rows**, not the Task 004 clock. Controls must be visible in the admin review surface before public placement.

| Control | Meaning | Must not |
| --- | --- | --- |
| Intended `allowed_sections` | Target surfaces (`library`, `search`, `archive`, `club_home`, homepage keys, and so on) | Publish the row |
| `priority` | Order within one eligible surface | Override holds or missing approval |
| `story_type` | `primary` / `secondary` / `brief` treatment intent | Change public layout by itself |
| Canonical vs alternate | Default public choice is canonical | Silently replace canonical |
| Hold / pause | Keep staged or approved but not selectable for rotation | Be the same as `unpublished` |
| Preview rotation set | Operator sees the ordered set that **would** appear if published | Call public helpers with unpublished rows |

Priority and section keys follow `docs/reference/website/editorial-placement-and-rotation.md`. Negative priority and equal-priority tie-breaks stay as that reference defines them.

Task 004 owns scheduled swap times, pause-at-deadline, and operator override of a running schedule. This task only requires that the **set and order** are reviewable while still `staged` / `reviewed` / `approved`.

## Movement from staging to approved public placement

Use Task 002 transitions. The admin surface must not offer a one-click `staged` → `published` control.

| Step | Operational state | Actor | Surface action |
| --- | --- | --- | --- |
| 1 | `draft` → `staged` | reviewing editor | enqueue for preview |
| 2 | Preview on `/admin/clubstaging` (or adjacent admin preview) | reviewing editor | visual check; no public write |
| 3 | `staged` → `reviewed` | reviewing editor | metadata + rights/privacy complete |
| 4 | `reviewed` → `approved` | Product Authority / Bill | `approved_by` / `approved_at` + named target |
| 5 | `approved` → `published` | Product Authority / Bill | inventory conversion; public helper may then read the row |
| Optional | `approved` → `scheduled` | Product Authority / Bill | Task 004 |

Public placement is step 5 only. Rotation fields from the previous section travel with the row; they do not skip approval.

## Public exposure boundaries

| Route class | May show this content |
| --- | --- |
| `/admin/clubstaging` and other `/admin/*` | Staged samples or later real staged rows; admin auth required |
| Public homepage, library, gallery, search, archive | Only `content_inventory.status = published` with matching `allowed_sections`, source, credit, and no rights/privacy block |
| Fan Club member routes | Published inventory (+ approved photos catalog); not `staged` or `reviewed` rows |
| Content-pipeline admin API | Candidates including staged; ADMIN_TOKEN only |

Must never happen:

- public or member fetch of `staged` / `reviewed` / `approved` (not yet published) inventory;
- clubstaging preview writing `published`;
- `search` or `library` in `allowed_sections` causing public hits before `published`;
- using fixture samples from `clubStagingSamples.ts` as live Gehrig content.

## Fail-closed stops for these surfaces

Stop the affected action when:

- the operator is not admin;
- required Task 002 public-path metadata is missing and the action is `reviewed` or later;
- UI offers `published` without `approved_by` / `approved_at`;
- preview would query public helpers with non-published rows;
- intended `allowed_sections` includes a key not in the placement registry;
- Task 007 is attempted before #3157 records real trial rows (runtime still gated).

## Explicit non-goals of this task

- No application, workflow, migration, or route changes.
- No implementation of `/admin/homestaging`.
- No scheduled rotation clock (Task 004).
- No start of Task 004 in this PR (one issue, one PR; stage-before-merge).
- No public publication.

## Successor

#2052 — Scheduled publication and controlled rotation implementation plan, after this Task 003 PR is independently reviewed and merged.
