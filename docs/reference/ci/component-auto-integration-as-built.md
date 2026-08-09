---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: As-built component child auto-integration evaluator, workflow behavior, and GitHub-native state surfaces
Does Not Own: Delivery policy boundaries, approval authority, or branch protection configuration
Canonical Reference: /docs/governance/DELIVERY-AND-RELEASE.md
Related Issues: #2498, #2501, #2502, #2588, #3151
Last Reviewed: 2026-08-09
---

# Component Auto-Integration As-Built

## Purpose

This reference documents the deterministic Model B child auto-integration evaluator and the GitHub workflow that enables squash auto-merge only after eligibility succeeds.

Policy boundaries live in `docs/governance/DELIVERY-AND-RELEASE.md` and `docs/governance/OPERATIONS-AND-RECOVERY.md`.

## Evaluator contract

`scripts/ci/component_integration_eligibility.mjs` exports `evaluateComponentIntegration` with these inputs:

| Input | Meaning |
| --- | --- |
| `profile` | Parsed delivery-profile metadata |
| `checks` | Required check conclusions for the child PR head |
| `reviews` | Current review state |
| `componentState` | Derived component branch state |
| `labels` | Current PR and component routing labels |
| `changedFiles` | Changed-file paths used for protected-scope evaluation |
| `headSha` | Current PR head SHA used to exclude superseded review state |

Return shape:

| Field | Meaning |
| --- | --- |
| `eligible` | `true` only when every negative rule passes |
| `blockedReasons` | Ordered list of `{ code, message, ...details }` |
| `requiresChatReview` | `true` when protected-change review is required before integration |
| `componentState` | Supplied `componentState` value returned when truthy; otherwise `green` |
| `deliveryModel` | Classified or supplied delivery model |
| `gateProfile` | Classified or supplied gate profile |
| `approvalProfile` | Classified or supplied approval profile |
| `componentBranch` | Classified or supplied component branch metadata |
| `componentMaster` | Classified or supplied component-master issue reference |
| `protectedChange` | Whether the evaluated profile contains protected scope |

Supporting constants:

- `HOLD_LABELS = ['component-integration-hold', 'hold:component-integration']`
- `COMPONENT_STATES = ['green', 'red', 'hold']`

## Negative rules

The evaluator blocks auto-integration when any of the following are true:

| Code | Trigger |
| --- | --- |
| `failed_check` | Any required check reports a terminal failure |
| `pending_check` | Any required check is still running or queued |
| `non_component_base` | PR base is not `component/**` |
| `protected_change` | Protected paths changed or approval profile is `protected-change-review`, and no independent current-head APPROVED review has been recorded yet |
| `protected_change_stale_approval` | An independent APPROVED review exists, but only for a prior head — the head changed since approval and a fresh review is required |
| `component_hold` | Component state is `hold` or a hold label is present |
| `component_red_state` | Component branch integration state is `red` |
| `branch_mismatch` | `Component branch` metadata does not match PR base ref |
| `missing_component_master` | `Component master` metadata is missing |
| `stale_base` | PR base SHA is behind the current component branch head |
| `invalid_delivery_model` | Delivery model is not `B-child` |
| `changes_requested` | A reviewer requested changes on the current head |
| `implementer-self-approval` | The only APPROVED review recorded is from the implementation actor itself |

### Protected-change review completion (#3151)

Protected changes set `requiresChatReview: true` only while `protected_change` or `protected_change_stale_approval` remains an active blocker; both clear together once the requirement is satisfied. `evaluateComponentIntegration` calls `assessProtectedChangeReview({ implementationActor, implementationLogin, reviews, headSha })`, exported from `scripts/ci/component_integration_eligibility.mjs`, to distinguish:

1. **pending** — no independent APPROVED review exists yet for the current head (`protected_change`);
2. **satisfied** — an APPROVED review from someone other than the implementation actor is linked to the current head; `protected_change` is cleared and `requiresChatReview` becomes `false`;
3. **stale** — an independent APPROVED review exists, but only for a prior head; the approval must be refreshed after a new commit (`protected_change_stale_approval`, not `protected_change`);
4. **current-head `CHANGES_REQUESTED`** — remains blocking via the separate, unchanged `changes_requested` check regardless of protected-change state;
5. **self-approval** — an APPROVED review that exists only from the implementation actor never satisfies the requirement; `protected_change` stays present alongside the general `implementer-self-approval` finding.

Reviewer identity for this check prefers an attested `Reviewer actor:` field in the review body (`reviewerActor()` from `scripts/ci/reviewer_lifecycle_gate.mjs`) over the raw GitHub review author, matching the identity resolution already used elsewhere in this evaluator. The evaluator only ever reads real GitHub review state (author identity, review state, `commit_id`) — it verifies that authorized review evidence exists; it never infers or invents the Engineering decision. Non-protected children never run this check at all.

## Positive rule

A clean Model B child with:

- delivery model `B-child`
- gate profile `component-child`
- approval profile `component-auto-integration`
- matching `component/**` base and metadata
- green technical checks
- component state `green`
- no hold labels
- fresh base

returns `eligible: true` and `requiresChatReview: false`.

## Workflow triggers

`.github/workflows/component-child-integration.yml` supports four event paths:

| Event | Eligibility boundary |
| --- | --- |
| `pull_request` | Runs for `opened`, `synchronize`, `reopened`, and `ready_for_review` events targeting `component/**`; draft PRs are skipped |
| `pull_request_review` | Runs for `submitted`, `edited`, and `dismissed` review events (#3151) — the deterministic reevaluation trigger for protected-change review completion/staleness; draft PRs are skipped. GitHub does not support branch-filtering this event at the trigger level, so non-component PRs proceed through the same resolution path as `workflow_dispatch` and are rejected downstream by `non_component_base` |
| `workflow_run` | Re-evaluates after `GATE — Quality Checks`, `GATE — Diff Scope`, or `GATE — Secret Scan` completes for a pull-request run; only an associated PR targeting `component/**` proceeds |
| `workflow_dispatch` | Manually evaluates the supplied `pr_number`; draft PRs are skipped and the evaluator still enforces the component-base contract |

## Workflow behavior

| Stage | Behavior |
| --- | --- |
| Evidence collection | Reads PR body, changed files, reviews, labels, and head check runs through GitHub APIs |
| State derivation | Resolves component freshness and branch state as `green`, `red`, or `hold` |
| Evaluation | Runs `component_integration_eligibility.mjs` |
| Published result | Creates a completed check run named `Component Integration Eligibility` |
| Integration action | Enables squash auto-merge only when `eligible=true` and repository settings permit it |

Component integration state is recorded through the check run conclusion and branch commit status, not PR-body lifecycle prose.

## Validation coverage

Automated evaluator coverage is maintained in `tests/component-integration-eligibility.test.mjs`. Operator verification and recovery commands are owned by `docs/how-to/delivery/manage-component-integration.md`.

## Pilot status

A live Model B child pilot completed before Delivery System v1 promotion. The evaluator and workflow are present on `main`; ongoing eligibility remains subject to current repository settings, branch state, required checks, and delivery policy.

## Canonical references

| Topic | Owner |
| --- | --- |
| Delivery policy | `docs/governance/DELIVERY-AND-RELEASE.md` |
| Component integration procedure | `docs/how-to/delivery/manage-component-integration.md` |
| Delivery metadata contract | `docs/reference/ci/delivery-profile-contract.md` |
| Component state facts | `docs/reference/delivery/delivery-and-rollback-profiles.md` |
