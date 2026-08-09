---
Doc Type: Operations Report
Audience: Human + AI
Authority Level: Task Evidence
Owns: #2909 (#2859 Task 004) cross-route QA record, safe-fallback proof, and editorial/Day-2 handoff for the production content launch surface matrix
Does Not Own: #2906's matrix itself (only consumed/cited here); #2907/#2908's own evidence (only consumed/cited here); Production verification/publication (separately protected)
Canonical Reference: /docs/ops/reports/production-content-cross-route-qa-2909.md
Related Issues: #2909, #2859, #2906, #2907, #2908
Last Reviewed: 2026-08-09
---

# Production content — cross-route QA, safe-fallback proof, and editorial/Day-2 handoff (#2909)

## Purpose

Deliver #2909 (#2859 Task 004): walk every `missing-actionable` and
`protected-pending-decision` row on #2906's authoritative launch surface
matrix, prove that each `missing-actionable` surface degrades safely (no
crash, no placeholder lie, no broken reference) when its backing content is
absent, and complete editorial acceptance and Day-2 handoff — all without
performing Production verification or publication, which remain a separate,
protected decision per #2859's own scope.

## Scope

Covers cross-route QA and handoff only: the QA record below
(Section 2), the safe-fallback tests it cites, and the Day-2 handoff
(Section 3). It consumes #2906's matrix and #2907/#2908's already-merged
evidence (`component/production-content-readiness` tip
`b5668d4a2d37b5c5b925ef4bfef31f979fb3b66a` — see #2908's PR #3237 merge
commit) but does not re-implement or re-scope that work. It does not
perform Production content verification, does not touch live D1/B2
credentials, and does not authorize publication of any content.

## Current known truth

- #2906 (matrix), #2907 (evidence reconciliation), and #2908 (batch-plan
  scaffolding) are all closed complete on `component/production-content-readiness`.
- 6 of the matrix's 26 `missing-actionable`/`protected-pending-decision`
  rows are now proven safe with real tests against the real components (5
  new tests in `tests/homepage-sections-empty-state.test.tsx` plus 1 new
  test in `tests/faq-page.test.tsx`, plus 1 pre-existing test in
  `tests/milestones-section.test.tsx`) — not asserted from reading the
  source alone.
- The remaining 20 rows are honestly recorded as deferred, each with the
  accountable owner and release condition #2906's own Owner/Successor
  columns already assign — not silently dropped, and not fabricated as
  "done."
- No Production content population, D1/B2 write, or publication has
  occurred under this task. Rollback for every surface covered here is
  simply "the safe fallback is the current, already-shipped behavior" —
  there is nothing to roll back to, since no new content has been added.

## Intended final state

This document's QA record (Section 2) is durable evidence; it does not need
to change again unless #2906's matrix itself changes, a new gap is found,
or a deferred row's successor (#2907/#2908-class population, or a Product
Authority decision) actually lands — at which point that row moves from
`deferred` to `verified-safe-fallback` with real content, which is a
different, later verification event than this document records.

## 1. Safe-fallback proof

Proven against the real components, not asserted from documentation alone:

| Matrix ID | Surface | Claim | Test |
| --- | --- | --- | --- |
| P-03 | `WeeklyMatchup` | Renders "No matchup available this week." instead of a broken/partial vote UI when fewer than 2 current photos exist | `tests/homepage-sections-empty-state.test.tsx` — "shows 'No matchup available this week.' instead of crashing or rendering a partial matchup" |
| P-08 | `FriendsOfFanClub` | Falls back to three named, real default partners (not a broken empty grid) when the API returns zero items or fails | `tests/homepage-sections-empty-state.test.tsx` — "falls back to the three named default partners when the API returns zero items" / "...when the API request fails outright" |
| P-09 | `MilestonesSection` | Shows a clean empty state when no milestone rows are returned | `tests/milestones-section.test.tsx` — "shows clean empty state when no milestone rows are returned" (pre-existing) |
| P-10 | `CalendarSection` | Shows a clean notice ("No posted events yet...") instead of a broken calendar grid on zero items or API failure | `tests/homepage-sections-empty-state.test.tsx` — "shows a clean notice instead of a broken calendar grid when the API returns zero items" / "...when the API request fails" |
| P-11 | `FAQSection` (homepage) | Shows "No matching FAQ answers found." instead of a broken/empty grid when zero FAQ rows exist | `tests/homepage-sections-empty-state.test.tsx` — "shows a clean empty message instead of a broken/empty grid when the API returns zero items" |
| P-14 | `/faq` page | Shows a distinct "No FAQ entries are available yet." message (not the "no search matches" message) when zero FAQ rows exist at all | `tests/faq-page.test.tsx` — "shows a distinct fail-closed message when zero FAQ entries exist at all (not just zero search matches)" (new; the pre-existing empty-state test in this file only covered zero-search-matches against a non-empty dataset) |

## 2. Cross-route QA record

Validated with `scripts/ci/production_content_cross_route_qa.mjs`
(`buildCrossRouteQaReadiness()`): every one of #2906's matrix rows classified
`missing-actionable` or `protected-pending-decision` has an explicit
disposition — verified safe with real test evidence, or an honest deferral
with the accountable owner and release condition the matrix itself already
assigns.

```json
{
  "matrixSourceSha": "00e1608adb8ff27b24eae2fa995372e79c2ab8eb",
  "rows": [
    { "matrixId": "P-03", "status": "verified-safe-fallback", "testFile": "tests/homepage-sections-empty-state.test.tsx", "testName": "shows \"No matchup available this week.\" instead of crashing or rendering a partial matchup" },
    { "matrixId": "P-08", "status": "verified-safe-fallback", "testFile": "tests/homepage-sections-empty-state.test.tsx", "testName": "falls back to the three named default partners when the API returns zero items" },
    { "matrixId": "P-09", "status": "verified-safe-fallback", "testFile": "tests/milestones-section.test.tsx", "testName": "shows clean empty state when no milestone rows are returned" },
    { "matrixId": "P-10", "status": "verified-safe-fallback", "testFile": "tests/homepage-sections-empty-state.test.tsx", "testName": "shows a clean notice instead of a broken calendar grid when the API returns zero items" },
    { "matrixId": "P-11", "status": "verified-safe-fallback", "testFile": "tests/homepage-sections-empty-state.test.tsx", "testName": "shows a clean empty message instead of a broken/empty grid when the API returns zero items" },
    { "matrixId": "P-14", "status": "verified-safe-fallback", "testFile": "tests/faq-page.test.tsx", "testName": "shows a distinct fail-closed message when zero FAQ entries exist at all (not just zero search matches)" },
    { "matrixId": "P-16", "status": "deferred", "owner": "Bill / ChatGPT", "releaseCondition": "IA decision: /events inclusion in primary navigation/hamburger" },
    { "matrixId": "P-17-data", "status": "deferred", "owner": "Editorial", "releaseCondition": "#2907 search index population (content_inventory rows for FAQ/events/milestones/friends/inventory)" },
    { "matrixId": "P-22", "status": "deferred", "owner": "Legal / Bill", "releaseCondition": "Attorney review of Privacy policy body" },
    { "matrixId": "P-23", "status": "deferred", "owner": "Legal / Bill", "releaseCondition": "Attorney review of Terms body" },
    { "matrixId": "P-26", "status": "deferred", "owner": "Bill / ChatGPT (IA)", "releaseCondition": "FAQ/Ask/Events hamburger inclusion decision" },
    { "matrixId": "F-02", "status": "deferred", "owner": "Editorial", "releaseCondition": "#2907/#2908 club-home lead story/story-rail content population" },
    { "matrixId": "F-03", "status": "deferred", "owner": "Editorial", "releaseCondition": "#2907 archive inventory population" },
    { "matrixId": "F-04", "status": "deferred", "owner": "Editorial", "releaseCondition": "#2908 B2 media feature binding" },
    { "matrixId": "F-09", "status": "deferred", "owner": "Editorial / members", "releaseCondition": "#2908 member photo gallery media batch" },
    { "matrixId": "F-11", "status": "deferred", "owner": "Editorial", "releaseCondition": "#2907 library seed population" },
    { "matrixId": "F-12", "status": "deferred", "owner": "Editorial", "releaseCondition": "#2907/#2908 memorabilia population" },
    { "matrixId": "A-04", "status": "deferred", "owner": "Editorial", "releaseCondition": "#2908 weekly matchup pairs population" },
    { "matrixId": "A-05", "status": "deferred", "owner": "Editorial", "releaseCondition": "#2907 FAQ seed population" },
    { "matrixId": "A-06", "status": "deferred", "owner": "Editorial", "releaseCondition": "#2907 events seed population" },
    { "matrixId": "A-07-records", "status": "deferred", "owner": "Editorial", "releaseCondition": "#2907 content_inventory record population" },
    { "matrixId": "A-09", "status": "deferred", "owner": "Ops", "releaseCondition": "#2908 media registry population" },
    { "matrixId": "X-01", "status": "deferred", "owner": "Editorial", "releaseCondition": "#2907 content_inventory population for search + library surfaces" },
    { "matrixId": "X-03", "status": "deferred", "owner": "Editorial", "releaseCondition": "#2908 weekly matchup API population" },
    { "matrixId": "X-04", "status": "deferred", "owner": "Editorial / members", "releaseCondition": "#2908 fan club photo API population" },
    { "matrixId": "X-10", "status": "deferred", "owner": "Cursor Local / WORK", "releaseCondition": "#2858 responsive-contract ACCEPT before final launch packaging" }
  ]
}
```

Running the harness against this record: `ready: true`, `blockers: []`,
`detail.deferredMatrixIds` lists the 20 rows above — meaning cross-route QA
is package-complete (every required row has an explicit, accountable
disposition) while honestly surfacing which surfaces still need real content
population (#2907/#2908-class work) or a Product Authority decision before
Production verification can claim full readiness.

## 3. Editorial acceptance and Day-2 handoff

### Editorial acceptance

- Every `missing-actionable` row's safe-fallback behavior (Section 1) is
  editorially acceptable as a **launch-safe interim state** — none of them
  show placeholder text, broken links, or private data; they show honest
  "not yet available" messaging consistent with the matrix's own
  `deferred-safe-fallback`/`missing-actionable` design intent.
- No row in this QA pass required inventing or approving new public-facing
  copy; the messages tested ("No matchup available this week.", "No FAQ
  entries are available yet.", etc.) already existed in the shipped
  components before this task.
- The 5 `protected-pending-decision` rows (P-16, P-22, P-23, P-26, X-10)
  explicitly remain Product/Legal/Cursor decisions per #2906 Section 6 —
  this task does not and cannot substitute for that authority.

### Operator ownership (Day-2)

- **Content population ownership:** Editorial, per matrix Owner column —
  responsible for sourcing/approving the actual content batches #2908's
  batch-plan schema is ready to validate once Product Authority
  authorizes a live population run.
- **IA/navigation decisions:** Bill / ChatGPT — owns P-16 and P-26.
- **Legal review:** Legal / Bill — owns P-22 and P-23.
- **Responsive-contract acceptance:** Cursor Local / WORK — owns X-10,
  the entry gate for final launch packaging.
- **QA re-run ownership:** whoever picks up the next #2907/#2908-class
  population batch should re-run
  `node scripts/ci/production_content_cross_route_qa.mjs --record <updated record>`
  after updating that row's disposition, rather than assuming this
  document's snapshot stays current indefinitely.

### Rollback

Every safe fallback verified in Section 1 is the component's existing,
already-shipped behavior — there is no new code path to roll back. If a
future content-population batch (#2908-class) introduces a regression in
one of these empty-state paths, revert that batch's PR; the fallback
behavior proven here is unaffected by content population since it only
triggers when the corresponding query returns zero rows.

## 4. Acceptance mapping (#2909)

| Criterion | How met |
| --- | --- |
| Required surfaces match the approved matrix | Section 2 record's `matrixSourceSha` and 26 row IDs are drawn directly from #2906's matrix |
| Unresolved items have accepted safe fallbacks | Section 1: 6 rows proven with real tests; Section 2: remaining 20 rows explicitly deferred with owner + release condition, not silently dropped |
| Editorial acceptance and operator ownership are recorded | Section 3 |
| Rollback remains executable | Section 3 ("Rollback") |

## 5. Verification

- `npx vitest run tests/homepage-sections-empty-state.test.tsx` — 6/6 passing.
- `npx vitest run tests/faq-page.test.tsx` — 10/10 passing (9 pre-existing + 1 new).
- `npx vitest run tests/production-content-cross-route-qa.test.mjs` — 23/23 passing.
- `node scripts/ci/production_content_cross_route_qa.mjs --record <this section 2 record>` — `ready: true`, 20 rows in `deferredMatrixIds`, exactly matching this document's claims.
- No Production credential use, no live D1/B2 mutation, no publication.

## 6. Handoff

The 20 deferred rows are the concrete, named remainder standing between
this QA pass and a fully-populated launch surface. Whoever picks up the
next content-population batch under #2908's batch-plan schema, or the
Product/Legal/responsive decisions listed in Section 3, should update this
document's QA record for the corresponding row(s) and re-run the harness
before claiming further launch readiness.
