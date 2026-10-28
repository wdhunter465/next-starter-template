---
Doc Type: Report
Audience: Human + AI
Authority Level: Operational Evidence
Owns: Task #3633-013 handoff record: what CI and Day-2 monitoring cover as of 2026-10-28, what is partly covered, what stays manual, which recovery exercises are done, and the residual risks entering aggressive testing Round 1
Does Not Own: Any workflow or test change, the Product Authority acceptance decision, Product dates, Production access, or the recovery exercises themselves
Canonical Reference: /docs/ops/implementation-plans/issue-3633-002-ordered-plan.md
Related Issues: #3633, #4471, #4467, #4469, #4470, #4466, #4468, #4139
Last Reviewed: 2026-10-28
---

# CI and Day-2 handoff for #3633

## Status

`_DRAFT`, interim. This record is written on 2026-10-28 while #4467 (scheduled and end-to-end qualification) and #4469 (recovery exercises) are still open, so it is **not** the final acceptance. It records the evidence that exists today, names what is missing, and is updated when those tasks close. Product Authority accepts the parent (#3633); nothing here changes a check.

Baseline: the gap assessment of 2026-10-16 (`docs/ops/reports/ci-gap-assessment-3633.md`, 91 rows). That assessment is not re-graded row by row here. Where a later task changed a row, this record says which task and links its evidence. Where it did not, the row keeps the status the assessment gave it.

## Build children

| Task | Issue | State on 2026-10-28 | What it delivered or still owes |
| --- | --- | --- | --- |
| #3633-008 PR CI hardening | #4466 | Closed | Process tests in CI (rows 2, 9, 11); admin authorization matrix (8); member sessions (22 to 24, 82); matchup pairing (38 to 40); `/api/join`, `/api/login`, `/api/ask` (25, 80, 81); admin mutation evidence enumeration (30); migration check against a scratch database (4). Not built as of the last handoff note (2026-10-11), and no dependency-audit, Dependabot or SBOM workflow exists on `main` on 2026-10-28: rows 7 and 84 (decided "build now" on 2026-10-14), 3, 5, 10 |
| #3633-009 Scheduled and end-to-end qualification | #4467 | **Open** | Nightly `OPS — Scheduled Qualification (#4467)`: eight consecutive passes, 2026-10-21 to 2026-10-28 (see below). Sign-in, join, session-expiry and concurrent-session rows (19, 20, 21, 26, 32, 33) and the rotation, rights-revoked, asset, external-service timeout and focus-order rows are not built |
| #3633-010 Production health and Day-2 monitoring | #4468 | Closed | Production edge health check (home and FAQ: status, cache age, 8-second baseline); monitor-of-monitors `OPS — Scheduled Job Health`; failure watchers extended; operator runbook `docs/how-to/ops/run-day2-monitoring-checks.md`. Row 70 (an alert channel other than GitHub Issues) waits on Product Authority |
| #3633-011 Recovery exercises | #4469 | **Open** | Two of four exercises done (below) |
| #3633-012 Fundraiser-specific qualification | #4470 | Closed on partial scope (Product Authority, 2026-10-27) | Inactive, degraded and fail-closed rows (PR #4965, `tests/fundraiser-inactive-degraded.test.tsx`, run with `docs/how-to/ops/fundraiser-qualification-rows.md`). The Givebutter widget rows (50, 51, 52, 53) moved to #4139 |

## Scenarios fully covered by CI

"Fully covered" here means a check runs automatically and has a recent passing run. A check name below is the evidence, not a claim that it covers every case in the row.

### Before merge (required pull request checks)

| Scenario | Check | Last passing run |
| --- | --- | --- |
| Build, typecheck, lint, format, structure (row 1) | `quality` (workflow `gate-quality.yml`) | [2026-10-28](https://github.com/wdhunter465/next-starter-template/actions/runs/40672224704) |
| Secrets and credential leakage (row 6) | `gitleaks` | Passed on PRs #4996 and #5000 (2026-10-28) |
| PR hygiene and allowlist | `pr-hygiene`, `diff-scope` | Passed on PRs #4996 and #5000 (2026-10-28) |
| Reviewer lifecycle and separation of duties (row 9) | `reviewer-response-completion` and the reviewer lifecycle gate; the reviewer and post-merge process tests run as a step of `quality` | Passed on PRs #4996 and #5000 (2026-10-28) |

### After merge and on a schedule

| Scenario | Workflow | Cadence | Last passing run |
| --- | --- | --- | --- |
| Every sitemap route loads and fits at three widths (rows 12, 14); internal links resolve (13); unknown page returns 404 with a way home, admin page hidden from visitors, admin APIs refuse no credentials (17, 28, 85), all against Production | `ops-scheduled-qualification.yml` | Nightly, 07:30 UTC | [2026-10-28](https://github.com/wdhunter465/next-starter-template/actions/runs/40651162477) |
| Production edge health (home and FAQ) and the silence check on the job-health monitor | `ops-production-edge-health.yml` | Twice daily | [2026-10-28](https://github.com/wdhunter465/next-starter-template/actions/runs/40646338886) |
| Site uptime | `ops-site-uptime-probe.yml` | Every 30 minutes | [2026-10-28](https://github.com/wdhunter465/next-starter-template/actions/runs/40670534024) |
| Production audit | `production-audit.yml` (includes Playwright) | Twice daily | [2026-10-28](https://github.com/wdhunter465/next-starter-template/actions/runs/40610567828) |
| Daily D1 backup | `ops-d1-backup-scheduled-daily-3268.yml` | Daily | [2026-10-28](https://github.com/wdhunter465/next-starter-template/actions/runs/40661465744) |
| D1 restore verification (quarterly drill) | `ops-d1-backup-scheduled-quarterly-drill-3268.yml` | Quarterly | [2026-10-16](https://github.com/wdhunter465/next-starter-template/actions/runs/38966454925) |
| B2 to D1 sync and reconcile | `b2-d1-daily-sync.yml` | Daily | [2026-10-28](https://github.com/wdhunter465/next-starter-template/actions/runs/40661064407) |
| B2 storage smoke test | `b2-s3-smoke-test.yml` | Daily | [2026-10-28](https://github.com/wdhunter465/next-starter-template/actions/runs/40644184315) |
| Published photo addresses and near-duplicates | `ops-photo-address-check.yml`, `ops-duplicate-photo-sweep.yml` | Every 6 hours, daily | [address check, 2026-10-28](https://github.com/wdhunter465/next-starter-template/actions/runs/40644944867), [duplicates, 2026-10-27](https://github.com/wdhunter465/next-starter-template/actions/runs/40508603748) |
| Scheduled content publish and its presence check | `ops-scheduled-content-publish.yml`, `ops-scheduled-post-presence.yml` | Daily, two UTC slots for daylight saving | [2026-10-27](https://github.com/wdhunter465/next-starter-template/actions/runs/40528011559), [2026-10-27](https://github.com/wdhunter465/next-starter-template/actions/runs/40532287494) |
| Certificate, DNS and secret-expiry watch | `ops-cert-dns-watch.yml`, `ops-secret-expiry-watch.yml` | Daily | [2026-10-27](https://github.com/wdhunter465/next-starter-template/actions/runs/40505372536), [2026-10-27](https://github.com/wdhunter465/next-starter-template/actions/runs/40506451767) |
| Design compliance audit | `ops-design-compliance-audit.yml` | Daily | [2026-10-28](https://github.com/wdhunter465/next-starter-template/actions/runs/40618571777) |
| Post-merge self-healing | `ops-post-merge-self-healing.yml` | Daily | [2026-10-28](https://github.com/wdhunter465/next-starter-template/actions/runs/40642150600) |
| Workflow failure to Operations Issue | `ops-workflow-failure-exception-issues.yml` | On failure | [2026-10-28](https://github.com/wdhunter465/next-starter-template/actions/runs/40646176289) |
| Three-failure halt | `ops-halt-repeated-failures.yml` | Hourly (minute 17) | [2026-10-28](https://github.com/wdhunter465/next-starter-template/actions/runs/40671629213) |

### Scheduled qualification: consecutive runs (#4467)

Eight consecutive passes, 2026-10-21 (manual) and 2026-10-22 to 2026-10-28 (schedule), each retaining the `playwright-report-scheduled-qualification` artifact for 30 days. This meets the acceptance criterion of at least three consecutive runs before 2026-11-07. The run links are in the comment on #4467 of 2026-10-28.

## Scenarios partly covered

- **Unit and integration tests (rows 2, 3):** `npm test` runs in `quality`, and the reviewer and post-merge process tests that `vitest.config.ts` excludes run as a separate step of `quality` (#4466, rows 2, 9, 11). `preview-invariants.yml` runs Playwright against the deployed preview on pull requests; whether that satisfies row 3, and whether it is a required check, was not re-graded for this record.
- **Migrations (row 4):** checked against a scratch database; running them against a real D1 preview needs a workflow change, which waits on Product Authority approval. Four migration numbers are used twice (0020, 0028, 0044, 0045) and are pinned, not renamed.
- **Authorization (row 8):** `tests/admin-auth-matrix.test.ts` covers `requireAdmin` with a fake database; the live sign-in path is covered only once the test-account rows in #4467 are built.
- **Admin mutation evidence (row 30):** the handlers that leave no actor or audit evidence are enumerated (29 at the time); fixing each is its own Issue and a Product decision.
- **Public endpoints (rows 25, 81):** join, login, ask and matchup are covered; other public endpoints are not.
- **Playwright specs, including the accessibility scan:** `production-audit.yml` and `preview-invariants.yml` run Playwright, and the nightly run covers the scheduled-qualification spec. Which of the other specs (accessibility scan, homepage sections, launch-readiness, mobile navigation) each workflow includes was not re-checked for this record.
- **Fundraiser (rows 50 to 53):** the hidden-when-inactive and fail-closed rows run; the widget rows wait on #4139 and a published campaign.
- **Alerting (row 70):** alerts are GitHub Issues only, until Product Authority names a channel.

## Not covered by CI (build still open)

Dependency and supply-chain checks (rows 7, 84); PR-time preview run (3); documentation consolidation (5); deployed commit equals merged candidate (10); concurrent sessions and admin actions (26, 32, 33); missing or slow asset (35); rotation fairness (41); focus order (59); reduced motion (63, a product fix under its own Issue); performance baselines (65); external-service timeout (68); repeated-run stability beyond the nightly count (69); caching and stale-content behavior (18); Givebutter widget rows (50 to 53).

## Left for manual and exploratory testing

Browser compatibility (15); takedown and suppression acceptance (44); admin staging and preview acceptance (48); publication to the homepage (49); network interruption, refresh and back navigation (54); keyboard-only use (58); privilege escalation paths (86). Rows 56 and 87 (inbound webhooks) need nothing: no inbound webhook is adopted (Product Authority, 2026-10-16).

## Recovery exercises

Source: `docs/how-to/ops/recovery-exercise-records.md` (#4469).

| Row | State | Evidence |
| --- | --- | --- |
| D1 restore verification | Done, 2026-10-16 | Workflow run 38966454925 (`restore-verify`) passed |
| B2/D1 relationships | Done, 2026-10-19, with a finding | Production: 14 of 14 photo addresses return an image. Development: 4 of 844 return an image (a Development refresh gap, not a Production defect) |
| Deployment rollback | **Not run** | Needs a window named by Product Authority and a Cloudflare Pages rollback control |
| Failed deployment | **Not run** | Needs a throwaway branch exercise; the session has no tool to observe a branch-only failed preview |

Recovery targets (Product Authority, 2026-10-16): zero data loss and immediate recovery, as targets. Their evidence is the recorded exercises, so row 74 stays open until the two exercises above run.

## Residual risks entering Round 1 (target 2026-11-07)

1. **Two recovery rows have no evidence.** Rollback and failed-deployment have never been exercised, so the immediate-recovery target is unproven for those paths.
2. **Sign-in, join and session paths are untested on a schedule.** The admin test credentials live in D1 (Product Authority, 2026-10-28) and the scheduled run cannot read GitHub secrets, so the design for how a scheduled check obtains them is open (#4467, #4657).
3. **No dependency or supply-chain checks.** Decided "build now" on 2026-10-14; not built.
4. **The Givebutter widget is not qualified.** Rows 50 to 53 wait on #4139 and a published 2027 campaign; the campaign exists but is unpublished.
5. **Alerts reach GitHub Issues only.** Row 70 needs a channel; an unwatched Issue queue is a missed alert.
6. **The monitor of monitors was halted on 2026-10-28.** `OPS — Scheduled Job Health` stopped after three failures caused by the advisory contract validators reporting 30 findings (#4989 to #4992). Until it is re-enabled, a stale scheduled job raises no alarm. The restart policy (retry at 5 AM, then 7 AM, then hold for manual restart) is not implemented.
7. **Development data is out of step with B2.** Preview environments show broken photos until Development is refreshed; this does not affect Production.
8. **29 admin mutation handlers leave no audit evidence.** A Product decision decides which are audited.
9. **Content, media and rights test rows stay parked** until the held copyright redesign (#4526, #4592, #4593) is final.

## Parent acceptance

The acceptance criteria of #3633 are not all met: #4467 and #4469 are open, and the open build rows above are not built. The 2026-10-31 implementation date is at risk for those. This record is the handoff draft; the final version, with the rows above updated, is the one Product Authority accepts.

## Rollback

Revert this documentation commit. This record changes no workflow, secret or Production behavior.
