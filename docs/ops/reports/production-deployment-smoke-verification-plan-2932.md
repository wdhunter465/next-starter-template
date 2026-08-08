---
Doc Type: Operations Report
Audience: Human + AI
Authority Level: Task Evidence
Owns: #2932 (#2782 Task 003) smoke-test category schema, exact-deployed-identity proof, and smoke-verification readiness harness
Does Not Own: The candidate manifest (#2930, owned by that report); the preflight/change-window/rollback runbook (#2931, owned by that report); the actual deployment execution and Production Go decision (separately protected); post-deployment closeout/handoff (#2933)
Canonical Reference: /docs/ops/reports/production-deployment-smoke-verification-plan-2932.md
Related Issues: #2932, #2782, #2930, #2931, #2933
Last Reviewed: 2026-08-08
---

# Production deployment smoke-verification plan — #2932

## Purpose

Deliver #2932 (#2782 Task 003) per its non-blocking prerequisite rule: the
smoke-test category schema, the exact-deployed-identity proof requirement, and
a deterministic smoke-verification readiness harness — so that once #2931's
readiness evidence is accepted and Product Authority records a Production Go,
the immediate post-deploy smoke verification follows a pre-agreed, testable
structure instead of improvising evidence categories or an identity check
under deployment pressure.

## Scope

Covers smoke-test preparation only: the smoke-test result record schema
below, the readiness harness (`scripts/ci/production_deployment_smoke_verification.mjs`),
and the exact-deployed-identity cross-check against #2930's candidate
manifest. It does not cover #2930's candidate manifest or #2931's preflight/
rollback runbook (only consumes #2930's `candidateSha` as a pipeline input),
does not execute any Production action or deployment, and does not cover
#2933's post-deployment closeout/handoff — each is owned by its own task.

## Current known truth

- #2931's readiness evidence is not yet accepted and Product Authority has not
  recorded a Production Go. No real smoke-test result record exists yet — this
  document and its companion harness are **smoke-test preparation and
  automation scaffolding**, per #2932's own non-blocking prerequisite rule.
- `buildSmokeVerificationReadiness()` is implemented and tested against
  synthetic fixtures (`tests/production-deployment-smoke-verification.test.mjs`),
  including the exact-deployed-identity cross-check and the unhandled-failure
  check, before any real smoke-test record exists.
- This document does not authorize deployment, Production mutation, or
  credential use of any kind. It never performs a live request.

## Intended final state

This document is evolving scaffolding pending #2931 acceptance and Product
Authority's Production Go. Its stable, post-decision state — once #2932 is
actually executed — replaces the template sections below with the real
smoke-test result records (one per required category) and the
`buildSmokeVerificationReadiness()` verdict for those records against #2930's
accepted candidate manifest. The schema and invariants themselves are not
expected to change — only "Current known truth" above is expected to update.

## Non-blocking prerequisite rule

Per #2932's non-blocking prerequisite rule: "Accepted #2931 readiness evidence
and explicit Production Go govern the actual deploy action. They do not
prevent smoke-test preparation, deployment command/runbook verification,
evidence templates, rollback rehearsal, package completion, or other
collision-safe non-Production work." This document and harness are exactly
that preparation — no real deployment is executed, simulated as real, or
implied by anything here.

## Smoke-test result record — required fields

| Field | Purpose |
| --- | --- |
| `category` | One of the six required categories below |
| `result` | `pass`, `fail`, or `stop_rollback_activated` — `fail` alone (without stop/rollback engaging) is a blocking, unhandled failure |
| `evidence` | Citation to the actual test run/output for this category |
| `deployedCandidateSha` | The exact candidate SHA this test ran against — must agree across every record in the suite |

## Required smoke-test categories

Per #2932's acceptance criteria and #2782 work unit 5:

- `public` — critical public-surface behavior
- `auth_member` — authentication and member-account behavior
- `content_data_media` — content, data, and media integrity
- `email_fundraiser_state` — email delivery and fundraiser state behavior
- `monitoring` — monitoring/alerting is live and reporting
- `failure_behavior` — a deliberate failure path exercises stop/rollback correctly

## Readiness harness

`scripts/ci/production_deployment_smoke_verification.mjs` validates a suite of
smoke-test result records against the schema above and, when given
`--manifest` pointing at #2930's candidate manifest JSON, cross-checks that
every record's `deployedCandidateSha` matches the manifest's `candidateSha` —
the mechanical enforcement of "exact deployed identity is proven" and "no
changed candidate bypasses qualification". It also blocks on any category
reporting `fail` without stop/rollback having activated.

```bash
node scripts/ci/production_deployment_smoke_verification.mjs \
  --records smoke-test-records.json \
  --manifest candidate-manifest.json
```

## What #2933 inherits from this task

- The smoke-test record schema and readiness harness, ready to validate the
  real smoke-test suite once #2931's readiness evidence and Product
  Authority's Production Go are in place.
- The exact-deployed-identity invariant, so #2933's post-deployment
  closeout/handoff can cite a single, mechanically-proven candidate SHA
  rather than reconciling per-category claims by hand.

## Validation

- `npx vitest run tests/production-deployment-smoke-verification.test.mjs` — all tests passing.
- `node scripts/ci/production_deployment_smoke_verification.mjs --records <sample> --manifest <sample>` — verified `ready: true` when every category is present, every record agrees on `deployedCandidateSha`, that SHA matches the manifest's `candidateSha`, and no category reports an unhandled `fail`; verified `ready: false` with the correct blocker for a missing category, a mismatched candidate identity, a manifest omitting `candidateSha`, and an unhandled `fail` result, including with a malformed suite.
