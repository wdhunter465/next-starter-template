---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Owns: Operator steps for the Production health and Day-2 monitoring checks (stage 1): what each check proves, where it alerts, how to respond, how to disable
Does Not Own: Monitoring strategy and stages (#4468), rollback authority (#3633 decision record), the per-workflow failure watcher procedure (docs/how-to/ci/workflow-failure-exception-issues.md)
Canonical Reference: /docs/ops/reports/ci-gap-assessment-3633.md
Related Issues: #4468, #3633, #4444, #4540, #4539
Last Reviewed: 2026-10-12
---

# Run the Day-2 Monitoring Checks

## Purpose

Tell an operator, for each stage 1 monitoring check, what it proves, where its alert lands, how to respond, and how to turn it off. Every alert opens or updates one Issue in the Operations queue (`team:operations`).

## Checks

| Check | Workflow | Cadence | Proves | Alert |
| --- | --- | --- | --- | --- |
| Production audit | `production-audit.yml` | 00:15 and 12:15 UTC | Playwright invariants pass against `https://www.lougehrigfanclub.com` (read-only) | Issue `Production Audit Failed (Playwright Invariants)` |
| Site uptime probe | `ops-site-uptime-probe.yml` | Every 30 minutes | `www`, `/faq/`, `/api/health` with D1, the `pages.dev` host and the apex answer HTTP 2xx | Issue `OPS — Site uptime probe — failure detected` |
| Asset register reconcile | `ops-asset-register-reconcile.yml` | Mondays 12:30 UTC | The asset register matches the repository's inventories | Issue opened by the reconcile script |
| Workflow failure watcher | `ops-workflow-failure-exception-issues.yml` | On each watched run | A watched workflow failed on `main` | Issue `OPS EXCEPTION: <workflow> failed` |
| Scheduled job health | `ops-scheduled-job-health.yml` | Every 2 hours at :40 | Every scheduled workflow is enabled and succeeded on `main` within its window | Issue `OPS — Scheduled job health — stale or disabled job` |

Scheduled job health covers the silent case the watcher cannot see: a job that stopped running, was disabled, or keeps failing past its window. Its windows are in `JOBS` in `scripts/ops/scheduled-job-health.mjs`. A test fails if a scheduled workflow is added without an entry there.

## Respond to an alert

1. Open the Issue and the linked run. Read the failing step or the failing row of the report.
2. Classify it:
   - **Production broken by the last deployment.** Under the standing rollback Go for the launch window (#3633, 2026-10-12), roll back to the last good Cloudflare Pages deployment with `docs/how-to/website/website-production-rollback.md`, then report on the Issue. The code fix still goes through a reviewed PR.
   - **Real fault, not deploy-related.** Open or name a source Issue and fix it by PR.
   - **External or temporary cause** (a third-party API outage, the Cursor host asleep). Confirm with a re-run, then record the cause.
   - **Missing secret or configuration.** Record who provisions it.
3. Close the Issue with a comment naming the fix or decision. The uptime probe and scheduled job health post a recovery comment on a clean run; they do not close the Issue.

## Disable a check

- **One job in scheduled job health:** remove its `JOBS` entry by PR and say why in the PR. Removing the workflow file has the same effect, and the coverage test then expects the entry to be gone.
- **A whole check:** disable the workflow in the Actions tab for an emergency, then remove its `schedule:` by PR. Scheduled job health reports a disabled workflow until the PR lands. That is intended.
- **The failure watcher:** remove the workflow's name from its `workflows:` list and from `docs/how-to/ci/workflow-failure-exception-issues.md`.

## Verification

- `npx vitest run tests/scheduled-job-health.test.mjs` passes. It includes broken fixtures: a stale job, a disabled job, a missing workflow, a job with no success, and an API error that must not report a pass.
- After merge, run `OPS — Scheduled Job Health` by `workflow_dispatch` and read the step summary table.

## Limits

- Scheduled job health cannot see itself stop. Its failures are on the watcher's list, and the uptime probe and runner health are independent schedules, but a disabled `ops-scheduled-job-health.yml` is noticed only by a person.
- There is no out-of-band alert channel (gap row 70). Alerts reach Operations through GitHub Issues only.

## Rollback

Revert the PR. Monitors stop alerting; no Production state changes.
