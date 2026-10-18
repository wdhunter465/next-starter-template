---
Doc Type: How-To
Audience: Operations, maintainers, and AI implementation agents
Authority Level: Procedure
Owns: How a failed scheduled or post-merge workflow becomes an Operations exception Issue, how to add a workflow to the watch list, and how a scheduled workflow is halted and re-enabled after 3 consecutive failures
Does Not Own: Incident command, rollback decisions, or the content of individual workflows
Canonical Reference: /docs/governance/OPERATIONS-AND-RECOVERY.md
Related Issues: #4444, #3268, #4589, #4637, #4670, #4674
Last Reviewed: 2026-10-18
---

# Workflow Failure Exception Issues

## Purpose

Make sure a failed scheduled or post-merge action cannot sit unseen in the Actions tab. When a watched workflow fails on the default branch, a new Issue is opened and assigned to the Operations queue (`team:operations`) for immediate review (Product Authority direction, 2026-10-05).

## Scope

Workflow: `.github/workflows/ops-workflow-failure-exception-issues.yml`
Script: `scripts/ci/open_workflow_failure_issue.mjs`
Tests: `tests/open-workflow-failure-issue.test.mjs`

Watched workflows (by their exact `name:`):

- OPS — D1 Backup Scheduled Daily Export (#3268 Phase 3)
- OPS — D1 Backup Scheduled Quarterly Restore Drill (#3268 Phase 4)
- OPS — Scheduled Content Publish (#4253)
- OPS — Snapshot Backup
- D1 Migrations
- Repository Runner Health
- LGFC Cursor Runner Health
- OPS — Design Compliance Audit
- OPS — Post-Merge Self-Healing
- Gehrig Content Discovery (#3551 / #3552 / #2270 perpetual collection)
- OPS — Scheduled Job Health
- GATE — Quality Checks (default branch only)
- GATE — Secret Scan (default branch only)
- OPS — B2 D1 Daily Sync
- OPS — B2 S3 Smoke Test
- OPS — Matchup Pair Monitor
- OPS — Production Edge Health

Only failures on the default branch open an Issue. Failures on pull request branches are normal and are ignored.

## Steps

1. **When a watched workflow fails**, the watcher opens an Issue titled `OPS EXCEPTION: <workflow name> failed` with the labels `team:operations` and `ops-exception`. It does not set an `agent:*` claim; an Operations agent claims it in the normal way.
2. **Later failures of the same workflow** add a comment to the open Issue (with the run link) instead of opening a duplicate.
3. **Operations reviews the Issue.** Open the linked run and read the failing step, then decide: a real fault (fix it under a source Issue), a missing secret or configuration (record who provisions it), or an accepted state (record the decision).
4. **Close the Issue** with a comment naming the fix or decision. A passing run does not close it automatically.

## Repeated failure halt

Policy: `docs/governance/OPERATIONS-AND-RECOVERY.md`, "Repeated Action failure halt" (Product Authority rule 2026-10-14, #4589).

Workflow: `.github/workflows/ops-halt-repeated-failures.yml` (hourly, minute 17)
Script: `scripts/ops/halt-repeated-failures.mjs`
Tests: `tests/halt-repeated-failures.test.mjs`

How it works:

1. The sweeper lists every workflow in `.github/workflows` that has a `schedule:` trigger. Pull request, push and `workflow_run` workflows are never touched.
2. For each one it reads the newest completed runs on the default branch. Cancelled and skipped runs are ignored. A success, including a manual `workflow_dispatch` run, restarts the count.
3. When the 3 newest counted runs are all `failure` or `timed_out`, it opens one Issue (`OPS HALTED: <workflow> halted after 3 consecutive failures`, labels `team:operations`, `ops-exception`, `ops-halted`, `ops:priority:2`) naming the three runs, then disables the workflow. It reports first so a halt is never silent.
4. These Production-protecting jobs are never disabled. They get an `OPS ALERT` Issue (`ops:priority:1`) and keep running: the daily and quarterly D1 backups, the snapshot backup, the production audit, the site uptime probe and the D1 daily sync. Product Authority confirms this list.
5. An Operations Issue is an actionable interrupt only when it carries an `ops:priority:N` label, so both Issues carry one. The Issue records the newest failed run it covers. After a person re-enables the workflow, only newer runs count, so the old failures do not halt it again.

### Re-enable a halted workflow

1. Open the `OPS HALTED` Issue and the three failed runs. Record the cause and fix on the Issue.
2. Merge the fix first when one is needed.
3. Actions tab, select the workflow, "Enable workflow" (or `gh workflow enable <file>`). Optionally run it once with "Run workflow".
4. A successful run restarts the failure count. Close the Issue with a comment naming the fix or decision.

### Check what the sweeper would do

Run `GITHUB_TOKEN=<token> GITHUB_REPOSITORY=wdhunter465/next-starter-template node scripts/ops/halt-repeated-failures.mjs --dry-run`. It prints the Issue and disable calls it would make and changes nothing.

## Procedure

### Add a workflow to the watch list

1. Copy the workflow's exact `name:` value.
2. Add it to the `workflows:` list in `.github/workflows/ops-workflow-failure-exception-issues.yml`.
3. Add it to the list in this document.
4. Open the change as a protected-path PR (workflows) with a source Issue.

### Test the behavior

1. Run `npx vitest run tests/open-workflow-failure-issue.test.mjs tests/halt-repeated-failures.test.mjs` to check creating, de-duplicating, ignoring non-failures, and the 3-failure halt.
2. After merge, confirm with a deliberate failure of a low-risk watched workflow through `workflow_dispatch`, then close the test Issue.

## Verification

- A failed run of a watched workflow on the default branch produces exactly one open `ops-exception` Issue for that workflow.
- A second failure adds a comment, not a second Issue.
- The Issue appears in the `team:operations` queue.
- A scheduled workflow with 3 consecutive failures on the default branch is disabled and has exactly one `OPS HALTED` Issue. A Production-protecting job has one `OPS ALERT` Issue and stays enabled.

## Rollback

Remove the workflow file. No data is changed. Existing exception Issues stay open for Operations to close. To undo the halt mechanism, delete `.github/workflows/ops-halt-repeated-failures.yml` and re-enable any workflow it disabled from the Actions tab.
