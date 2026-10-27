---
Doc Type: How-To
Audience: LGFC operators, maintainers, and AI implementation agents
Authority Level: Procedure
Owns: Fan Club member operational path verification for operators
Does Not Own: Member onboarding policy, chat moderation rules, or admin surfaces
Canonical Reference: /docs/reference/architecture/access-model.md
Related issues: #1258, #1565, #1118, #1689
Last Reviewed: 2026-06-23
---

# Fan Club Operational Workflows

## Purpose

Verify and support member-facing Fan Club operational paths (`#1118` / T40).

## Scope

Member routes (require member session, not admin):

| Route | Purpose |
| --- | --- |
| `/fanclub/photo` | Member photo interactions |
| `/fanclub/submit` | Member editorial intake (story/note → `submission_queue`) |
| `/fanclub/chat` | Discussions/chat |
| `/fanclub/library` | Library browsing |
| `/fanclub/memorabilia` | Memorabilia browsing |

APIs: `functions/api/fanclub/**`, `functions/api/discussions/**`,
`functions/api/library/**`, `functions/api/photos/**`.

## Steps

1. Sign in as a test member (not admin-only session).
2. Open each Fan Club route from the Fan Club navigation.
3. Confirm empty, error, and success states render safely.
4. For admin-side report or moderation follow-up, use [Moderation and FAQ](./admin-moderation-and-faq.md) or [Audit and reporting](./admin-audit-and-reporting.md).
5. Record deferrals to `#1259` for production PDF/upload edge cases.

## Procedure

### Session gate

`src/app/fanclub/layout.tsx` requires member session. Guests are redirected away
from operational paths.

### Photo lane

1. Open `/fanclub/photo`.
2. Confirm photo list or empty state loads.
3. On API error, confirm user-visible error (not silent failure).

### Submit lane

1. Open `/fanclub/submit`.
2. Exercise submission form with test content per policy (text fields; source/credit when available).
3. Confirm validation errors and success messaging.
4. Confirm the item is **not** published to library or Club Home until editorial review.
5. Follow [Member content submission](./member-content-submission.md) and the unified workflow reference at `docs/reference/website/unified-content-workflow.md`.

Binary photo/PDF upload is not available on this path; defer media intake gaps to Task 005+ unless a new issue authorizes implementation.

### Chat / discussions

1. Open `/fanclub/chat`.
2. Post a test message when permitted.
3. Confirm errors surface on failed post (credentials included on fetches).

### Library and memorabilia

1. Open `/fanclub/library` and `/fanclub/memorabilia`.
2. Confirm lists load or empty states display.
3. Escalate content moderation via admin lanes when needed.

### Operator boundaries

- Fan Club paths are **member** gated, not admin token gated.
- Admin operators test with a member test account.
- Admin token is not required on Fan Club pages.

## Verification

- `tests/fanclub-operations.test.tsx` (Task 003 / PR `#1536`).
- Manual route checklist per environment.

## Closeout Criteria

Fan Club verification is complete when each scoped route passes empty/error/auth
checks or gaps are documented as `#1259` deferrals.
