---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Post-merge failure label taxonomy, terminal vs intermediate status labels, idempotent closeout normalization rules, remediation issue labeling policy
Does Not Own: PR merge authority, workflow YAML implementation outside documented scripts, PMO dashboard precedence
Canonical Reference: /docs/reference/ci/post-merge-validation-surface.md
Related Issues: #2418, #2364, #2420, #2425
Last Reviewed: 2026-08-18
---

# Post-Merge Failure Label Transition

## Purpose

Define how LGFC labels post-merge closeout failures, separates workflow-state labels from agent-routing labels, and documents idempotent terminal-label normalization for already-closed completed source issues.

## Scope

This reference owns:

- current vs preferred post-merge remediation issue labels;
- terminal, intermediate, and stale workflow `status:*` labels eligible for post-merge cleanup;
- when CI may normalize labels without creating a blocking exception;
- when CI must stop and open a governance exception.

This reference does not own merge approval, issue closure authority outside automation, or creation of new GitHub labels without operator authorization.

## Current Known Truth

| Label | Status | Role |
| --- | --- | --- |
| `post-merge-failure` | **Active** | Canonical remediation-issue marker used by Post-Merge Detection and Post-Merge Remediation |
| `post-merge:failed` | **Proposed** | Preferred future workflow-state label; not yet created in the live repo |
| `post-merge:issue-####` | **Proposed** | Optional source-issue-scoped marker when a single source issue is known |
| `agent:ChatGPT` | **Active** | Agent-routing label for governance review — must not be auto-applied to every post-merge exception |
| `status:complete` | **Active** | Terminal completed source-issue status label |

Automation scripts use `REMEDIATION_ISSUE_LABEL = post-merge-failure` in `scripts/ci/post_merge_source_issue_closeout.mjs`. The preferred colon-style labels remain transition debt until a separate authorized label-creation change lands.

## Label classes

### Terminal status labels (source issues)

| Label | Meaning |
| --- | --- |
| `status:complete` | Completed task — sole terminal success label for source issues |
| `status:active` | Intentionally open umbrella/active source issue after merge |
| `status:failed` | Failure-path relabel when validation fails and source issue stays open |

### Intermediate / stale labels (safe to remove post-merge)

CI may remove these during successful or idempotent closeout when validation passes:

- `status:blocked`
- `status:queued`
- `status:assigned`
- `status:failed` (success path only)
- `status:post-merge-verify`
- `status:pr-draft`
- `status:review`
- `status:implementation`
- `status:implementation-ready`
- `status:ready-for-cursor`
- `status:ready`
- `status:changes-requested`
- `status:in-progress`

Authoritative list: `STALE_SOURCE_ISSUE_LABELS` and `INTERMEDIATE_SOURCE_ISSUE_LABELS` in `scripts/ci/post_merge_source_issue_closeout.mjs`.

### Workflow-state vs agent-routing labels

| Class | Examples | Rule |
| --- | --- | --- |
| Workflow state | `post-merge-failure`, `status:post-merge-verify`, `status:complete` | Describe closeout/queue state; safe for automation |
| Agent routing | `agent:cursor`, `agent:ChatGPT` | Describe who should act next; never substitute for workflow-state labels |
| Ops escalation | `ops-pr-escalation` | Self-healing handoff when automation cannot safely close an exception |

Remediation issues receive `post-merge-failure` only. `agent:ChatGPT` is added manually when a governance decision is required, not for deterministic label cleanup.

## Idempotent closeout normalization

Post-merge closeout must be idempotent when:

1. the merged PR passed post-merge validation (`status: pass`);
2. the source issue is already **closed** with `state_reason: completed`;
3. no blocking implementation, DIATAXIS, reviewer-finding, reviewer-disposition, or required workflow failures remain;
4. terminal label reconciliation is deterministic (`planTerminalLabelReconciliation().ok === true`).

In that mode (`closed_completed_idempotent_normalize`):

- CI does **not** emit `source_issue_not_open`;
- CI reconciles stale/intermediate labels to `status:complete`;
- CI posts closeout evidence without reopening the issue;
- queue advancement is not blocked solely by remediable stale labels on an already-closed source issue.

## Blocking exceptions (governance required)

CI must still stop and open or update a remediation issue when any of the following remain:

- undispositioned trusted reviewer comments or outdated review threads;
- implementation or DIATAXIS evidence failures;
- required workflow failures on merge/head scope;
- non-repairable unknown `status:*` labels outside the stale/intermediate allowlist;
- source issue closed for a non-completed reason without explicit permitted follow-up authority;
- PR body declares an exception/blocker state.

Reviewer-disposition failures and terminal-label cleanup failures are reported separately. Label-only cleanup must not be conflated with governance-review exceptions.

## Migration / compatibility

| Step | Action |
| --- | --- |
| Now (#2418) | Treat `status:changes-requested` and `status:in-progress` as removable intermediate labels; implement idempotent closed-completed normalization |
| Deferred | Create `post-merge:failed` and optional `post-merge:issue-####` labels in GitHub |
| Deferred | Dual-write or alias-read both `post-merge-failure` and `post-merge:failed` in workflows |
| Deferred | Update operator search queries and dashboards after label creation |

Do not bulk-relabel historical issues without an authorized migration manifest.

## Core scripts

| Script | Change area |
| --- | --- |
| `scripts/ci/post_merge_source_issue_closeout.mjs` | Stale/intermediate label lists, idempotent closeout helpers |
| `scripts/ci/post_merge_validator.mjs` | Source-issue state failures and closeout mode resolution |
| `scripts/ci/post_merge_remediation_issue.mjs` | Remediation issue labels; governance-exception classification |

## Acceptance mapping (#2418)

- Current and proposed post-merge failure labels documented in this file.
- Workflow-state labels separated from agent-routing labels.
- Idempotent terminal-label normalization implemented in closeout scripts.
- `agent:ChatGPT` is not auto-applied to remediation issues.
