---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Post-merge self-healing classifier outcomes, evidence inputs, safety rules, and documented example fixtures
Does Not Own: Workflow implementation, detector ingestion, auto-fix action execution, issue mutation, merge approval, runtime app-code remediation
Canonical Reference: /docs/reference/ci/post-merge-validation-surface.md
Related issues: #1847, #1848, #1914, #1921, #3069, #3462
Last Reviewed: 2026-09-18
---

# Post-Merge Self-Healing Classification Contract

## Purpose

This reference defines the Task 001 classification contract and safety model for
bounded post-merge self-healing CI.

For the full trigger model, layer diagram, and operational design rationale, see
`docs/explanation/ci/post-merge-self-healing-architecture.md`.

The classifier converts a detected post-merge finding into exactly one outcome:

- `safe_auto_fix`
- `cursor_remediation_required`
- `operator_authorization_required`
- `intentionally_deferred`
- `no_action`

## Scope

This document covers the decision contract only. It defines allowed repository
evidence, deterministic outcome precedence, safety limits, and documented example
fixtures for each outcome.

This document does not implement detector or report ingestion, auto-fix actions,
remediation issue creation, workflow orchestration, issue closure, label mutation,
or runtime app-code changes. #1914 separately authorizes bounded backlog and
issue-event safe-close implementation using this contract.

## Current Known Truth

Post-merge validation already records closeout, remediation, workflow, and
reviewer evidence. Current closeout authority is documented in
`docs/reference/ci/post-merge-validation-surface.md`, and issue mutation remains
bounded by `docs/ops/pmo/github-issue-closeout-protocol.md`.

Program, umbrella, master, parent, queue, roadmap, and tracking issue boundaries
remain governance policy unless explicit runtime classification is implemented by
a later task. This Task 001 contract does not change current workflow behavior.

## Intended Final State

Future self-healing CI uses the same deterministic contract before taking any
action. Deterministic repo-hygiene findings may be repaired automatically.
Findings requiring judgment, authorization, runtime code changes, secrets,
configuration, or ambiguous evidence are escalated instead of repaired.

Self-healing cannot bypass PR governance, reviewer-response accounting,
source-issue accounting, branch protection, or Bill/ChatGPT merge authorization.

## Repository Evidence Inputs

The classifier uses repository evidence only. External chat context, agent
memory, inferred intent, and unstated operator preference are not valid inputs.

| Input | Evidence examples | Classification use |
|---|---|---|
| Post-merge closeout reports | closeout status, merged PR, merge SHA, source issue, validation summary | Prove pass/fail state and identify stale closeout records |
| Manifest entries | PR number, source issue, manifest status, batch entry status | Detect stale or duplicate manifest records |
| Workflow conclusions | required or optional workflow status, head SHA, run conclusion | Distinguish proven pass, required failure, false-red, and unknown state |
| Source issue state | issue number, open/closed state, labels, state reason | Determine closeout eligibility and ambiguity |
| PR state / merge state | PR open/closed/merged state, base branch, merge commit | Confirm post-merge scope and prevent pre-merge mutation |
| Closeout exception issues | exception issue state, referenced PR/source issue, superseded-by evidence | Detect stale or duplicate exceptions |
| Remediation backlog issues | remediation issue state, linked finding, superseded-by evidence | Preserve canonical remediation and close only proven duplicates in later action tasks |
| Reviewer disposition failures | reviewer comment IDs, thread states, disposition parseability | Escalate missing or ambiguous reviewer evidence |
| Workflow failure classifications | failure type, affected workflow, blocking status, confidence | Separate deterministic hygiene from auth, config, runtime, or ambiguous failures |

## Output Contract

Each classified finding has one outcome and an evidence explanation.

| Outcome | Meaning | Allowed follow-up |
|---|---|---|
| `safe_auto_fix` | The finding is a deterministic repo-hygiene defect with complete evidence and no governance ambiguity. | A later authorized auto-fix action may apply the bounded hygiene repair. |
| `cursor_remediation_required` | The finding is unsafe for automatic repair but fits normal Cursor remediation through a scoped issue or PR. | Create or update a Cursor-ready remediation issue in a later authorized task. |
| `operator_authorization_required` | The finding involves protected authority, destructive issue action, secrets/config, active program-lane choice, merge/queue authority, or production-sensitive judgment. | Stop for Bill/ChatGPT/operator authorization. |
| `intentionally_deferred` | Repository evidence explicitly records that the finding is deferred and no current gate requires immediate repair. | Preserve the defer record and avoid duplicate noise. |
| `no_action` | Repository evidence proves there is no remaining finding, the finding is already reconciled, or the clean state would produce churn. | Emit no mutation and no remediation issue. |

## Deterministic Outcome Precedence

When multiple signals are present, the classifier applies this precedence in
order and returns the first matching outcome.

| Precedence | Outcome | Trigger |
|---:|---|---|
| 1 | `operator_authorization_required` | Protected action, active alternate program lane, auth/secrets/config failure, issue or queue mutation without explicit authority, merge authorization, or production-sensitive runtime decision |
| 2 | `cursor_remediation_required` | Missing reviewer disposition, source issue ambiguity, allowlist ambiguity, runtime app-code finding, required workflow failure that is not deterministic hygiene, conflicting repository evidence, or unknown workflow failure classification |
| 3 | `intentionally_deferred` | Explicit defer evidence exists in the source issue, remediation backlog, closeout exception, or accepted program documentation, and no higher-precedence unsafe condition is present |
| 4 | `safe_auto_fix` | Complete evidence proves the finding is one of the allowed deterministic repo-hygiene repairs |
| 5 | `no_action` | Evidence proves clean state, prior reconciliation, or duplicate report absence |

Ambiguous evidence never reaches `safe_auto_fix`.

## Safe Auto-Fix Boundary

`safe_auto_fix` is limited to deterministic repository-hygiene issues.

Allowed safe classifications:

- stale manifest entries after a post-merge closeout report proves pass;
- emptying closeout manifests after all entries have passed;
- duplicate exception or remediation issues superseded by newer canonical
  repository evidence;
- stale exception issues where the PR passed, the source issue is closed, and no
  blocker remains.

The safe classification only permits an authorized action to make the bounded
hygiene repair. It does not authorize broad cleanup, runtime edits, issue
mutation outside the proven target, queue advancement, or merge approval.

## Escalation Boundary

The classifier escalates instead of auto-fixing when a finding includes any of
these signals:

- missing reviewer disposition;
- source issue ambiguity;
- allowlist ambiguity;
- active alternate program lane;
- auth, secrets, or configuration failure;
- runtime app-code issue;
- ambiguous, missing, conflicting, or stale evidence;
- required workflow failure without a deterministic hygiene repair;
- any action that would close, reopen, relabel, or advance issues without
  explicit authority;
- any action that would bypass PR governance or Bill/ChatGPT merge authorization.

## Backlog disposition and `ops-pr-escalation`

The backlog scanner (`post_merge_self_heal_backlog.mjs`) maps each open
post-merge exception issue to a backlog disposition. Execution outcomes:

| Disposition | `safe_to_close` | Execution action |
|---|---|---|
| `safe_to_close` | yes | Close issue + disposition comment |
| `duplicate_of_canonical_remediation` | yes | Close issue + disposition comment |
| `preserve_active_source` | no | Comment + add `ops-pr-escalation` (and `post-merge-failure` when missing) |
| `preserve_source_state_reconciliation` | no | Comment + add `ops-pr-escalation` (and `post-merge-failure` when missing). Source Issue is OPEN while carrying terminal labels such as `status:complete` and/or `pmo:closed`. Do not auto-close. Originating-agent ownership is unchanged. After the source is genuinely closed-complete, the normal no-remaining-action safe-close path may evaluate the exception. |
| `preserve_ambiguous_evidence` | no | Comment + add `ops-pr-escalation` (and `post-merge-failure` when missing) |
| `unsafe_operator_review_required` | no | Comment + add `ops-pr-escalation` (and `post-merge-failure` when missing) |

`unsafe_operator_review_required` retains precedence over `preserve_source_state_reconciliation`. An OPEN source Issue with terminal labels does not hide operator-unsafe evidence.

Any issues already labeled `ops-pr-escalation` are excluded from backlog scans.
Applying the label does not re-trigger `OPS — Post-Merge Self-Healing`.

Ops queue search:

`is:issue is:open label:post-merge-failure label:ops-pr-escalation`

Remove `ops-pr-escalation` only when an operator intentionally requests
re-triage after new evidence lands.

## Governance Invariant

Self-healing is a post-merge hygiene and escalation layer. It cannot:

- approve, merge, or mark a PR ready for merge;
- satisfy reviewer-response accounting by guessing reviewer intent;
- select a source issue when source issue evidence is ambiguous;
- broaden a PR file-touch allowlist;
- change runtime app code;
- modify secrets or production configuration;
- close, reopen, relabel, or advance issues without explicit repository
  authority;
- override Bill/ChatGPT gate, queue, launch, or merge decisions.

## Documented Example Fixtures

These fixtures are normative examples for future tests. Each fixture uses only
repository evidence listed in this contract.

| Fixture ID | Evidence | Expected outcome | Reason |
|---|---|---|---|
| `safe_auto_fix_manifest_stale_after_pass` | Manifest entry references PR `#1201`; post-merge closeout report for PR `#1201` is `pass`; required workflow conclusions are successful; source issue is closed complete; no exception or remediation issue remains open for the same finding | `safe_auto_fix` | The manifest row is stale repo hygiene after proven pass |
| `safe_auto_fix_duplicate_remediation_superseded` | Two remediation issues reference the same PR, source issue, and failure classification; the newer issue is open and canonical; the older issue contains superseded-by evidence pointing to the newer issue | `safe_auto_fix` | Closing the older duplicate is deterministic hygiene when later action scope authorizes it |
| `cursor_remediation_missing_reviewer_disposition` | Post-merge report fails reviewer audit; trusted reviewer comment ID is present; PR body lacks a parseable `review-comment:<id>` disposition; no operator authorization issue exists | `cursor_remediation_required` | Reviewer intent cannot be inferred by CI and requires scoped remediation |
| `cursor_remediation_allowlist_ambiguous` | PR body allowlist and changed-file evidence disagree; no single authoritative allowlist can be derived from repository evidence | `cursor_remediation_required` | Allowlist ambiguity is unsafe for auto-fix |
| `operator_auth_active_alternate_lane` | Finding references a source issue that belongs to an active alternate program lane; remediation would choose whether to halt, continue, close, or move queue state | `operator_authorization_required` | Program-lane and queue decisions require Bill/ChatGPT/operator authority |
| `operator_auth_secret_config_failure` | Required workflow failure classification is `auth_secret_config_failure`; logs point to missing or invalid token/configuration | `operator_authorization_required` | CI must not modify secrets or production configuration automatically |
| `intentionally_deferred_backlog_item` | Closeout report records a non-blocking finding; an open remediation backlog issue references the same finding and is explicitly marked deferred to a later task; no required workflow is failing for that finding | `intentionally_deferred` | The repository already records the defer decision, so duplicate churn is avoided |
| `no_action_clean_manifest` | Closeout manifest is empty; latest post-merge closeout report is `pass`; no open exception or remediation issue references the PR/source issue pair | `no_action` | Clean state requires no issue and no mutation |
| `no_action_duplicate_report_already_reconciled` | A repeated detection report references a duplicate exception issue that is already closed with superseded-by evidence; canonical issue remains open or complete as recorded | `no_action` | Repeating the prior reconciliation would create churn |

## Task Boundary

This contract governs classifier outcomes for detect, apply, backlog disposition,
and optional escalation paths. Backlog disposition execution and the
`ops-pr-escalation` handoff label are implemented in
`scripts/ci/post_merge_self_heal_backlog.mjs` and
`.github/workflows/ops-post-merge-self-healing.yml`.
