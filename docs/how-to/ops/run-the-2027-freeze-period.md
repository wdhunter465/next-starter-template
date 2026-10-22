---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Owns: Operator steps for the 2027 freeze period (2026-12-31 to the 2027-06-07 fundraiser close): the milestone runbook, the daily post and snapshot checks, the freeze exception log, and the weekly status report
Does Not Own: The calendar dates, the Go/No-Go or freeze declaration, emergency-change approval (Product Authority on #2093), the freeze scope itself (recorded on #2093 from #4417), launch-window cover hours and response times (#4762), or any code, workflow or Production change
Canonical Reference: /docs/reference/operations/2027-launch-calendar-operating-contract.md
Related Issues: #4763, #2093, #4414, #4417, #4433, #4432, #4573, #4684, #4762, #4764, #3866
Last Reviewed: 2026-10-22
---

# Run the 2027 freeze period

## Purpose

This procedure says what Operations, PMO and Product Authority do between the 2026-12-31 freeze and the 2027-06-07 fundraiser close. It runs the calendar of record; it does not change it. Nothing here declares the freeze, a Go, or an announcement. Only Product Authority does, on #2093.

Dates and times come from the calendar of record in `docs/reference/operations/2027-launch-calendar-operating-contract.md` (revised 2026-10-12): the fundraiser launches 2027-03-25 at 12:00 AM and closes 2027-06-07 at 12:00 PM. All times are Eastern (America/New_York), recorded on #2093 on 2026-10-13.

## Roles

| Duty | Role |
| --- | --- |
| Declares the freeze, approves emergency changes, authorizes each public post, lifts the freeze | Product Authority |
| Reads the monitors, posts the daily status, runs smoke checks and rollback | Operations |
| Records exceptions and the weekly status, keeps the packet rows current | PMO Admin |
| Fixes during an incident (reviewed pull request, normal checks) | Engineering |

Role holders are in `docs/governance/AGENT-TEAM.md`. Cover hours, response times and the wake path belong to the launch-window plan (#4762).

## What is frozen

The scope Product Authority accepted on #2093 on 2026-10-14 (from `docs/ops/reports/freeze-scope-proposal-p03.md`) applies. In short: application code, workflows, schema, Production secrets and edits to existing public content are frozen. The following continue under the stated rule:

| Continues | Rule |
| --- | --- |
| Staged Fundraiser Daily Details posts and the 10:00 AM publish job | Only rows staged before 2026-12-31 publish. Adding or editing a staged row needs an exception |
| Leaderboard and progress snapshots | Automated refresh only; Product Authority sets the 2027 cadence on #2093 (the #4573 design recommends hourly, and every 15 minutes in the last 24 hours before each checkpoint and the close) |
| Checkpoint records and winner publishing | Recorded as an approved scheduled-content activity (#4573); Product Authority approves each record |
| Member activity, moderation, backups, health checks, monitoring | Not changes |
| Documentation and PMO records | No effect on the running site |

Anything else needs a freeze exception.

## Before the freeze (must be true by 2026-12-31)

| Check | Owner | Evidence |
| --- | --- | --- |
| All 29 Fundraiser Details rows (2027-02-01 to 2027-03-01) created, reviewed and staged; first row piloted (#4433) | PMO Admin, Operations | `GET /api/admin/fundraiser-details/list` shows 29 draft rows with 10:00 publish times |
| `SCHEDULED_CONTENT_BRIDGE_TOKEN` provisioned and the daily publish workflow passing | Operations | Latest scheduled run of `ops-scheduled-content-publish.yml` succeeded; today's-post check in place (#4684) |
| Leaderboard, snapshot freshness and checkpoint capture built and watched (#4432, #4573) | Engineering, Operations | Jobs listed in `OPS - Scheduled Job Health` |
| Final Go/No-Go recorded and freeze declared | Product Authority | Comment on #2093 |
| Standing rollback authorization recorded or declined | Product Authority | Comment on #2093 (answer 5 of 2026-10-14 pre-authorizes rollback for the launch window, with a report afterward) |

If a row is not ready, record it as a waiver on #2093 (authority, scope, expiry, residual risk) or as a freeze exception. Do not guess a date.

## Milestone runbook

Each row is a check, not a Go. Operations does the checks; Product Authority authorizes anything public.

| Date and time | Milestone | Before | After | Fallback |
| --- | --- | --- | --- | --- |
| 2026-12-31 | Final Go/No-Go; freeze begins if Go | Packet rows current (`docs/ops/as-built/2027-launch-calendar.md`) | Declaration on #2093; exception log opened | No declaration means no freeze: record a HOLD and the next review |
| 2027-01-01 | Website live; launch announcements | Production smoke on the candidate revision; rollback path confirmed; D1 restore drill (scheduled 2027-01-01) result noted | Smoke result, deployed revision and status word posted on #2093 | Roll back to the last good deployment (pre-authorized), report afterward |
| 2027-02-01 | Fundraiser "coming soon"; registration opens; first daily post | Registration working; channel list and copy authorized; post 1 staged | Post 1 visible on `/fundraiser-details` and the home teaser by 10:30 AM | Publish by hand through the admin if the job missed; log it |
| 2027-02-01 to 2027-03-01 | Daily posts | See "Daily post check" | Same | Same |
| 2027-02-15 | Join-as-participant call to action | Authorization on #2093 | Post live | Product Authority decides a late post |
| 2027-03-01 | Join call to action; last daily post | Same | Same; confirm the series is complete (29 posts) | Same |
| 2027-03-25, 12:00 AM | Donations open | Givebutter campaign live and recorded (#4430); snapshot job healthy; no unapproved sponsor claim | Donate link works; first snapshot published or the fail-closed state shown | Hold the donate link; do not open early |
| 2027-03-25 to 2027-06-07 | Daily leaderboard and progress | See "Daily snapshot check" | Same | Same |
| 2027-04-30 and 2027-05-31, 11:59:59 PM | Checkpoint cutoff | Checkpoint job scheduled; Product Authority has approved the prize description | Checkpoint record created and immutable; "winner to be announced" shown until approved | If the job failed, re-run the capture as of the cutoff or Product Authority decides from the Givebutter dashboard; note which |
| 2027-06-02 | Lou Gehrig Day | Annual instance checklist (`docs/how-to/ops/run-annual-lou-gehrig-day.md`) | Public event and posts as authorized; fundraiser still open | Copy changes are Product Authority's |
| 2027-06-07, 12:00 PM | Fundraiser closes; closeout | Closeout rehearsal passed (#4436) | Final snapshot frozen; winners, final report, social announcement and thank-yous per #4436 and #4764 | Product Authority decides from the Givebutter dashboard |

## Daily post check (2027-02-01 to 2027-03-01)

1. The publish workflow runs at 14:00 and 15:00 UTC, which covers 10:00 AM Eastern in both time zones.
2. At 10:30 AM Eastern, Operations confirms today's post is on `/fundraiser-details` and the home teaser (the public list endpoint shows it without a login).
3. If it is missing, run `ops-scheduled-content-publish.yml` with `workflow_dispatch` (no inputs). If the run fails, read its log, open or update the Operations exception Issue, and publish the row through the admin by hand. Record it in the exception log as a content exception.
4. The social cross-post is separate and does not roll back the website post. If it did not run, tell Product Authority; the repository does not post to social.
5. Post one line in the day's status (below).

## Daily snapshot check (2027-03-25 to 2027-06-07)

1. The page shows a "Last updated" time. If the newest snapshot is older than 3 hours, the page shows "Standings are being updated" (fail-closed design, #4573).
2. Operations checks freshness at 10:00 AM and 4:00 PM Eastern, and every 2 hours in the last 24 hours before a checkpoint cutoff and the close. These times are proposed; the launch-window plan (#4762) confirms cover hours.
3. Two consecutive failed refreshes open one Operations Issue through the existing watcher. Diagnose, fix through the exception path if code is needed, and note the outage on #2093.
4. A donation total that goes down is not published. Do not edit a snapshot by hand.

## Freeze exception log

Kept on #2093. The PMO Admin role records each entry after Product Authority approves in writing.

1. Open an Issue titled `FREEZE EXCEPTION: <short reason>` with the change, why it cannot wait, the files or content touched, the risk and the rollback.
2. Product Authority approves or rejects on that Issue and on #2093. No approval means no change.
3. The change goes through a normal pull request linked to the exception Issue. Required checks still apply.
4. Operations verifies after deploy and records the result on the exception Issue.
5. PMO Admin adds the row below to the log on #2093.

| Date | Issue | Change | Approved by | Verified by | Result |
| --- | --- | --- | --- | --- | --- |
| (none) | | | | | |

Security fixes and rollback use the same path. A rollback to the last good deployment is pre-authorized for the launch window with a report afterward.

## Weekly status

PMO Admin posts one comment on #2093 each Monday from the first week after the freeze (a proposed cadence; Product Authority may change it). It uses exactly these status words (#3866): blocked, at risk, ready, go, no-go, deployed, verified, monitoring. A `ready` or `go` word is not website, Production or announcement Go.

| Field | Content |
| --- | --- |
| Week of | Date |
| Status word | One of the eight |
| Deployed revision | Commit and deployment identifier |
| Milestones this week | From the table above: done, at risk, missed |
| Daily checks | Count missed or manual |
| Exceptions | Issue numbers and results |
| Open incidents | Issue numbers |
| Next milestone | Date and owner |

## Freeze lift

Product Authority lifts the freeze in writing on #2093 after the fundraiser close. The post-event sequence in #4764 starts at the close. Lifting needs no code change.

## Stop conditions

Stop and escalate to Product Authority for: a missing or disputed date; a public post without authorization; an unexplained change in a donation total; a rights or privacy question; a fundraiser commitment beyond what is recorded on #2093; a paid service or credential need; an active Operations interrupt; or any request to treat a status word as a Go.

## Rollback

This is a documentation procedure. Revert the pull request that changed it. Rolling back a deployment follows the rollback runbook (#4425) and Product Authority's recorded authorization.
