---
Doc Type: Operations
Audience: Human + AI
Authority Level: Planning Draft
Owns: Program 5 admin page and tools design readiness, admin tool inventory questions, session-gated access review, and promotion criteria for a future Program 1-4 portfolio project
Does Not Own: Runtime implementation, session secrets, Cloudflare environment configuration, workflow YAML, D1 migrations, production secrets, issue creation, or launch approval
Canonical Reference: /docs/ops/pmo/PMO-V2-OPERATING-MODEL.md
Related Issues: #1255, #1379, #1411, #4776
Last Reviewed: 2026-10-26
---

# Program 5 — Admin Page and Tools Design Readiness

## Purpose

Capture the admin page and admin tools design as a Program 5 project draft.

The repository has an admin access model and several implemented or admin-adjacent tools, but the complete admin product design is not yet clearly centralized. Token errors across tools may reflect valid security enforcement, incomplete UX design, tool-state drift, missing environment configuration, or backend dependency failure.

This document does not authorize implementation. It defines the readiness work required before admin tools should be promoted into a Program 1-4 portfolio lane.

## PMO v2 placement

This belongs in Program 5 because it is not yet a clean portfolio project with complete scope, design authority, tool inventory, UX contract, and implementation boundaries.

It may later be promoted into Programs 1-4 after readiness review and prioritization.

## Existing documentation basis

Known existing authority:

- `docs/reference/architecture/access-model.md` defines the admin access model. Member auth and redirects stay in `docs/reference/design/auth-model.md`.
- Admin UI pages are browser-reachable under `/admin/**` and are session-gated.
- Admin API endpoints under `/api/admin/**` authorize a signed-in admin member session (`functions/_lib/auth.ts`). There is no `ADMIN_TOKEN` or `x-admin-token` path.
- The `localStorage` key `lgfc_admin_token` and `AdminTokenPanel` were removed (access-model note, 2026-08-22, #3547). They are not the current gate.
- Unauthenticated admin API calls return `401`; an authenticated non-admin returns `403`; a missing D1 binding returns `503`.

This is an architecture/access basis. It is not a complete admin product/tool design.

## Current known admin surfaces to inventory

The readiness review should inventory current and historical admin surfaces, including but not limited to:

- `/admin`
- `/admin/d1-test`
- `/admin/cms`
- `/admin/content`
- `/admin/faq`
- `/admin/join-requests`
- `/admin/media-assets`
- `/admin/editorial`
- admin API endpoints under `/api/admin/**` or Cloudflare Pages Functions equivalents
- diagnostic-only tools
- retired or legacy admin tools still linked in the UI

The review must determine whether each surface is active, diagnostic-only, deprecated, incomplete, or future.

## Required design questions

Before promotion, this project needs answers to these questions:

1. What is the canonical admin dashboard information architecture?
2. Which admin tools are active production tools?
3. Which admin tools are diagnostic-only?
4. Which admin tools should be retired or hidden?
5. Which tools require D1, B2, external services, or static config?
6. What does each tool do when the admin session is missing?
7. What does each tool do when the signed-in member is not an admin?
8. What does each tool do when the admin session is valid but the backend dependency fails?
9. Should the signed-out state be shared across all admin pages?
10. Admin auth is the member session in `auth-model.md`. This draft does not add a browser token.
11. Which tools should be visible before the admin session is confirmed?
12. Which tools should expose only a locked state before the admin session is confirmed?
13. What is the expected UX for 401, 403, 500, 503, D1 binding missing, B2 missing, malformed response, and empty data?
14. Which tools can be safely used in preview deployments?
15. Which tools are production-only?

## Tool-by-tool readiness matrix

Future design documentation should include this matrix:

| Tool | Route | Purpose | Status | Session behavior | Backend sources | Failure states | Promotion readiness |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Admin dashboard | `/admin` | Admin landing and tool launcher | TBD | TBD | TBD | TBD | TBD |
| D1 diagnostic | `/admin/d1-test` | Inspect D1 binding/table state | TBD | TBD | D1 | TBD | TBD |
| CMS/content tools | `/admin/cms`, `/admin/content` | Edit managed content | TBD | TBD | D1 `page_content` and related tables | TBD | TBD |
| FAQ admin | `/admin/faq` | Manage FAQ entries | TBD | TBD | D1 `faq_entries` | TBD | TBD |
| Join requests | `/admin/join-requests` | Review member join requests | TBD | TBD | D1 `join_requests`, `members` | TBD | TBD |
| Media assets | `/admin/media-assets` | Review/manage B2/D1 media metadata | TBD | TBD | D1 media metadata, B2 | TBD | TBD |
| Editorial inventory | `/admin/editorial` | Manage content inventory and editorial placement | TBD | TBD | D1 `content_inventory`, media associations | TBD | TBD |

## Session UX design requirements

The future admin design must distinguish these cases. There is no admin token prompt.

| Case | Expected design decision |
| --- | --- |
| No admin session | Show locked state and a path to `/join?mode=login`. |
| Signed in, not an admin | Show 403. Do not offer a token prompt. |
| Admin session but endpoint missing | Show tool unavailable / implementation mismatch. |
| Admin session but D1 binding missing | Show environment/configuration error, not a generic auth error. |
| Admin session but B2/media dependency missing | Show media backend unavailable, not a generic auth error. |
| Admin session but permission model changes | Show explicit access-model mismatch. |

Auth errors should not mask dependency errors. The design must let an admin distinguish authentication failure from backend/tool failure.

## Backend source mapping requirement

Each admin tool needs source mapping before implementation or repair:

- D1 table(s)
- B2 bucket/object dependencies
- external service dependencies
- static JSON/config dependencies
- required environment variables
- read/write permissions
- preview-vs-production behavior
- expected empty state
- expected failure state

## Promotion criteria

This Program 5 item can be promoted into a Program 1-4 portfolio lane only after:

1. all current admin tools are inventoried;
2. active vs diagnostic vs retired status is documented;
3. session-gated admin shell decisions are made;
4. backend source mapping is complete;
5. error and empty states are specified;
6. security boundaries are reviewed against the access model;
7. implementation scope is split into bounded tasks;
8. Product Authority chooses a Program 1-4 lane and explicitly authorizes launch.

## Recommended PMO classification

Current classification:

```text
Program 5 project draft
```

Potential future promotion target:

```text
Program 3 or Program 4, depending on portfolio priority after readiness review
```

## Open questions

1. Should admin tools become their own future portfolio project or remain support work inside Program 2/3?
2. Which session errors (401 and 403) are expected security behavior and which are defects?
3. Should admin tools share one admin shell and one signed-out state?
4. Should diagnostic tools be hidden from the main dashboard in production?
5. Should media/editorial/admin tools be grouped into one Admin Operations project?
