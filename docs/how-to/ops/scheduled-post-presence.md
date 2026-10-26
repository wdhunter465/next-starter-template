---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Owns: How the post-10:00 check confirms a scheduled Fundraiser Daily Details post is on the public site
Does Not Own: The publish sweep, the bridge token, or closing the exception Issue
Canonical Reference: /docs/how-to/ci/workflow-failure-exception-issues.md
Related Issues: #4684, #4253, #4407, #4444
Last Reviewed: 2026-10-26
---

# Scheduled post presence

## Purpose

Shortly after 10:00 America/New_York, confirm that a post the publish sweep says it published is on the public site. If it is missing, open one Operations Issue. If nothing was published, stay quiet.

## Scope

Workflow: `.github/workflows/ops-scheduled-post-presence.yml`
Script: `scripts/ops/scheduled-post-presence.mjs`
Tests: `tests/scheduled-post-presence.test.mjs`

The publish sweep is `.github/workflows/ops-scheduled-content-publish.yml`. It runs at 14:00 and 15:00 UTC so one of those times is 10:00 America/New_York. This check runs at 14:20 and 15:20 UTC.

It reads two public sources:

- Comments on #4253. A successful sweep that published one or more posts leaves a comment whose fenced JSON lists `published[].key`. No such comment for the New York date means no scheduled post was published. The check opens nothing.
- `GET /api/fundraiser-details/list` on `https://www.lougehrigfanclub.com`. Each published key must appear there. A missing key opens one Issue labeled `team:operations` and `ops-exception`, titled `OPS EXCEPTION: scheduled post missing after 10:00`. A later miss comments on that Issue.

A failed sweep is already an Operations exception from the workflow failure watcher (#4444). This check does not open a second Issue for that failure.

## #4407

#4407 (provision `SCHEDULED_CONTENT_BRIDGE_TOKEN`) is closed. The token stays on the publish sweep. This check does not read or change it.

## Steps

1. **After 10:00 America/New_York**, the workflow reads today's successful publish comment and the public list.
2. **No successful publish comment** for that New York date: the job exits without opening an Issue.
3. **Every published key is on the list:** the job exits without opening an Issue.
4. **A published key is missing:** open one Operations Issue naming the New York date, the missing key, and the list URL. A later miss comments on the open Issue.
5. **Operations closes the Issue** with a comment naming the fix or the accepted decision.

## Rollback

Revert the pull request that added the workflow. Open exception Issues stay open until Operations closes them.
