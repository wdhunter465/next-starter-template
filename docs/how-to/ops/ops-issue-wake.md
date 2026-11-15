---
Doc Type: How-to
Audience: Human + AI
Authority Level: Supporting
Owns: How the Operations Issue wake works, how to read its comments, how to run it by hand, and how to change its window
Does Not Own: Who holds the Operations role (docs/governance/AGENT-TEAM.md), the Operations interrupt rule (docs/governance/OPERATIONS-AND-RECOVERY.md), or response-time commitments (decision 6 on the launch monitoring review)
Canonical Reference: /docs/governance/OPERATIONS-AND-RECOVERY.md
Related Issues: #4681, #4657, #4414
Last Reviewed: 2026-11-15
---

# Operations Issue wake

## Purpose

Before this workflow, nothing woke an agent when a `team:operations` Issue opened: an alert reached GitHub and waited for someone to look. `ops-issue-wake.yml` posts one comment when such an Issue has no wake yet, and one escalation comment if nobody acknowledges it in time. It only comments. It never assigns, relabels, closes, approves or decides.

## What it does

Every 15 minutes, and when an Issue is opened or labeled, it lists the open `team:operations` Issues and decides one action for each:

| Situation | Action |
| --- | --- |
| No wake comment yet, and no `agent:*` label | Post `OPERATIONS WAKE`: names the Operations holder (Cursor, primary) and mentions `@claude` as the secondary holder |
| Wake posted, no acknowledgement, 30 minutes or more since | Post `OPERATIONS ESCALATION`: mentions `@claude` to take over as secondary holder |
| Anything else | Nothing |

**Acknowledged** means any of: the Issue is closed; it has any `agent:*` label; or someone other than the bot commented after the wake comment. Each comment carries a hidden marker, so a re-run never posts the same comment twice.

It skips pull requests, closed Issues, Issues labeled `ops:monitoring` or `ops:hold` (they do not interrupt), and Issues more than 7 days old.

## Why there is a sweep

GitHub does not run workflows for events created with the built-in token. The failure watcher opens its exception Issues that way, so an `issues: opened` trigger would only see Issues a person opens. The scheduled sweep sees all of them; the `issues` trigger is a fast path.

## Procedure

Actions, "OPS — Operations Issue wake (#4681)", Run workflow. The default is `scan`, which prints what it would post and writes nothing. Choose `apply` to post. Locally, with the GitHub CLI signed in:

```text
node scripts/ops/ops-issue-wake.mjs --mode=scan --repo=wdhunter465/next-starter-template
```

## Change the window

The window is `--window-minutes=30` in the workflow's Sweep step. 30 minutes is a documented default until Operations proposes response times (decision 6 on the launch monitoring review). Change it there and update this page.

## If it stops

The job is registered in `scripts/ops/scheduled-job-health.mjs` (an hourly sweep that has not succeeded in 3 hours is reported) and in the failure watcher list, so a failing or silent sweep opens an Operations Issue like any other scheduled job. A failed GitHub call fails the run; the sweep never reports "nothing to do" when it could not look.

## Not covered here

The automatic single re-run of a failed check before an Issue opens (decision 2) is a separate change under the same Issue.
