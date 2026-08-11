---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Evidence-backed description of the LGFC website as currently implemented and deployed in Production (current as-built baseline)
Does Not Own: Product design intent; design-vs-as-built gap decisions; Production remediation; runtime configuration secrets
Canonical Reference: /docs/reference/website/lgfc-website-as-built-current.md
Source Issue: #3324
Related Issues: #3305, #3074, #3148, #3149
Last Reviewed: 2026-08-11
---

# LGFC Website Production As-Built (Current)

## Purpose

Record **what is actually built, deployed, configured, reachable, and functioning** on Production at `https://www.lougehrigfanclub.com` as of the baseline date below.

As-built documentation records reality. It does **not** define design intent.

## Scope

In scope: public routes, homepage composition, auth/member/Fan Club surfaces, admin surfaces, APIs/Functions, D1/media relationships, content/media behavior, responsive/UI facts material to operation, and a Production verification matrix.

Out of scope: redesign, Production remediation, design-doc rewrites, design archive decisions, and secret exposure.

## Current known truth

**Baseline timestamp:** 2026-08-11 (live probes + `main` source inspection after #3305 remediation window).

**Platform (verified from `wrangler.toml` + live `/api/health`):**

| Fact | Value |
| --- | --- |
| Hosting | Cloudflare Pages (`pages_build_output_dir = "./out"`) |
| App | Next.js App Router static export + Pages Functions under `functions/api/**` |
| D1 binding | `DB` → database name `lgfc_lite` |
| Health | `GET /api/health` returned `{"ok":true,"db_ok":true}` |
| Media | Photo URLs observed on Backblaze B2 (`s3.us-east-005.backblazeb2.com/LouGehrigFanClub/...`) |
| Analytics | GA4 measurement ID / gtag identifier `G-BRV48J1VE` present in Production HTML |

## Intended final state

One canonical current website as-built authority at this path. Historical reconciliation snapshots remain historical. Design documents remain design authority and are not updated by this Issue.

## Evidence status legend

| Status | Meaning |
| --- | --- |
| `VERIFIED_PRODUCTION` | Observed on live Production |
| `VERIFIED_SOURCE_ONLY` | Present in repository source; not fully exercised live |
| `AUTH_GATED_NOT_FULLY_OBSERVED` | Requires member session; unauthenticated behavior only observed |
| `ADMIN_GATED_NOT_FULLY_OBSERVED` | Requires admin role; unauthenticated behavior only observed |
| `UNVERIFIED` | Not confirmed |

---

## 1. Public routes and navigation

### 1.1 Route inventory (live HTTP)

Probed 2026-08-11 with `curl -sL` (follow redirects):

| Path | Final HTTP | Final URL | Notes | Evidence |
| --- | --- | --- | --- | --- |
| `/` | 200 | `/` | Homepage | `VERIFIED_PRODUCTION` |
| `/about` | 200 | `/about/` | Fan Club about | `VERIFIED_PRODUCTION` |
| `/join` | 200 | `/join/` | Join/Login dual surface | `VERIFIED_PRODUCTION` |
| `/ask` | 200 | `/ask/` | FAQ browse + Ask workflow | `VERIFIED_PRODUCTION` |
| `/faq` | 200 | `/faq/` | Client redirect page to `/ask/` | `VERIFIED_PRODUCTION` + source |
| `/search` | 200 | `/search/` | Public search UI | `VERIFIED_PRODUCTION` |
| `/contact` | 200 | `/contact/` | Contact page | `VERIFIED_PRODUCTION` |
| `/privacy` | 200 | `/privacy/` | Privacy policy | `VERIFIED_PRODUCTION` |
| `/terms` | 200 | `/terms/` | Terms | `VERIFIED_PRODUCTION` |
| `/health` | 200 | `/health/` | Health page | `VERIFIED_PRODUCTION` |
| `/events` | 200 | `/events/` | Events calendar page | `VERIFIED_PRODUCTION` |
| `/login` | 200 | `/` | Legacy client redirect to home | `VERIFIED_PRODUCTION` |
| `/logout` | 200 | `/logout/` | Logout page | `VERIFIED_PRODUCTION` |
| `/auth` | 200 | `/join/` | Legacy redirect to join | `VERIFIED_PRODUCTION` |
| `/fanclub` | 200 | `/fanclub/` | HTML shell; client session gate | `AUTH_GATED_NOT_FULLY_OBSERVED` |
| `/admin` | 200 | `/admin/` | HTML shell; admin session gate | `ADMIN_GATED_NOT_FULLY_OBSERVED` |

**Sitemap routes declared in source** (`src/lib/publicSiteMetadata.ts`): `/`, `/about/`, `/ask/`, `/contact/`, `/events/`, `/faq/`, `/join/`, `/login/`, `/privacy/`, `/search/`, `/terms/`.

### 1.2 Header navigation (public)

Source: `src/components/Header.tsx`, `src/components/HamburgerMenu.tsx`.

Guest center buttons: **Join**, **Search**, **Store** (external Bonfire), **Login**, hamburger.

Member center buttons: **Club Home**, **Search**, **Store**, **Logout**, hamburger.

Store target: `https://www.bonfire.com/store/lou-gehrig-fan-club/` (new tab).

Login tab route constant: `/join?mode=login`.

Hamburger guest items: Join, Search, Store, Login, About, Contact.

Hamburger member (public): Club Home, Search, Store, Logout, About, Contact.

Hamburger fanclub variant (source): Club Home, My Profile, Search, Store, Logout, About, Contact.

Live desktop homepage showed Join / Search / Store / Login / hamburger — `VERIFIED_PRODUCTION`.

### 1.3 Legacy redirects (as implemented)

| Route | Behavior |
| --- | --- |
| `/faq` | Client `window.location.replace` to `/ask/` preserving query (`src/app/faq/page.tsx`) |
| `/login` | Client replace to `/` (`POST_LOGOUT_ROUTE`) |
| `/auth` | Live final URL `/join/`; source has `AuthClient` under `src/app/auth/` and join imports it |

---

## 2. Homepage

Source: `src/app/page.tsx`. Section order as implemented:

1. **FloatingLogo** — `src/components/FloatingLogo`
2. **Hero banner** (`#banner`) — static welcome copy referencing 2027 public relaunch
3. **CampaignSpotlightSlot** — `src/components/home/CampaignSpotlightSlot`
4. **Weekly Photo Matchup** (`#weekly`) — `WeeklyMatchup` → `/api/matchup/current`
5. **Join CTA** (`#join-cta`) — `JoinCTA`
6. **ABOUT LOU GEHRIG** (`#about-lou-gehrig`) — static biography content in page source
7. **Social Wall** (`#social-wall`) — Elfsight embed via `SocialWall`
8. **Recent Club discussions** — `RecentDiscussionsTeaser` → discussions API (auth-sensitive)
9. **Friends of the Fan Club** (`#friends-of-the-club`) — `FriendsOfFanClub` → `/api/friends/list`
10. **Milestones** (`#milestones`) — `MilestonesSection` → `/api/milestones/list`
11. **Fan Club Events Calendar** (`#calendar`) — `CalendarSection` → events APIs
12. **FAQ** (`#faq`) — `FAQSection` → `/api/faq/list`

### 2.1 Homepage Production observations (2026-08-11)

| Section | Live result | Evidence |
| --- | --- | --- |
| Hero | Renders welcome + 2027 relaunch text | `VERIFIED_PRODUCTION` |
| Weekly Photo Matchup | Two B2-hosted images rendered; title “Weekly Photo Matchup. Vote for your favorite!” | `VERIFIED_PRODUCTION` |
| Join CTA | Present with membership messaging | `VERIFIED_PRODUCTION` |
| ABOUT LOU GEHRIG | Biography sections render from static page content | `VERIFIED_PRODUCTION` |
| Social Wall | Component loads `https://elfsightcdn.com/platform.js` with widget class from `SOCIAL_WALL_WIDGET_ID`; 8s timeout + platform link fallbacks | `VERIFIED_SOURCE_ONLY` (integration) / partial live |
| Discussions teaser | API `/api/discussions/list` returns Not authenticated when unauthenticated | `VERIFIED_PRODUCTION` (unauth failure) |
| Friends | API returns charity/friend items (e.g. ALS Cure Project) | `VERIFIED_PRODUCTION` |
| Milestones | API returns placeholder row: title “Milestone placeholder”, description “This is text content from milestones table.” | `VERIFIED_PRODUCTION` |
| Calendar | API `/api/events/next` returns placeholder events | `VERIFIED_PRODUCTION` |
| FAQ section | API returns approved FAQ items | `VERIFIED_PRODUCTION` |
| Footer | Rotating quote API works; footer shows quote, © 2026, Privacy/Terms/Contact | `VERIFIED_PRODUCTION` |

**Finding (not a remediation under this Issue):** Production milestones and events data currently include explicit placeholder content from D1.

### 2.2 Social Wall as-built integration

- Client component `src/components/SocialWall.tsx`
- Loads Elfsight platform script; calls `window.elfsight.reload` when available
- On load/render failure: fallback headline + platform links from `src/lib/socialFallbacks`
- Does not re-evaluate historical Elfsight configuration decisions in this baseline

---

## 3. Authentication and Fan Club surfaces

### 3.1 Join / Login

| Fact | Implementation |
| --- | --- |
| Canonical UI | `/join` renders `AuthClient` with `defaultMode="join"` |
| Login tab | `/join?mode=login` (`LOGIN_TAB_ROUTE`) |
| Live UI | Dual tabs Join/Login; fields screen name/alias, full name, email; optional email updates checkbox | `VERIFIED_PRODUCTION` |
| APIs | `functions/api/join.ts`, `functions/api/login.ts`, `functions/api/logout.ts`, `functions/api/session/me.ts` |
| Session probe | `GET /api/session/me` unauthenticated → `{"ok":false,"error":"Not authenticated"}` | `VERIFIED_PRODUCTION` |
| Post-login route constant | `/fanclub` |
| Post-logout route constant | `/` |

Cookie/session internal names and secret values are not documented here.

### 3.2 Fan Club route inventory (source)

| Route | Source path | Gate |
| --- | --- | --- |
| `/fanclub` | `src/app/fanclub/page.tsx` | Member session via layout |
| `/fanclub/myprofile` | `src/app/fanclub/myprofile/page.tsx` | Member |
| `/fanclub/membercard` | `src/app/fanclub/membercard/page.tsx` | Member |
| `/fanclub/library` | `src/app/fanclub/library/page.tsx` | Member |
| `/fanclub/photo` | `src/app/fanclub/photo/page.tsx` | Member |
| `/fanclub/memorabilia` | `src/app/fanclub/memorabilia/page.tsx` | Member |
| `/fanclub/chat` | `src/app/fanclub/chat/page.tsx` | Member |
| `/fanclub/submit` | `src/app/fanclub/submit/page.tsx` | Member |

Layout (`src/app/fanclub/layout.tsx`): `useMemberSession({ redirectTo: '/' })`; unauthenticated users see null content and are redirected home — `AUTH_GATED_NOT_FULLY_OBSERVED` for authenticated feature behavior.

Member APIs under `functions/api/fanclub/**`: `home.ts`, `library.ts`, `memorabilia.ts`, `photos.ts`, `profile.ts`, tags endpoints.

---

## 4. Admin surfaces

Layout (`src/app/admin/layout.tsx`): requires authenticated session with `role === 'admin'`; otherwise redirect home.

| Admin route | Source |
| --- | --- |
| `/admin` | `src/app/admin/page.tsx` |
| `/admin/cms` | CMS management UI |
| `/admin/content` | Content management |
| `/admin/editorial` | Editorial inventory/review |
| `/admin/events` | Events administration |
| `/admin/faq` | FAQ moderation |
| `/admin/matchup` | Weekly matchup admin |
| `/admin/media-assets` | Media asset list/sync |
| `/admin/join-requests` | Join request list |
| `/admin/member-operations` | Member operations |
| `/admin/moderation` | Moderation |
| `/admin/audit` | Audit UI |
| `/admin/worklist` | Worklist |
| `/admin/clubstaging` | Club staging preview |
| `/admin/fundraiser-preview` | Fundraiser preview |
| `/admin/d1-test` | D1 test surface |

Admin APIs under `functions/api/admin/**` cover ask/faq/cms/content/editorial/events/matchup/media-assets/join-requests/worklist/stats/export/membership-card/welcome-email/footer-quotes/d1-inspect/content-pipeline.

**All admin UI and admin API behavior: `ADMIN_GATED_NOT_FULLY_OBSERVED`.**

---

## 5. Backend / data

### 5.1 Boundary

- Static pages exported to `out/` (Cloudflare Pages)
- Dynamic behavior via Pages Functions `functions/api/**`
- Middleware: `functions/api/_middleware.ts`
- Rate limiting: `wrangler.toml` `[[ratelimits]]` removed (#527); Pages ignored that field. Middleware optionally uses `env.API_RATE_LIMITER` if present; authoritative control plane is dashboard Rate Limiting / WAF (`docs/how-to/website/api-rate-limiting.md`)

### 5.2 D1 tables (from migrations; production-relevant)

Observed migration-created tables include (non-exhaustive of every column evolution):

| Table | Migration signal | Used by |
| --- | --- | --- |
| `join_requests` | 0004 | Join flow / admin |
| `photos` | 0003 | Matchup, galleries, media |
| `faq_entries` | 0013 | Public FAQ, admin FAQ |
| `events` | 0014 | Calendar, admin events |
| `milestones` | 0015 | Homepage milestones |
| `friends` | 0016 | Friends of Fan Club |
| `weekly_matchups` (+ related) | 0018 | Weekly Photo Matchup |
| `members` | 0019 | Auth roles |
| `reports` | 0030 | Reporting/moderation |
| `ask_inbox` | 0033 | Ask intake |

Additional tables/evolutions exist across later migrations (sessions, library, content inventory, membership card, etc.) — `VERIFIED_SOURCE_ONLY` at schema level.

### 5.3 Media

Live matchup items use absolute B2 URLs under bucket path `LouGehrigFanClub/`. Admin media sync endpoint exists: `functions/api/admin/media-assets/sync-from-b2.ts`.

---

## 6. API / function inventory (website-related)

Paths are Cloudflare Pages Function routes under `/api/...`.

### 6.1 Public / session

| Endpoint | Purpose | Auth (observed/source) | Live sample |
| --- | --- | --- | --- |
| `GET /api/health` | Health + DB probe | Public | ok/db_ok true |
| `GET /api/session/me` | Current session | Cookie | Not authenticated |
| `POST /api/join` | Join | Public form | source |
| `POST /api/login` | Login | Public form | source |
| `POST /api/logout` | Logout | Session | source |
| `GET /api/matchup/current` | Active weekly matchup | Public | ok, matchup_id 9 |
| `POST /api/matchup/vote` | Vote | Public/session rules in source | source |
| `GET /api/matchup/results` | Results | Public | source |
| `GET /api/matchup/repair` | Repair helper | source | source |
| `GET /api/faq/list` | Approved FAQs | Public | ok + items |
| `POST /api/faq/submit` | FAQ submit | source | source |
| `POST /api/faq/view` | View count | source | source |
| `POST /api/ask` | Ask intake | Public | source |
| `GET /api/friends/list` | Friends list | Public | ok + items |
| `GET /api/milestones/list` | Milestones | Public | ok + placeholder |
| `GET /api/events/next` | Upcoming events | Public | ok + placeholders |
| `GET /api/events/month` | Month events | Public | source |
| `GET /api/footer-quote` | Footer quote | Public | ok + Gehrig quote |
| `GET /api/search` | Site search | Public | source + live callable |
| `GET /api/discussions/list` | Discussions | Auth required | Not authenticated |
| `POST /api/discussions/create` | Create discussion | Auth | source |
| `GET /api/photos`, `/photos/list`, `/photos/get` | Photo listing | Mixed | source |
| `GET /api/content/get`, `/content/membercard` | Content | Mixed | source |
| `GET /api/cms/get` | CMS get | Mixed | source |
| `GET /api/membership-card` | Member card content | Mixed | source |
| `POST /api/csp-report` | CSP reports | Public | source |
| `GET /api/env/check` | Env check | source | source |
| `GET /api/d1-test` | D1 test | source | source |

### 6.2 Fan Club APIs

`/api/fanclub/home`, `/library`, `/memorabilia`, `/memorabilia/tags`, `/photos`, `/photos/tags`, `/profile` — member-authenticated in source — `AUTH_GATED_NOT_FULLY_OBSERVED`.

### 6.3 Admin APIs

Under `/api/admin/**` for ask, faq, cms, content, content-pipeline, editorial, events, matchup, media-assets, join-requests, worklist, stats, export, membership-card, welcome-email, footer-quotes, d1-inspect, reports — `ADMIN_GATED_NOT_FULLY_OBSERVED`.

---

## 7. Content / media behavior

| Behavior | As-built |
| --- | --- |
| Photo storage | B2 public object URLs referenced from D1 `photos` |
| Matchup rotation | D1 `weekly_matchups`; public current endpoint returns active pair |
| FAQ content | D1 `faq_entries`; approved items public |
| Ask intake | D1 `ask_inbox` via `/api/ask` |
| Editorial/CMS | Admin editorial + cms APIs/pages | admin-gated |
| Content inventory | Admin/content-pipeline + reference docs exist; member library submit APIs present |
| Search | `/api/search` aggregates searchable surfaces in Function implementation |

---

## 8. Responsive / UI (material facts)

- Global styles: `src/app/globals.css`; homepage module CSS present
- Header uses CSS modules; hamburger menu for overflow/primary mobile pattern
- Live desktop homepage (1920px probe) showed centered logo, right-side action buttons, matchup two-up layout
- Mobile-specific breakpoints: present in CSS modules — detailed pixel audit not performed; not a redesign review

Evidence: `VERIFIED_PRODUCTION` (desktop shell) + `VERIFIED_SOURCE_ONLY` (CSS breakpoints).

---

## 9. Operational / runtime behavior

| Behavior | Observation |
| --- | --- |
| Health page + API | Both return success with DB ok |
| Unauthenticated Fan Club | Layout returns null + redirect to `/` |
| Unauthenticated Admin | Layout returns null + redirect to `/` unless admin |
| Discussions unauthenticated | API error Not authenticated |
| Matchup loading | Client “Loading matchup…” then images |
| Placeholder data | Milestones and events APIs return explicit placeholder rows |
| Client/server split | Static export UI; data via browser `fetch` to Functions |
| Rate limiting | Dashboard Rate Limiting / WAF intended; `wrangler.toml` `[[ratelimits]]` removed (#527); middleware optional |

---

## 10. Production verification matrix

| Surface | Status |
| --- | --- |
| Homepage shell + hero + about biography | `VERIFIED_PRODUCTION` |
| Weekly Photo Matchup | `VERIFIED_PRODUCTION` |
| Join/Login page UI | `VERIFIED_PRODUCTION` |
| Public FAQ API + homepage FAQ section | `VERIFIED_PRODUCTION` |
| Friends API | `VERIFIED_PRODUCTION` |
| Milestones API (placeholder content) | `VERIFIED_PRODUCTION` |
| Events next API (placeholder content) | `VERIFIED_PRODUCTION` |
| Footer quote API + footer links | `VERIFIED_PRODUCTION` |
| Health API | `VERIFIED_PRODUCTION` |
| Session unauthenticated | `VERIFIED_PRODUCTION` |
| `/faq` legacy client redirect | `VERIFIED_PRODUCTION` |
| `/login` legacy redirect to home | `VERIFIED_PRODUCTION` |
| `/auth` → `/join` | `VERIFIED_PRODUCTION` |
| Search page reachability | `VERIFIED_PRODUCTION` |
| Social Wall Elfsight integration | `VERIFIED_SOURCE_ONLY` / partial live |
| Fan Club authenticated features | `AUTH_GATED_NOT_FULLY_OBSERVED` |
| Admin authenticated features | `ADMIN_GATED_NOT_FULLY_OBSERVED` |
| Vote/login/join POST success paths | `UNVERIFIED` (not exercised) |
| Full search result quality | `UNVERIFIED` |

### Could not fully verify

- Authenticated Fan Club library/photo/memorabilia/chat/submit UX
- Admin editorial/CMS/matchup-admin workflows
- Join and login success cookies end-to-end
- Matchup vote write path
- Social Wall third-party widget full render reliability
- Every D1 table row count and data quality beyond sampled public APIs

---

## 11. Disposition of prior as-built / current-state docs

| Document | Disposition |
| --- | --- |
| `docs/reference/website/lgfc-website-as-built-current.md` | **This file** — canonical current Production as-built authority (refreshed #3324) |
| `docs/reference/website/lgfc-website-as-built-reconciliation.md` | **Historical** Phase 1 / June 2026 snapshot — not current Production authority |
| Prior #3074 reconciliation prose in previous revision of this file | **Superseded** by this Production-evidence baseline; design decisions remain in design docs, not here |
| `docs/ops/as-built/*` program as-builts | **Retain** as program closeout evidence; not website Production inventory |
| Design docs under `docs/reference/design/**` | **Unchanged** by this Issue (design authority, not as-built) |

---

## 12. Findings recorded without remediation

1. Production milestones API returns placeholder milestone content.
2. Production events API returns placeholder event content.
3. Homepage discussions teaser depends on authenticated discussions list; guests see loading/empty/error path rather than public discussion data.
4. `/faq` remains a 200 HTML page that client-redirects (not HTTP-level redirect).
5. `/login` client-redirects to `/` rather than `/join?mode=login` (source-constant `POST_LOGOUT_ROUTE`).

These are as-built facts for later design-comparison Issues. No Production change is authorized under #3324.

---

## Related references

- Platform config: `wrangler.toml`
- Homepage: `src/app/page.tsx`
- Public metadata/sitemap: `src/lib/publicSiteMetadata.ts`
- Auth route constants: `src/lib/auth-routes.ts`
- Header/nav: `src/components/Header.tsx`, `src/components/HamburgerMenu.tsx`
- Functions: `functions/api/**`
- Migrations: `migrations/**`
- Historical reconciliation: `docs/reference/website/lgfc-website-as-built-reconciliation.md`
