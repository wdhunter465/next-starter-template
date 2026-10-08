---
Doc Type: Operations
Audience: Human + AI
Authority Level: Supporting (proposal for Product Authority decision; not a freeze declaration)
Owns: Proposed 2026-12-31 freeze scope, exception list, emergency-change path and lift condition for go-live task P-03 (#4417)
Does Not Own: The freeze declaration, the calendar Go, emergency-change approval (Product Authority on #2093), or any code, workflow or Production change
Canonical Reference: /docs/reference/operations/2027-launch-calendar-operating-contract.md
Related Issues: #4417, #4414, #2093, #3866, #4433, #4253
Last Reviewed: 2026-10-08
---

# Freeze scope proposal (go-live P-03)

## Purpose

The launch calendar says the repository and website change freeze begins 2026-12-31. It does not say whether database content, scheduled posts and the daily fundraiser jobs are frozen. This proposal gives Product Authority a complete scope to accept or change, so the definition can be recorded on #2093. It declares nothing: only Product Authority declares the freeze, approves emergency changes and lifts the freeze.

## What is already decided

| Fact | Source |
| --- | --- |
| Freeze begins 2026-12-31, assuming the calendar Go is recorded | 2027 launch calendar operating contract |
| Product Authority declares the freeze, approves emergency changes and lifts the freeze | Same contract, "Freeze and launch-window reporting handoff" |
| Public relaunch is 2027-01-01; donations open 2027-03-25 | Same contract and #4430 |
| Fundraiser Daily Details posts are authored in the admin and published after the freeze by a daily job at 10:00 AM America/New_York (posts planned 2027-02-01 through 2027-03-01) | `docs/how-to/ops/run-scheduled-content-publish.md` |
| Daily job calls the publish-due endpoint with a bounded token; it can only publish rows that are already drafts with a due time | Same how-to, workflow `ops-scheduled-content-publish.yml` |

## Proposed scope

"Frozen" means no change without an approved exception. "Exempt" means the activity continues during the freeze under the stated rule.

| Area | Status | Rule |
| --- | --- | --- |
| Application code, styles and public copy in the repository | Frozen | No merges to `main` that change the site, except through the emergency path |
| Workflows, scripts and CI configuration | Frozen | Same. Scheduled workflows keep running unchanged |
| Database schema and migrations | Frozen | No migration is applied during the freeze |
| Secrets and environment variables on Production | Frozen | No rotation or new secret without an exception, except the one-time provisioning in P-20, which must finish before the freeze |
| Edits to existing published public content in the admin (pages, FAQ, events, milestones) | Frozen | Editors stop unapproved change; corrections go through the emergency path |
| Pre-authored scheduled posts (Fundraiser Daily Details) | Exempt | Rows must be created, reviewed and staged before 2026-12-31. Editing or adding a staged row during the freeze needs an exception |
| The daily publish job at 10:00 AM ET | Exempt | Runs as built. It publishes only staged rows and writes nothing else |
| Leaderboard and standings snapshots | Exempt | Automated data refresh only. The cadence for 2027 is not recorded in the repository (the documented cadence is the 2026 one), so Product Authority confirms it |
| Member activity (join, login, votes, submissions, chat) and moderation | Exempt | Normal use of the site is not a change |
| Backups, health checks, monitoring and alerts | Exempt | Read-only or recovery-protecting; must not change application behavior |
| Givebutter campaign and donation pages | Outside the freeze | Vendor-owned. The site only displays approved public links, and a link change is a frozen content change |
| Documentation and PMO records | Exempt | No effect on the running site. Docs that describe freeze rules still go through review |

## Emergency-change path

1. Any role opens an Issue titled "FREEZE EXCEPTION: <short reason>" naming the change, why it cannot wait, the files or content touched, the risk and the rollback.
2. Product Authority approves or rejects in writing on that Issue and on #2093. No approval means no change.
3. The change goes through a normal pull request with the exception Issue linked. Required checks still apply.
4. After deploy, Operations verifies the affected page or job and records the result on the exception Issue.
5. The exception is added to the log below by the PMO Admin role.

Security fixes and a rollback to the last good deployment use this same path. A standing rollback authorization, if Product Authority grants one (see #4468), is recorded here as a named exemption.

## Exception log (kept on #2093)

| Date | Issue | Change | Approved by | Verified by | Result |
| --- | --- | --- | --- | --- | --- |
| (no entries yet) | | | | | |

## Freeze lift

Product Authority lifts the freeze in writing on #2093. Until then the last unfrozen calendar revision stays out of effect. Lifting does not need a code change.

## Decisions for Product Authority

| # | Question | Recommended answer |
| --- | --- | --- |
| 1 | Accept the table above as the freeze scope? | Yes |
| 2 | Must all Fundraiser Daily Details rows be staged before 2026-12-31? | Yes, with the first row piloted before the freeze (P-20) |
| 3 | Is the daily leaderboard refresh exempt, and what is its 2027 cadence? | Exempt; cadence set by Product Authority on #2093 |
| 4 | Does adding or editing a staged post during the freeze need an exception? | Yes |
| 5 | Is a rollback to the last good deployment pre-authorized? | Yes, for the launch window, with a report afterward |
| 6 | Who may be named to record exceptions in the log? | The PMO Admin role |

## What this document does not do

It does not start the freeze, change any workflow or secret, publish any post, or touch Production. P-20 (scheduled publishing pilot) and P-21 (launch announcement) depend on the answers above.

## Validation

Valid when Product Authority records acceptance or changes on #2093, and the accepted scope is copied there with the exception list.

## Rollback

Revert this documentation commit. No system state is created.
