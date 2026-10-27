---
Doc Type: How-To
Audience: LGFC operators, editors, and AI implementation agents
Authority Level: Procedure
Owns: Operator handoff for Club Home content placement, source/credit review, and member-surface verification after Program #1685 Tasks 004–007
Does Not Own: Merge authority, production B2 configuration, or issue closure
Canonical Reference: /docs/reference/website/unified-content-workflow.md
Related issues: #1693, #1685, #1689, #1690, #1691, #1692
Last Reviewed: 2026-06-23
---

# Club Home Content Operations Runbook

## Purpose

Give operators a single procedure for publishing content to Club Home and
verifying member-facing surfaces after the Website Completion / Fan Club Product
Buildout implementation (Tasks 004–007).

## Scope

This how-to covers:

- editorial publish and `club_home` placement;
- source/credit checks before publication;
- post-publish verification on `/fanclub` and linked member routes;
- accepted limitations and deferred work recorded in task evidence.

Out of scope:

- fundraiser, CMS slug pages, and moderation lanes unrelated to Club Home;
- binary member photo upload (deferred);
- GitHub issue closure or PR merge actions.

## Current known truth

- Tasks 004–007 merged implementation evidence exists in `docs/reference/website/unified-content-workflow.md`, Club Home APIs/UI, and Fan Club subpages.
- Operators publish Club Home content through admin editorial inventory with `club_home` in `allowed_sections`.
- Member surfaces use server-side search and fail-closed empty states as implemented in Task 007.

## Steps

1. Confirm the story or media item has complete source/credit metadata.
2. Publish or update the item in admin editorial inventory with `club_home` in `allowed_sections`.
3. Set rotation priority within the `club_home` section per placement reference.
4. Save and wait for inventory APIs to reflect the published row.
5. Sign in as a test member and open `/fanclub`.
6. Verify lead story, rail, spotlight, and media modules render the published item or fail closed to static fallback.
7. Spot-check `/fanclub/library`, `/fanclub/photo`, and `/fanclub/memorabilia` for search and related-story behavior.
8. Record verification notes in the task evidence report if program closeout requires it.

## Procedure

### Source and credit gate

Before any Club Home placement:

1. Open [Review a content submission](./review-content-submission.md).
2. Confirm `source_name`, `source_url`, and `credit_line` (or legacy author fields) are present when the item claims third-party or archival provenance.
3. Reject or return items with missing attribution rather than publishing to `club_home`.

Canonical workflow reference: `docs/reference/website/unified-content-workflow.md`.

### Publish to `club_home`

1. Open the admin editorial inventory UI (`/admin/editorial`).
2. Create or edit a published `content_inventory` row.
3. Include `club_home` in `allowed_sections` (API and inventory model accept this key; confirm the admin checkbox list includes **Club Home** when UI and API are in sync).
4. Assign `priority` and rotation metadata per `docs/reference/website/editorial-placement-and-rotation.md`.
5. Associate approved media when the Club Home module requires a thumbnail or feature image.

Runtime read path: `GET /api/fanclub/home` aggregates published `club_home` inventory with rotation rules in `functions/_lib/content-inventory-club-home.ts`.

### Member surface verification

After Club Home publish:

| Route | Operator check |
| --- | --- |
| `/fanclub` | Dynamic modules show published inventory with source/credit; static fallback only when inventory empty |
| `/fanclub/library` | H1 **Gehrig Library**; server search via `?q=` returns published library-section inventory |
| `/fanclub/photo` | Tag pills load from `GET /api/fanclub/photos/tags`; search uses photo list API |
| `/fanclub/memorabilia` | H1 **Memorabilia Archive**; server search via memorabilia API; related library stories render when API returns `related_library_entries` |

Use [Fan Club operational workflows](./fanclub-operational-workflows.md) for session-gate and empty-state checks.

### Accepted limitations (Task 008 evidence)

| Item | State | Evidence |
| --- | --- | --- |
| Member binary photo upload on `/fanclub/submit` | Deferred | `docs/reference/website/unified-content-workflow.md` |
| Admin UI `club_home` checkbox drift vs API | Verify during ops | Task #1691 API accepts key; confirm admin UI option present on branch |
| Homepage `homepage_*` inventory sections | Deferred | `tests/content-inventory-public-surface-validation.test.ts` deferred surfaces |
| Photo detail modal route | Deferred | Design reference allows modal or dedicated route |

### Escalation

- Editorial policy questions: use review workflow and `#1689` evidence.
- API or fail-closed defects: open a bounded follow-up against backend reconciliation report `docs/ops/reports/website-completion-fan-club-backend-reconciliation.md`.
- Program closeout: Task #1694 consolidates Tasks 001–008 evidence.

### Verification (operator / Cursor)

1. Run `npm run typecheck`.
2. Run targeted Vitest suites: `tests/fanclub-operations.test.tsx`, `tests/fanclub-home-shell.test.tsx`, `tests/fanclub-home-dynamic.test.tsx`, `tests/mobile-navigation.test.tsx`.
3. Record pass/fail outcomes in the PR body when making member-surface changes.
