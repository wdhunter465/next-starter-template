---
Doc Type: How-To
Audience: Human + AI
Authority Level: Operational
Owns: Operator procedure when a merged PR still carries failed required pre-merge checks, including verification of automatic remediation and manual fallback when automation does not run
Does Not Own: Merge authorization, branch protection policy, workflow YAML implementation, or gate definition changes
Canonical Reference: /docs/reference/ci/post-merge-validation-surface.md
Related Issues: #2376, #2374, #2380, #2373, #4776
Last Reviewed: 2026-10-26
---

# Merged PR With Failed Pre-Gate — Operator Follow-Up

## Purpose

Product Authority may authorize merge while a required pre-merge check remains failed on the PR head (for example, an accepted exception during launch). Merge authorization does not resolve the underlying gate failure.

This how-to defines what operators must verify after merge, how automatic post-merge remediation should surface the condition, and the manual fallback when automation does not create or update an Ops issue.

This document is operator procedure only. It does not change merge policy, branch protection, or CI gate definitions.

## When to use this procedure

Use this procedure when all of the following are true:

1. A PR merged into `main`.
2. At merge time, one or more **required** pre-merge checks on the PR head were still **failed** or incomplete.
3. The failed check may block future PRs or queue advancement even though the merge already completed.

Canonical example (Phase 0 launch, 2026-07-08):

| Field | Value |
| --- | --- |
| Merged PR | #2373 |
| Failed pre-gate | `ZIP History Audit (Full History)` |
| Failed run | `28957717158` |
| Failed job | `audit` |
| Failed step | `Scan full git history for ZIPs` |
| Underlying remediation | #2374 |
| Process visibility gap | #2376 |

## Authority boundaries

| Role | Owns |
| --- | --- |
| Bill | Final merge authorization; deciding whether merge proceeds with a failed required check |
| Governance | Governance review, remediation routing, merge-readiness synthesis, authorized issue/PR comments |
| Cursor | Scoped implementation or docs PRs when a source issue authorizes them; must not infer merge exceptions from chat |
| Post-Merge Detection | Validates merged state and triggers remediation issue creation or update when validation fails |

Merge with a failed required check is an **accepted exception** only when Product Authority records that decision in the PR, source issue, or an authorized ops note before or at merge time.

## Expected automatic behavior (post #2380)

After merge, **Post-Merge Detection** (`post-merge-closeout.yml`) should treat failed required pre-merge checks still attached to the merged PR head as post-merge validation evidence.

When validation fails for this reason, **Post-Merge Remediation** should create or update a canonical remediation issue (not a duplicate) that records at minimum:

- merged PR number;
- merge commit or head SHA;
- failed gate or check display name;
- failed workflow run ID when available;
- failed job name and failed step name when the Actions API exposes them;
- whether the failure is **blocking future PRs** or queue advancement;
- linked remediation issue when one already exists (for example #2374 for ZIP history);
- requested owner and next action.

Duplicate remediation issues for the same PR, source issue, and failure condition should be avoided by matching the canonical remediation group before creating a new issue.

Reference implementation and behavior summary: PR #2380 (`OPS: Surface failed pre-gates after merge`).

Detailed validation surface: `docs/reference/ci/post-merge-validation-surface.md`.

## Procedure

Run this checklist whenever merge occurred with a known failed required pre-merge check.

### Step 1 — Confirm merge evidence

Record:

- merged PR number and URL;
- merge commit SHA;
- source issue from PR body (`- **Issue:** #NNNN`);
- failed check name(s) from the PR checks panel at merge time;
- failed workflow run, job, and step identifiers when available.

### Step 2 — Wait for Post-Merge Detection

Inspect the `Post-Merge Detection` workflow run for the merge commit on `main`.

Download or read:

- PR comment from post-merge automation, if present;
- `post-merge-validation-result` or equivalent artifact when available.

### Step 3 — Verify remediation issue exists or was updated

Search open issues:

```text
is:issue is:open label:post-merge-failure
```

Confirm a remediation issue exists that names the merged PR and failed gate. If a linked root-cause issue already exists (for example #2374), the remediation issue body should reference it rather than opening a parallel duplicate.

### Step 4 — Verify source-issue and queue posture

When post-merge validation fails:

- the source task issue must **not** be treated as cleanly closed by automation alone;
- queue advancement for serial programs must **halt** until the remediation path is dispositioned;
- parent or program issues remain open unless explicitly authorized for terminal closeout.

Apply `docs/ops/pmo/github-issue-closeout-protocol.md` for closeout packet requirements, including successor and queue disposition.

### Step 5 — Route root-cause work

Separate process visibility (#2376) from underlying gate failure (#2374 for ZIP history):

| Concern | Track in |
| --- | --- |
| Why no Ops issue appeared (historical gap) | #2376 documentation and automation verification |
| How to fix the ZIP or other gate failure | Root-cause ops issue (#2374 or successor) |
| Whether launch may continue | Product Authority decision on parent program issue |

Do not conflate these tracks in one undifferentiated issue body.

## Manual fallback (when automation does not surface the failure)

If Post-Merge Detection completes without creating or updating a remediation issue, and the merged PR still had a failed required pre-merge check:

1. **Stop** queue advancement and successor unblock claims.
2. **Open or update** an Ops issue manually using this title pattern:

   `OPS: Post-merge follow-up — PR #<pr> merged with failed pre-gate <check-name>`

3. **Apply labels** when available:

   - `post-merge-failure`
   - `ops-pr-escalation` when operator action is required and self-healing cannot resolve the item
   - `agent:ChatGPT` when ChatGPT review is required

4. **Include this body structure:**

```text
## Problem

PR #<pr> merged with failed required pre-merge check still present on PR head.

## Evidence

- Merged PR: #<pr>
- Merge commit: <sha>
- Source issue: #<issue> (if applicable)
- Failed check: <display name>
- Failed workflow run: <run id or URL>
- Failed job: <job name>
- Failed step: <step name>
- Blocking future PRs: yes / no / unknown
- Linked root-cause issue: #<issue> / none

## Required action

- <owner>: <next step>

## Automation gap

Post-Merge Detection did not create or update the expected remediation issue.
Manual issue filed per docs/how-to/ci/merged-pr-failed-pre-gate-followup.md.

## Regression

Record whether post-#2380 automation should have caught this case.
```

5. **Comment on the source issue** with merge evidence and a link to the Ops issue. Do not claim closeout verified until validation and remediation posture are reconciled.

6. **File or update** a bounded process remediation issue if the automation gap itself blocks launch (see `docs/ops/pmo/queue-watch-and-dispatch-protocol.md`).

## What operators must not do

- Do not assume a green merge commit means all gates are resolved.
- Do not close the source task issue as complete while required failed-check remediation remains open unless Product Authority records an accepted exception with authority citation.
- Do not redesign branch protection or merge policy from this procedure.
- Do not perform repository-history remediation (for example ZIP history rewrite) from this procedure; route to the authorized root-cause issue (#2374).
- Do not open duplicate Ops issues when an open canonical remediation issue already matches the same PR and failure condition.

## Dispatcher integration

Manual queue dispatch must include failed pre-gate checks on recently merged PRs:

```text
Check open PRs for duplicates, superseded branches, failed gates, or review-ready work.
Check recently merged PRs for failed required pre-merge checks still unresolved.
```

See `docs/ops/pmo/queue-watch-and-dispatch-protocol.md`.

## Related references

- Post-merge validation surface: `docs/reference/ci/post-merge-validation-surface.md`
- GitHub issue closeout protocol: `docs/ops/pmo/github-issue-closeout-protocol.md`
- Post-merge self-healing runbook: `docs/how-to/ci/post-merge-self-healing-runbook.md`
- CI monitoring ownership: `docs/ops/ci-monitoring-ownership.md`
- ChatGPT / Cursor handoff workflow: `docs/ops/ai/chatgpt-cursor-handoff-workflow.md`
