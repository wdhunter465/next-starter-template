---
Doc Type: Reference
Audience: Human + AI
Authority Level: Canonical Architecture Specification
Owns: System architecture, data flows, access model, runtime dependencies
Does Not Own: Operational runbooks; governance policies; UI/UX design specifics
Canonical Reference: /docs/reference/design/LGFC-Production-Design-and-Standards.md
Related issues: #1255, #1258, #3552, #3553, #3547
Last Reviewed: 2026-08-22
---

# LGFC Admin Access Model — As-Built

**Version:** 2026-08-22
**Status:** Active (session-only admin authorization; shared `ADMIN_TOKEN` removed under `#3547`)

---

## Overview

LGFC admin operations are gated at two surfaces, both keyed off the same
authenticated member session:

1. **Admin UI session gate** — `/admin/**` pages require an authenticated member session with `role: admin`.
2. **Admin API gate** — `/api/admin/**` endpoints require the same signed-in admin member session (the `lgfc_session` cookie the UI gate already checks, re-verified server-side against D1). There is no shared-secret fallback.

A site operator only needs to **sign in as an admin member** to use admin tools end-to-end — no token to obtain, paste, or manage.

This document reflects the as-built implementation on `main` after T40–T49 admin work (PRs `#1171`–`#1216`), Task 001 gap analysis (PR `#1531`), the `#3552`/`#3553` session-based API auth change, and the `#3547` removal of the `ADMIN_TOKEN` shared-secret fallback.

---

## Architecture summary

| Layer | Surface | Enforcement | Primary code |
| --- | --- | --- | --- |
| Member session | `/api/session/me` | Cookie-backed member session; returns `role: admin \| member \| guest` | `functions/api/session/me.ts`, `functions/_lib/session.ts` |
| Admin UI gate | `/admin/**` | Client layout redirects non-admin or unauthenticated users to `/` | `src/app/admin/layout.tsx`, `src/hooks/useMemberSession.ts` |
| Admin API gate | `/api/admin/**` | Requires a signed-in admin member session (`lgfc_session` cookie, `members.role = 'admin'`, verified server-side); fail-closed otherwise | `functions/_lib/auth.ts` (`requireAdmin`, delegates to `functions/_lib/session.ts` `requireAdminMember`) |

**Security boundary:** The UI gate controls **who can see and navigate** admin pages. The API gate controls **who can read or mutate** privileged data, and independently re-verifies the same admin session server-side — it is the real enforcement point, not just a UX convenience.

---

## Admin UI pages

### Routes

All admin UI routes live under `/admin/**`. Current routes include dashboard, moderation, audit, FAQ, CMS, content, editorial, events, matchup, fundraiser preview, join requests, worklist, member operations, media assets, and D1 inspect. See Task 001 inventory: `docs/ops/reports/website-operations-admin-as-built-gap-analysis.md`.

### Access model

**Session-gated (not public):** `src/app/admin/layout.tsx` wraps all admin pages and calls:

```typescript
useMemberSession({ redirectTo: '/', requireAdmin: true })
```

While loading, or when the session is missing or `role !== 'admin'`, the layout renders nothing and redirects to the public homepage.

**Client-side only:** The gate runs in the browser after `/api/session/me` returns. There is no server-rendered admin auth in the static export.

**What this protects:** Casual visitors and signed-in non-admin members cannot use admin navigation or page chrome.

**What this does not protect:** Determined clients could still request static admin JS bundles directly. Sensitive operations remain blocked at the API layer.

### No admin token step

As of `#3547`, admin pages load data through `/api/admin/**` using only the
browser's `lgfc_session` cookie (`src/lib/adminClient.ts` calls `fetch(...,
{ credentials: 'include' })`). There is no admin-token input anywhere in the
admin UI, no `localStorage` token, and no `x-admin-token` header sent by any
admin page. Signing in as an admin member is sufficient end-to-end.

---

## Admin API endpoints

### Routes

Privileged operations are under `/api/admin/**`, including stats, export, worklist, CMS, content, editorial, FAQ, Ask, reports, events, matchup, media assets, join requests, welcome email, membership card, footer quotes, and D1 inspect. See Task 001 inventory for the full file list under `functions/api/admin/**`.

### Access model

**Session-only:** Every admin API handler calls `await requireAdmin(request, env)` before reading or writing data. `requireAdmin` delegates to `requireAdminMember()` (`functions/_lib/session.ts`):

- Server reads the `lgfc_session` cookie from the request.
- Looks up the session in `member_sessions` (must be unexpired) to resolve an email.
- Looks up `members.role` for that email.
- `role = 'admin'` → request is authorized.

**Failure modes:**

- No `DB` binding configured → `503` with `{ ok: false, error: "Database unavailable", ... }`
- No session, or session doesn't resolve to a member → `401` with `{ ok: false, error: "Not authenticated" }`
- Valid session but `role !== 'admin'` → `403` with `{ ok: false, error: "Admin required" }`

There is no shared-secret fallback: `env.ADMIN_TOKEN` is not read anywhere in `functions/_lib/auth.ts`, and no admin route accepts `x-admin-token` or `Authorization: Bearer`.

### Example handler pattern

```typescript
import { requireAdmin } from "../../_lib/auth";

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  // Proceed with admin operation
};
```

---

## Operator workflow (site operator)

Use this sequence when operating the live or preview site. No developer tooling is required beyond a browser and an admin-role member account.

### Prerequisites

- Your member account is assigned **admin** role in the member database (maintainer action). No admin API token exists to obtain or share.

### Operator sequence

1. **Sign in as a member** using the normal site login flow (same as Fan Club / member areas).
2. **Open an admin URL**, for example `/admin` or `/admin/moderation`.
3. **Session check:** If you are not signed in or your account is not an admin, you are redirected to the homepage. Sign in with an admin account and try again.
4. **Use admin tools:** Navigate via admin nav or dashboard cards. Lists, saves, exports, and publishes call `/api/admin/**`; your admin session cookie authorizes them automatically.
5. **If data does not load:** Confirm you're signed in as an admin account and on the correct preview or production URL. API errors surface in page status text (for example *"Error: Not authenticated"* or *"Error: Admin required"*).
6. **Sign out:** Use the normal site sign-out flow when finished on a shared machine; this clears the session cookie that authorizes both the UI and the API.

### Operator expectations

| Situation | Expected behavior |
| --- | --- |
| Not signed in → visit `/admin` | Redirect to `/` |
| Signed in as member (non-admin) → visit `/admin` | Redirect to `/` |
| Signed in as admin | Full read/write per page capabilities |
| API called with a valid admin session cookie | Authorized |
| API called without a session | `401 Unauthorized` JSON response |
| API called with a valid session but a non-admin member | `403 Forbidden` JSON response |
| API called with no `DB` binding configured | `503` JSON response |

---

## Security boundary

| Capability | UI session gate | API gate (session only) |
| --- | --- | --- |
| View admin page chrome and navigation | Required | Not required |
| Load D1-backed lists, stats, exports | Required (to reach UI) | Required (for data) |
| CMS / content / editorial publish | Required | Required |
| Moderation approve/deny/archive | Required | Required |
| Join requests, worklist, member ops config | Required | Required |
| Public member/Fan Club routes | Not applicable | Not applicable |

**Protected by API gate (hard boundary):** database reads of sensitive data, all privileged writes, CSV exports, configuration changes.

**API gate is independently enforced:** `requireAdmin` re-verifies the admin session server-side (session lookup + `members.role` check) rather than trusting the client-side UI gate; it is the sole enforcement point for mutations and sensitive reads.

---

## D1 diagnostic tool

**Route:** `/admin/d1-test`

**Purpose:** Browser tool for D1 table inspection (counts, schemas, sample rows).

**Access:**

| Layer | `/admin/d1-test` behavior |
| --- | --- |
| Session UI gate | Same as other `/admin/**` routes (`layout.tsx` + `useMemberSession`) |
| API gate | Same `requireAdmin` session check as other admin APIs — no token step |
| API call | `/api/admin/d1-inspect` |

Planned PMO program will add `photos.is_matchup_eligible` curation on this route; today it is inspect-only.

---

## Configuration

### Cloudflare Pages environment variables

No admin-specific environment variable is required. The API gate depends only on the existing `DB` (D1) binding, already required for all member/session/admin surfaces.

### Local development

Sign in as an admin member against your local `DB` binding (`npm run dev:cf` per `package.json`); the admin session cookie satisfies both the UI and API gates with no additional configuration.

### Verification signals

| Check | Expected result |
| --- | --- |
| `GET /api/admin/stats` with a valid admin session cookie | `200` with stats payload |
| `GET /api/admin/stats` without a session | `401 Unauthorized` JSON |
| `GET /api/admin/stats` with a valid session but a non-admin member | `403 Forbidden` JSON |
| Browser: sign in as admin → open `/admin/d1-test` | D1 table list loads, no token step needed |

Operator how-to with full click-path detail may move to `docs/how-to/website/` in Task 013.

---

## Security considerations

### Threat model

- Admin UI static assets may be discoverable; session gate reduces casual access, and the API gate independently re-verifies the session server-side.
- All sensitive operations must fail without a valid admin session — there is no alternate credential that can substitute for one.
- Session cookies (`lgfc_session`) are `HttpOnly`, `Secure`, `SameSite=Lax`, and expire server-side via `member_sessions.expires_at`.

### Best practices

1. Limit admin-role member accounts to authorized operators; role changes happen in `members.role`, not via any distributed secret.
2. Review Cloudflare request logs for repeated `401`/`403` on `/api/admin/**`.
3. Sign out on shared devices when finished.

---

## Historical context

### ZIP 41 (PR `#457`)

Early post–ZIP 41 documentation described admin UI pages as browser-reachable without a session gate, with `sessionStorage` token UX and API-only security. That matched an interim static-export compromise.

### 2026-06 as-built

Admin UI used **session-backed layout gating** via `useMemberSession({ requireAdmin: true })` plus a **`localStorage` admin token** (`adminClient.ts` / `AdminTokenPanel`) for admin API calls. The API layer only checked the static token — the UI session gate was client-side only and not independently re-verified server-side.

### 2026-08 (`#3552`/`#3553`)

The admin API gate (`requireAdmin`) added support for a signed-in admin member session, verified server-side against `member_sessions` and `members.role`, alongside the existing static-token path (dual-gate: session **or** token).

### Current as-built (2026-08-22, `#3547`)

The static `ADMIN_TOKEN` shared-secret path was removed entirely. `requireAdmin` now delegates to `requireAdminMember()` and authorizes solely on a signed-in admin member session, returning `401` when unauthenticated and `403` when authenticated but not an admin. The browser admin-token input (`AdminTokenPanel`), `localStorage` key `lgfc_admin_token`, and all `x-admin-token` request headers were removed from the admin UI and `src/lib/adminClient.ts`. Further login improvements (e.g. OAuth, MFA, passkeys) remain a future consideration, not part of this change.

---

## Follow-up gaps (explicit; no code beyond `#3547` scope)

| Gap | Notes | Suggested route |
| --- | --- | --- |
| Dedicated operator how-to under `docs/how-to/website/` | Task 002 captures workflow in this spec; a standalone how-to may help non-technical operators | Task 013 runbooks |
| D1 test photo curation UI | `/admin/d1-test` is inspect-only; `photos.is_matchup_eligible` editing deferred to PMO program | PMO admin tools program |
| `footer-quotes` admin API without admin UI | Config surface still has no dedicated admin UI (same session gate applies at the API layer) | Task 004 (deferred UI) |
| Further login hardening (OAuth, MFA, passkeys) | Session-only admin API auth landed `#3547`; deeper identity work remains a future consideration per site operator | Future auth program; not `#1258` Task 002 |
| PMO `production-ready` dependency-map fields | Plan promotion gate | ChatGPT/Bill before child issue creation |

---

## Future enhancements

Phase 6+ may add layered role verification on APIs, stronger server-side UI enforcement, and audit logging. Until then, operators and agents should treat **session UI gate + session-only API gate** as the canonical model.

---

## References

- Task 001 inventory: `docs/ops/reports/website-operations-admin-as-built-gap-analysis.md`
- Implementation plan: `docs/ops/implementation-plans/website-operations-admin.md`
- Auth library: `functions/_lib/auth.ts`
- Session library: `functions/_lib/session.ts`
- Session API: `functions/api/session/me.ts`
- Admin layout: `src/app/admin/layout.tsx`
- Admin client: `src/lib/adminClient.ts`
- Admin pages: `src/app/admin/**`
- Admin APIs: `functions/api/admin/**`
