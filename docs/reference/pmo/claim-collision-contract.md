---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Deterministic collision classification and atomic claim-eligibility evaluation for executable child Issues
Does Not Own: Team ownership policy, durable role definitions, or Product Authority reservation decisions
Canonical Reference: /docs/governance/WORK-QUEUES-AND-COLLABORATION.md
Related Issues: #3667, #3665, #3240
Last Reviewed: 2026-08-24
---

# Claim and Collision Contract

## Purpose

Define the deterministic collision evaluation performed before an eligible
agent may claim a package-complete executable child Issue (#3667), so
duplicate starts and unsafe parallel execution are prevented while
independent work stays maximally concurrent. Implemented in
`scripts/ci/claim-collision-contract.mjs`.

This contract extends, without duplicating:

- the team-vs-agent claim lifecycle (`docs/governance/AGENT-TEAM.md`,
  `scripts/ci/agent-claim-contract.mjs`, #3240) — `team:*` ownership stays
  independent from `agent:*` claims;
- the executable child contract (`docs/reference/pmo/executable-child-contract.md`,
  #3665) — package completeness, lifecycle-state consistency, and queue
  invariants must already hold before collision evaluation runs.

## Collision classification

`classifyCollision(a, b)` compares two claim surfaces and returns one of:

| Classification | Meaning |
| --- | --- |
| `SAFE_PARALLEL` | No materially shared resource; both may proceed concurrently |
| `SERIAL_DEPENDENCY` | An ordered predecessor/successor relationship; queue precedence applies, not a collision |
| `COLLISION` | A materially shared resource — overlapping file/domain scope, shared schema/migration surface, shared configuration, or a shared project dependency |

Each result carries `evidence`, an array of the specific overlaps found, so
a blocked claim always has an actionable reason.

No arbitrary global work-in-progress cap is imposed. A claim is blocked
only when a genuine, evidenced collision or unresolved serial dependency
exists.

## Atomic claim evaluation

`evaluateAtomicClaim({ issue, requestingAgent, activeClaims })` composes,
in fail-closed precedence order:

1. `evaluateExecutableChildContract(issue)` (#3665) — blocks with
   `BLOCKED-INVALID-QUEUE-STATE`, `BLOCKED-LIFECYCLE-CONTRADICTION`, or
   `BLOCKED-PACKAGE-INCOMPLETE` before any claim/collision check runs.
2. `classifyClaim` / `canClaim` (#3240) — blocks with
   `BLOCKED-CLAIM-STATE` on a duplicate active claim, an ambiguous claim
   state, or a Product Authority reservation held by another agent. A
   proven stale pre-assignment does not block; it may be released then
   claimed.
3. Collision evaluation against every supplied active claim — blocks with
   `BLOCKED-COLLISION` on a genuine collision, or
   `BLOCKED-SERIAL-DEPENDENCY` when only an ordered predecessor/successor
   relationship is outstanding.
4. Otherwise `ALLOWED`.

Each check only runs once every higher-precedence check has passed —
a block at step 1 or 2 returns immediately with `claimState`/
`claimDecision` as `null` and `collisions` as `[]`, so a
higher-precedence block is never diluted with lower-precedence
evidence that was never actually evaluated. The result always includes
the full `errors` and `remediation` evidence from every check that did
run, and the underlying `contract`, `claimState`, `claimDecision`, and
per-claim `collisions` detail for those checks, so the owning role can
correct every defect from the checks that ran in one pass.

## Scope

This document covers collision classification between two claim
surfaces and the composite `evaluateAtomicClaim` gate for a single
package-complete executable child Issue. It does not cover Pipeline
launch-package preparation claims (see
`docs/reference/pmo/pipeline-preparation-contract.md`) or which child
in a dependency graph should be evaluated next (see
`docs/reference/pmo/next-executable-contract.md`).

## Current known truth

`scripts/ci/claim-collision-contract.mjs` is implemented, unit-tested,
and lint-clean as a pure-function library composing #3665's and #3240's
existing modules. It is not currently wired into any GitHub Actions
workflow or other live enforcement entrypoint.

## Intended final state

Once operator/PMO authority decides to enforce atomic claiming live,
the intended integration point is the same claim-time automation that
already applies `agent:*` labels, calling `evaluateAtomicClaim` before
the label mutation and rejecting the claim on any non-`ALLOWED` status.
That wiring decision is out of scope for this document and its
validator.

## Non-goals

This contract does not decide Project Graduation, priority, or
Product Authority reservation policy itself — it only evaluates whether a
requesting agent's claim is currently safe given the Issue's own contract
state and the supplied set of other active claims.
