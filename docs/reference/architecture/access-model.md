---
Doc Type: Reference
Audience: Human + AI
Authority Level: Canonical Architecture Specification
Owns: System architecture, data flows, access model, runtime dependencies
Does Not Own: Operational runbooks; governance policies; UI/UX design specifics
Canonical Reference: /docs/reference/design/LGFC-Production-Design-and-Standards.md
Related issues: #1255, #1258, #3552, #3553
Last Reviewed: 2026-08-18
---

# LGFC Admin Access Model — As-Built

**Version:** 2026-08-18
**Status:** Active (session-based API auth added under `#3552`/`#3553`)

---

## Overview

LGFC admin operations are gated at two surfaces, but as of 2026-08-18 a single
sign-in satisfies both:

1. **Admin UI session gate** — `/admin/**` pages require an authenticated member session with `role: admin`.
2. **Admin API gate** — `/api/admin/**` endpoints require **either** a valid signed-in admin member session (the same cookie the UI gate already checks, now verified server-side) **or** the configured `ADMIN_TOKEN`.

A site operator only needs to **sign in as an admin member** to use admin tools end-to-end — no separate token to obtain or paste. The static `ADMIN_TOKEN` remains available as a fallback for ops scripts, CI, and other non-browser automation that has no member session to send.

This document reflects the as-built implementation on `main` after T40–T49 admin work (PRs `#1171`–`#1216`), Task 001 gap analysis (PR `#1531`), and the `#3552`/`#3553` session-based API auth change (closing the "Role/session hardening beyond `ADMIN_TOKEN`" gap noted below).

---

## Architecture summary

| Layer | Surface | Enforcement | Primary code |
| --- | --- | --- | --- |
| Member session | `/api/session/me` | Cookie-backed member session; returns `role: admin \| member \| guest` | `functions/api/session/me.ts`, `functions/_lib/session.ts` |
| Admin UI gate | `/admin/**` | Client layout redirects non-admin or unauthenticated users to `/` | `src/app/admin/layout.tsx`, `src/hooks/useMemberSession.ts` |
| Admin API gate | `/api/admin/**` | Accepts a signed-in admin member session (`lgfc_session` cookie, `members.role = 'admin'`, verified server-side) OR `x-admin-token` / `Authorization: Bearer` matching `env.ADMIN_TOKEN`; fail-closed if neither is present/configured | `functions/_lib/auth.ts` (`requireAdmin`), `functions/_lib/session.ts` |
| Operator token UX (optional) | Admin dashboard and most pages | Token entered in `AdminTokenPanel`; stored in browser `localStorage`. Not required for a signed-in admin member — only for scripted/token-only access | `src/components/admin/AdminTokenPanel.tsx`, `src/lib/adminClient.ts` |
| D1 test token UX (exception) | `/admin/d1-test` only | Page-local token input; stored in `sessionStorage` (not shared with `adminClient`) | `src/app/admin/d1-test/page.tsx` |

**Security boundary:** The UI gate controls **who can see and navigate** admin pages. The API gate controls **who can read or mutate** privileged data, and as of `#3552`/`#3553` it independently re-verifies the same admin session server-side — it is a real enforcement point, not just a UX convenience layered on the token.

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

### Admin API token panel (optional)

Most admin pages load data through `/api/admin/**`. The dashboard includes `AdminTokenPanel`, which:

- Reads and writes `localStorage` key `lgfc_admin_token` (via `src/lib/adminClient.ts`)
- Sends the saved value as header `x-admin-token` on admin API calls
- Does **not** use `sessionStorage`

Since `#3552`/`#3553`, this panel is **optional** for a signed-in admin member — the admin session cookie alone satisfies the API gate. It remains useful for scripted access, debugging against a specific token, or an environment where the session cookie isn't being sent for some reason.

Help text on the panel: *"Signing in with an admin account is enough to use the admin pages. This token is only needed for scripts and automation that don't have a browser session — you can leave it blank."*

---

## Admin API endpoints

### Routes

Privileged operations are under `/api/admin/**`, including stats, export, worklist, CMS, content, editorial, FAQ, Ask, reports, events, matchup, media assets, join requests, welcome email, membership card, footer quotes, and D1 inspect. See Task 001 inventory for the full file list under `functions/api/admin/**`.

### Access model

**Dual-path, either satisfies the gate:** Every admin API handler calls `await requireAdmin(request, env)` before reading or writing data.

**1. Session verification (primary path, added `#3552`/`#3553`):**

- Server reads the `lgfc_session` cookie from the request
- Looks up the session in `member_sessions` (must be unexpired) to resolve an email
- Looks up `members.role` for that email
- `role = 'admin'` → request is authorized, no token required

**2. Static token verification (fallback path, for non-browser callers):**

- Client sends `x-admin-token` (or `Authorization: Bearer <token>`)
- Server compares against `env.ADMIN_TOKEN`
- Only reached if the session check above did not authorize the request

**Failure modes** (only when neither path authorizes the request):

- No admin session **and** `ADMIN_TOKEN` not configured → `503` with `{ ok: false, error: "Admin access is not configured." }`
- No admin session **and** token missing or wrong → `401` with `{ ok: false, error: "Unauthorized." }`

**Environment variable:**

| Field | Value |
| --- | --- |
| Name | `ADMIN_TOKEN` |
| Set in | Cloudflare Pages project settings (Production and Preview as needed) |
| Repository | Never committed |
| Recommended format | 32+ character random string |
| Required? | No longer required for browser-based admin use once a member has `role = 'admin'`; still needed for ops scripts, CI, and other non-browser automation |

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

Use this sequence when operating the live or preview site. No developer tooling is required beyond a browser and credentials supplied by the site maintainer.

### Prerequisites

- Your member account is assigned **admin** role in the member database (maintainer action).
- No admin API token is needed for normal browser use. Ops scripts/CI still need the **admin API token** value for the target environment (maintainer shares out-of-band; never post in chat or email threads).

### Operator sequence

1. **Sign in as a member** using the normal site login flow (same as Fan Club / member areas).
2. **Open an admin URL**, for example `/admin` or `/admin/moderation`.
3. **Session check:** If you are not signed in or your account is not an admin, you are redirected to the homepage. Sign in with an admin account and try again.
4. **Use admin tools:** Navigate via admin nav or dashboard cards. Lists, saves, exports, and publishes call `/api/admin/**`; your admin session cookie authorizes them automatically — no token needed.
5. **If data does not load:** Confirm you're signed in as an admin account and on the correct preview or production URL. API errors surface in page status text (for example *"Error: Unauthorized."*). If the session cookie isn't reaching the API for some reason, the token panel remains available as a manual fallback.
6. **Sign out:** Use the normal site sign-out flow when finished on a shared machine; this clears the session cookie that authorizes both the UI and the API.

### Operator expectations

| Situation | Expected behavior |
| --- | --- |
| Not signed in → visit `/admin` | Redirect to `/` |
| Signed in as member (non-admin) → visit `/admin` | Redirect to `/` |
| Signed in as admin | Full read/write per page capabilities — no token needed |
| API called with a valid admin session cookie | Authorized (no token required) |
| API called without an admin session and without a matching token | `401 Unauthorized` JSON response (`503` if `ADMIN_TOKEN` isn't configured at all) |

---

## Security boundary

| Capability | UI session gate | API gate (session or token) |
| --- | --- | --- |
| View admin page chrome and navigation | Required | Not required |
| Load D1-backed lists, stats, exports | Required (to reach UI) | Required (for data) |
| CMS / content / editorial publish | Required | Required |
| Moderation approve/deny/archive | Required | Required |
| Join requests, worklist, member ops config | Required | Required |
| Public member/Fan Club routes | Not applicable | Not applicable |

**Protected by API gate (hard boundary):** database reads of sensitive data, all privileged writes, CSV exports, configuration changes.

**API gate is independently enforced:** `requireAdmin` re-verifies the admin session server-side (session lookup + `members.role` check) rather than trusting the client-side UI gate; it is the real enforcement point for mutations and sensitive reads, with the static token as a secondary path.

---

## D1 diagnostic tool

**Route:** `/admin/d1-test`

**Purpose:** Browser tool for D1 table inspection (counts, schemas, sample rows).

**Access:**

| Layer | `/admin/d1-test` behavior |
| --- | --- |
| Session UI gate | Same as other `/admin/**` routes (`layout.tsx` + `useMemberSession`) |
| API gate | Same dual-path `requireAdmin` as other admin APIs — admin session cookie authorizes it; `AdminTokenPanel` / `localStorage` key `lgfc_admin_token` remains an optional fallback |
| API call | `/api/admin/d1-inspect` |

Planned PMO program will add `photos.is_matchup_eligible` curation on this route; today it is inspect-only.

---

## Configuration

### Cloudflare Pages environment variables

1. Cloudflare Dashboard → Pages → project → Settings → Environment Variables
2. Add `ADMIN_TOKEN` for Production (and Preview when testing admin APIs via scripts/CI)
3. Redeploy after changes

### Local development

Create a gitignored `.env.local` with `ADMIN_TOKEN=your-local-dev-token-here`, then start the local Cloudflare Pages dev server (`npm run dev:cf` per `package.json`). Signing in as an admin member locally also satisfies the API gate without the token.

### Verification signals

| Check | Expected result |
| --- | --- |
| `GET /api/admin/stats` with a valid admin session cookie, no token | `200` with stats payload |
| `GET /api/admin/stats` without a session and without `x-admin-token` | `401 Unauthorized` JSON |
| `GET /api/admin/stats` without a session but with valid `x-admin-token` | `200` with stats payload |
| Browser: sign in as admin → open `/admin/d1-test` | D1 table list loads, no token step needed |

Operator how-to with full click-path detail may move to `docs/how-to/website/` in Task 013.

---

## Security considerations

### Threat model

- Admin UI static assets may be discoverable; session gate reduces casual access, and the API gate independently re-verifies the session server-side.
- All sensitive operations must fail without a valid admin session **and** a valid `ADMIN_TOKEN`.
- Tokens in `localStorage` persist per browser origin; operators should clear tokens on shared devices if one was ever saved.
- Session cookies (`lgfc_session`) are `HttpOnly`, `Secure`, `SameSite=Lax`, and expire server-side via `member_sessions.expires_at`.

### Best practices

1. Generate strong tokens (`openssl rand -hex 32` or equivalent) for the ops/CI fallback path
2. Rotate `ADMIN_TOKEN` periodically; update operator copies
3. Limit both admin-role member accounts and token distribution to authorized operators
4. Review Cloudflare request logs for repeated `401`/`503` on `/api/admin/**`
5. Never commit tokens or store them in repository files

---

## Historical context

### ZIP 41 (PR `#457`)

Early post–ZIP 41 documentation described admin UI pages as browser-reachable without a session gate, with `sessionStorage` token UX and API-only security. That matched an interim static-export compromise.

### 2026-06 as-built

Admin UI used **session-backed layout gating** via `useMemberSession({ requireAdmin: true })` plus **`localStorage` admin token** (`adminClient.ts` / `AdminTokenPanel`) for admin API calls, including `/admin/d1-test`. The API layer only checked the static token — the UI session gate was client-side only and not independently re-verified server-side.

### Current as-built (2026-08, `#3552`/`#3553`)

The admin API gate (`requireAdmin`) now also accepts a signed-in admin member session, verified server-side against `member_sessions` and `members.role`. This closed the "operational APIs require pasting a token even though I already signed in as admin" friction reported by the site operator, and closed the "Role/session hardening beyond `ADMIN_TOKEN`" gap listed below. The static token remains supported for ops scripts and CI. Further login improvements (e.g. OAuth, MFA, passkeys) remain a future consideration, not part of this change.

---

## Follow-up gaps (explicit; no code in Task 002)

| Gap | Notes | Suggested route |
| --- | --- | --- |
| Dedicated operator how-to under `docs/how-to/website/` | Task 002 captures workflow in this spec; a standalone how-to may help non-technical operators | Task 013 runbooks |
| D1 test photo curation UI | `/admin/d1-test` is inspect-only; `photos.is_matchup_eligible` editing deferred to PMO program | PMO admin tools program |
| `footer-quotes` admin API without admin UI | Config surface still has no dedicated admin UI (session or token both work at the API layer) | Task 004 (deferred UI) |
| Further login hardening (OAuth, MFA, passkeys) | Session-based admin API auth landed `#3552`/`#3553`; deeper identity work remains a future consideration per site operator | Future auth program; not `#1258` Task 002 |
| PMO `production-ready` dependency-map fields | Plan promotion gate | ChatGPT/Bill before child issue creation |

---

## Future enhancements

Phase 6+ may add layered role verification on APIs, stronger server-side UI enforcement, and audit logging. Until then, operators and agents should treat **session UI gate + `ADMIN_TOKEN` API gate** as the canonical model.

---

## References

- Task 001 inventory: `docs/ops/reports/website-operations-admin-as-built-gap-analysis.md`
- Implementation plan: `docs/ops/implementation-plans/website-operations-admin.md`
- Auth library: `functions/_lib/auth.ts`
- Session API: `functions/api/session/me.ts`
- Admin layout: `src/app/admin/layout.tsx`
- Admin client: `src/lib/adminClient.ts`
- Token panel: `src/components/admin/AdminTokenPanel.tsx`
- Admin pages: `src/app/admin/**`
- Admin APIs: `functions/api/admin/**`
