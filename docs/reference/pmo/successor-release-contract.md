---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Deterministic successor-release evaluation after verified predecessor completion
Does Not Own: Project Graduation, the predecessor-completion evidence source itself (integration/CI/review systems), or Product Authority priority decisions
Canonical Reference: /docs/governance/PMO-PORTFOLIO.md
Related Issues: #3669, #3665, #3666, #3667
Last Reviewed: 2026-08-24
---

# Successor Release Contract

## Purpose

Define the deterministic logic that advances a project's dependency graph
after verified predecessor completion, making the next package-complete
eligible child(ren) claimable — and, where an agent is named, atomically
self-claimable — without routine PMO redispatch (#3669). Implemented in
`scripts/ci/successor-release.mjs` (`releaseSuccessors`).

Standing Project Graduation authority already covers routine successor
release for a graduated project; this contract mechanizes that release
rather than creating new authority.

## Predecessor closeout evidence

`evaluatePredecessorCloseout(evidence)` classifies a predecessor edge from
four required evidence flags — `integrated`, `validated`, `reviewed`,
`closeoutRecorded` — plus two override flags. Every flag is checked with
strict `=== true`; a truthy non-boolean value (a string, a number, an
object) does not count as evidence and fails closed to "missing" rather
than accidentally releasing or blocking a successor:

| Status | Trigger | Successor released? |
| --- | --- | --- |
| `NOT-STARTED` | no evidence flags are `=== true` | no |
| `REVIEW-PENDING` | some but not all required flags are `=== true` | no |
| `REMEDIATION-PENDING` | `remediationPending === true`, regardless of the other flags | no |
| `STALE-EVIDENCE` | `supersededEvidence === true`, regardless of the other flags | no |
| `VERIFIED-COMPLETE` | all four required flags `=== true`, no override flags | yes, if graph/collision checks also pass |

`remediationPending` and `supersededEvidence` are checked first and always
override an otherwise-complete evidence set — a successor is never
released from stale or superseded verification evidence, and never while
a bounded remediation duty remains.

## Scope

This document covers predecessor closeout classification and the
graph-advancement step that derives each child's `completed` flag from
that classification before delegating to `nextExecutable`. It does not
cover how integration/validation/review/closeout evidence itself gets
produced (CI, PR review, post-merge closeout own that), or the
per-child eligibility/collision rules themselves (see
`docs/reference/pmo/next-executable-contract.md` and
`docs/reference/pmo/claim-collision-contract.md`).

## Current known truth

`scripts/ci/successor-release.mjs` is implemented, unit-tested, and
lint-clean as a pure-function library composing #3666's and #3667's
existing modules. It is not currently wired into any GitHub Actions
workflow or other live enforcement entrypoint — callers must supply
`closeoutEvidence` themselves; this module does not read PR/CI state.

## Intended final state

Once operator/PMO authority decides to enforce continuous successor
release live, the intended integration point is post-merge closeout
automation that already reconciles a predecessor child (#3055),
translating its recorded integration/validation/review/closeout
evidence into `closeoutEvidence` and calling `releaseSuccessors` instead
of requiring manual PMO redispatch. That wiring decision is out of
scope for this document and its validator.

## Graph advancement

`releaseSuccessors({ children, activeClaims, requestingAgent })` derives
each child's `completed` flag exclusively from
`evaluatePredecessorCloseout(child.closeoutEvidence)` — callers cannot
force a child to `completed` any other way — then delegates to
`nextExecutable` (#3666) for structural validation, protected-stop/serial-
dependency/package-completeness/claim-state filtering, and collision-safe
set selection (#3667).

When `requestingAgent` is supplied, every releasable successor also gets
an `evaluateAtomicClaim` result (#3667), so an eligible agent may
self-claim under standing Project Graduation authority in the same pass
that release is evaluated.

## Result shape

```json
{
  "status": "RESOLVED | AMBIGUOUS",
  "releasable": [{ "id": "...", "closeout": { "status": "...", "complete": true }, "claim": { "allowed": true } }],
  "blocked": [{ "id": "...", "reasons": ["..."] }],
  "deferred": [{ "id": "...", "reason": "collision evidence" }],
  "closeout": { "<childId>": { "status": "...", "complete": false, "reason": "..." } },
  "errors": ["..."],
  "remediation": ["..."]
}
```

## Non-goals

This contract does not itself produce integration/validation/review/
closeout evidence — it consumes evidence already recorded elsewhere
(CI, PR review, post-merge closeout) via `closeoutEvidence`. It does not
grant Project Graduation and does not override a protected stop or
genuine collision; those remain unclaimed with explicit evidence per
#3666/#3667.
