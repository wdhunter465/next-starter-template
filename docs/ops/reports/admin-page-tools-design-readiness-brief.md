---
Doc Type: Operations
Audience: Bill, ChatGPT, Cursor, Claude Code, LGFC maintainers, and reviewers
Authority Level: Controlled
Owns: Project #2085 admin page/tools design-readiness brief — live `/admin` route inventory, #2270 ten-queue gap map, IA/access recommendation, and a design-only publish recommendation
Does Not Own: Any `/admin/*` route or component implementation, authentication changes, `/admin/homestaging`, re-scoping #2039/#2040, Production website Go, or the OpenAI-name sweep (#4135)
Canonical Reference: /docs/ops/reports/content-pipeline-strategy-reconciliation-2270.md
Related Issues: #2085, #4225, #4226, #4227, #4228, #2270, #2039, #2040
Last Reviewed: 2026-09-21
---

# Admin Page and Tools Design-Readiness Brief (#2085)

## Purpose

Give later `/admin` UI work — specifically the ten content-review queues #2270 already specifies but has not built — one authoritative design-readiness record: what admin surface exists today, what remains missing or API-only, and a recommended information architecture and access model. This brief implements the ordered #2085 launch-package work units (#4225 → #4226 → #4227 → #4228) as a single accumulating Model A document.

This document adds, renames, and removes **no** `/admin/*` route, component, or API. It authorizes no runtime, authentication, or Production change. It is a docs-only deliverable on `docs/ops/reports/admin-page-tools-design-readiness-brief.md`.

## Scope and non-goals

In scope: live admin-route inventory; #2270 ten-queue gap map (delivered-UI / API-only / absent); MVP-vs-defer recommendation; IA and access/safety recommendation; a publish recommendation naming the first queue that would need its own source Issue.

Out of scope (non-goals): new `/admin/*` routes or components; `/admin/homestaging`; re-implementing or re-scoping `/admin/clubstaging` (#2039) or the publication-review surfaces (#2040); authentication changes; OAuth; hard-delete; Production publication unlock; the OpenAI-name sweep (#4135); duplicating #2270's own implementation children.

## Current known truth

| Field | Value |
| --- | --- |
| Source issue | #2085 |
| Ordered child work units | #4225 → #4226 → #4227 → #4228 (all four implemented in this document) |
| Delivery model (project launch package) | Model A — single documentation deliverable |
| Working branch | `claude/great-mccarthy-fpizfd` |
| Deliverable | This file only: `docs/ops/reports/admin-page-tools-design-readiness-brief.md` |
| Live admin routes on `main` | 18, enumerated in Work unit 1 |
| Governing queue list | #2270 "Admin UI requirements" — 10 named queues |
| Recommendation | Retain current flat `AdminNav` IA; add only the missing queue pages under a new `/admin/review/**` group when Product authorizes — see Work unit 4 |

---

## Work unit 1 (#4225) — Live `/admin` route inventory

### All 18 routes, as wired in `src/components/admin/AdminNav.tsx`

| Route | AdminNav label | Disposition |
| --- | --- | --- |
| `/admin` | Dashboard | General admin landing page |
| `/admin/moderation` | Moderation | Community-content report/flag queue (`ReportItem`: kind, target_id, reporter_email, reason) — general moderation, not a #2270 candidate queue |
| `/admin/audit` | Audit & Reporting | Same `ReportItem` moderation-report model as above, with export; **not** the #2270 content-pipeline `moderation_events`/audit-trail concept despite the shared name |
| `/admin/faq` | FAQ Queue | FAQ content management — unrelated to #2270 |
| `/admin/content` | Page Content | Static page-content editing — unrelated to #2270 |
| `/admin/cms` | CMS Blocks | CMS content-block editing — unrelated to #2270 |
| `/admin/editorial` | Editorial Archive | **Pre-existing, parallel `Submission` review workflow** (`content_inventory` / `submission_queue` schema, migrations 0036–0038): statuses `pending → triaged → under_review → approved/rejected/merged/purged`, with `triage_flags`, `duplicate_candidate`, `review_notes`, `decision_by/at`, `purge_eligible_at`, `retention_reason`. Functionally adjacent to several #2270 queues (see Work unit 2) but built on a distinct, older schema — **not** the #2270 `candidate_id`/`input_stream` model, which `migrations/0042_content_pipeline_core.sql` (`sources`/candidate metadata for Program #2286/#2288) defines separately |
| `/admin/events` | Events | Event content management — unrelated to #2270 |
| `/admin/matchup` | Matchup | Weekly matchup content — unrelated to #2270 |
| `/admin/fundraiser-preview` | Fundraiser Preview | Fundraiser content preview — unrelated to #2270 |
| `/admin/clubstaging` | Club Staging | **#2039 prior art** — visual staging/rotation preview. Not re-scoped by this brief |
| `/admin/join-requests` | Join Requests | LGFC **club membership** join-request review — a different "submission" concept than #2270 content member-submissions; do not conflate |
| `/admin/worklist` | Worklist | Admin team worklist/task tracking — unrelated to #2270 |
| `/admin/member-operations` | Member Operations | Member account operations (soft-delete, etc.) — unrelated to #2270 |
| `/admin/media-assets` | Media Assets | B2-backed media asset browser (`media_uid`, `b2_key`, `etag`, size) — **delivered #2270-adjacent UI** for media asset review (queue 4) |
| `/admin/rights-review` | Rights Review | **Delivered #2270-adjacent UI** (#3827/#3552/#3748) — curator queue for `rights_evidence` rows on `hold`; append-only permit/deny/hold triage. Directly serves queue 5 (rights/privacy review) |
| `/admin/archive-items` | Archive Items | **#2073 prior art** — physical archive-acquisition intake/custody tracking (donation/loan), a different concern than #2270's digital candidate pipeline |
| `/admin/d1-test` | D1 Inspect | Raw D1 diagnostic/inspection tool — unrelated to #2270 |

### Content-pipeline APIs with no matching admin page

All under `functions/api/admin/content-pipeline/**`, backed by the #2270-era schema (migration `0042_content_pipeline_core.sql`, distinct from `content_inventory`):

- `candidates/index.ts`, `candidates/review.ts`, `candidates/media-reference.ts` — candidate item review (queue 3) is **API-only**, no dedicated page
- `search-runs/index.ts`, `search-runs/complete.ts` — discovery/search-run tracking, relevant to duplicate-candidate detection (queue 9) — **API-only**
- `publication-prep/index.ts` — publication eligibility (queue 6) — **API-only**
- `ingest.ts` — candidate intake — **API-only**
- `rights-evidence/index.ts`, `rights-evidence/queue.ts` — already surfaced via `/admin/rights-review`, so this one **is** delivered

### Correction to prior Idea-stage claim

The original #2085 "Idea coherence" note that "#2270 admin surfaces do not exist" is **rejected as stated**: `/admin/rights-review` and `/admin/media-assets` are live, delivered #2270-adjacent UI. The accurate framing is *partial* queue coverage plus one schema-distinct legacy system (`/admin/editorial`) that covers overlapping ground under different field names — not a blank admin area.

---

## Work unit 2 (#4226) — #2270 ten-queue gap map and MVP-vs-defer recommendation

| # | #2270 queue | Status | Evidence | MVP-vs-defer recommendation |
| --- | --- | --- | --- | --- |
| 1 | Source review | **Absent** (no dedicated page or API for source-domain trust states `pending/trusted/questionable/blocked/deleted`) | Not found under `functions/api/admin/content-pipeline/**` | Defer — no source records exist yet to review (successor map: "Future source Issue required") |
| 2 | Member submission review | **Absent** for the #2270 model. `/admin/join-requests` covers club-membership signup, not content submissions; `/admin/editorial`'s `Submission` type covers a distinct, older submission concept (no `submitter_id`/`consent_status`/`ownership_statement` fields from the frozen member-submission model) | `docs/reference/content/member-submission-content-model.md` (model only); `functions/api/fanclub/photos/upload.ts` (Path C upload, no admin review page) | Defer until real member-submission intake volume exists per #2270 successor map |
| 3 | Candidate item review | **API-only** | `functions/api/admin/content-pipeline/candidates/{index,review,media-reference}.ts` | 2027 MVP candidate — API exists, only the page is missing |
| 4 | Media asset review | **Delivered** | `/admin/media-assets/page.tsx` | Covered — no action |
| 5 | Rights/privacy review | **Delivered** | `/admin/rights-review/page.tsx` | Covered — no action |
| 6 | Publication eligibility | **API-only** | `functions/api/admin/content-pipeline/publication-prep/index.ts` | 2027 MVP candidate |
| 7 | Audit history | **Absent** for the #2270 candidate/`moderation_events` model. `/admin/audit` exists but serves the unrelated community-report `ReportItem` model | No `moderation_events` admin surface found | Defer — depends on queue 3/6 shipping first so there is audit-worthy activity |
| 8 | Deferred/rejected items | **Partially covered by the parallel system.** `/admin/editorial`'s `Submission.status` includes `rejected`/`merged`/`purged`, but on the legacy schema, not the #2270 candidate model | `src/app/admin/editorial/page.tsx` | Defer — re-evaluate once queue 3 ships whether to extend it or reuse editorial's pattern |
| 9 | Duplicate candidates | **Partially covered by API + parallel system.** `search-runs/**` supports dedup detection; `/admin/editorial` has a `duplicate_candidate` merge-target field on the legacy schema | `functions/api/admin/content-pipeline/search-runs/**`; editorial page | Defer — no dedicated #2270-schema page |
| 10 | Purge/retention review | **Partially covered by the parallel system only.** `/admin/editorial` has `purge_eligible_at`/`retention_reason` on the legacy schema; no #2270-schema equivalent | editorial page | Defer — lowest urgency; #2270 report explicitly treats denial ≠ deletion and requires an explicit later purge policy |

**MVP-vs-defer summary (recommendation, not a Product date):** if/when #2270's candidate pipeline needs an admin surface, queues **3 (candidate item review)** and **6 (publication eligibility)** are the cheapest 2027 MVP slice — their APIs already exist, only pages are missing, following the `/admin/rights-review` pattern. Queues 1, 2, 7, 8, 9, 10 should stay deferred until real data volume justifies them, per #2270's own "manual pilot first" sequencing principle.

---

## Work unit 3 (#4227) — IA and access/safety recommendation

### Information architecture

**Recommend Option 1 from the design package: retain the flat `AdminNav` route pattern and add only the missing queue pages**, rather than opening a consolidated `/admin/review` tab shell now. Rationale:

- `AdminNav` is already the proven access/discovery pattern for 18 surfaces; a second, parallel "shell" pattern would fragment admin IA rather than unify it.
- `/admin/rights-review` already demonstrates the target pattern for a #2270-schema queue: a read-only list endpoint plus append-only action endpoints, no raw CRUD (per its own code comment). New queue 3/6 pages should copy that pattern exactly, adding two `AdminNav` entries (e.g. "Content Candidates", "Publication Prep") rather than inventing a new shell.
- A consolidated `/admin/review` tab surface remains a legitimate **later** option (design package Option 2) only if Product wants one queue shell after more queues exist — not a reason to hold now.
- Do **not** open a generic "all admin tools" catch-all program (design package's explicit Option 3 rejection).

### Access and safety boundary

Reuse the existing admin session/role gate unchanged: `src/app/admin/layout.tsx` already gates every `/admin/**` route on `useMemberSession({ redirectTo: '/', requireAdmin: true })` — non-admin or unauthenticated users are redirected before render. Any future queue page for #2270 candidates inherits this gate automatically by living under `src/app/admin/**`; no new auth mechanism, role model, or OAuth is needed or authorized.

### Privacy boundary

Member-submitted content must remain private/internal until reviewed, per #2270's frozen model (`pending_review` / `not_ready` defaults). Any future member-submission-review page (queue 2) must default new records to non-public review states and must never let the existing public content-query helpers (`functions/_lib/content-inventory-public.ts`) read unreviewed submissions — consistent with #2270's "public routes must never query raw candidate records" rule.

---

## Work unit 4 (#4228) — Publish recommendation

### Recommendation

**Retain the current admin IA plus targeted gap-fill; do not open a new catch-all admin program.** Concretely:

1. Keep the flat `AdminNav` route pattern.
2. When Product authorizes #2270 admin work, the first two pages to build are **candidate item review** (queue 3) and **publication eligibility** (queue 6), copying the `/admin/rights-review` read-only-list-plus-append-only-actions pattern — both already have backing APIs and need only a page plus `AdminNav` entry.
3. Leave queues 1 (source review), 2 (member submission review), 7 (audit history), 8 (deferred/rejected), 9 (duplicate candidates), and 10 (purge/retention) deferred until real data volume from queues 3/6 justifies them, per #2270's manual-pilot-first sequencing.
4. Do not extend or repurpose `/admin/editorial`'s legacy `Submission` workflow to stand in for the #2270 candidate model — they are schema-distinct systems that happen to cover similar concepts; conflating them would silently merge two different data models.

### First missing queue needing its own source Issue

**Candidate item review (queue 3)** is the first queue that would need a dedicated source Issue after Product Go — it has the most existing groundwork (three backing API endpoints already implemented) and the clearest reusable UI pattern (`/admin/rights-review`) to copy.

### Confirmation this brief does not authorize implementation

This parent (#2085) and this brief authorize no `/admin/*` route, component, or API change. Building queue 3 or 6 pages requires a separately approved implementation source Issue with its own file-touch allowlist, exactly as `/admin/rights-review` (#3827) and `/admin/archive-items` (#4062) each required their own issue. No OAuth, no hard-delete, no `/admin/homestaging`, and no OpenAI-name sweep (#4135) work is performed or authorized here.
