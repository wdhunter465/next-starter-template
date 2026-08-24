---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Distributed Pipeline launch-package preparation eligibility, preparation-claim discipline, launch-package completeness, and preparer authority boundaries
Does Not Own: Project Graduation, PMO Active priority assignment, implementation Go, or PMO/Engineering independent review itself
Canonical Reference: /docs/governance/PMO-PORTFOLIO.md
Related Issues: #3672, #3665, #3667
Last Reviewed: 2026-08-24
---

# Pipeline Launch-Package Preparation Contract

## Purpose

Remove single-threaded PMO Pipeline preparation as a throughput
bottleneck by letting more than one qualified LGFC agent-team member
prepare launch packages and executable child graphs, while preserving
PMO / Engineering authority for design acceptance, Project Graduation,
and implementation Go (#3672). Implemented in
`scripts/ci/pipeline-preparation-contract.mjs`.

This contract standardizes preparation output against the executable
project/child contract established by #3665 and reuses the #3240/#3667
claim mechanics for preparation-claim discipline, rather than creating a
competing PMO authority surface.

## Scope

This document covers Pipeline-parent launch-package completeness,
preparation-claim discipline, and preparer authority boundaries. It
does not cover project-child execution contracts (see
`docs/reference/pmo/executable-child-contract.md`) or execution-time
atomic claiming of a child once a project is graduated (see
`docs/reference/pmo/claim-collision-contract.md`) — preparation claims
and execution claims are distinct concerns that happen to reuse the
same underlying `classifyClaim`/`canClaim` mechanics.

## Current known truth

`scripts/ci/pipeline-preparation-contract.mjs` is implemented,
unit-tested, and lint-clean as a pure-function library composing
#3665's and #3240's existing modules. It is not currently wired into
any GitHub Actions workflow or other live enforcement entrypoint.

## Intended final state

Once operator/PMO authority decides to enforce distributed preparation
live, the intended integration point is the same `agent:*` claim
automation used for execution claims, applied to Pipeline-parent
preparation, plus a Graduation Candidate gate that calls
`evaluateGraduationCandidateReadiness` before a Pipeline parent may
enter PMO review. That wiring decision is out of scope for this
document and its validator.

## Launch-package completeness

`validateLaunchPackageCompleteness(issue)` parses the Pipeline parent's
launch-package fields — objective, scope/non-goals, requirements,
acceptance criteria, architecture/design, dependencies, child graph,
validation, rollback, stop conditions, delivery model, Production/Day-2
boundaries, and intended implementation owner — using the same
labeled-field parsing convention as #3665's executable child contract
(`extractFieldValue`, imported from `scripts/ci/executable-child-contract.mjs`
rather than duplicated). A Pipeline parent may only be presented as
Graduation Candidate (`evaluateGraduationCandidateReadiness`) once every
field is present with real (non-placeholder) content.

## Preparation-claim discipline

`evaluatePreparationClaim({ pipelineParent, requestingAgent,
collaborationRequested })` reuses `classifyClaim`/`canClaim` (#3240) to
preserve exactly one active preparation claim per Pipeline parent:

| Status | Meaning |
| --- | --- |
| `ALLOWED` | no conflicting claim; requesting agent may prepare |
| `ALLOWED-BOUNDED-COLLABORATION` | another agent already holds the active claim, but `collaborationRequested: true` was explicitly set — bounded multi-agent collaboration, not dual queue ownership |
| `BLOCKED-DUPLICATE-CLAIM` | another agent already holds an evidenced active claim and collaboration was not explicitly requested |
| `BLOCKED-RESERVATION` | a Product Authority (or controlling) reservation is held by another agent |
| `BLOCKED-AMBIGUOUS-CLAIM-STATE` | the existing claim state cannot be classified safely (for example, insufficient evidence, or multiple `agent:*` labels) |
| `BLOCKED-INVALID-REQUEST` | no `requestingAgent` was supplied |

These are distinguished explicitly, rather than collapsed into one
generic "blocked" status, so a caller can route each to the correct
remediation path (wait for the duplicate claim to release, escalate a
reservation, request a claim-state disposition, or fix the caller's
request) without parsing `decision.reason`/`claimState` itself.

Team ownership (`team:pmo`) stays independent of the preparation claim,
consistent with #3240.

## Preparer authority boundary

`assertPreparationAuthorityBoundary(action)` fails closed: only
`draft-launch-package`, `refine-launch-package`, `draft-child-issues`,
and `refine-child-issues` are permitted. `assign-pmo-active-priority`,
`grant-project-graduation`, `grant-implementation-go`, and
`self-approve-package` are always rejected, regardless of launch-package
completeness or claim state — a preparer can produce a complete package
but can never grant itself Graduation, Active priority, implementation
Go, or its own approval. An unrecognized action is also rejected rather
than defaulting to permitted.

Independent PMO / Engineering review of the completed preparation package
remains required before Graduation; this contract does not perform that
review, only gates the inputs to it (a complete package) and the outputs
a preparer cannot self-grant.

## Non-goals

This contract does not grant Project Graduation, PMO Active priority, or
implementation Go, and does not replace independent PMO / Engineering
review of a completed package — it only distributes who may prepare, and
bounds what preparation authority can do.
