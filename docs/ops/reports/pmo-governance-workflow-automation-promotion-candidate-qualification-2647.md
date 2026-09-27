---
Doc Type: Operations
Audience: Bill, Atlas, ChatGPT, Cursor, LGFC maintainers, and reviewers
Authority Level: Superseded
Owns: Historical #2647 Promotion Candidate synchronization evidence only — superseded for current Program #1719 promotion status
Does Not Own: Production promotion to main, Cursor self-approve/self-merge, unauthorized issue mutation, workflow YAML redesign, or secret/credential changes
Canonical Reference: /docs/ops/reports/pmo-governance-workflow-automation-promotion-candidate-qualification-2775.md
Related Issues: #2647, #1719, #1727, #2640, #2775
Last Reviewed: 2026-09-25
---

# Program #1719 Promotion Candidate Qualification (#2647)

## Status

**Superseded by [#2775](./pmo-governance-workflow-automation-promotion-candidate-qualification-2775.md).**
The candidate this report qualified (`9d6db7d`) went stale against `main`
before Production review; #2775 records the replacement resynchronization and
is the current Promotion Candidate evidence for Program #1719. This report is
retained as historical evidence of the original conflict dispositions and is
not itself actionable.

## Purpose

Record the exact Promotion Candidate prepared by synchronizing accepted Program
#1719 component history with current `main`, including conflict dispositions,
reserved #1727 cleanup corrections, validation evidence, rollback status, and
the Atlas Go/No-Go recommendation.

## Scope

- Synchronization of `component/pmo-governance-workflow-automation` accepted tip
  into working branch `cursor/1719-promotion-candidate-sync` by merging current
  `main` without rewriting component history.
- Conflict resolution for constitutional/domain-policy authority files.
- Reserved #1727 cleanup edits and this qualification report.
- One PR targeting only the component branch.

Out of scope: Production promotion PR to `main`, self-approval, self-merge,
workflow redesign, website changes, secrets, credentials, branch-protection
changes, and external mutations.

## Current known truth

| Field | Value |
| --- | --- |
| Source issue | #2647 |
| Parent program | #1719 |
| Accepted component starting SHA | `5a005e9e1c3ccff04192709a833d100e35b5874a` |
| Current `main` SHA consumed | `8a3f56e65b90b36729d96dce2005ea21cc27e08f` |
| Working branch | `cursor/1719-promotion-candidate-sync` |
| PR base | `component/pmo-governance-workflow-automation` |
| Merge method | `git merge origin/main` (no rebase / no history rewrite) |
| Ahead/behind at merge start | component 18 ahead / 53 behind `main` |

Candidate head SHA is the final push tip of this working branch after the merge
commit and the reserved cleanup/qualification commit(s). Record the exact SHA in
the PR body and `CHATGPT HANDOFF` at open time.

## Conflict inventory and dispositions

Eight conflict files. Disposition for each: **preserve current `main`
constitutional and domain-policy authority** (`git checkout --theirs` during the
merge where HEAD was the component branch).

| File | Disposition |
| --- | --- |
| `.agents/skills/lgfc-pr-governance/SKILL.md` | main wins |
| `docs/governance/DELIVERY-AND-RELEASE.md` | main wins |
| `docs/governance/PR_LIFECYCLE_STATE_MACHINE.md` | main wins |
| `docs/governance/PR_PROCESS.md` | main wins |
| `docs/ops/ai/chatgpt-cursor-handoff-workflow.md` | main wins |
| `docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md` | main wins |
| `docs/ops/pmo/github-issue-closeout-protocol.md` | main wins |
| `docs/ops/pmo/queue-watch-and-dispatch-protocol.md` | main wins |

Rationale: current `main` carries the canonical four-lane / four-profile model
from #2640/#2642 and subsequent communication governance. Unique #1719
construction deliverables that did not conflict remain on the component history
and continue through the merge.

## Reserved #1727 cleanup corrections

1. `docs/ops/pmo/pmo-governance-workflow-automation-completion-readiness.md` —
   related-issue / current-state metadata updated for #2647 and #2640.
2. `docs/ops/reports/pmo-governance-workflow-automation-closeout-1727.md` —
   added concise `Scope` and `Current known truth` sections.

## Validation

Recorded at PR open. Minimum commands:

- conflict inventory posted on #2647 before resolution
- `git diff --check`
- documentation / governance / delivery-profile / PR-governance checks applicable
  to the synchronized result
- relevant Vitest/Node tests for touched governance or CI contracts when required
  by changed paths
- no tracked ZIP / secret scan checks

Exact command/result lines appear in the PR `## Verification` section.

## Rollback package

Rollback remains: close or reject the child PR without merging to the component
branch; if already integrated to the component branch, revert the merge commit on
`component/pmo-governance-workflow-automation`. No Production rollback is required
because this task never merges to `main`.

## Unresolved gaps

- Atlas Promotion Candidate Go/No-Go not yet recorded.
- Separate Production promotion Issue/PR to `main` is still required after Go.
- Deferred workflow/CI candidates C-01–C-06 from #1727 remain out of scope.

## Documentation-standard remediation (#2652 review)

Seven Copilot review findings required Minimum Content Requirements
(`Purpose`, `Scope`, `Current known truth`, and `Intended final state` where
evolving) on docs brought in by the main synchronization. Remediated in-scope
on:

1. `docs/tutorials/operations/idea-to-production-feature.md`
2. `docs/explanation/operations/four-lane-four-profile-operating-model.md`
3. `docs/how-to/operations/run-work-through-promotion-profiles.md`
4. `docs/reference/operations/operating-lanes-and-promotion-profiles.md`
5. `docs/reference/operations/administrative-control-lane-contract.md`
6. `docs/reference/ci/repository-runner-contract.md`
7. `docs/reference/pmo/pmo-dashboard-single-authority-implementation-plan.md`

After remediation, the qualification recommendation below applies to the new
head SHA recorded in the `CHATGPT HANDOFF` / PR.

## Qualification recommendation

**PROMOTION CANDIDATE READY** for Atlas Go/No-Go review of the synchronized
component candidate, contingent on CI gates on the child PR, disposition of the
seven documentation-standard review threads, and Atlas review of this packet.
This is not Production Go and does not authorize merge to `main`.
