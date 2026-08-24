---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Deterministic CI/review failure classification and bounded remediation routing
Does Not Own: Independent review authority, Production authorization, or protected-boundary decisions themselves
Canonical Reference: /docs/governance/CI-AND-VERIFICATION.md
Related Issues: #3668, #3665
Last Reviewed: 2026-08-24
---

# CI Failure Remediation Routing Contract

## Purpose

Convert routine deterministic CI/review failures into a bounded
remediation loop that returns work to the originating implementer with
exact failing evidence and a permitted remediation scope, instead of
unnecessarily freezing the project or requiring Product Authority relay
(#3668). Implemented in `scripts/ci/failure-remediation-routing.mjs`.

This contract only routes a single already-observed failure; it does not
itself run checks, does not grant independent review, and does not
authorize Production changes.

## Failure classification

`classifyFailure(evidence)` returns one of five classes:

| Class | Trigger | Routes to |
| --- | --- | --- |
| `PRODUCTION_LIVE_FAILURE` | failure surfaced against Production/live verification | Escalate |
| `PROTECTED_BOUNDARY_DEFECT` | failure touches a protected path/boundary | Escalate |
| `SCOPE_AUTHORITY_DEFECT` | failure requires scope/architecture/acceptance judgment | Escalate |
| `ADVISORY_DISPOSITION` | advisory-only finding on a non-required check | Acknowledge |
| `DETERMINISTIC_REMEDIATION` | machine-provable, reproducible failure | Remediate |

Checked in that order — a failure that is simultaneously deterministic
and, say, protected-path-touching still escalates. A failure that
matches none of the above **fails closed to `SCOPE_AUTHORITY_DEFECT`**:
an unclassifiable failure is never silently treated as routine.

## Routing

`routeFailure(evidence)` wraps the classification with a bounded action:

- **`REMEDIATE`** (deterministic failures, pre-merge or post-merge) —
  routes back to the originating implementer with the exact `evidence`
  text and a `permittedScope` (defaults to "the failing check/file(s)
  only"). `retryLimit` is always `null`: fix → retest → review may
  continue until clean terminal closeout with no arbitrary cap, as long
  as each attempt is still deterministically diagnosable.
- **`ACKNOWLEDGE`** (advisory findings) — recorded as evidence, no
  blocking action.
- **`ESCALATE`** (scope/architecture, protected-boundary, Production/live,
  or repeated-unclassifiable) — requires controlling-role judgment.

A failure whose `repeatedUnclassifiableCount` reaches
`UNCLASSIFIABLE_ESCALATION_THRESHOLD` (3) always escalates regardless of
its nominal class — a failure that keeps recurring without a
deterministic diagnosis is not routine, even if it once looked
deterministic.

Every result carries a `phase` (`pre-merge` or `post-merge`, from
`evidence.postMerge`) and the original `evidence`, so routing evidence
stays GitHub-native and auditable rather than living only in this
module's return value.

## Scope

Routing operates on one observed failure at a time and never expands an
Issue's scope on its own — a `REMEDIATE` result's `permittedScope` stays
bounded to the failing surface. Because each call is scoped to a single
failure, unaffected project children and unrelated agent lanes are
unaffected by construction; routing one Issue's failure never touches
another Issue's evaluation.

## Current known truth

`scripts/ci/failure-remediation-routing.mjs` is implemented,
unit-tested, and lint-clean as a pure-function library. It is not
currently wired into any GitHub Actions workflow or other live
enforcement entrypoint — a caller must construct the `FailureEvidence`
object itself from a check-run/review event; this module does not read
GitHub state.

## Intended final state

Once operator/PMO authority decides to enforce continuous CI failure
routing live, the intended integration point is a webhook/workflow step
that observes a `check_run.completed`/review event, derives
`FailureEvidence` from it, and calls `routeFailure` to post the
remediation evidence back onto the PR instead of requiring manual
triage. That wiring decision is out of scope for this document and its
router.

## Non-goals

This contract does not perform independent review itself (`ACKNOWLEDGE`
and `REMEDIATE` do not bypass required review — see
`docs/governance/PR_PROCESS.md`), does not authorize Production changes,
and does not decide protected-path policy — it only routes an
already-classified failure to the correct bounded action.
