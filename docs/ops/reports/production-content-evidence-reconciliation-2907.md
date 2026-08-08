---
Doc Type: Ops Report
Audience: Human + AI
Authority Level: Program Evidence
Status: Draft — #2907 evidence reconciliation
source issue: #2907
Parent Project: #2859
Owns: Reconciliation of repository fixtures/configuration, D1 schema/seed evidence, B2 reference inventory, and live-state boundaries into a bounded sourcing and disposition list for #2859
Does Not Own: Production D1/B2 writes, rights clearance, editorial approval, publication, or #2908/#2909 execution
Canonical Reference: /docs/ops/reports/production-content-launch-surface-matrix-2906.md
related issues: #2859, #2906, #2908, #2909, #2091, #1259
Last Reviewed: 2026-08-08
Executor: Grok (Lane 3)
---

# Production Content Evidence Reconciliation (#2907)

## Purpose

Reconcile repository fixtures/configuration, D1 schema and seed migrations, B2 reference inventory, and prior live-read evidence into a **bounded sourcing and disposition list** consumed by #2908 (controlled population) and #2909 (QA/handoff).

This report does **not** authorize Production mutation or publication.

## Current known truth

- Parent #2859 active; #2906 matrix merged on `component/production-content-readiness` via PR #3202.
- Component base for this work: `component/production-content-readiness` @ `796541934945b725f8824a3a3bdb926948707e0a` (includes #2906 matrix).
- Production D1/B2 **population counts were not queried** in this increment (no live credential use; zero-cost / privacy boundary).
- Public read-path fail-closed behavior was previously validated under Program #1259 Task 005 (`docs/ops/reports/website-qa-production-validation-d1-b2-read-path-validation.md`).
- Daily B2→D1 sync path is repository-defined (`docs/ops/reports/d1-b2-daily-sync-readiness-2091.md`); live credential proof remains operator-private.
- In-repo non-Production seeds exist: `data/mock-*.json`, `data/fundraiser.json` (zeros), `data/b2/inventory.json`, `seed/content/pilot-pack.json`, and migration seed SQL under `migrations/`.

## Intended final state

- One authoritative reconciliation register that maps every `missing-actionable` matrix row to a sourcing class, privacy class, rights gate, and #2908/#2909 action without requiring re-inventory of routes.
- Explicit separation of **repository-proven**, **seed-available**, **operator-live-verify**, and **protected-pending-decision** evidence.
- No unapproved item scheduled for publication.

## Evidence class vocabulary

| Code | Meaning |
| --- | --- |
| `REPO_PRESENT` | Source/component/static copy present in repository |
| `SCHEMA_PRESENT` | D1 table/migration exists; not a population proof |
| `SEED_SQL_PRESENT` | Migration or seed file provides candidate rows (non-Production until applied under authorization) |
| `FIXTURE_PRESENT` | `data/` or `seed/` fixture available for dry-run / local |
| `LIVE_READ_UNQUERIED` | Production count unknown; not asserted |
| `LIVE_READ_PRIOR` | Prior report validated read-path behavior only (not counts) |
| `B2_REF_UNKNOWN` | Media URL binding not proven for launch pairs |
| `PROTECTED_DECISION` | Product/editorial/rights/legal gate |
| `NOT_FOR_PUBLICATION` | Must not publish under current authority |

## Privacy rules applied

- No member emails, credentials, private messages, or secret values.
- Counts are structural (table exists / seed file present / fixture present) only.
- Member PII surfaces remain non-public in all dispositions.

---

## 1. Repository fixture & configuration inventory

| Asset | Path | Privacy | Use for #2908 |
| --- | --- | --- | --- |
| Launch readiness contract | `scripts/launch-readiness/manifest.json` | Public routes only | Route parity gate |
| #2906 matrix | `docs/ops/reports/production-content-launch-surface-matrix-2906.md` | No PII | Authoritative surface list |
| Fundraiser fixture | `data/fundraiser.json` | Aggregate zeros only | Keep campaign fail-closed; do not treat as live totals |
| Mock posts / weekly | `data/mock-posts.json`, `data/mock-weekly.json` | Non-Production mock | Dry-run / local only |
| B2 inventory fixture | `data/b2/inventory.json` | Non-Production | Dry-run reference only |
| Content pilot pack | `seed/content/pilot-pack.json` | Editorial pilot candidates | Candidate source list; rights review required before Production |
| Contact launch copy SQL | `migrations/0040_contact_launch_copy.sql` | Public contact copy | Already maps to contact `approved-present` |
| FAQ seed SQL | `migrations/0027_faq_email_and_seed.sql` | Public FAQ candidates | Candidate batch for FAQ/milestones-adjacent surfaces |
| Events seed SQL | `migrations/0028_seed_events_next10.sql` | Public event candidates | Candidate batch; IA decision still protected for `/events` nav |
| Friends seed SQL | `migrations/0031_seed_friends_partners.sql`, `0020_seed_friend_luckiest_man.sql` | Partner names | Rights/partner permission before publish |
| Weekly matchup seed | `migrations/0026_seed_weekly_matchup.sql` | Photo refs may exist | Matchup pair batch; photo rights gate |
| Page content seed | `migrations/0009_page_content_seed.sql` | CMS-like blocks | Admin/CMS tooling support |
| Privacy/join disclosure | `migrations/0045_privacy_join_ask_disclosure.sql` | Legal/disclosure copy | Supports join/ask; privacy/terms pages still legal-protected |

---

## 2. D1 schema presence (population not asserted)

| Domain | Migration evidence | Surfaces (matrix IDs) | Population status |
| --- | --- | --- | --- |
| FAQ | `0013_faq.sql`, `0027_*`, `0028_faq_*` | P-11, P-14, A-05 | `SCHEMA_PRESENT` + `SEED_SQL_PRESENT`; `LIVE_READ_UNQUERIED` |
| Events | `0014_events.sql`, `0028_seed_events_next10.sql` | P-10, P-16, F-06, A-06 | Same; nav inclusion `PROTECTED_DECISION` |
| Milestones | `0015_milestones.sql` | P-09 | `SCHEMA_PRESENT`; seed thin → sourcing required |
| Friends | `0016_friends.sql`, `0031_*` | P-08 | `SEED_SQL_PRESENT`; partner rights gate |
| Matchups | `0018_matchups.sql`, `0026_*`, photo exclude migrations | P-03, A-04, X-03 | `SEED_SQL_PRESENT`; live pair `LIVE_READ_UNQUERIED` |
| Photos | `0003_photos.sql`, `0007_*`, exclude migrations | F-09, F-12, X-04 | Schema + B2 sync path; counts unqueried |
| Library | `0002_library_entries.sql` | F-11, X-01 | Schema; inventory rows unqueried |
| Content inventory | `0035_*`, `0036_*`, `0038_*` | X-01, A-07, F-02 | Schema; published row counts unqueried |
| CMS / page content | `0008_*`, `0009_*`, `0011_*`, `0040_*` | P-13, X-02, A-08 | Contact seed present; campaign remain fail-closed |
| Members / join / sessions | `0019_*`, `0020_*`, `0029_*`, `0039_*` | P-18–P-20, F-13–F-14, A-11–A-12 | Operational; **not** public content batches |
| Ask / moderation | `0033_*`, `0034_*`, `0037_*` | P-15, A-10, F-10 | Queue tooling; no public payload publication |
| Discussions | `0017_discussions.sql` | P-07 | Schema; public teaser remains deferred-safe |

---

## 3. B2 / media evidence

| Item | Evidence | Classification |
| --- | --- | --- |
| Daily sync workflow | `.github/workflows/b2-d1-daily-sync.yml` + #2091 report | Repository-proven path; live success operator-verify |
| Photo URL normalization | Prior #1259 D1/B2 read-path report + tests | `LIVE_READ_PRIOR` (behavior only) |
| Local B2 inventory fixture | `data/b2/inventory.json` | Non-Production |
| Matchup/memorabilia launch pairs | Matrix P-03, F-09, F-12, A-09 | `B2_REF_UNKNOWN` until authorized binding batch |
| Original media preservation | #2908 acceptance requires preserve originals | Constraint for successor — no destructive rewrite |

---

## 4. Matrix disposition → sourcing register

### 4.1 Ready for launch-prep use (no #2908 population required)

| Matrix IDs | Disposition retained | Notes |
| --- | --- | --- |
| P-01, P-04, P-05, P-12, P-13, P-15, P-18–P-21, P-24–P-25, P-27–P-28 | `approved-present` | Repository static/shell |
| P-02, F-05, A-03, X-02 campaign | `intentionally-empty-approved` | Fundraiser fail-closed; fixture totals are zeros |
| P-06, P-07, F-06, F-07, F-15, X-05, X-09 | `deferred-safe-fallback` | Safe empty/vendor fail-soft |
| A-01, A-02, A-08, A-12–A-14, X-06–X-08 | tooling `approved-present` | Not public content |

### 4.2 Sourcing required before publication (`missing-actionable`)

| Matrix IDs | Domain | Sourcing class | Privacy | Rights gate | #2908 batch class |
| --- | --- | --- | --- | --- | --- |
| P-11, P-14, A-05 | FAQ | `SEED_SQL_PRESENT` + editorial review | Public Q&A only | Editorial approve answers | `faq-public-seed` |
| P-09 | Milestones | `SCHEMA_PRESENT`; content thin | Public historical | Photo rights if images | `milestones-public` |
| P-08 | Friends/partners | `SEED_SQL_PRESENT` | Partner names/logos | Partner permission | `friends-partners` |
| P-10 | Calendar teaser | `SEED_SQL_PRESENT` | Public events | — | `events-public` (nav still protected) |
| P-03, A-04, X-03 | Weekly matchup | `SEED_SQL_PRESENT` | Public vote pair | Photo rights | `matchup-week-pair` |
| P-17 data | Search index | Depends on FAQ/events/milestones/friends/inventory | No private fields | — | Derived after domain batches |
| F-02, F-03, F-04 | Club home content | inventory/CMS/media | Member-only | Credit/rights | `club-home-content` |
| F-09, F-12, A-09, X-04 | Photos / memorabilia | B2 + photos schema | Member gallery | Upload rights | `media-member-gallery` |
| F-11, X-01 | Library / inventory | library + content_inventory | Member-only | Attribution | `library-inventory` |

### 4.3 Protected — do not schedule publication

| Matrix IDs | Decision owner | Register action |
| --- | --- | --- |
| P-16, P-26 (Events/FAQ/Ask IA) | Bill / ChatGPT | Hold nav finalization |
| P-22, P-23 | Legal / Bill | Hold attorney review |
| Live fundraiser enable | Bill / #1700 | Keep `enabled: false` |
| Production population authorization | Product Authority | Required before #2908 live writes |
| X-10 / #2858 responsive ACCEPT | Cursor / WORK | Final packaging gate only |
| Any public reuse of member photos | Editorial / rights | `NOT_FOR_PUBLICATION` until cleared |

---

## 5. Discrepancy summary (privacy-safe)

| Discrepancy | Evidence | Decision |
| --- | --- | --- |
| Matrix marks many data surfaces `missing-actionable` while seed SQL exists | Migrations 0026–0031, 0040 | Seeds are **candidates**, not proof of Production population; retain `missing-actionable` until authorized apply + post-count |
| Fundraiser JSON shows zero totals | `data/fundraiser.json` | Aligns with fail-closed campaign; do not publish as live fundraising progress |
| B2 daily sync exists but live success unproven here | #2091 | Operator-verify before relying on sync for launch media completeness |
| Public read paths fail closed | #1259 Task 005 | Safe to leave empty sections empty; do not invent placeholder public records |
| Pilot pack may contain candidate narrative | `seed/content/pilot-pack.json` | Editorial + rights review before any Production write |

---

## 6. Bounded #2908 input list (approved planning only)

Ordered, collision-safe batch **plans** (execution remains separately protected):

1. **`faq-public-seed`** — Apply/review FAQ candidates; no PII.
2. **`milestones-public`** — Historical milestone rows; image optional with rights.
3. **`friends-partners`** — Partner blurbs after permission evidence.
4. **`events-public`** — Calendar rows; do not change nav without Product decision.
5. **`matchup-week-pair`** — One current-week pair with rights-cleared photos.
6. **`library-inventory`** — Member library/inventory published rows.
7. **`club-home-content`** — Member home modules after editorial selection.
8. **`media-member-gallery`** — B2-bound member gallery items; preserve originals.

Each batch must be: attributable, idempotent, recoverable, pre/post count recorded, **no private data**, **no placeholder public lies**, and **no Production write** until Product Authority authorization is explicit.

---

## 7. Acceptance mapping (#2907)

| Criterion | How met |
| --- | --- |
| Counts and gaps reproducible and privacy-safe | Structural classifications only; no live personal data |
| Missing rights or Product decisions explicit | Section 4.3 + discrepancy table |
| No unapproved item scheduled for publication | Section 6 is planning only; live writes blocked |
| Single allowlisted report path | This file only |
| No Production mutation / paid dependency | Confirmed |

## 8. Verification record

| Check | Result |
| --- | --- |
| Consumed #2906 matrix on component branch | Yes |
| Inspected migrations, `data/*`, `seed/content`, launch manifest | Yes |
| Live Production D1/B2 queried | **No** (by design) |
| Secrets printed | No |
| Production mutation | None |

## 9. Rollback

Revert this report via reviewed PR. Documentation rollback does not alter D1/B2 state.

## 10. Handoff

- **#2908** may design dry-run tooling and repository corrections using Section 6 batch classes; live writes require separate authorization and backup evidence.
- **#2909** QA should walk every `missing-actionable` and `PROTECTED_DECISION` row.
- This report does **not** claim Production launch readiness.

---

*End of #2907 reconciliation.*
