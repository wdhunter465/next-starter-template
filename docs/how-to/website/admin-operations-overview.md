---
Doc Type: How-To
Audience: LGFC operators, ChatGPT, Bill, maintainers, and AI implementation agents
Authority Level: Operational Procedure
Owns: Entry-point operator workflow for Website Operations Admin surfaces under Program #1258
Does Not Own: GitHub issue closure, runtime deployment, schema migration, or auth policy changes
Canonical Reference: /docs/reference/architecture/access-model.md
Related issues: #1255, #1258, #1565
Last Reviewed: 2026-08-22
---

# Website Operations Admin — Overview

## Purpose

Orient operators to LGFC admin surfaces after Phase 4 hardening (Tasks 003–012). Use
this overview before lane-specific runbooks.

## Scope

Covers:

- session-only admin gating (UI + API, no token);
- navigation across `/admin/**` surfaces;
- pointers to per-surface runbooks;
- fail-closed expectations shared by hardened admin pages.

Does not cover editorial content strategy (`#1256`) or production QA (`#1259`).

## Steps

1. Sign in as an admin member and open `/admin`.
2. Open the lane runbook for the surface you need — data loads automatically.
3. Perform the operation; confirm status text reports success or an `Error:` prefix.
4. If your session expires or you sign out, expect the next action to surface `401`/`403` `Error:` status.

## Procedure

### 1. Satisfy the session UI gate

1. Sign in with a member account whose session returns `role: admin` from `/api/session/me`.
2. Navigate to `/admin` or any `/admin/**` route.
3. If redirected to `/`, the session is missing or not admin — resolve sign-in before continuing.

Reference: `src/app/admin/layout.tsx`, `docs/reference/architecture/access-model.md`.

### 2. No admin token step

As of `#3547`, admin pages call `/api/admin/**` with only the browser's
`lgfc_session` cookie (`src/lib/adminClient.ts`). There is no admin-token
input, no `localStorage` token, and no `x-admin-token` header. Signing in as
an admin member is sufficient — data loads as soon as the page mounts.

### 3. Use admin navigation

`AdminNav` links (current `main`):

| Route | Runbook |
| --- | --- |
| `/admin` | [Dashboard and member operations](./admin-dashboard-and-member-operations.md) |
| `/admin/moderation` | [Moderation and FAQ](./admin-moderation-and-faq.md) |
| `/admin/audit` | [Audit and reporting](./admin-audit-and-reporting.md) |
| `/admin/faq` | [Moderation and FAQ](./admin-moderation-and-faq.md) |
| `/admin/content` | [CMS and page content](./admin-cms-and-page-content.md) |
| `/admin/cms` | [CMS and page content](./admin-cms-and-page-content.md) |
| `/admin/editorial` | [Editorial archive operations](./admin-editorial-archive-operations.md) |
| `/admin/events` | [Events calendar](./admin-events-calendar.md) |
| `/admin/matchup` | [Matchup administration](./admin-matchup.md) |
| `/admin/fundraiser-preview` | [Fundraiser preview](./admin-fundraiser-preview.md) |
| `/admin/join-requests` | [Dashboard and member operations](./admin-dashboard-and-member-operations.md) |
| `/admin/worklist` | [Dashboard and member operations](./admin-dashboard-and-member-operations.md) |
| `/admin/member-operations` | [Dashboard and member operations](./admin-dashboard-and-member-operations.md) |
| `/admin/media-assets` | [Media assets](./admin-media-assets.md) |
| `/admin/d1-test` | [D1 inspect](./admin-d1-inspect.md) |

Fan Club member operational paths (T40 / `#1118`): [Fan Club operational workflows](./fanclub-operational-workflows.md).

Legacy issue disposition copy-paste package (ChatGPT batch; no GitHub mutations in-repo):
`docs/ops/reports/website-operations-admin-legacy-disposition-package.md`

### 4. Shared fail-closed signals

After Tasks 004–012 hardening (and the `#3547` session-only auth change), expect:

- controls disabled only while background work is active (no token-readiness gating);
- error status prefixed with `Error:` for operator-visible failures;
- data load automatically on mount for a signed-in admin member.

### 5. Verification quick checks

| Check | Expected |
| --- | --- |
| Open `/admin` without admin session | Redirect to `/` |
| Open any admin page while signed in as admin | Data loads automatically, no token step |
| `GET /api/admin/stats` without a session | `401` JSON |
| `GET /api/admin/stats` with a session but non-admin member | `403` JSON |

## Closeout Criteria

An operator session is correctly set up when the admin session is active
and the target lane runbook procedure completes with success status or a documented
deferral to `#1259`.
