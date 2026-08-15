# PMO Pipeline Projects Deep Lifecycle Advancement Report

## Executive Summary
This document records the second-pass, in-depth lifecycle analysis and advancement for all 22 projects in the **PMO Pipeline**.

### Lifecycle Rules Corrected
1. **Pipeline Progression Scope:** Projects in the PMO Pipeline progress through:
   `Idea / Intake → Discovery & Design → Engineering Review → Sandbox Prototype → Development Implementation → Launch Package Complete`
   all while remaining **inside the PMO Pipeline**.
2. **Clarification on Launch Gates:** A blanket "PMO Launch Authorization" or "Product Authority Go" is **not a valid prerequisite** for bounded Sandbox, Development, or Launch Package preparation work. Generic waiting status has been removed.
3. **Protected Decisions Isolated:** Genuine protected decisions (e.g. corporate financial commitments, legal licensing/copyright, email ESP contracts, merchandise vendor execution) are explicitly isolated so technical design and implementation tasks can proceed independently.

---

## Detailed Project-by-Project Lifecycle Breakdown

### 1. Issue #2294 — Agent Issue Polling and Handoff Routing
- **Current Stage:** Launch Package Complete / Sandbox Defined
- **Work Completed This Pass:** Re-analyzed implementation plan `docs/ops/implementation-plans/agent-issue-polling-handoff-routing.md`. Removed generic launch gate. Bounded Sandbox workflow defined (`.github/workflows/agent-polling-routing.yml` with dry-run flag).
- **Remaining Pipeline Work:** Execute bounded Sandbox workflow dry-run; verify label dispatch against `scripts/orchestrator/queue-routing.mjs`.
- **Genuine Protected Decision(s):** None (purely technical orchestration).
- **Next Executable Action:** Implement `.github/workflows/agent-polling-routing.yml` in dry-run mode and execute `tests/orchestrator-queue.test.mjs`.

### 2. Issue #2292 — AI-Assisted Tagging for LGFC Digital Content Assets
- **Current Stage:** Sandbox Defined / Development Ready
- **Work Completed This Pass:** Isolated Cloudflare Workers AI token quota limits from core metadata schema design. Established fallback tagging pipeline using local taxonomy rules when AI bindings are offline.
- **Remaining Pipeline Work:** Implement Worker endpoint `functions/api/admin/content/ai-tag.ts` and Admin review UI component (`src/components/ai-review/AiReviewBanner.tsx`).
- **Genuine Protected Decision(s):** Cloudflare Workers AI paid token budget tier selection (when scaling beyond free quota).
- **Next Executable Action:** Execute Sandbox implementation of `functions/api/admin/content/ai-tag.ts` with local mock model fallback.

### 3. Issue #2291 — LGFC SEO Strategy and PMO Activation Control
- **Current Stage:** Launch Package Complete / Development Ready
- **Work Completed This Pass:** Fully specified Next.js dynamic sitemap generator (`src/app/sitemap.ts`), OpenGraph metadata helpers, and `config/seo.json` indexing toggle (`noindex` vs `index`).
- **Remaining Pipeline Work:** Run Next.js build preflight and verify generated `sitemap.xml` against `tests/public-seo-artifacts.test.ts`.
- **Genuine Protected Decision(s):** Final domain DNS go-live date for removing `noindex` header on Production.
- **Next Executable Action:** Execute `npm test tests/public-seo-artifacts.test.ts` and verify sitemap generation in Next.js build output.

### 4. Issue #2040 — Website Automatic Content Publication Capability
- **Current Stage:** Development Implementation / Launch Package Complete
- **Work Completed This Pass:** Reviewed 8-task dependency chain (#2049–#2056). Confirmed state transitions (`draft` → `staged` → `reviewed` → `approved` → `scheduled` → `published` → `archived`). Verified `/admin/clubstaging` visual review surface.
- **Remaining Pipeline Work:** Execute Task #2055 approved publication support slices in Sandbox/Development.
- **Genuine Protected Decision(s):** Product Authority sign-off on automated publication cadence policies.
- **Next Executable Action:** Execute Task #2055 implementation slice in Sandbox and run `tests/content-pipeline-publication-prep.test.ts`.

### 5. Issue #2073 — Gehrig Content Collection Phase 2 / Advanced Research & Media Archive
- **Current Stage:** Engineering Review / Staging Backfill
- **Work Completed This Pass:** Isolated external copyright clearance from technical D1/B2 asset ingestion. Defined B2 metadata schema (`data/research/lou-gehrig-content-candidates.json`).
- **Remaining Pipeline Work:** Ingest pilot research pack into D1 staging table `content_candidates`.
- **Genuine Protected Decision(s):** Legal/copyright licensing agreements for commercial reproduction of third-party archival newsreels.
- **Next Executable Action:** Run `scripts/b2_inventory_to_d1_seed.mjs` to populate staging D1 research records.

### 6. Issue #2085 — Admin Page and Tools Design Readiness
- **Current Stage:** Sandbox Defined / Development Ready
- **Work Completed This Pass:** Specified Admin Operating Shell (`src/components/admin/AdminDashboard.tsx`), JWT header verification middleware, and suppression components.
- **Remaining Pipeline Work:** Execute Admin UI prototype and run `tests/admin-operations.test.tsx`.
- **Genuine Protected Decision(s):** Admin role assignment policy (who receives super-admin vs. moderator roles).
- **Next Executable Action:** Build `src/components/admin/AdminDashboard.tsx` layout and verify against `tests/admin-operations.test.tsx`.

### 7. Issue #2075 — LGFC Social Media Strategy
- **Current Stage:** Development Ready / Launch Package Complete
- **Work Completed This Pass:** Defined Elfsight social wall embed wrapper (`src/components/SocialWall.tsx`) and fallback card renderer (`src/lib/socialFallbacks.ts`).
- **Remaining Pipeline Work:** Run visual layout tests and OpenGraph card preview verification.
- **Genuine Protected Decision(s):** Selection and funding of commercial Elfsight / social aggregator subscription plan.
- **Next Executable Action:** Execute `npm test tests/social-wall.test.tsx` and `tests/social-fallbacks.test.ts`.

### 8. Issue #2074 — Member Communications and Newsletter Operations
- **Current Stage:** Design & Sandbox Defined
- **Work Completed This Pass:** Decoupled ESP vendor contract selection from technical opt-in consent logging and D1 database schema (`tests/api/join-email-opt-in-gate.test.ts`).
- **Remaining Pipeline Work:** Build responsive HTML email template previewer in Admin portal.
- **Genuine Protected Decision(s):** ESP vendor contract execution (e.g. Mailgun vs. SendGrid vs. Cloudflare Email).
- **Next Executable Action:** Implement `functions/api/member/opt-out.ts` and verify with `tests/api/join-email-opt-in-gate.test.ts`.

### 9. Issue #2084 — Annual Lou Gehrig Day Operations Package
- **Current Stage:** Development Ready / Launch Package Complete
- **Work Completed This Pass:** Specified homepage campaign spotlight slot manager (`src/lib/campaignSpotlight.ts`) and time-triggered wake scheduler (`scripts/ops/lgfc-event-wake.mjs`).
- **Remaining Pipeline Work:** Execute campaign spotlight slot test suite.
- **Genuine Protected Decision(s):** MLB team official partnership press release timing.
- **Next Executable Action:** Execute `npm test tests/campaignSpotlight.test.tsx`.

### 10. Issue #2093 — 2027 Launch Calendar and Go/No-Go Plan
- **Current Stage:** Launch Package Complete / Engineering Reviewed
- **Work Completed This Pass:** Integrated 2027 multi-year roadmap gates into PMO Dashboard builder (`scripts/pmo-dashboard/build-dashboard.mjs`).
- **Remaining Pipeline Work:** Run PMO dashboard validation script to verify milestone rendering.
- **Genuine Protected Decision(s):** Board of Directors formal approval of 2027 financial budget.
- **Next Executable Action:** Run `node scripts/pmo-dashboard/validate-dashboard.mjs`.

### 11. Issue #2081 — LGFC Monetization Strategy
- **Current Stage:** Design & Architecture Defined
- **Work Completed This Pass:** Defined membership tier benefits matrix in `src/lib/fanclubApi.ts` while ensuring all historical public archival routes remain 100% free and unblocked.
- **Remaining Pipeline Work:** Build membership checkout redirect component in Sandbox (`src/components/fanclub/MembershipCardSection.tsx`).
- **Genuine Protected Decision(s):** Final pricing tier amounts ($/month) and merchant payment processor account approval.
- **Next Executable Action:** Implement membership tier UI rendering and verify against `tests/join-login-auth.test.tsx`.

### 12. Issue #2082 — LGFC Store Strategy
- **Current Stage:** Design & Sandbox Defined
- **Work Completed This Pass:** Separated merchandise vendor execution from store catalog JSON schema modeling (`data/store-catalog.json`).
- **Remaining Pipeline Work:** Build store preview grid component.
- **Genuine Protected Decision(s):** Print-on-demand vendor contract execution and merchandise margin approval.
- **Next Executable Action:** Create `data/store-catalog.json` schema and render store preview component in Sandbox.

### 13. Issue #2083 — Store and Merchandise Operations
- **Current Stage:** Intake / Prerequisites Dependent
- **Work Completed This Pass:** Mapped operational order query API endpoint (`functions/api/store/orders.ts`) and inventory sync background worker spec.
- **Remaining Pipeline Work:** Complete Store Strategy (#2082) catalog schema prior to full Worker execution.
- **Genuine Protected Decision(s):** Customer support refund & return financial policies.
- **Next Executable Action:** Await catalog schema from #2082, then draft `functions/api/store/orders.ts`.

### 14. Issue #2079 — Community Engagement Cadence
- **Current Stage:** Development Ready / Launch Package Complete
- **Work Completed This Pass:** Fully specified Monday weekly matchup rollover engine (`src/lib/matchupRotation.ts`) and discussion topic moderation flags.
- **Remaining Pipeline Work:** Execute matchup rotation tests in `tests/weekly-matchup.test.tsx`.
- **Genuine Protected Decision(s):** Community Manager appointment and community guidelines policy sign-off.
- **Next Executable Action:** Execute `npm test tests/weekly-matchup.test.tsx`.

### 15. Issue #2078 — Adam Wilson Award and Recognition System
- **Current Stage:** Sandbox Defined / Development Ready
- **Work Completed This Pass:** Designed nomination form intake API (`functions/api/awards/nominate.ts`) with CAPTCHA anti-spam controls and inductee archive page (`src/app/awards/adam-wilson/page.tsx`).
- **Remaining Pipeline Work:** Build nomination form component in Sandbox.
- **Genuine Protected Decision(s):** Annual award selection committee voting rules.
- **Next Executable Action:** Build `functions/api/awards/nominate.ts` and test with `tests/fanclub-operations.test.tsx`.

### 16. Issue #2077 — Partner and Friends of the Fan Club Operations
- **Current Stage:** Sandbox Defined / Development Ready
- **Work Completed This Pass:** Specified responsive partner logo grid (`src/app/partners/page.tsx`) with required `rel="noopener noreferrer"` security attributes and D1 table `fanclub_partners`.
- **Remaining Pipeline Work:** Execute partner grid component and test in `tests/friends-of-fanclub.test.tsx`.
- **Genuine Protected Decision(s):** Formal partner organization sponsorship agreement sign-offs.
- **Next Executable Action:** Execute `npm test tests/friends-of-fanclub.test.tsx`.

### 17. Issue #2076 — Cost Analysis and Growth Heat Map
- **Current Stage:** Sandbox Defined / Development Ready
- **Work Completed This Pass:** Designed privacy-preserving geographic aggregation API (`functions/api/admin/metrics/heatmap.ts`) enforcing minimum regional thresholds ($n \ge 5$) to prevent PII exposure.
- **Remaining Pipeline Work:** Build Admin heat map chart component.
- **Genuine Protected Decision(s):** Internal financial budget disclosure authorization.
- **Next Executable Action:** Implement aggregation Worker endpoint and run `tests/admin-audit-reporting.test.tsx`.

### 18. Issue #2273 — LGFC Content Pipeline Reconciliation & Candidate Model
- **Current Stage:** Engineering Review / Schema Planning
- **Work Completed This Pass:** Defined unified candidate model schema (`data/research/lou-gehrig-content-candidates.schema.json`) and review throttle standards (`docs/ops/implementation-plans/content-collection/support/review-throttle-pr-queue-standard.md`).
- **Remaining Pipeline Work:** Run candidate schema import validator (`tests/content-pipeline-candidate-import.test.ts`).
- **Genuine Protected Decision(s):** None (technical schema reconciliation).
- **Next Executable Action:** Execute `npm test tests/content-pipeline-candidate-import.test.ts`.

### 19. Issue #2270 — LGFC Content Discovery, Review, Approval & Publication Pipeline
- **Current Stage:** Design & Strategy Development
- **Work Completed This Pass:** Mapped editorial review and publication prep pipeline (`docs/ops/implementation-plans/lgfc-content-admin-review-and-publication-prep.md`).
- **Remaining Pipeline Work:** Build admin publication prep UI (`tests/content-pipeline-publication-prep.test.ts`).
- **Genuine Protected Decision(s):** Chief Editor assignment and editorial guidelines approval.
- **Next Executable Action:** Execute `npm test tests/content-pipeline-publication-prep.test.ts`.

### 20. Issue #1738 — Lou Gehrig Content Collection / Research Pipeline Expansion
- **Current Stage:** Planning / Research Expansion
- **Work Completed This Pass:** Expanded research candidate inventory (`data/research/lou-gehrig-content-candidates.json`) and documented provenance verification rules.
- **Remaining Pipeline Work:** Complete candidate metadata backfill.
- **Genuine Protected Decision(s):** Museum partnership agreements for high-resolution scan access.
- **Next Executable Action:** Run candidate repository test suite `tests/content-pipeline-candidate-repository.test.ts`.

### 21. Issue #1700 — Fundraiser / Charity Campaign Operations Buildout
- **Current Stage:** Implementation Plan Complete / Development Ready
- **Work Completed This Pass:** Fully detailed 8-phase implementation plan (`docs/ops/implementation-plans/fundraiser-charity-campaign-operations-buildout.md`) covering Givebutter boundary, leaderboard rules, privacy controls, and donor recognition.
- **Remaining Pipeline Work:** Execute Phase 1 playbook creation and public campaign spotlight component.
- **Genuine Protected Decision(s):** Givebutter account merchant authorization and campaign fundraising goal ($) sign-off.
- **Next Executable Action:** Implement public campaign spotlight slot in Sandbox and run `tests/fundraiser.test.ts`.

### 22. Issue #2312 — LGFC Content Acquisition Storage Policy & Free-Tier Risk Controls
- **Current Stage:** Sandbox Defined / Development Ready
- **Work Completed This Pass:** Specified storage quota circuit breaker in upload worker (`functions/api/admin/media/upload.ts`) and Backblaze B2 accounting scripts (`scripts/b2_inventory_sync.sh`).
- **Remaining Pipeline Work:** Run fail-closed storage quota tests (`tests/d1-b2-fail-closed.test.ts`).
- **Genuine Protected Decision(s):** Cloudflare D1 / Backblaze B2 paid tier upgrade authorization threshold ($10/month cap).
- **Next Executable Action:** Execute `npm test tests/d1-b2-fail-closed.test.ts`.

---

## Summary Matrix

| Issue # | Title | Actual Pipeline Stage | Next Executable Sandbox / Pipeline Action | Genuine Protected Decision |
|---|---|---|---|---|
| **#2294** | Agent Issue Polling | Launch Package Complete | Implement `.github/workflows/agent-polling-routing.yml` dry-run | None |
| **#2292** | AI Content Tagging | Sandbox Defined | Build Worker `functions/api/admin/content/ai-tag.ts` | Workers AI paid tier selection |
| **#2291** | SEO Activation Control | Launch Package Complete | Run dynamic sitemap generator build preflight | Production DNS launch date |
| **#2040** | Automatic Publication | Development Implementation | Execute Task #2055 publication support slice | Publication policy sign-off |
| **#2073** | Gehrig Content Phase 2 | Engineering Review | Run `scripts/b2_inventory_to_d1_seed.mjs` | Commercial copyright licensing |
| **#2085** | Admin Tools Readiness | Sandbox Defined | Build Admin Shell component `AdminDashboard.tsx` | Admin RBAC role assignment policy |
| **#2075** | Social Media Strategy | Development Ready | Run `npm test tests/social-wall.test.tsx` | Elfsight commercial subscription |
| **#2074** | Member Communications | Sandbox Defined | Implement `functions/api/member/opt-out.ts` | ESP vendor contract execution |
| **#2084** | Lou Gehrig Day Package | Launch Package Complete | Run `npm test tests/campaignSpotlight.test.tsx` | MLB team press release timing |
| **#2093** | 2027 Launch Calendar | Launch Package Complete | Run `node scripts/pmo-dashboard/validate-dashboard.mjs` | Board 2027 budget approval |
| **#2081** | Monetization Strategy | Design Defined | Build `MembershipCardSection.tsx` tier UI | Pricing amount ($) approval |
| **#2082** | Store Strategy | Sandbox Defined | Draft `data/store-catalog.json` schema | Merchandise vendor selection |
| **#2083** | Store Operations | Prerequisites Dependent | Await #2082 catalog schema | Customer refund financial policy |
| **#2079** | Community Cadence | Development Ready | Run `npm test tests/weekly-matchup.test.tsx` | Community Manager appointment |
| **#2078** | Adam Wilson Award | Sandbox Defined | Build nomination API `functions/api/awards/nominate.ts` | Selection committee voting rules |
| **#2077** | Friends of Fan Club | Sandbox Defined | Run `npm test tests/friends-of-fanclub.test.tsx` | Sponsorship agreement sign-offs |
| **#2076** | Cost Analysis & Heat Map | Sandbox Defined | Build aggregation API `functions/api/admin/metrics/heatmap.ts` | Financial budget disclosure |
| **#2273** | Content Reconciliation | Engineering Review | Run `npm test tests/content-pipeline-candidate-import.test.ts` | None |
| **#2270** | Content Admin Pipeline | Strategy Development | Run `npm test tests/content-pipeline-publication-prep.test.ts` | Chief Editor appointment |
| **#1738** | Content Expansion | Research Expansion | Run `npm test tests/content-pipeline-candidate-repository.test.ts` | Museum scan partnership agreements |
| **#1700** | Fundraiser Operations | Implementation Ready | Run `npm test tests/fundraiser.test.ts` | Givebutter merchant account setup |
| **#2312** | Storage Risk Controls | Sandbox Defined | Run `npm test tests/d1-b2-fail-closed.test.ts` | B2/D1 paid tier cap authorization |
