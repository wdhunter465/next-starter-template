---
Doc Type: How-To
Audience: Operations, maintainers, and AI implementation agents
Authority Level: Procedure
Owns: How a failed scheduled or post-merge workflow becomes an Operations exception Issue, and how to add a workflow to the watch list
Does Not Own: Incident command, rollback decisions, or the content of individual workflows
Canonical Reference: /docs/governance/OPERATIONS-AND-RECOVERY.md
Related Issues: #4444, #3268
Last Reviewed: 2026-10-05
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
- GATE — Quality Checks (default branch only)
- GATE — Secret Scan (default branch only)

Only failures on the default branch open an Issue. Failures on pull request branches are normal and are ignored.

## Steps

1. **When a watched workflow fails**, the watcher opens an Issue titled `OPS EXCEPTION: <workflow name> failed` with the labels `team:operations` and `ops-exception`. It does not set an `agent:*` claim; an Operations agent claims it in the normal way.
2. **Later failures of the same workflow** add a comment to the open Issue (with the run link) instead of opening a duplicate.
3. **Operations reviews the Issue.** Open the linked run and read the failing step, then decide: a real fault (fix it under a source Issue), a missing secret or configuration (record who provisions it), or an accepted state (record the decision).
4. **Close the Issue** with a comment naming the fix or decision. A passing run does not close it automatically.

## Procedure

### Add a workflow to the watch list

1. Copy the workflow's exact `name:` value.
2. Add it to the `workflows:` list in `.github/workflows/ops-workflow-failure-exception-issues.yml`.
3. Add it to the list in this document.
4. Open the change as a protected-path PR (workflows) with a source Issue.

### Test the behavior

1. Run `npx vitest run tests/open-workflow-failure-issue.test.mjs` to check creating, de-duplicating and ignoring non-failures.
2. After merge, confirm with a deliberate failure of a low-risk watched workflow through `workflow_dispatch`, then close the test Issue.

## Verification

- A failed run of a watched workflow on the default branch produces exactly one open `ops-exception` Issue for that workflow.
- A second failure adds a comment, not a second Issue.
- The Issue appears in the `team:operations` queue.

## Rollback

Remove the workflow file. No data is changed. Existing exception Issues stay open for Operations to close.
