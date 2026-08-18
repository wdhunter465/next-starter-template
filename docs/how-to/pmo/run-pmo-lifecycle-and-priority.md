---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Owns: Procedures to qualify Engineering work, move PMO stages, assign or renumber ordered priorities, graduate a project, and reconcile dashboard defects
Does Not Own: Product priority decisions, implementation execution, Production authorization, or live bulk label mutation
Canonical Reference: /docs/reference/pmo/pmo-lifecycle-and-priority-contract.md
Related Issues: #3597, #2699
Last Reviewed: 2026-08-18
---

# Run PMO Lifecycle and Priority

## Purpose

Move one project through Engineering qualification and PMO Pipeline without treating preparation as Active implementation.

Use the weekly review how-to for meeting sequence: `docs/how-to/pmo/run-weekly-pmo-priority-and-graduation-review.md`.

## Qualify Engineering work

1. Confirm the Issue carries `team:engineering` and does not carry `pmo:pipeline`.
2. Record the problem, why remediation is required, intended outcome, remediation objectives or design direction, and known constraints, dependencies, risks, and protected decisions.
3. Stop if those fields are missing. Do not invent a launch packet to compensate.
4. When the fields are complete, remove `team:engineering` and any `eng:priority:*` labels.
5. Add `team:pmo`, `pmo`, `pmo:pipeline`, `pmo:stage:initial-idea`, and `pmo:pipeline-priority:<n>` where `<n>` is the next Pipeline order position.

## Move a Pipeline stage

Work only the current Pipeline Priority 1 parent unless Product Authority records a different order.

| From | To | Required evidence before the label change |
| --- | --- | --- |
| Initial Idea | Drafted Design | Design document exists on the Issue or linked canonical path |
| Drafted Design | Pending Launch Packet | Feedback reconciled; design approved on the Issue |
| Pending Launch Packet | Graduation Candidate | Linked children, implementation plan, sequence, acceptance, rollback, handoff, and intended implementation owner recorded |
| Graduation Candidate | Active | Explicit PMO Graduation Go |

Replace the previous `pmo:stage:*` label with exactly one canonical stage label. Do not add `pmo:active` until Graduation.

## Assign or renumber priority

Pipeline and Active are separate sequences.

1. List open parents in that lifecycle.
2. Order them as the PMO meeting decided.
3. Apply `pmo:pipeline-priority:1...N` or `pmo:priority:1...N` so the numbers are contiguous where practical.
4. Create a GitHub label `pmo:priority:<n>` or `pmo:pipeline-priority:<n>` only when that integer does not already exist. Do not cap at 4.
5. After add, remove, hold, close, or reprioritize, renumber the affected lifecycle queue in the same meeting closeout.

Child tasks never receive these labels.

## Graduate to Active

1. Confirm `pmo:stage:graduation-candidate` and a complete launch packet.
2. Record Active ordered position, one start-to-finish implementation owner, first executable child, and implementation authority.
3. Remove `pmo:pipeline`, `pmo:pipeline-priority:*`, and `pmo:stage:*`.
4. Add `pmo:active` and `pmo:priority:<n>`. Keep `team:pmo`.
5. Do not copy the Pipeline number onto Active. Assign Active order independently.

Protected Product, Production, credential, legal, and separation-of-duty stops remain in force after Graduation.

## Handle hold or blocked preparation

If Pipeline work cannot proceed:

1. Leave the lifecycle stage truthful.
2. Record owner, reason, next review time, expected evidence, and return condition on the Issue.
3. Renumber remaining executable Pipeline parents if the held item should not occupy position 1.

Do not move the parent to Active to bypass the hold.

## Reconcile dashboard Incomplete rows

1. Open the live GitHub Issue. The dashboard is reporting only.
2. Apply the remediation strings on the Incomplete row.
3. Rebuild the dashboard after labels match the contract.
4. If the row still uses legacy `eng:priority:*` on `pmo:pipeline` or a retired `pmo:stage:*` label, follow `docs/ops/pmo/issue-3597-pmo-lifecycle-migration-plan.md` instead of inventing a new stage name.
