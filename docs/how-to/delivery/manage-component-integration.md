---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Owns: Operator procedure for managing Model B component child auto-integration, holds, and rollback disablement
Does Not Own: Delivery policy, evaluator implementation, or branch protection configuration
Canonical Reference: /docs/governance/DELIVERY-AND-RELEASE.md
Related Issues: #2498, #2502
Last Reviewed: 2026-07-15
---

# Manage Component Integration

## Purpose

Operate Model B child auto-integration into an authorized component branch after technical gates pass, without production ceremony or Bill approval for eligible children.

## Prerequisites

- Child issue classified as Model B with `component/**` base branch
- Component master issue recorded on the child issue and PR
- Branch-aware CI and unified preflight proven (#2497)
- Auto-integration evaluator and workflow deployed (#2498)

## Procedure

### 1. Confirm child PR metadata

Child PRs must declare:

```text
Delivery model: B-child
Target environment: component
Gate profile: component-child
Rollback profile: multi-step
Component branch: component/<release-unit>
Component master: #<program-issue>
Approval profile: component-auto-integration
```

Protected-path changes require `protected-change-review` and block auto-integration until Chat review completes.

### 2. Run technical verification

Required checks must pass on the child PR head before integration proceeds. Pending or failed checks block auto-integration deterministically.

Local preflight remains available through `npm run pr:preflight` when GitHub snapshots are not yet collected.

### 3. Monitor component branch state

Component integration state is GitHub-native:

| State | Signal | Action |
| --- | --- | --- |
| `green` | Required checks passing on component branch head | Eligible children may auto-integrate when evaluator passes |
| `red` | Failed required check or broken build on component branch | Halt successor children until Cursor restores green with Chat verification |
| `hold` | `component-integration-hold` or `hold:component-integration` label | No auto-integration; remove hold only after Chat or Bill direction |

State is derived from branch commit status and the `Component Integration Eligibility` check run — not PR-body lifecycle fields.

### 4. Let auto-integration proceed for eligible children

When the workflow reports `eligible: true`, GitHub squash auto-merge is enabled automatically. Cursor does not self-approve or manually merge eligible children.

If the workflow reports `requiresChatReview: true`, route the PR to Chat for protected-change review before retrying integration.

### 5. Place or remove holds

To pause integration across a component branch:

1. Apply `component-integration-hold` to the blocked child PR or component master issue per Chat direction.
2. Confirm the workflow publishes a blocked `Component Integration Eligibility` check.
3. Remove the hold label only after Chat or Bill clears the pause condition.

### 6. Recover from red component state

When the component branch enters red state:

1. Halt new child integrations.
2. Cursor restores green checks on the component branch head.
3. Chat verifies recovery before successors resume.
4. Re-run the blocked child PR checks after the component branch returns to green.

### 7. Roll back automation

Disable child auto-integration without deleting component evidence:

1. Disable or remove `.github/workflows/component-child-integration.yml`.
2. Disable repository auto-merge settings if no other workflow depends on them.
3. Record the rollback action on the source issue.
4. Retain the component branch and merged child PR history for promotion planning.

### 8. Restore repository configuration after failed promotion

Use this ordered restoration when a Model B promotion to `main` fails or must be reversed. Snapshot facts live in `docs/reference/github/delivery-system-repository-configuration.md`.

1. Pause component auto-integration deterministically using one of these mechanisms (record which was used on the source issue):
   - Apply hold label `component-integration-hold` or `hold:component-integration` to every open Model B child PR targeting the component branch (and to the component master issue when Chat directs a branch-wide pause); confirm the child integration workflow publishes a blocked `Component Integration Eligibility` result; **or**
   - Disable the workflow file `.github/workflows/component-child-integration.yml` via a Chat-authorized config change (rename/remove in a scoped PR, or disable the workflow in GitHub Actions UI when authorized), then confirm no new `component-child-integration` runs start for `component/**` children.
2. Restore ruleset `15885337` (or the pre-change ruleset export) if promotion altered branch protection.
3. Restore template files from the recorded pre-promotion commit on `main`.
4. Revert the promotion merge commit if production activation occurred.
5. Restore the previous Cloudflare Pages deployment if required.
6. Verify required checks `quality` and `gitleaks` on `main`.
7. Reconcile source issues, Program #2477 status, and authority references.

Verification commands (operator):

```bash
gh api repos/wdhunter465/next-starter-template/rulesets
gh api repos/wdhunter465/next-starter-template --jq '{allow_auto_merge, allow_merge_commit, allow_rebase_merge, allow_squash_merge}'
gh api repos/wdhunter465/next-starter-template/rulesets/15885337
```

## Verification checklist

- [ ] Negative fixtures block failed, pending, protected, hold, red, mismatch, missing master, and stale-base cases
- [ ] Eligible non-protected child fixture returns `eligible: true`
- [ ] Workflow publishes `Component Integration Eligibility` on child PRs targeting `component/**`
- [ ] Auto-merge enables only after eligibility success
- [ ] Production and emergency PRs cannot use child auto-integration

## Canonical references

| Topic | Owner |
| --- | --- |
| As-built evaluator and workflow | `docs/reference/ci/component-auto-integration-as-built.md` |
| Model B release procedure | `docs/how-to/delivery/run-model-b-component-release.md` |
| Component state facts | `docs/reference/delivery/delivery-and-rollback-profiles.md` |
| Delivery policy | `docs/governance/DELIVERY-AND-RELEASE.md` |
