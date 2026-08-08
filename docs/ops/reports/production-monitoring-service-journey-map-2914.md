---
Doc Type: Operations Report
Audience: Bill, Day-2 Operations, Implementation/Operations, PMO/Engineering, implementation agents
Authority Level: Controlled
Owns: #2780 Task 001 — Production service/journey/signal/owner/severity/evidence map
Does Not Own: Signal collector implementation (#2915), Operations Issue routing/runbooks (#2916/#2917), CI/delivery-pipeline monitoring (owned by #2680 and `docs/ops/ci-monitoring-ownership.md`), any Production mutation
Canonical Reference: /docs/ops/reports/production-monitoring-service-journey-map-2914.md
Related Issues: #2780, #2914, #2915, #2916, #2917
Last Reviewed: 2026-08-08
---

# Production monitoring service/journey/signal/owner/severity map (#2780 Task 001)

## Purpose and scope boundary

This is the first of four #2780 work units: "Map Production services, journeys,
signals, owners, severity, expected response, and zero-cost evidence sources."
It is a **documentation and inventory deliverable only** — no workflow YAML,
signal collector, or issue-routing code is added here. No Production read or
write was performed to produce it; it is grounded entirely in a static read of
this repository's own source (`functions/api/**`, `.github/workflows/**`,
`migrations/*.sql`, `wrangler.toml`, `src/app/**`).

**This project monitors the public website, member/fundraiser journeys,
data/media integrations, and Production deployments** — the end-user-facing
site, per #2780's own reconciled objective. It does **not** monitor this
repository's CI/delivery pipeline (PR gates, post-merge validation, reviewer
lifecycle, orchestration) — that is #2680's domain, already documented in
`docs/ops/ci-monitoring-ownership.md` and
`docs/ops/reports/program-1-ops-monitoring-snapshot.md`. Several existing
scheduled workflows sit at the boundary between these two domains (they run
under the repo's CI/Actions infrastructure but check actual site/data health,
not delivery-pipeline health); this map treats those as **in scope** for
#2780 because their *purpose* is production health, and cross-references the
CI-ownership docs rather than duplicating them.

## Severity rubric (authoritative source: #2780)

| Severity | Definition |
|---|---|
| **P1** | Unavailable, unsafe, destructive, security/privacy exposure, or fundraiser-critical failure |
| **P2** | Major journey unavailable without acceptable fallback |
| **P3** | Degraded/partial service or repeated error requiring remediation |
| **P4** | Bounded defect with acceptable workaround |
| **Monitoring/Hold** | Follows repository authority; not an active incident |

## Ownership model (authoritative source: #2780)

| Role | Accountability |
|---|---|
| **Bill / Day-2 Operations** | Incident and recovery authority — the escalation target for P1/P2 |
| **Implementation/Operations** (agent role) | Bounded remediation within stop conditions |
| **Administration** | Evidence reconciliation |
| **PMO/Engineering** | Material design changes |

Every row below cites the accountable role(s) from this table, not a named
individual — this is a zero-budget volunteer operation with no dedicated
on-call staff, matching #2780's own framing ("on-call practicality for a
zero-budget volunteer operation").

## No-secret evidence contract

Applies to every signal, collector, and Operations Issue this program produces
(#2915–#2917) and to this map's own sourcing:

**Never capture or log:** raw email addresses, session cookies/tokens,
`ADMIN_TOKEN`, B2 credentials (`B2_KEY_ID`/`B2_APP_KEY`/`B2_ENDPOINT`),
`MAILCHANNELS_API_KEY`, raw IP addresses, or full request bodies containing
member PII.

**Safe to capture:** HTTP status codes, response timing, aggregate row
*counts* (never row content), boolean pass/fail per check, workflow run
IDs/URLs, schema metadata (table/column names — not values), and
non-reversible client fingerprints (hashed IP, never a full raw IP;
truncated rather than raw user-agent).

This isn't a new policy — it's already the pattern this codebase uses,
though not uniformly, and #2915's collectors should follow the *strongest*
existing precedent below rather than assume every example uses the same
technique:
- `functions/_lib/d1.ts` (`requireD1`/`requireTables`) and
  `functions/_lib/env.ts` (`checkEnv`) fail closed on missing
  bindings/secrets without ever logging their values.
- `functions/api/matchup/vote.ts` computes a real cryptographic
  `SHA-256` digest (`crypto.subtle.digest`) over IP+UA+week for its
  anti-spam vote-dedup hash — the strongest fingerprinting pattern in
  this codebase.
- `functions/_lib/matchup-repair-audit.ts` is weaker and should not be
  read as the SHA-256 precedent: it hashes only the IP, via a lightweight
  non-cryptographic FNV-1a-style fingerprint (`hashIp`, explicitly
  commented "not auth"-grade), and logs the user-agent as plain text
  truncated to 180 characters rather than hashing it. It's still the one
  place in the runtime with a real structured-log event schema, but
  #2915 should match `matchup/vote.ts`'s SHA-256 approach for any new
  IP/UA fingerprinting, not this one.
- `scripts/ci/production_d1_preflight_2913.mjs` (#2913) emits only column
  names/types from a schema check, never row content, and never prints its
  own credentials.

## Service/journey inventory

Grouped by user-facing journey (not by individual API route — routes are
cited as evidence, not as separate rows) per the acceptance criteria: *"Every
critical service and journey has a proportionate signal or explicit
monitoring gap, an accountable owner, a severity rule, and a no-secret
evidence contract."*

### Public / anonymous journeys

| Journey | Critical? | Existing signal | Severity if failed | Owner | Evidence source |
|---|---|---|---|---|---|
| **Public site availability** (home, static pages, core routes reachable) | Yes | `production-audit.yml` (Playwright invariants, 2×/day) + `ops-assess.yml` (nightly route/marker crawl, `continue-on-error: true` soft-fail) | P1 | Bill/Day-2 Ops (incident); Implementation/Ops (remediation) | HTTP status + Playwright pass/fail artifacts, no PII |
| **Weekly Photo Matchup — voting** (`POST /api/matchup/vote`) | Yes — explicitly fundraiser-equivalent per #2780 | `matchup-pair-monitor.yml` (hourly) — drift detection, auto-remediation, findings issue on drift | P1 | Bill/Day-2 Ops (incident); Implementation/Ops (remediation) | Pair ids/URL names + week_start only; anti-spam hash (`weekly_votes`) never exposed |
| **Weekly Photo Matchup — results/current pair display** | Yes | Same as above (`matchup/current.ts` self-heals broken photo refs via live availability probe) | P1 | Bill/Day-2 Ops; Implementation/Ops | Same as above |
| **Public FAQ / Ask-a-question** (`faq/*`, `ask.ts`) | No | **Gap** — no synthetic check; covered only incidentally if `production-audit`/`ops-assess` happen to crawl these routes | P3 | Implementation/Ops | N/A until #2915 adds one |
| **Public search** (`search.ts`) | No | **Gap** — same as above | P3 | Implementation/Ops | N/A until #2915 |
| **Public photo/milestone/friends archive** (`photos*`, `milestones/list`, `friends/list`) | Partial | Indirectly covered by B2↔D1 daily reconcile (soft-retires rows whose B2 objects vanished); no direct "endpoint returns 200 with data" check | P2 if archive-wide broken; P3 if a subset of images broken | Implementation/Ops | Row-count deltas only (no photo content/URLs in alerts) |
| **CMS/legacy content pages** (`cms/get`, `content/get`) | Partial | **Gap** — `content/get.ts` has a Cache-API last-known-good fallback on D1 failure (self-mitigating), but nothing monitors whether that fallback is silently masking a real D1 problem | P3 | Implementation/Ops | N/A until #2915 |

### Member journeys (require `requireMember` session)

| Journey | Critical? | Existing signal | Severity if failed | Owner | Evidence source |
|---|---|---|---|---|---|
| **Member signup** (`join.ts`) | Yes | **Gap** — no synthetic signup test. `join_requests` insert is idempotent (409 on dup); email send is best-effort and does not block the request | P2 (signup blocked); P3 if only the welcome email fails | Implementation/Ops | N/A until #2915; never log submitted email/name |
| **Member login/session** (`login.ts`, session cookie) | Yes — gates all member content below | **Gap** — no synthetic login test. `login_attempts` rate-limits 3 failed/hr/IP but nothing proactively reads that table for abuse trends | P2 | Implementation/Ops | N/A until #2915; if abuse-trend signal added, hash IP as `matchup-repair-audit` does |
| **Member content** (`fanclub/home`, `library`, `memorabilia`, `photos`, `profile`, `membercard`) | Yes, once logged in | **Gap, confirmed** — `tests/e2e/launch-readiness-fanclub-routes.spec.ts` (run by `production-audit.yml`) intercepts `**/api/session/me` client-side and returns a mocked authenticated response (`page.route(...)`). It verifies the frontend renders correctly when it *believes* it's authenticated, but never performs a real login and never exercises the real backend `requireMember` guard or session cookie. This confirms — it does not merely leave open — that there is no signal for real backend member authentication/authorization | P3 (partial feature) escalating to P2 if the whole member area is down | Implementation/Ops | N/A until #2915; a real signal would need an actual test-account login, not a mock |
| **Member content submission** (`library/submit`, `library/content-pipeline/submit`, `discussions/create`) | No (internal/editorial, not public-facing until published) | **Gap** — no monitoring of submission-queue backlog growth or submit-endpoint failure rate | P3 | Implementation/Ops | Aggregate counts only |
| **Member photo upload** | N/A — **does not exist in Production.** `functions/_lib/photo-upload-validation.ts` is fully implemented but has no production/runtime callers — its only reference in the repo is `tests/photo-upload-validation.test.ts`, which exercises it in isolation; no `functions/api/**` route imports it. Photos enter the system only via the B2→D1 sync path, not member upload | N/A | Not applicable | N/A | Recorded here so a future signal isn't designed against a journey that doesn't exist |

### Admin/operational journeys

| Journey | Critical? | Existing signal | Severity if failed | Owner | Evidence source |
|---|---|---|---|---|---|
| **Admin console availability** (moderation, CMS, matchup admin, editorial pipeline) | Yes — blocks staff, not the public site | **Gap** — no confirmed authenticated-route coverage (admin routes require `ADMIN_TOKEN`, unlikely to be exercised by public-facing Playwright invariants) | P2 (staff cannot operate; public site unaffected) | Implementation/Ops; PMO/Engineering if a design change is needed | N/A until #2915; never include `ADMIN_TOKEN` in any check |
| **Editorial content pipeline** (`submission_queue`/`content_items` → review → publish) | No, until it silently corrupts already-published content | **Gap** — no automated check of publish-step success or backlog growth | P3; P2 if a publish action corrupts live content | Implementation/Ops | Aggregate counts, publish success/fail boolean |
| **Weekly matchup admin actions** (`admin/matchup/*`) | Yes for fundraiser continuity | Requires a GitHub `source_issue` reference for any pair mutation (audit-gated by design) + `logMatchupRepairAudit` structured log | P2 if admin cannot manage matchup state during an active issue | Bill/Day-2 Ops; Implementation/Ops | Structured audit event (hashed fingerprint, before/after photo ids — no member data) |

### Data/integration services

| Service | Critical? | Existing signal | Severity if failed | Owner | Evidence source |
|---|---|---|---|---|---|
| **D1 database availability** (`DB` binding, `lgfc_lite`) | Yes — everything above depends on it | `/api/health` does a best-effort `SELECT 1` ping, but **no scheduled workflow calls it** — this is a real gap despite the endpoint existing. Incidentally exercised daily by the B2↔D1 sync jobs | P1 | Bill/Day-2 Ops; Implementation/Ops | Column/table existence only (per #2913 preflight precedent), never row content |
| **B2 object storage availability** | Yes | `b2-s3-smoke-test.yml` (daily connectivity smoke) | P1 if fully unreachable; P2 if intermittent | Bill/Day-2 Ops; Implementation/Ops | Connectivity boolean only |
| **B2↔D1 sync integrity** (`media_assets`, orphaned photo reconciliation) | Yes | `b2-d1-daily-sync.yml` (incremental sync + deletion reconcile + matchup repair-on-retirement), findings issue via `ops_reconcile_findings.mjs` on actionable results | P2 if sync fails outright; P3 for drift/staleness | Implementation/Ops | Row-count deltas, retired-id counts — no photo content |
| **Email delivery** (MailChannels, `join.ts`/`ask.ts`) | No — best-effort, does not block the underlying request | **Gap** — no monitoring of send success/failure rate; `join_email_log` exists but is never proactively queried | P3 | Implementation/Ops | Aggregate send-success counts, never recipient addresses |
| **Cloudflare Pages deployment health** | Yes for shipping fixes; a failed deploy does not take the live site down (previous good deploy stays live) | `snapshot.yml` (daily rollback/recovery evidence) + `ops-cf-pages-retry.yml` (**manual-only**, capped at 2 retries, no automatic trigger on deploy failure — documented gap) | P3 (can't ship) escalating to P1 only if paired with actual site unavailability | Bill/Day-2 Ops; Implementation/Ops | Deployment status/id only |
| **Rate limiting / abuse protection** (`API_RATE_LIMITER`, `login_attempts`) | No | **Gap** — no proactive monitoring of rate-limit trigger frequency or abuse patterns; the mechanism itself is real, just not observed | P4 | Implementation/Ops | Aggregate trigger counts, hashed IP if ever added |
| **CSP violation reporting** | No | Intentionally **discarded by design** — `csp-report.ts`'s own code comment: "we rely on Cloudflare request logs during rollout." Recorded here as an accepted, explicit gap, not an oversight | Monitoring/Hold | PMO/Engineering (if ever revisited) | N/A — explicitly not collected |

## Known monitoring gaps (feeds #2915–#2917)

Consolidated from the "Gap" rows above, for the next work unit to prioritize:

1. No scheduled hit against `/api/health` (D1 availability) despite the endpoint existing.
2. No synthetic test of member signup (`join.ts`) or login (`login.ts`) — these gate nearly every other member journey.
3. Confirmed: `production-audit.yml`'s only "authenticated" spec (`launch-readiness-fanclub-routes.spec.ts`) mocks the session client-side rather than performing a real login — there is no real signal for backend member authentication, and none at all for admin routes (`ADMIN_TOKEN`-gated, not exercised by any Playwright spec found).
4. No monitoring of email delivery success/failure rate (MailChannels).
5. No monitoring of editorial/content-pipeline backlog growth or publish-step failure.
6. No automatic trigger for Cloudflare Pages deploy-failure retry (`ops-cf-pages-retry.yml` is manual-only — already known per `program-1-ops-monitoring-snapshot.md`'s gap register).
7. No proactive monitoring of rate-limiter/abuse-pattern trends.
8. `matchup-pair-monitor.yml`, `ops-design-compliance-audit.yml`, `ops-post-merge-self-healing.yml`, and `pmo-dashboard-ci-build.yml` all run on schedule but are **not** registered in `OPS_RUNTIME_SURFACE` (`scripts/ci/ops_runtime_surface.mjs`) — a pre-existing inventory-drift gap this map inherited from `program-1-ops-monitoring-snapshot.md` rather than introduced. Worth reconciling before #2915 adds more workflows to avoid compounding the drift.

## Out of scope for this task and this program

- No Production read or write was performed to produce this map.
- No paid monitoring vendor is proposed or evaluated (per #2780's explicit
  zero-additional-cost constraint).
- No workflow YAML, collector script, or issue-routing code changes — those
  are #2915 (collectors) and #2916 (routing/runbooks).
- CI/delivery-pipeline monitoring (PR gates, post-merge validation, reviewer
  lifecycle) remains #2680's domain; this map does not restate or modify
  `docs/ops/ci-monitoring-ownership.md`.
- No new named individual owners are assigned beyond the four roles #2780
  already defines — this is a zero-budget volunteer operation with no
  dedicated on-call roster to draw from.

## Related documents

| Document | Role |
|---|---|
| `docs/ops/reports/program-1-ops-monitoring-snapshot.md` | Authoritative OPS-runtime-workflow trigger/escalation/verdict matrix (CI/delivery domain — cross-referenced, not duplicated) |
| `docs/ops/ci-monitoring-ownership.md` | CI/delivery monitoring ownership model (#2680 domain) |
| `scripts/ci/ops_runtime_surface.mjs` | Machine-checked registry of OPS runtime workflows (CI/delivery domain) |
| `scripts/ci/ops_runtime_escalation.mjs` | Shared idempotent Operations-Issue escalation primitive — the recommended mechanism for #2916's routing work |
| `docs/ops/reports/library-content-production-batch-plan-2913.md` | Precedent for this repo's no-secret evidence-contract pattern in a Production-adjacent report |
