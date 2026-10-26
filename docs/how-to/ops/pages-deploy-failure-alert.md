---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Owns: How a failed Cloudflare Pages deployment of the default branch becomes one Operations exception Issue
Does Not Own: D1 migration failure Issues, Cloudflare retry, rollback, or closing the exception
Canonical Reference: /docs/how-to/ci/workflow-failure-exception-issues.md
Related Issues: #4689, #4657, #4444
Last Reviewed: 2026-10-26
---

# Pages deploy failure alert

## Purpose

Open one Operations Issue within the GitHub event that reports a failed Cloudflare Pages deployment of the default branch. Name the commit and the run. A successful deployment opens nothing.

## Scope

Workflow: `.github/workflows/ops-pages-deploy-failure.yml`
Script: `scripts/ops/pages-deploy-failure-alert.mjs`
Tests: `tests/pages-deploy-failure-alert.test.mjs`

The workflow listens for a completed `check_suite` from the Cloudflare Pages GitHub App (`cloudflare-workers-and-pages`). The job runs only when that suite's conclusion is `failure` and the head branch is the repository default branch. The script then opens an Issue only if the check named `Cloudflare Pages` failed. A failure on a pull request branch is a preview and is ignored.

A failed `D1 Migrations` run on the default branch is already opened by `.github/workflows/ops-workflow-failure-exception-issues.yml` (#4444). This alert does not open a second Issue for that workflow.

GitHub delivers `check_suite` events only to a workflow file that is already on the default branch.

## Steps

1. **When the Cloudflare Pages check fails on the default branch**, the workflow opens an Issue titled `OPS EXCEPTION: Cloudflare Pages deployment failed` with labels `team:operations` and `ops-exception`. The body names the commit and the GitHub run. It does not set an `agent:*` claim.
2. **A later failure** adds a comment to that open Issue instead of opening another one.
3. **A successful Pages check** does not open an Issue. The job is skipped.
4. **Operations reviews the Issue** and closes it with a comment naming the fix or the accepted decision. A later successful deployment does not close it.

## Rollback

Revert the pull request that added the workflow. Open exception Issues stay open until Operations closes them.
