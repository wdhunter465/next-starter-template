---
Doc Type: How-To
Audience: LGFC operators, maintainers, and AI implementation agents
Authority Level: Operational Procedure
Owns: Moderation hub and FAQ queue operator procedures
Does Not Own: Public FAQ/Ask UX, report creation policy, or automated moderation
Canonical Reference: /docs/reference/architecture/access-model.md
Related issues: #1258, #1565, #1120
Last Reviewed: 2026-06-14
---

# Admin Moderation and FAQ

## Purpose

Review moderation queues, FAQ submissions, and cross-links to report closeout for
`#1120` / T42.

## Scope

Routes:

- `/admin/moderation` — moderation hub (Ask, reports overview)
- `/admin/faq` — FAQ approval queue

API areas: `functions/api/admin/faq/**`, `functions/api/admin/ask/**`,
`functions/api/admin/reports/**`.

## Steps

1. Sign in as admin and save the admin API token on the target page.
2. Open **Moderation** or **FAQ Queue**.
3. Refresh queues; confirm items render or empty-state messaging appears.
4. Approve, deny, archive, or route items per editorial policy.
5. For report closeout detail, use [Audit and reporting](./admin-audit-and-reporting.md).

## Procedure

### Moderation hub

1. Open **Moderation**; queue summaries load automatically for a signed-in admin member.
2. Review Ask and related queue summaries.
3. Follow in-page links to **FAQ Queue** or **Audit & Reporting** when needed.
4. On failure, read `Error:` status; confirm admin session and D1 availability.

### FAQ queue

1. Open **FAQ Queue**; lists load automatically.
2. Load pending/approved lists.
4. Approve or deny with required notes when the UI prompts.
5. Confirm queue counts update after action.

### Reports

Member report creation is public/member-scoped. Admin list/close lives under
`/admin/audit` — see the audit runbook for masked reporter display and closeout notes.

## Verification

- `tests/admin-moderation.test.tsx` — queue failure and FAQ token gating.
- Manual: no queue loads without token; errors use accessible status text.

## Closeout Criteria

Moderation action is complete when the target item transitions, audit trail is
preserved (admin note where required), and status text confirms the outcome.
