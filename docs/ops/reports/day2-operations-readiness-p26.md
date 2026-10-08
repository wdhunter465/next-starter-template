---
Doc Type: Operations
Audience: Human + AI
Authority Level: Supporting (proposal for Product Authority decision; not a Go packet row)
Owns: Proposed launch-window roles, daily status format, monitoring and alerting map, incident and escalation path, and owner and date assignments for the remaining D1 backup items, for go-live task P-26 (#4439)
Does Not Own: The Go packet, any workflow or alert change, the freeze declaration, credentials, or any Production action
Canonical Reference: /docs/reference/operations/2027-launch-calendar-operating-contract.md
Related Issues: #4439, #4414, #3268, #2780, #3866, #4444, #4453, #4407, #4417, #4468
Last Reviewed: 2026-10-08
---

# Day-2 operations readiness for the launch window (go-live P-26), proposal

## Purpose

The Go packet's Operations row needs named owners and monitoring for the launch window. Production telemetry and recovery (risk R7, debt D7) are unowned today. This proposal names the roles, the daily status format, what is already watched, what is not, and the incident path. It declares no Go and changes no workflow.

## What was checked, and its limits

Checked on 2026-10-08 from GitHub workflow history and the repository. Run results are from the scheduled runs listed. Cloudflare dashboard alerts, e-mail routing and the state of the backup bucket's lifecycle rule were not viewed. Where a statement depends on them it is marked "not checked".

## Roles for the launch window

Role names only. Product Authority names the person or agent who holds each role.

| Duty | Role | Notes |
| --- | --- | --- |
| Window health (daily status, reads the monitors) | Operations | Reports using the status words below |
| Smoke checks | Operations | Production smoke test after each deploy (P-08) |
| Incident lead | Operations | Opens and runs the incident Issue |
| Fixes during an incident | Engineering | Reviewed pull request, normal checks |
| Rollback | Operations executes; Product Authority gives the Go | A standing rollback Go for the window is a decision below |
| Records and the daily Go-packet row | PMO Admin | |
| Decisions, freeze exceptions, public announcements | Product Authority | |

## Daily launch-window status

Operations posts one comment per day on #2093 starting when the freeze is declared, or earlier if Product Authority says. It uses exactly these words (from #3866): blocked, at risk, ready, go, no-go, deployed, verified, monitoring.

| Field | Content |
| --- | --- |
| Date and time | |
| Status word | one of the eight |
| Deployed revision | commit and deployment identifier |
| Monitors | each row in the map below: pass, fail, or not run |
| Open incidents | Issue numbers |
| Next check | time |

## Monitoring and alerting map

| Area | What watches it today | Evidence on 2026-10-08 | Gap |
| --- | --- | --- | --- |
| Site up and database reachable | Public health endpoint, plus the twice-daily Production Audit workflow | Production Audit succeeded on every run checked, 2026-10-05 through 2026-10-08 (twice daily) | Health endpoint is not polled between audits |
| Pages deployments | Cloudflare Pages checks on pull requests | Preview deploys report on every PR | No alert on a failed production deploy |
| D1 daily backup | Scheduled export workflow, daily at 09:00 UTC | 24 of 24 scheduled runs succeeded, 2026-09-15 through 2026-10-08 | A run that never starts raises no failure, so a missing backup is not detected |
| D1 restore drill | Scheduled quarterly drill workflow (1 Jan, Apr, Jul, Oct at 10:00 UTC) | Last drill result not checked | The next scheduled run falls on 2027-01-01, the launch day |
| Daily publish job (10:00 AM ET) | Scheduled publish workflow, fires at 14:00 and 15:00 UTC | **Failing**: every scheduled run checked from 2026-10-05 to 2026-10-08 failed except one still queued | Cause is most likely the missing publish token (#4407); exception #4453 is open |
| B2 and D1 sync | Daily sync (09:00 UTC) and daily B2 smoke test (06:15 UTC) | Not checked | Neither is on the failure-watcher list below |
| Failure routing | Watcher that opens one `team:operations` exception Issue per failing workflow (#4444) | Opened #4453 for the publish job | Watches nine workflows: daily backup, quarterly drill, scheduled publish, snapshot backup, D1 migrations, both runner-health workflows, the quality gate and the secret scan. It does not watch Production Audit, the B2 sync or the B2 smoke test |

## Incident and escalation path

1. Detect: a monitor fails, a watcher opens an exception Issue, or someone reports a fault.
2. Open or use the exception Issue in the `team:operations` queue. Name the page or job, the first failing time and the last good deployment.
3. Operations triages within the same day during the launch window and sets the status word.
4. If a bad deployment is the cause, Operations rolls back to the last good deployment (`docs/how-to/website/website-production-rollback.md`) once Product Authority has given the Go, then reports.
5. Engineering fixes the cause in a reviewed pull request linked to the Issue. During the freeze the change also needs a freeze exception (#4417).
6. Operations verifies, records the result on the Issue, and closes it.
7. Anything touching member data, credentials or a public statement goes to Product Authority at once.

## Remaining D1 backup items (from #3268), with owners and dates

#3268 is closed as complete. Its daily export and quarterly drill workflows exist. These items still need an owner and a date for the launch window.

| Item | Owner role | Proposed date |
| --- | --- | --- |
| Confirm the 30-day retention rule is applied to the backup bucket and record it (not checked here) | Operations | 2026-10-31 |
| Missing-backup alert: a check that opens an Operations Issue when no export has succeeded in 26 hours | Engineering builds; Operations owns | Under #3633-010 (Day-2 monitoring), by 2026-10-31 |
| Run the restore drill by hand before the freeze, so the first scheduled drill on 2027-01-01 is not the only proof | Operations | 2026-12-17 |
| Quarterly drill owner | Operations | Named by Product Authority |

## Decisions for Product Authority

| # | Question | Recommended answer |
| --- | --- | --- |
| 1 | Who holds each role above? | Product Authority names them; one named person for Operations and one backup |
| 2 | Standing rollback Go for the launch window? | Yes, rollback only, report afterward |
| 3 | Where do alerts go? | The `team:operations` exception Issues, plus a notification to the Operations holder |
| 4 | When does daily reporting start? | On the day the freeze is declared |
| 5 | Add Production Audit, the B2 sync and the B2 smoke test to the failure watcher? | Yes, as part of #3633-010 |

## Validation

Valid when the role holders are named, the five decisions are recorded on #4439 or #2093, and the map is re-run on the launch candidate with the gaps closed or accepted.

## Rollback

Revert this documentation commit. No system state is created.
