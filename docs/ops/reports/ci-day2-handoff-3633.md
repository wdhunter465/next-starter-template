---
Doc Type: Report
Audience: Human + AI
Authority Level: Operational Evidence
Owns: Task #3633-013 handoff record: what CI and Day-2 monitoring cover as of 2026-11-24, what is partly covered, what stays manual, which recovery exercises are done, and the residual risks at handoff
Does Not Own: Any workflow or test change, the Product Authority acceptance decision, Product dates, Production access, or the recovery exercises themselves
Canonical Reference: /docs/ops/implementation-plans/issue-3633-002-ordered-plan.md
Related Issues: #3633, #4471, #4467, #4469, #4470, #4466, #4468, #4139, #5179, #4682, #5492, #5505
Last Reviewed: 2026-11-24
---

# CI and Day-2 handoff for #3633

## Status

Final handoff record for #3633-013, written on 2026-11-24. It replaces the interim record of 2026-10-28. Every build child except the follow-up #5179 and the held #4139 is closed, and the recovery exercises are recorded. It records the evidence that exists on 2026-11-24, names what is still open, and carries forward, unchanged and marked, the rows that were not re-graded. Product Authority accepts the parent (#3633); nothing here changes a check.

Baseline: the gap assessment of 2026-10-16 (`docs/ops/reports/ci-gap-assessment-3633.md`, 91 rows). That assessment is not re-graded row by row here. Where a later task changed a row, this record says which task and links its evidence. Where it did not, the row keeps the status the assessment gave it.

## Build children

| Task | Issue | State on 2026-11-24 | What it delivered or still owes |
| --- | --- | --- | --- |
| #3633-008 PR CI hardening | #4466 | Closed 2026-10-14 | Process tests in CI (rows 2, 9, 11); admin authorization matrix (8); member sessions (22 to 24, 82); matchup pairing (38 to 40); `/api/join`, `/api/login`, `/api/ask` (25, 80, 81); admin mutation evidence enumeration (30); migration check against a scratch database (4). No dependency-audit, Dependabot or SBOM workflow exists on `main` on 2026-11-24 (rows 7 and 84, decided "build now" on 2026-10-14, still not built), and rows 3, 5, 10 are not built |
| #3633-009 Scheduled and end-to-end qualification | #4467 | Closed 2026-11-12 | The nightly `OPS — Scheduled Qualification (#4467)` (see below). Follow-up #5179 added rows 35, 41, 42, 45, 68, 69 (Slice 1, PR #5456, 2026-11-21). Slice 2 (sign-in, join, session-expiry and concurrent-session rows 19, 20, 21, 26, 32, 33) waits on the test-account Go on #4682 |
| #3633-010 Production health and Day-2 monitoring | #4468 | Closed 2026-10-18 | Production edge health check (home and FAQ: status, cache age, 8-second baseline); monitor-of-monitors `OPS — Scheduled Job Health`; failure watchers extended; operator runbook `docs/how-to/ops/run-day2-monitoring-checks.md`. Row 70 (an alert channel other than GitHub Issues) waits on Product Authority (#4687) |
| #3633-011 Recovery exercises | #4469 | Closed 2026-11-22 | All four recorded (below) |
| #3633-012 Fundraiser-specific qualification | #4470 | Closed on partial scope 2026-10-27 (Product Authority) | Inactive, degraded and fail-closed rows (PR #4965, `tests/fundraiser-inactive-degraded.test.tsx`, run with `docs/how-to/ops/fundraiser-qualification-rows.md`). The Givebutter widget rows (50, 51, 52, 53) moved to #4139, which is on hold until the LiveLikeLou administrator confirms the campaign and API access |

## Scenarios fully covered by CI

"Fully covered" here means a check runs automatically and has a recent passing run. A check name below is the evidence, not a claim that it covers every case in the row. Run links are the latest successful run read on 2026-11-24.

### Before merge (required pull request checks)

| Scenario | Check | Last passing run |
| --- | --- | --- |
| Build, typecheck, lint, format, structure (row 1) | `quality` (workflow `gate-quality.yml`) | [2026-11-24](https://github.com/wdhunter465/next-starter-template/actions/runs/45310975996) |
| Secrets and credential leakage (row 6) | `gitleaks` | Passed on PR #5462 (2026-11-22) |
| PR hygiene and allowlist | `pr-hygiene`, `diff-scope` | Passed on PR #5462 (2026-11-22) |
| Reviewer lifecycle and separation of duties (row 9) | `reviewer-response-completion` and the reviewer lifecycle gate; the reviewer and post-merge process tests run as a step of `quality` | Passed on PR #5462 (2026-11-22) |

### After merge and on a schedule

| Scenario | Workflow | Cadence | Last passing run |
| --- | --- | --- | --- |
| Every sitemap route loads and fits at three widths (rows 12, 14); internal links resolve (13); unknown page returns 404 with a way home, admin page hidden from visitors, admin APIs refuse no credentials (17, 28, 85), all against Production | `ops-scheduled-qualification.yml` | Nightly, 07:30 UTC | [2026-11-24](https://github.com/wdhunter465/next-starter-template/actions/runs/45348702873) |
| Production edge health (home and FAQ) and the silence check on the job-health monitor | `ops-production-edge-health.yml` | Twice daily | [2026-11-23](https://github.com/wdhunter465/next-starter-template/actions/runs/45241927585); failing on 2026-11-24 for the monitor-liveness reason below (#5503) |
| Site uptime | `ops-site-uptime-probe.yml` | Every 30 minutes | [2026-11-24](https://github.com/wdhunter465/next-starter-template/actions/runs/45366790789) |
| Production audit | `production-audit.yml` (includes Playwright) | Twice daily | [2026-11-24](https://github.com/wdhunter465/next-starter-template/actions/runs/45298208111) |
| Daily D1 backup | `ops-d1-backup-scheduled-daily-3268.yml` | Daily | [2026-11-24](https://github.com/wdhunter465/next-starter-template/actions/runs/45361622415) |
| D1 restore verification (quarterly drill) | `ops-d1-backup-scheduled-quarterly-drill-3268.yml` | Quarterly | [2026-10-16](https://github.com/wdhunter465/next-starter-template/actions/runs/38966454925) |
| B2 to D1 sync and reconcile | `b2-d1-daily-sync.yml` | Daily | [2026-11-24](https://github.com/wdhunter465/next-starter-template/actions/runs/45361274414) |
| B2 storage smoke test | `b2-s3-smoke-test.yml` | Daily | [2026-11-24](https://github.com/wdhunter465/next-starter-template/actions/runs/45340594740) |
| Published photo addresses | `ops-photo-address-check.yml` | Every 6 hours | [2026-11-23](https://github.com/wdhunter465/next-starter-template/actions/runs/45175335840); **disabled** after three failures on 2026-11-24 (#5505, cause #5492) |
| Near-duplicate photos | `ops-duplicate-photo-sweep.yml` | Daily | [2026-11-23](https://github.com/wdhunter465/next-starter-template/actions/runs/45177740958) |
| Scheduled content publish and its presence check | `ops-scheduled-content-publish.yml`, `ops-scheduled-post-presence.yml` | Daily, two UTC slots for daylight saving | [2026-11-23](https://github.com/wdhunter465/next-starter-template/actions/runs/45201202097), [2026-11-23](https://github.com/wdhunter465/next-starter-template/actions/runs/45204735141) |
| Certificate, DNS and secret-expiry watch | `ops-cert-dns-watch.yml`, `ops-secret-expiry-watch.yml` | Daily | [2026-11-23](https://github.com/wdhunter465/next-starter-template/actions/runs/45174258015), [2026-11-23](https://github.com/wdhunter465/next-starter-template/actions/runs/45175284559) |
| Design compliance audit | `ops-design-compliance-audit.yml` | Daily | [2026-11-24](https://github.com/wdhunter465/next-starter-template/actions/runs/45309414617) |
| Post-merge self-healing | `ops-post-merge-self-healing.yml` | Daily | [2026-11-24](https://github.com/wdhunter465/next-starter-template/actions/runs/45338157966) |
| Workflow failure to Operations Issue | `ops-workflow-failure-exception-issues.yml` | On failure | [2026-11-24](https://github.com/wdhunter465/next-starter-template/actions/runs/45343351226) |
| Three-failure halt | `ops-halt-repeated-failures.yml` | Hourly (minute 17) | [2026-11-24](https://github.com/wdhunter465/next-starter-template/actions/runs/45364583070) |
| Monitor of monitors | `ops-scheduled-job-health.yml` | Scheduled | [2026-11-23](https://github.com/wdhunter465/next-starter-template/actions/runs/45241639626); **disabled** on 2026-11-24 (#5493, #5503) |

### Scheduled qualification: consecutive runs (#4467, #5179)

The nightly has passed on every scheduled run since 2026-11-20: five consecutive scheduled passes (2026-11-20 to 2026-11-24). It failed on 2026-11-13, 2026-11-17, 2026-11-18 and 2026-11-19 (scheduled runs; this record does not investigate those causes) and was fixed on 2026-11-19. For #5179 Slice 1, three consecutive scheduled greens after the merge of 2026-11-21 are met: 2026-11-22 ([https://github.com/wdhunter465/next-starter-template/actions/runs/44998623799](https://github.com/wdhunter465/next-starter-template/actions/runs/44998623799)), 2026-11-23 ([https://github.com/wdhunter465/next-starter-template/actions/runs/45131748988](https://github.com/wdhunter465/next-starter-template/actions/runs/45131748988)) and 2026-11-24 ([https://github.com/wdhunter465/next-starter-template/actions/runs/45348702873](https://github.com/wdhunter465/next-starter-template/actions/runs/45348702873)).

## Scenarios partly covered

Rows below are carried from 2026-10-28 and were not re-graded on 2026-11-24, except where a later task is named.

- **Unit and integration tests (rows 2, 3):** `npm test` runs in `quality`, and the reviewer and post-merge process tests that `vitest.config.ts` excludes run as a separate step of `quality` (#4466, rows 2, 9, 11). `preview-invariants.yml` runs Playwright against the deployed preview on pull requests; whether that satisfies row 3, and whether it is a required check, was not re-graded for this record.
- **Migrations (row 4):** checked against a scratch database; running them against a real D1 preview needs a workflow change, which waits on Product Authority approval. Four migration numbers are used twice (0020, 0028, 0044, 0045) and are pinned, not renamed.
- **Authorization (row 8):** `tests/admin-auth-matrix.test.ts` covers `requireAdmin` with a fake database; the live sign-in path is covered only once the test accounts exist (#5179 Slice 2, #4682).
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

Source: `docs/how-to/ops/recovery-exercise-records.md` (#4469, closed 2026-11-22).

| Row | State | Evidence |
| --- | --- | --- |
| D1 restore verification | Done, 2026-10-16 | Workflow run 38966454925 (`restore-verify`) passed |
| B2/D1 relationships | Done, 2026-10-19, with a finding | Production: 14 of 14 photo addresses return an image. Development: 4 of 844 return an image (a Development refresh gap, not a Production defect) |
| Deployment rollback | Done, 2026-11-22 | Production moved to the previous commit and back to the newest commit; the site returned HTTP 200 after each step. Pages deployments `79c56450` and `b6721f39` |
| Failed deployment | Done, observed 2026-11-20, accepted by Product Authority 2026-11-22 | A failed preview build (`208290cb`) stopped before deploy, created no Production deployment and opened no alert Issue. A failed build on `main` was not exercised |

Recovery targets (Product Authority, 2026-10-16): zero data loss and immediate recovery, as targets. Their evidence is the four recorded exercises above, so row 74 has evidence for the preview and Production rollback paths. It has none for a rollback across a D1 schema change (Pages rollback does not change D1).

## Residual risks at handoff (2026-11-24)

1. **Two published photos are missing from Backblaze (#5492).** Photos 851 and 853 are still in the public list and return 404. The scheduled check caught it on 2026-11-23, which is the monitor working. Restoring the objects or unpublishing the rows writes Production data and waits on Product Authority.
2. **Two monitors are disabled.** `ops-photo-address-check.yml` was halted after three failures (#5505) and `ops-scheduled-job-health.yml` is also disabled (#5493, #5503). Until both are re-enabled, a stale scheduled job raises no alarm from the monitor of monitors. Re-enable them after #5492 is fixed. The restart policy (retry at 5 AM, then 7 AM, then hold for manual restart) is not implemented.
3. **Sign-in, join and session paths are untested on a schedule.** #5179 Slice 2 waits on the test-account Go (#4682; option C recorded 2026-11-22, the addresses and the Go are still needed).
4. **No dependency or supply-chain checks.** Decided "build now" on 2026-10-14. On 2026-11-24 no workflow scans dependencies and there is no `.github/dependabot.yml`.
5. **The Givebutter widget is not qualified.** Rows 50 to 53 wait on #4139, which is on hold until the LiveLikeLou administrator confirms the campaign and API access (#5209).
6. **Alerts reach GitHub Issues only.** Row 70 needs a channel; an unwatched Issue queue is a missed alert, and three escalations on 2026-11-23 and 2026-11-24 were not acknowledged within 30 minutes. The alert email stays inert until configured (#4687).
7. **A failed build on `main` was not exercised.** Only the preview path was observed (accepted by Product Authority, 2026-11-22). The default-branch failure alert is `docs/how-to/ops/pages-deploy-failure-alert.md`.
8. **Carried from 2026-10-28, not re-checked on 2026-11-24:** Development data out of step with B2 (previews show broken photos; Production is not affected), and 29 admin mutation handlers that leave no audit evidence (a Product decision decides which are audited).
9. **Content, media and rights test rows stay parked.** The held redesign Issues #4526, #4592 and #4593 are closed (2026-10-25); whether those rows can now be written was not assessed here.

## Parent acceptance

The build children are closed except the follow-up #5179 (Slice 2 waits on #4682) and the held #4139. The open build rows listed above remain unbuilt. This is the final handoff record; Product Authority decides whether #3633 is accepted with the open items above, or whether any of them must close first. The 2026-10-31 implementation date passed with those items open; the project's contingency window runs to 2026-11-30 and its confidence checkpoint is 2026-12-01.

## Rollback

Revert this documentation commit. This record changes no workflow, secret or Production behavior.
