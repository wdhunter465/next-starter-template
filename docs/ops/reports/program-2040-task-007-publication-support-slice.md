---
Doc Type: Report
Audience: Bill, ChatGPT, Cursor, LGFC maintainers, and reviewers
Authority Level: Program Evidence
Owns: Program #2040 Task 007 (#2055) first bounded publication-support slice — fail-closed editorial inventory publish gate, as-built behavior, and verification
Does Not Own: Remaining Task 007 slices, scheduler implementation, moderation_events storage, #3157 trial population, #2056 operator handoff, Production D1 writes, or public publication
Canonical Reference: /docs/ops/implementation-plans/website-automatic-content-publication-capability.md
Related Issues: #2040, #2055, #2054, #2050, #3157, #2273, #2286
Last Reviewed: 2026-08-14
---

# Program #2040 Task 007 — Publication support slice (editorial write gate)

## Purpose

Record the first implemented Task 007 slice: fail-closed `content_inventory` publication writes on `POST /api/admin/editorial/publish`.

Human approval remains mandatory before inventory `status` can become `published`. This slice does not auto-publish, does not treat fixtures as real Gehrig content, and does not write Production D1.

## Scope

This report covers the first #2055 slice only:

- shared A1–A7 transition gate plus S4/S9 on this write path;
- editorial publish/list wiring and admin archive controls for approve, publish, unpublish, and archive;
- additive `content_inventory` approval columns;
- targeted tests and this as-built note.

It does not implement scheduler fire, rollback writes, `moderation_events`, `/admin/clubstaging` rebuild, content-pipeline candidate intake, or #2056.

## Product predecessor note (#3157)

Product Authority adopted PMO option 2 on 2026-08-14. #3157 remains OPEN and is deferred for the current implementation; it is not complete and was not skipped as if trials ran. Cursor's HOLD stands: zero real pipeline candidates exist, and fixture JSON is not trial evidence. S10 live-trial runtime is Product-authorized to stand down **for starting this slice only**. This PR still refuses fabricated trial rows and Production D1 writes.

## Intended final state of this slice

After merge and Dev application of migration `0046`:

- `draft` → `published` is refused (A3);
- named human `approved_by` / `approved_at` must be recorded before publish (A2/A5);
- unpublished/archived **operational** state cannot jump back to `published` (A6); a new `approve` then `publish` is legal even while inventory `status` is still `archived`;
- unpublish/archive requires a reason (S9);
- public helpers remain `publishedInventoryWhere` (`status = 'published'`, matching `allowed_sections`, non-empty `source_name` and `credit_line`);
- already-published Library inventory rows stay readable; missing `operational_state` maps from inventory status and is not rewritten by this PR.

## Current known truth

| Field | Value |
| --- | --- |
| Source issue | #2055 (Task 007 of Program #2040) |
| Implementation start | `a3d2178d` (`origin/main`); branch `cursor/2055-publication-support-slice-2e48` |
| Design predecessors on `main` | Tasks 001–006 reports |
| Public helper | `functions/_lib/content-inventory-public.ts` — `publishedInventoryWhere` unchanged |
| Production D1 writes | None in this PR |
| Public publication | None in this PR |

## As-built behavior

`evaluatePublicationTransition` in `functions/_lib/publication-transition-gate.ts` is the named check catalog for this write path.

| ID | Runtime |
| --- | --- |
| A1 | Refuse publish unless operational state is `approved` or `scheduled` |
| A2 | Refuse approve/publish when `approved_by` / `approved_at` is missing |
| A3 | Refuse illegal jumps, including `draft` → `published` |
| A4 | Refuse `schedule` writes; refuse scheduled fire before `scheduled_at` or while paused |
| A5 | Refuse approver names `scheduler`, `automation`, `system`, `bot`, `ci`, `cursor`, `chatgpt` |
| A6 | Refuse republish while operational state is still `unpublished` or `archived`; a new `approve` (inventory status may remain `archived`) then `publish` is the legal path |
| A7 | Rollback writes stay unimplemented and fail closed; the gate also refuses rollback-to-publish without an approval snapshot |
| S4 | Refuse publish without `source_name` and `credit_line` |
| S9 | Refuse unpublish/archive without `reason` |

Legal path on this endpoint: `approve` (inventory status stays `draft` or `archived`) → `publish` (inventory `status = published`). Unpublish sets inventory `archived` and operational `unpublished`.

## Explicit non-goals of this slice

- No Production D1 migration apply or inventory rewrite.
- No content-pipeline candidate rows and no #3157 evidence fabrication.
- No start of #2056.
- No parent #2040 closeout.
- No scheduler, rotation fire, or `moderation_events` table.
- No change to public/member read helpers beyond keeping `publishedInventoryWhere`.

## Successor

Further #2055 slices may add scheduler, audit storage, or staging-surface wiring under a new allowlist. #2056 starts only after Task 007 is accepted. Parent #2040 closes only after #2056 + Product acceptance.
