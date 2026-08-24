---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Deterministic next-executable-child selection within a graduated project's dependency graph
Does Not Own: Project (parent) selection/priority, Project Graduation decisions, or cross-project queue precedence
Canonical Reference: /docs/governance/PMO-PORTFOLIO.md
Related Issues: #3666, #3665, #3667
Last Reviewed: 2026-08-24
---

# nextExecutable Dependency-Graph Contract

## Purpose

Define the deterministic logic that identifies the next executable PMO
project child, or collision-safe parallel set, within an already-graduated
project's child graph (#3666). Implemented in
`scripts/ci/next-executable.mjs` (`nextExecutable`).

PMO parent priority remains project-selection authority (which graduated
project's queue to advance — see `docs/governance/PMO-PORTFOLIO.md` and
`scripts/orchestrator/queue-routing.mjs`). This contract is
child-selection authority only, scoped to the children of one project.

This module composes, without duplicating:

- `evaluateExecutableChildContract` (#3665) for package completeness,
  lifecycle-state consistency, and queue invariants of each candidate
  child;
- `classifyClaim` (#3240) to exclude children already under an active
  claim or explicit reservation;
- `classifyCollision` (#3667) to build a collision-safe parallel set from
  otherwise-eligible candidates.

## Scope

This document covers within-project child selection: structural graph
validation, per-child eligibility, parallel-authorization gating, and
collision-safe set reduction. It does not cover which graduated project
to advance (project-selection authority stays with
`docs/governance/PMO-PORTFOLIO.md` and
`scripts/orchestrator/queue-routing.mjs`), successor release after
predecessor completion (see
`docs/reference/pmo/successor-release-contract.md`), or performing the
claim itself (see `docs/reference/pmo/claim-collision-contract.md`).

## Current known truth

`scripts/ci/next-executable.mjs` is implemented, unit-tested, and
lint-clean as a pure-function library composing #3665's and #3667's
existing modules. It is not currently wired into any GitHub Actions
workflow or other live enforcement entrypoint.

## Intended final state

Once operator/PMO authority decides to enforce continuous successor
selection live, the intended integration point is the same automation
that already advances a project after WORK acceptance (#3055), calling
`nextExecutable` to select the released child(ren) instead of requiring
manual PMO redispatch. That wiring decision is out of scope for this
document and its validator.

## Graph input

Each child node supplies:

| Field | Meaning |
| --- | --- |
| `id` | Child identifier |
| `body`, `labels` | Passed through to the #3665 contract evaluation |
| `predecessors` | Ordered predecessor id(s) that must be `completed` first |
| `completed` | Deterministic predecessor-completion evidence already recorded |
| `protectedStop` | `{ active, evidence }` — a real protected stop, not an advisory prerequisite |
| `executionRelationship` | `'serial'` (default) or `'parallel-authorized'` |
| `collisionSurface` | Passed through to #3667's `classifyCollision` |

Advisory prerequisites are intentionally not part of this graph: they are
comment-only guidance per
`docs/templates/executable-child-task-template.md` and must not deny
collision-safe work.

## Selection algorithm

1. **Structural validation** — an unknown predecessor reference or a
   dependency cycle fails the entire evaluation closed
   (`status: AMBIGUOUS`) with actionable evidence, since no other result
   can be trusted from a malformed graph.
2. **Per-child eligibility** — a non-`completed` child is blocked (and
   excluded from the executable set, without affecting unrelated
   children) when it has an active protected stop, an incomplete ordered
   predecessor, a contract status other than `PACKAGE-COMPLETE`, or an
   existing active claim/reservation/ambiguous claim state.
3. **Parallel-authorization check** — when more than one otherwise-eligible
   child shares the same predecessor set, all of them are blocked as
   ambiguous unless every one explicitly carries
   `executionRelationship: 'parallel-authorized'`. This prevents silently
   parallelizing work the launch package did not authorize.
4. **Collision-safe set** — remaining candidates are walked in the
   caller-supplied (queue-precedence) order; a candidate that collides
   (#3667 `COLLISION`) with an already-selected candidate or with a
   supplied active claim is deferred with evidence rather than selected.

## Result shape

```json
{
  "status": "RESOLVED | AMBIGUOUS",
  "executable": ["child ids safe to claim now"],
  "blocked": [{ "id": "...", "reasons": ["..."] }],
  "deferred": [{ "id": "...", "reason": "collision evidence" }],
  "errors": ["..."],
  "remediation": ["..."]
}
```

`blocked` and `deferred` are always populated with evidence, never a
silent omission, so the owning role can see exactly why a child was not
returned.

## Non-goals

This contract does not select which graduated project to advance, does
not grant Project Graduation, and does not itself perform a claim — see
`docs/reference/pmo/claim-collision-contract.md` (#3667) for atomic claim
evaluation once a child is identified as executable.
