---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Preview and component-environment isolation classifications, blocking rules, and mutating-resource inventory as a supporting specification
Does Not Own: Platform and Environment Domain Policy; delivery approval policy; PR lifecycle; runtime deployment credentials
Canonical Reference: /docs/governance/PLATFORM-AND-ENVIRONMENT.md
Related Issues: #2688, #2496, #2495, #2478
Last Reviewed: 2026-07-21
---

# Component and Preview Environment Isolation

This document is the **primary supporting isolation inventory** under the Platform and Environment Domain Policy (`docs/governance/PLATFORM-AND-ENVIRONMENT.md`).

It is the canonical inventory and classification for every preview- and component-accessible mutating resource in the LGFC delivery system. It proves what can and cannot silently mutate production from a Cloudflare Pages preview URL or a Model B component branch deployment.

This file is **not** a Domain Policy co-owner. Domain-policy conflicts resolve through `docs/governance/PLATFORM-AND-ENVIRONMENT.md`.

Machine-readable inventory: `scripts/ci/preview-isolation-manifest.json`  
Audit evidence: `docs/ops/reports/delivery-system-preview-isolation-audit.md`

---

## Scope

| Environment | Definition | Isolation status (2026-07-13) |
| --- | --- | --- |
| **Production** | `main` branch deploy to `www.lougehrigfanclub.com` | Authoritative write target |
| **Preview** | Per-PR or per-branch Cloudflare Pages URL | **Not isolated** — shares production bindings |
| **Component** | Model B child branch (e.g. `component/delivery-system-v1`) preview URL | **Not isolated** — shares production bindings |
| **Local** | `npm run dev` with optional `PAGES_SITE_URL` proxy | Depends on operator `.env`; defaults safe |

Delivery policy (#2495) classifies PR **intent** (`Target environment: component|preview|production|recovery`). This document classifies **runtime resource behavior**. Auto-integration on Model B child PRs remains blocked for protected paths until runtime isolation is proven (`docs/explanation/projects/two-model-delivery-system-design.md`, Environment isolation section).

---

## Classification vocabulary

| Class | Meaning |
| --- | --- |
| **isolated** | Separate resource instance; preview writes cannot reach production |
| **read-only** | Preview may read but cannot mutate the resource |
| **test-namespaced** | Writes allowed only into a dedicated test namespace or schema |
| **disabled** | Feature off by default on non-production; no mutation when unset |
| **production-shared** | Preview and production use the same resource; writes affect production |

Every resource below has exactly one primary classification.

---

## Platform resources

### Cloudflare Pages

| Resource | Class | Evidence | Blocking rule |
| --- | --- | --- | --- |
| Pages project `next-starter-template` | **production-shared** | `docs/reference/platform/CLOUDFLARE.md`, `wrangler.toml` | Same project, secrets, and function bindings for preview and production URLs. URL alone does not isolate data. |
| API rate limiting | **production-shared** | Dashboard Rate Limiting / WAF; middleware optional (`docs/how-to/website/api-rate-limiting.md`, #527) | Do not use `wrangler.toml` `[[ratelimits]]` on Pages (ignored). Dashboard / shared abuse-control changes require `protected-change-review`. |

### Cloudflare D1

| Resource | Class | Evidence | Blocking rule |
| --- | --- | --- | --- |
| Database `lgfc_lite` (`22d0dc3e-ad34-43af-8e6a-2063df1a1e04`) | **production-shared** | `wrangler.toml`, `functions/_lib/d1.ts` | Single `database_id` in repo with no `[[env.preview.d1_databases]]` override. All Pages Functions use `env.DB` with no environment guard. |

**Protected:** provisioning a separate preview D1 or runtime write guard requires platform decision and is out of scope for documentation-only corrections.

### Backblaze B2

| Resource | Class | Evidence | Blocking rule |
| --- | --- | --- | --- |
| B2 object list at runtime | **read-only** | `functions/_lib/b2.ts` | ListObjectsV2 only; no PutObject/DeleteObject in `functions/**`. |
| Admin `POST /api/admin/media-assets/sync-from-b2` | **production-shared** | `functions/api/admin/media-assets/sync-from-b2.ts`, `docs/ops/tasks/MEDIA-01.md` | Inserts into `media_assets` on production D1 when B2 secrets and `ADMIN_TOKEN` are present on preview. |

### Email

| Resource | Class | Evidence | Blocking rule |
| --- | --- | --- | --- |
| MailChannels (`MAILCHANNELS_ENABLED`) | **disabled** (default) | `functions/_lib/email.ts`, `.env.example` | Default `MAILCHANNELS_ENABLED=0` returns `{ provider: 'disabled' }`. |
| MailChannels when enabled | **production-shared** | Same | Sends real email via `api.mailchannels.net` to production addresses. **Preview must keep `MAILCHANNELS_ENABLED=0`.** |

### Analytics

| Resource | Class | Evidence | Blocking rule |
| --- | --- | --- | --- |
| Google Analytics 4 (`NEXT_PUBLIC_GA_ID`) | **disabled** (default) | `src/components/GoogleAnalytics.tsx`, `.env.example` | Empty GA id skips script load. |
| GA when set at build time | **production-shared** | Same | Pollutes production GA property. **Preview builds must leave `NEXT_PUBLIC_GA_ID` unset.** |

### Admin credentials

| Resource | Class | Evidence | Blocking rule |
| --- | --- | --- | --- |
| `ADMIN_TOKEN` gate | **disabled** when unset | `functions/_lib/auth.ts` | Admin routes return 401 without token. |
| Admin APIs when token set | **production-shared** | `functions/api/admin/**` | Full CMS, editorial, matchup, FAQ, events, and sync surface writes production D1. **Preview must not mirror production `ADMIN_TOKEN`.** |

### AI review

| Resource | Class | Evidence | Blocking rule |
| --- | --- | --- | --- |
| AI review routes | **read-only** | `src/lib/aiReviewAccess.ts`, `functions/api/_ai-review/page-snapshot.ts` | POST/PUT/PATCH/DELETE return 405; enabled only with `AI_REVIEW_ENABLED=1` and token. |

---

## API mutation inventory

All routes below write to production D1 when preview binds the production database.

### Public and member routes (no admin token)

| Method | Route | Handler | Tables / effect |
| --- | --- | --- | --- |
| POST | `/api/join` | `functions/api/join.ts` | `join_requests`, `join_email_log`; optional email |
| POST | `/api/ask` | `functions/api/ask.ts` | `join_requests`; optional email |
| POST | `/api/login` | `functions/api/login.ts` | `login_attempts`, `member_sessions` |
| POST | `/api/logout` | `functions/api/logout.ts` | `member_sessions` |
| POST | `/api/matchup/vote` | `functions/api/matchup/vote.ts` | `weekly_votes` |
| GET | `/api/matchup/current` | `functions/api/matchup/current.ts` | **Side-effect write:** closes stale rows, upserts `weekly_matchups` on homepage load |
| POST | `/api/faq/submit` | `functions/api/faq/submit.ts` | `faq_entries` |
| POST | `/api/faq/view` | `functions/api/faq/view.ts` | view counters |
| POST | `/api/reports/create` | `functions/api/reports/create.ts` | `reports` |
| POST | `/api/reports/close` | `functions/api/reports/close.ts` | `reports` (admin token required) |
| POST | `/api/fanclub/profile` | `functions/api/fanclub/profile.ts` | `members`, `join_requests` |
| POST | `/api/library/submit` | `functions/api/library/submit.ts` | `library_entries` |
| POST | `/api/library/content-pipeline/submit` | `functions/api/library/content-pipeline/submit.ts` | content pipeline tables |
| POST | `/api/discussions/create` | `functions/api/discussions/create.ts` | `discussions` |

### Admin routes (`/api/admin/**`)

Approximately 40 admin handlers under `functions/api/admin/**` perform D1 INSERT/UPDATE/DELETE for CMS, content, editorial, FAQ, events, matchups, worklist, welcome email, ask moderation, content-pipeline review, and B2 sync. All require `ADMIN_TOKEN` or member admin session and are **production-shared** when credentials are present on preview.

---

## CI and operator scripts (not preview-invoked)

| Resource | Class | Evidence | Blocking rule |
| --- | --- | --- | --- |
| D1 migrations on `main` | **production-shared** | `.github/workflows/d1-migrations.yml` | Remote `wrangler d1 migrations apply lgfc_lite --remote` |
| Manual D1 migrate workflow | **production-shared** | `.github/workflows/lgfc-d1-migrate.yml` | Operator-triggered production migration |
| B2→D1 daily sync | **production-shared** | `.github/workflows/b2-d1-daily-sync.yml` | Scheduled production D1 writes from B2 inventory |
| Local migrate/seed scripts | **production-shared** when run with prod creds | `scripts/d1-prod-migrate.sh`, `scripts/content-pipeline/import-seed-candidates.mjs` | Not reachable from preview URL; operator responsibility |

---

## Automatic blocking rules

These rules are enforced today without a separate preview database:

1. **Delivery profile protected paths** — `scripts/ci/delivery_profile.mjs` marks `wrangler*.toml`, `functions/api/admin/**`, `migrations/**`, and governance paths as protected; Model B child PRs touching them require `protected-change-review` instead of auto-integration.

2. **Repository inventory test** — `tests/preview-isolation-inventory.test.ts` fails if:
   - a new mutating Pages Function handler is not listed in `scripts/ci/preview-isolation-manifest.json`;
   - `wrangler.toml` gains preview D1 env blocks without manifest update;
   - `.env.example` loses preview-safe defaults (`MAILCHANNELS_ENABLED=0`, empty `NEXT_PUBLIC_GA_ID`).

3. **Fail-closed bindings** — `functions/_lib/d1.ts` and `functions/_lib/b2.ts` return 503 when bindings are missing (availability, not separation).

4. **Email fail-closed default** — `MAILCHANNELS_ENABLED=0` disables outbound email in code.

5. **Admin fail-closed default** — missing `ADMIN_TOKEN` blocks admin mutations.

### Configuration rules for preview and component deploys

| Variable | Required preview value | Risk if production value mirrored |
| --- | --- | --- |
| `MAILCHANNELS_ENABLED` | `0` | Real email to members and admins |
| `NEXT_PUBLIC_GA_ID` | *(unset)* | Production analytics pollution |
| `ADMIN_TOKEN` | *(unset or preview-only)* | Full admin write surface on production D1 |
| B2 secrets | Omit unless testing sync intentionally | B2→D1 sync writes production `media_assets` |

### What is not blocked automatically

- Public and member API writes to production D1 from any preview URL with standard bindings.
- `GET /api/matchup/current` side-effect rotation.
- Shared D1 binding until a separate preview database is provisioned in Cloudflare.

These paths are classified **production-shared** and marked **protected** for Model B integration decisions.

---

## Evidence-backed corrections implemented (#2496)

| Correction | Type | Notes |
| --- | --- | --- |
| Canonical isolation reference (this document) | Documentation | Full inventory and blocking rules |
| Audit report | Documentation | Evidence table and gap analysis |
| `preview-isolation-manifest.json` | CI artifact | Machine-readable inventory |
| `preview-isolation-inventory.test.ts` | CI enforcement | Prevents silent inventory drift |

**Not implemented (requires platform decision):** separate preview D1, runtime `CF_PAGES_ENV` write guard, Wrangler env-specific bindings. Documented as protected follow-up.

---

## Related authority

- `docs/governance/PLATFORM-AND-ENVIRONMENT.md` — Platform and Environment Domain Policy
- `docs/reference/platform/CLOUDFLARE.md` — Cloudflare resource inventory
- `docs/governance/DELIVERY-AND-RELEASE.md` — delivery and approval policy (#2495)
- `docs/reference/ci/delivery-profile-contract.md` — delivery metadata contract
- `docs/explanation/projects/two-model-delivery-system-design.md` — isolation requirements for Model B
