---
Doc Type: Report
Audience: Human + AI
Authority Level: Supporting (proposal for Product Authority decision; not a Go packet row)
Owns: Review of what the website does against what the repository can see through monitoring, the gaps ranked by launch risk, and the proposed alert-to-response path, for go-live task P-26a (#4657)
Does Not Own: Any workflow, alert or secret change, the freeze declaration, the Go packet, or any Production action
Canonical Reference: /docs/reference/operations/2027-launch-calendar-operating-contract.md
Last Reviewed: 2026-10-16
Related Issues: #4657, #4439, #4414, #4468, #4444, #3633, #4469
---

# Launch monitoring review

## Status

`_DRAFT` — written 2026-10-16 from the repository only. Product Authority directed this review: the launch relies heavily on monitoring, so compare what the website does with what the repository can see, close the gaps, and connect alerts to the CI/CD response. Cursor holds Operations for the launch window; Claude Code holds Engineering and is secondary Operations.

**Limits.** I read workflow files, scripts and specs on `main`. I did not view Cloudflare dashboard alerts, WAF or rate-limit rules, email routing, Pages deployment notifications, or current workflow run results. Anything that depends on them is marked "not checked". Nothing here changes a workflow.

## What exists today

| Control | What it does | How often |
| --- | --- | --- |
| Site uptime probe (`ops-site-uptime-probe.yml`) | Requests 5 public URLs: the home page, the FAQ page, `/api/health` (must report the site up and D1 reachable), the `pages.dev` host and the apex domain. Opens an escalation Issue on failure. | Every 30 minutes |
| Production Audit (`production-audit.yml`) | Runs the Playwright specs against Production (launch-readiness public and Fan Club routes, homepage sections, mobile navigation, accessibility scan) and, since #4616, checks that Production serves the merged commit. Opens or updates one Issue on failure. | Twice daily (00:15 and 12:15 UTC) |
| Scheduled Job Health (`ops-scheduled-job-health.yml`) | Checks that 22 scheduled workflows are enabled and succeeded within their own window. | Every 2 hours |
| Failure exception Issues (`ops-workflow-failure-exception-issues.yml`) | Opens one `team:operations` Issue per failing workflow, for 13 named workflows. | On each completed run |
| Halt after 3 failures (`ops-halt-repeated-failures.yml`, #4638) | Stops a scheduled workflow after 3 consecutive failures and opens one Issue. Alert-only for production-protecting jobs. | Hourly |
| D1 backups | Daily export at 09:00 UTC, snapshot at 08:00 UTC, quarterly restore drill. | Daily and quarterly |
| Photo storage checks | B2 smoke test at 06:15 UTC and B2 to D1 sync at 09:00 UTC. | Daily |
| Other watchers | Stale-communication detector (15 minutes), runner health (twice daily), Gehrig content discovery (weekly). | Various |
| Agent wake (`claude-code-wake.yml`) | Posts a wake notice when a pull request opens or becomes ready, and when Bill comments "CLAUDE CODE RESUME" on an Issue. | On event |

## Website capabilities against monitoring

| Capability | Watched by | Gap |
| --- | --- | --- |
| Public pages load | Uptime probe (2 of about 12 public routes: home and FAQ); Production Audit specs (twice daily) | The other public routes (about, accessibility, contact, privacy, terms, ask, search, events, join, login) are checked only twice a day |
| API and D1 reachable | `/api/health` in the uptime probe | None for reachability; it does not test a real read of site content |
| Domain and hosting | Apex and `pages.dev` in the uptime probe | Certificate expiry and DNS changes are not watched |
| Join, login, logout, session | Production Audit specs, if they sign in (not confirmed) | No synthetic sign-in with a test member. Needs the test accounts from P-09 (#4422) |
| Member area and Club Home | Production Audit Fan Club route spec (public behavior only, not confirmed) | No member-session check of Club Home content |
| Admin tools | None | No check that an admin session can load the admin pages |
| Photo and Weekly Matchup display | B2 smoke test and B2 to D1 sync (daily, jobs only) | No check that the photo web addresses the site serves actually load. The Development site showed broken photos from rows pointing at missing files |
| 10:00 AM scheduled publish | Failure exception Issues; Scheduled Job Health (30-hour window) | Failing on every run checked 2026-10-05 to 2026-10-08 (token missing, #4407); current status not checked. A missed publish is noticed after the next run, not at 10:00 |
| Fundraiser and Givebutter | None | No check that the widget loads or the campaign state is right. Matters at the 2027-03-25 launch |
| Email (welcome and membership card) | None | No delivery check; whether email is enabled in Production not checked |
| Deployments | #4616 check in Production Audit (twice daily) | No immediate alert on a failed Production deploy |
| Backups and restore | Daily export, quarterly drill, job health | A backup that never starts is noticed only after 30 hours; the next scheduled drill is on launch day, 2027-01-01 |
| Secrets and tokens expiring | A manual list on #4439 | No automatic reminder; two long-lived tokens expired unannounced on 2026-10-09 |
| Content security reports | `/api/csp-report` endpoint exists | Where reports go was not checked |
| Cloudflare account alerts, WAF, rate limits | Not visible from the repository | Not checked |
| Performance | None | No baseline (#3633 row 65) |

## Monitors that do not report through one path

The failure exception watcher covers 13 workflows. It does not cover Production Audit, the uptime probe, the B2 sync or the B2 smoke test. The first two open their own Issues. The two B2 jobs are caught only by Scheduled Job Health, after up to 30 hours. This is decision 5 on #4439, still open.

## Alert-to-response path

Today every alert ends as a GitHub Issue. Nothing wakes an agent when an Operations Issue opens, and nothing reaches Bill outside GitHub. The wake workflow fires only on pull requests and on Bill's comment.

Proposed path, in three tiers:

| Tier | What happens | Who |
| --- | --- | --- |
| 1. Automatic, safe | The failing check is re-run once. If it fails again, one Issue opens with the severity label, the failing check, the run link and the last good deployment. Nothing is changed or rolled back. | Workflow |
| 2. Agent response | The Issue is assigned to the Operations holder (Cursor) by label, a wake notice is delivered, and Claude Code (secondary Operations) takes over if the Operations holder does not acknowledge within the response time. The agent diagnoses and, if a code fix is needed, opens a normal reviewed pull request. | Cursor, then Claude Code |
| 3. Product Authority | Rollback (unless a standing rollback Go exists), a freeze exception, any change to a workflow that disables other workflows, and every public statement. Escalation by Issue comment, and by email or phone alert if Bill chooses (decision 3). | Bill |

Response times, hours of cover, and the exact wake mechanism for Cursor were not reviewed here and need Operations' input.

## Gaps, ranked by launch risk

| # | Gap | Risk | Proposed closing change | Owner role |
| --- | --- | --- | --- | --- |
| 1 | No automatic agent wake when an Operations Issue opens | High: alerts can sit unseen | Wake step on new `team:operations` Issues; escalate to the secondary holder on no acknowledgement | Engineering |
| 2 | No synthetic sign-in (join, login, member and admin pages) | High: the most valuable pages are unwatched | Test member and admin accounts (P-09), then a scheduled sign-in check | Engineering, with P-09 |
| 3 | Photo web addresses not checked | High: broken images were already seen on Development | Sample the photo addresses the site serves and alert if any fail | Operations |
| 4 | Scheduled publish failing and noticed late | High for the daily posts | Fix the token (#4407); add a check just after 10:00 that today's post exists | Operations |
| 5 | Uptime probe covers 2 of about 12 public routes | Medium: cheap to widen | Add the remaining public routes to the probe list | Engineering |
| 6 | Watchers do not share one failure path | Medium | Add Production Audit, uptime probe and the B2 jobs to the failure watcher (decision 5, #4439) | Engineering |
| 7 | Alerts only reach GitHub | Medium | Decision 3: also notify the Operations holder and Bill | Product Authority, then Engineering |
| 8 | Certificate expiry and DNS not watched | Medium | A scheduled certificate-expiry check on the domains | Operations |
| 9 | Failed Production deploy not alerted immediately | Medium | Alert on a failed Pages deployment event, not only the twice-daily commit check | Operations |
| 10 | Email delivery not checked | Medium, if email is on | Confirm the setting, then a delivery check | Operations |
| 11 | Fundraiser widget and campaign state not checked | High from 2027-03-25, not at website launch | Part of #3633 fundraiser qualification (#4470) | Engineering |
| 12 | Secret expiry reminders manual | Medium | Scheduled reminder 30 days before each recorded expiry | Operations |
| 13 | Performance baselines absent | Low for launch | #3633 row 65 | Engineering |

Gap closing is one pull request per gap, starting at 1. Gaps 1, 2 and 7 touch workflows and need Product Authority approval and independent review.

## Decisions for Product Authority

| # | Question | Recommended answer |
| --- | --- | --- |
| 1 | Approve the three-tier alert path above? | Yes |
| 2 | Allow one automatic re-run of a failed check before opening an Issue? | Yes |
| 3 | Should alerts also reach Bill and the Operations holder by email or phone alert, not only GitHub? | Yes, for outage and failed-deploy alerts only |
| 4 | Create a test member and a test admin account for the sign-in checks (P-09)? | Yes, with a Go on the account creation and where the credentials are stored |
| 5 | Standing rollback Go for the launch window (#4439 decision 2)? | Yes, rollback only, with a report afterward |
| 6 | Response times and cover hours for Operations during the window? | Operations (Cursor) to propose |

## Validation

Valid when Product Authority records answers on #4657 and the gap Issues are opened in the order above.

## Rollback

Revert this documentation commit. No system state is created.
