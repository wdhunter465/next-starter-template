---
Doc Type: Report
Audience: Human + AI
Authority Level: Operational Evidence
Owns: Task #3633-007 gap assessment of the Phase 1 catalog and the build plan for children 008 through 012
Does Not Own: Any workflow or test change, Product dates, Production access, or the acceptance decision (Product Authority accepts Phases 1-4 at the design gate)
Canonical Reference: /docs/ops/implementation-plans/issue-3633-002-ordered-plan.md
Related Issues: #3633, #4465, #4463, #4464, #4466, #4467, #4468, #4469, #4470, #4471
Last Reviewed: 2026-10-07
---

# Gap assessment for #3633

## Status

`_DRAFT` — documentation only, and the design gate. It assigns exactly one status to each of the 87 catalog rows and names the build children. Product Authority accepts Phases 1-4 before children 008 through 012 start (proposed 2026-10-19). Nothing here changes a check.

## How to read the statuses

Evidence comes from the inventory (`docs/ops/reports/ci-test-inventory-3633.md`) and the deduplication proposal (`docs/ops/reports/ci-dedup-proposal-3633.md`). A status says what exists in the repository today. **Where a row says a test exists, that means a test file covers the area; it is not a claim that the file covers every case in the row.** The rows marked `EXISTING_NEEDS_HARDENING` are the main place that needs a closer read when the build child opens. Statuses use the parent's seven values.

## Result

| Status | Rows |
| --- | --- |
| `EXISTING_SUFFICIENT` | 7 |
| `EXISTING_NEEDS_HARDENING` | 46 |
| `DUPLICATED_CONSOLIDATE` | 1 |
| `MISSING_BUILD` | 18 |
| `MANUAL_EXPLORATORY` | 7 |
| `CONTROLLED_RECOVERY_EXERCISE` | 5 |
| `DEFER_PRODUCT_DECISION` | 3 |
| Total | 87 |

Headlines:

- **Only 7 of 87 rows are fully covered today**, and 3 of those (build and lint, and the two secrets rows) rest on the required pre-merge checks. Most rows have a test somewhere but not a run that happens automatically against a deployed environment.
- **The biggest single gap is run coverage, not test count.** 26 post-merge and reviewer test files run nowhere, the Playwright specs (including the accessibility scan) are not required or scheduled on a preview, and there is no scheduled qualification against a deployed environment.
- **Missing outright:** dependency and supply-chain checks, performance baselines, focus order and reduced-motion handling, fundraiser widget checks (blocked on #4139), concurrent-session and concurrent-admin tests, a missing or slow asset check, repeated-run stability evidence, and a check that alerts when a monitor itself stops.
- **Deferred to Product Authority:** the two webhook rows (no inbound webhook is adopted) and the RTO, RPO and SLO row (#2829 is on hold).

## Row statuses


### Repository / PR qualification

| # | Requirement | Class | Status | Evidence or note | Child |
| --- | --- | --- | --- | --- | --- |
| 1 | Build, typecheck, and lint where applicable | Deterministic CI | `EXISTING_SUFFICIENT` | `gate-quality` (required): typecheck, lint, format check, structure check, build | - |
| 2 | Unit tests | Deterministic CI | `EXISTING_NEEDS_HARDENING` | `npm test` in `gate-quality`; 26 `post-merge-*` and `reviewer-*` test files are excluded and run nowhere; 4 of them fail on main | #3633-008 |
| 3 | Integration tests | Deterministic CI | `EXISTING_NEEDS_HARDENING` | API route tests in `tests/api/` use fake D1; no PR-time run against a deployed preview | #3633-008 |
| 4 | Schema and migration validation | Deterministic CI | `EXISTING_NEEDS_HARDENING` | Migration-specific tests (0065, 0073); `d1-migrations` applies on push to main; no PR-time migration check against a scratch database | #3633-008 |
| 5 | Documentation and DIATAXIS validation | Deterministic CI | `DUPLICATED_CONSOLIDATE` | `docs-guardrails`, `design-authority-check`, two overlapping DIATAXIS workflows (see #4464); governance folders wrongly flagged | #3633-008 |
| 6 | Secrets and credential leakage | Deterministic CI | `EXISTING_SUFFICIENT` | `gitleaks` (required) | - |
| 7 | Dependency and supply-chain checks | Deterministic CI | `MISSING_BUILD` | No dependency audit, dependabot or SBOM workflow found; #2827 owns provenance, consume it | #3633-008 |
| 8 | Authorization and protected-route checks | Deterministic CI | `EXISTING_NEEDS_HARDENING` | `tests/admin-auth-matrix.test.ts` covers `requireAdmin` with a fake database; member and public protected routes covered per route | #3633-008 |
| 9 | Required reviewer and separation of duties | Deterministic CI | `EXISTING_NEEDS_HARDENING` | `reviewer-response-completion` (required); its 4 test files are excluded from CI | #3633-008 |
| 10 | Candidate and commit identity | Deterministic CI | `EXISTING_NEEDS_HARDENING` | Preview URL and delivery-profile scripts exist; a check that the deployed commit equals the merged candidate was not found | #3633-008 |
| 11 | Post-merge closeout | Deterministic CI | `EXISTING_NEEDS_HARDENING` | Post-merge detection, closeout and self-healing workflows plus 22 test files that CI excludes; #4445 tracks the closeout defect | #3633-008 |

### Public website

| # | Requirement | Class | Status | Evidence or note | Child |
| --- | --- | --- | --- | --- | --- |
| 12 | Homepage and public routes | Scheduled qualification | `EXISTING_NEEDS_HARDENING` | `tests/e2e/launch-readiness-public-routes.spec.ts` and `homepage-sections.spec.ts`; run by hand or by `production-audit`, not on PRs | #3633-009 |
| 13 | Navigation and links | Scheduled qualification | `EXISTING_NEEDS_HARDENING` | `mobile-navigation` spec and tests; no link checker | #3633-009 |
| 14 | Responsive layout at mobile, tablet, and desktop widths | Scheduled qualification | `EXISTING_NEEDS_HARDENING` | `public-mobile-responsive-validation` test and mobile-navigation spec; widths not exercised on a schedule | #3633-009 |
| 15 | Browser compatibility where practical | Manual / exploratory | `MANUAL_EXPLORATORY` | Not practical to automate fully; keep as a named manual check | - |
| 16 | Metadata, sitemap, and robots | Deterministic CI | `EXISTING_SUFFICIENT` | `tests/public-seo-artifacts.test.ts` runs in `quality` | - |
| 17 | Error and degraded states | Scheduled qualification | `EXISTING_NEEDS_HARDENING` | Fallback and degraded-state unit tests exist (43 files mention them); no scheduled run against a deployed environment | #3633-009 |
| 18 | Caching and stale-content behavior | Production health | `MISSING_BUILD` | `production-audit` checks invariants only; no cache-control or stale-content check | #3633-010 |

### Membership / authentication

| # | Requirement | Class | Status | Evidence or note | Child |
| --- | --- | --- | --- | --- | --- |
| 19 | Join | Scheduled qualification | `EXISTING_NEEDS_HARDENING` | `join-login-auth` tests; no scheduled end-to-end join | #3633-009 |
| 20 | Login and logout | Scheduled qualification | `EXISTING_NEEDS_HARDENING` | Same tests cover login and logout; no scheduled run | #3633-009 |
| 21 | Session expiration | Scheduled qualification | `EXISTING_NEEDS_HARDENING` | About 10 test files exercise session expiry; none scheduled | #3633-009 |
| 22 | Stale, invalid, or tampered session | Deterministic CI | `EXISTING_NEEDS_HARDENING` | One test file covers invalid or forged sessions; thin | #3633-008 |
| 23 | Soft-deleted, disabled, and restored account | Deterministic CI | `EXISTING_NEEDS_HARDENING` | `tests/api/admin-member-soft-delete.test.ts` (from #4224) covers soft-delete and login block; restored-account path not shown | #3633-008 |
| 24 | Protected routes | Deterministic CI | `EXISTING_NEEDS_HARDENING` | Per-route protection tests; no single matrix for member routes | #3633-008 |
| 25 | Duplicate or malformed requests | Deterministic CI | `EXISTING_NEEDS_HARDENING` | 19 test files cover malformed requests across APIs; not a systematic duplicate-request set | #3633-008 |
| 26 | Concurrent or interrupted sessions | Scheduled qualification | `MISSING_BUILD` | No test for concurrent or interrupted member sessions found | #3633-009 |

### Administration

| # | Requirement | Class | Status | Evidence or note | Child |
| --- | --- | --- | --- | --- | --- |
| 27 | Anonymous, member, and admin matrix for every admin route and API | Deterministic CI | `EXISTING_NEEDS_HARDENING` | `admin-auth-matrix` test checks the shared check and that admin routes wire it (69 admin function files); fake database only | #3633-008 |
| 28 | Direct admin route access | Deterministic CI | `EXISTING_NEEDS_HARDENING` | Admin page gating tests per page; no deployed direct-access run | #3633-009 |
| 29 | Privilege enforcement | Deterministic CI | `EXISTING_NEEDS_HARDENING` | Same matrix; role-level cases beyond admin vs member not enumerated | #3633-008 |
| 30 | Mutation audit evidence | Deterministic CI | `EXISTING_NEEDS_HARDENING` | `admin-audit-reporting` test; evidence per mutation type not enumerated | #3633-008 |
| 31 | Rollback and failure handling | Controlled recovery exercise | `CONTROLLED_RECOVERY_EXERCISE` | Needs a recorded exercise, not a unit test | #3633-011 |
| 32 | Session expiration during mutation | Scheduled qualification | `MISSING_BUILD` | No test for session expiring during a mutation found | #3633-009 |
| 33 | Concurrent administrative actions | Scheduled qualification | `MISSING_BUILD` | No test for concurrent administrative actions found | #3633-009 |

### Content / media / Club Newspaper

| # | Requirement | Class | Status | Evidence or note | Child |
| --- | --- | --- | --- | --- | --- |
| 34 | D1/B2 consistency | Scheduled qualification | `EXISTING_NEEDS_HARDENING` | `b2-d1-daily-sync` (scheduled) and `d1-b2-fail-closed` test | #3633-009 |
| 35 | Missing or slow asset | Scheduled qualification | `MISSING_BUILD` | No test or scheduled check for a missing or slow asset found | #3633-009 |
| 36 | Rights and publication gate | Deterministic CI | `EXISTING_SUFFICIENT` | Many tests: `rights-evidence*`, `publication-transition-gate`, `content-pipeline-*rights*` | - |
| 37 | Article and media pairing eligibility | Deterministic CI | `EXISTING_SUFFICIENT` | `photos-rights-reconcile`, `matchup-current-rotation`, `weekly-matchup` tests | - |
| 38 | Insufficient eligible-image pool | Deterministic CI | `EXISTING_NEEDS_HARDENING` | Weekly Matchup hold tests exist; empty-pool behavior for every pairing path not shown | #3633-008 |
| 39 | Random selection only inside the eligible pool | Deterministic CI | `EXISTING_NEEDS_HARDENING` | Rotation tests exist; the 'only inside the eligible pool' property is not asserted as such | #3633-008 |
| 40 | Pairing, placement, and edition history | Deterministic CI | `EXISTING_NEEDS_HARDENING` | `admin-editorial-rotation-preview`, `matchup-*` tests; edition history not asserted end to end | #3633-008 |
| 41 | Rotation fairness, cooldown, and duplicate prevention | Scheduled qualification | `MISSING_BUILD` | No fairness, cooldown or duplicate-pair test found | #3633-009 |
| 42 | Persistent editions | Scheduled qualification | `EXISTING_NEEDS_HARDENING` | Editorial rotation preview tests; persistence across deploys not tested | #3633-009 |
| 43 | Regenerate and rollback | Controlled recovery exercise | `CONTROLLED_RECOVERY_EXERCISE` | Regenerate and rollback need a recorded exercise | #3633-011 |
| 44 | Takedown and suppression | Product / operator acceptance | `MANUAL_EXPLORATORY` | Operator acceptance; #3076 behavior is on main (PR #4224); keep as an acceptance step | - |
| 45 | Rights revoked after staging | Scheduled qualification | `EXISTING_NEEDS_HARDENING` | `rights-hold-quarantine` and `rights-evidence-hold-queue` tests; revocation after staging not a scheduled check | #3633-009 |
| 46 | Malformed metadata and duplicate candidates | Deterministic CI | `EXISTING_SUFFICIENT` | `content-pipeline-duplicate-detection`, `perceptual-hash`, candidate import tests | - |

### Fundraiser / Givebutter

| # | Requirement | Class | Status | Evidence or note | Child |
| --- | --- | --- | --- | --- | --- |
| 47 | Fundraiser hidden when inactive | Scheduled qualification | `EXISTING_NEEDS_HARDENING` | `fundraiser.test.ts` and admin fundraiser tests; deployed behavior waits on #4139 | #3633-012 |
| 48 | Admin staging and preview | Product / operator acceptance | `MANUAL_EXPLORATORY` | Operator acceptance step | - |
| 49 | Publication to the homepage | Product / operator acceptance | `MANUAL_EXPLORATORY` | Operator acceptance step; scheduled publish itself is blocked by missing secret (#4407) | - |
| 50 | Embedded Givebutter widget | Scheduled qualification | `MISSING_BUILD` | No widget check found; waits on a stable interface (#4139) | #3633-012 |
| 51 | Donation button, inline form, goal bar, and signup widget as adopted | Scheduled qualification | `MISSING_BUILD` | Same; depends on the adopted widgets | #3633-012 |
| 52 | Mobile fundraiser experience | Scheduled qualification | `MISSING_BUILD` | Same | #3633-012 |
| 53 | Givebutter unavailable or degraded | Scheduled qualification | `MISSING_BUILD` | No degraded Givebutter state test found | #3633-012 |
| 54 | Network interruption, refresh, and back navigation | Manual / exploratory | `MANUAL_EXPLORATORY` | Exploratory by design | - |
| 55 | Campaign state, ended campaign, and stale cache | Scheduled qualification | `EXISTING_NEEDS_HARDENING` | Three tests mention ended or inactive campaigns; no stale-cache case | #3633-012 |
| 56 | Webhook duplicate, delay, malformation, replay, or unavailability, if webhooks are adopted | Deterministic CI | `DEFER_PRODUCT_DECISION` | No inbound Givebutter webhook is adopted; the only webhook is the outbound Zapier call in scheduled publish | - |
| 57 | No payment credentials, secrets, or private donor data | Deterministic CI | `EXISTING_NEEDS_HARDENING` | `gitleaks` covers secrets; the zero-donor-data boundary (#4139) has no test | #3633-012 |

### Accessibility / UX

| # | Requirement | Class | Status | Evidence or note | Child |
| --- | --- | --- | --- | --- | --- |
| 58 | Keyboard-only use | Manual / exploratory | `MANUAL_EXPLORATORY` | Manual by design | - |
| 59 | Focus order | Scheduled qualification | `MISSING_BUILD` | No focus-order check found | #3633-009 |
| 60 | Headings and landmarks | Deterministic CI | `EXISTING_NEEDS_HARDENING` | `accessibility-scan.spec.ts` (axe) and `homepage-structure` tests; scan is not a required check | #3633-009 |
| 61 | Contrast | Scheduled qualification | `EXISTING_NEEDS_HARDENING` | axe rules include contrast, but only critical and serious results fail; not scheduled | #3633-009 |
| 62 | Alt text and media alternatives | Deterministic CI | `EXISTING_NEEDS_HARDENING` | axe image-alt rule in the same scan; not scheduled | #3633-009 |
| 63 | Reduced motion where applicable | Scheduled qualification | `MISSING_BUILD` | No `prefers-reduced-motion` handling or test found in the source; a product gap as well as a test gap | #3633-009 |
| 64 | Automated accessibility baseline plus named manual checks | Deterministic CI | `EXISTING_NEEDS_HARDENING` | The axe spec exists; not required or scheduled; named manual checks not recorded | #3633-009 |

### Performance / reliability

| # | Requirement | Class | Status | Evidence or note | Child |
| --- | --- | --- | --- | --- | --- |
| 65 | Representative route performance baselines | Scheduled qualification | `MISSING_BUILD` | No Lighthouse or performance baseline tool found | #3633-010 |
| 66 | Production health and Playwright invariants | Production health | `EXISTING_NEEDS_HARDENING` | `production-audit` runs twice daily; it is not in the failure-watch list from #4444 | #3633-010 |
| 67 | Scheduled-job health | Production health | `EXISTING_NEEDS_HARDENING` | #4444 watches 9 workflows; b2-d1-daily-sync, matchup monitor, production-audit and others are not watched | #3633-010 |
| 68 | External-service timeout and unavailability | Scheduled qualification | `MISSING_BUILD` | No external-service timeout test found beyond unit fallbacks | #3633-009 |
| 69 | Repeated-run stability | Scheduled qualification | `MISSING_BUILD` | No repeated-run stability record; required by 2026-11-07 | #3633-009 |
| 70 | Alert delivery and escalation | Production health | `EXISTING_NEEDS_HARDENING` | #4444 opens Operations exception Issues (proved on #4453); no out-of-band alert channel | #3633-010 |

### Recovery / Day-2

| # | Requirement | Class | Status | Evidence or note | Child |
| --- | --- | --- | --- | --- | --- |
| 71 | Deployment rollback | Controlled recovery exercise | `CONTROLLED_RECOVERY_EXERCISE` | `run-emergency-recovery.md` describes rollback; no recorded exercise | #3633-011 |
| 72 | D1 backup creation and restore verification | Controlled recovery exercise | `EXISTING_NEEDS_HARDENING` | Daily export and quarterly restore-drill workflows (#3268); last drill results not summarized here | #3633-011 |
| 73 | B2/D1 recovery relationships | Controlled recovery exercise | `CONTROLLED_RECOVERY_EXERCISE` | No exercise covering B2 and D1 together found | #3633-011 |
| 74 | RTO, RPO, and SLO evidence per #2829 | Product / operator acceptance | `DEFER_PRODUCT_DECISION` | #2829 is on hold; Product Authority sets the targets | - |
| 75 | Failed or partial deployment | Controlled recovery exercise | `CONTROLLED_RECOVERY_EXERCISE` | No exercise for failed or partial deployment found | #3633-011 |
| 76 | Production post-deploy smoke | Production health | `EXISTING_NEEDS_HARDENING` | `production-audit` also runs on push to main paths; post-deploy trigger not tied to the deploy | #3633-010 |
| 77 | Scheduled recovery exercises | Controlled recovery exercise | `EXISTING_NEEDS_HARDENING` | Quarterly restore drill only; no schedule for rollback or content exercises | #3633-011 |
| 78 | Monitor and alert failure handling | Production health | `MISSING_BUILD` | Nothing alerts when a monitor or the failure watcher itself stops | #3633-010 |
| 79 | Incident evidence and operator runbook paths | Product / operator acceptance | `EXISTING_NEEDS_HARDENING` | `run-emergency-recovery.md` and `run-scheduled-content-publish.md`; set is incomplete | #3633-010 |

### Security / adversarial

| # | Requirement | Class | Status | Evidence or note | Child |
| --- | --- | --- | --- | --- | --- |
| 80 | Auth bypass attempts inside safe test boundaries | Deterministic CI | `EXISTING_NEEDS_HARDENING` | Auth matrix test; bypass attempts beyond the shared check not enumerated | #3633-008 |
| 81 | Malformed or hostile input inside safe test boundaries | Deterministic CI | `EXISTING_NEEDS_HARDENING` | 19 tests cover malformed input; hostile-input cases not systematic | #3633-008 |
| 82 | Stale privilege and session behavior | Deterministic CI | `EXISTING_NEEDS_HARDENING` | Covered with the session tests above | #3633-008 |
| 83 | Secret exposure | Deterministic CI | `EXISTING_SUFFICIENT` | `gitleaks` (required) | - |
| 84 | Dependency and provenance findings | Deterministic CI | `MISSING_BUILD` | Same as row 7 | #3633-008 |
| 85 | Direct API access without the UI | Deterministic CI | `EXISTING_NEEDS_HARDENING` | API tests call handlers directly; no run against a deployed environment | #3633-009 |
| 86 | Privilege escalation paths | Manual / exploratory | `MANUAL_EXPLORATORY` | Manual exploratory by design | - |
| 87 | Webhook signature and authentication, if implemented | Deterministic CI | `DEFER_PRODUCT_DECISION` | No inbound webhook is adopted | - |

## Build plan by child

Each gap row is assigned to one build child. Risk, cadence, environment, writable scope, owner and rollback are the same for every row in a child unless a row says otherwise.


### #3633-008 PR CI hardening (#4466)

- **Rows (23):** 2, 3, 4, 5, 7, 8, 9, 10, 11, 22, 23, 24, 25, 27, 29, 30, 38, 39, 40, 80, 81, 82, 84
- **Risk if absent:** A defect or regression reaches main unnoticed because a test or check does not run in CI.
- **Cadence:** Every pull request, plus one scheduled full run of the excluded tests.
- **Environment:** GitHub Actions on pull requests; test database fakes plus a deployed preview for the API rows.
- **Writable scope:** .github/workflows/** (named files), scripts/ci/**, tests/**, vitest config
- **Owner role:** Engineering (Claude Code primary)
- **Rollback:** Revert the pull request; a new check is disabled by removing its trigger.

### #3633-009 Scheduled and end-to-end qualification (#4467)

- **Rows (25):** 12, 13, 14, 17, 19, 20, 21, 26, 28, 32, 33, 34, 35, 41, 42, 45, 59, 60, 61, 62, 63, 64, 68, 69, 85
- **Risk if absent:** A visitor-facing, membership, admin, content or accessibility regression is found by a visitor, not by a check.
- **Cadence:** Nightly against the Pages preview or Development; weekly for slower suites; at least three consecutive runs before 2026-11-07.
- **Environment:** Development deployment or preview. Production only for read-only audits.
- **Writable scope:** .github/workflows/** (named files), tests/**
- **Owner role:** Engineering (Claude Code primary)
- **Rollback:** Remove the schedule trigger; history is kept.

### #3633-010 Production health and Day-2 monitoring (#4468)

- **Rows (8):** 18, 65, 66, 67, 70, 76, 78, 79
- **Risk if absent:** A Production outage, failed scheduled job or silent monitor is not noticed.
- **Cadence:** Existing 12-hour production audit; add the failure-watch list entries now; add an out-of-band alert path.
- **Environment:** Production, read-only.
- **Writable scope:** .github/workflows/**, scripts/ops/**, docs/how-to/ops/
- **Owner role:** Operations (Cursor primary)
- **Rollback:** Revert; alerts stop, monitors keep running.

### #3633-011 Recovery, backup and rollback exercises (#4469)

- **Rows (7):** 31, 43, 71, 72, 73, 75, 77
- **Risk if absent:** Recovery steps are untested when they are needed.
- **Cadence:** One recorded exercise per row before 2026-11-07; D1 restore drill stays quarterly.
- **Environment:** An approved environment, never Production without a recorded Product Authority Go and a documented restore path.
- **Writable scope:** docs/how-to/ops/, scripts/ops/**
- **Owner role:** Operations (Cursor primary)
- **Rollback:** Each exercise is reversible by its documented restore path; the document change is reverted with the pull request.

### #3633-012 Fundraiser-specific qualification (#4470)

- **Rows (7):** 47, 50, 51, 52, 53, 55, 57
- **Risk if absent:** Fundraiser regressions or donor-data exposure reach the public.
- **Cadence:** After #4139 stabilizes the interface; nightly once running.
- **Environment:** Development deployment; Givebutter test mode only.
- **Writable scope:** tests/**, docs/how-to/ops/
- **Owner role:** Engineering (Claude Code primary)
- **Rollback:** Revert; no data change.

## Order inside the build window

If time is short before 2026-10-31, build in this order: (1) add the missing workflows to the failure-watch list and make the excluded tests run (cheap, high value), (2) scheduled qualification of public routes, auth and admin against the preview, (3) recovery exercises, (4) the supply-chain and performance rows, (5) fundraiser rows once #4139 allows. Rows classed manual or deferred need no build.

## Decisions for Product Authority at the design gate

1. Accept the catalog, inventory, deduplication proposal and this assessment as Phases 1-4.
2. Choose whether dependency and supply-chain checks (rows 7 and 84) are built now or deferred under #2827.
3. Confirm webhooks are not adopted (rows 56 and 87) and the RTO, RPO and SLO row waits on #2829.
4. Decide whether a missing `prefers-reduced-motion` behavior (row 63) is fixed in the product or accepted for launch.

## Rollback

One documentation file. Rollback is reverting the merge commit.
