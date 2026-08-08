---
Doc Type: Operations Report
Audience: Human + AI
Authority Level: Task Evidence
Owns: #2931 (#2782 Task 002) change window, role, preflight, communications, credential-boundary, smoke/complete-test, stop-trigger, and rollback runbook
Does Not Own: The candidate manifest (#2930, owned by that report); actual Production execution (#2932, separately protected); post-deployment verification/closeout (#2933)
Canonical Reference: /docs/ops/reports/production-deployment-readiness-runbook-2931.md
Related Issues: #2931, #2782, #2930, #2932, #2933
Last Reviewed: 2026-08-08
---

# Production deployment preflight runbook — #2931

## Purpose

Deliver #2931 (#2782 Task 002): the change window, executor/verifier role
definitions, preflight checklist, communications plan, credential boundary,
smoke/complete test plans, explicit stop triggers, rollback candidate, and
recovery owner — so #2932's actual deployment execution follows a pre-agreed,
testable procedure instead of improvising any of these under time pressure.

## Scope

Covers deployment preparation only: the preflight record schema/harness below,
role/communication/stop/rollback definitions, and the smoke/complete test plan
structure. It does not cover #2930's candidate manifest (only consumes its
`candidateSha`), does not execute any Production action, and does not cover
#2932's actual deployment or #2933's post-deployment verification/closeout —
each is owned by its own task.

## Current known truth

- #2930's candidate manifest is not yet accepted and Product Authority has not
  recorded a Production Go. No real preflight record exists yet — this document
  and its companion harness are **runbook preparation and automation
  scaffolding**.
- `buildDeploymentReadiness()` is implemented and tested against synthetic
  fixtures (`tests/production-deployment-preflight-readiness.test.mjs`),
  including the rollback-distinctness invariant, before any real preflight
  record exists.
- This document does not authorize deployment, Production mutation, or
  credential use of any kind.

## Intended final state

This document is evolving scaffolding pending #2930 acceptance and Product
Authority's Production Go. Its stable, post-decision state — once #2931 is
actually executed — replaces the template sections below with the real change
window, named roles, the actual preflight checklist result, and the
`buildDeploymentReadiness()` verdict for the real preflight record and #2930's
accepted candidate manifest. The schema and invariants themselves are not
expected to change — only "Current known truth" above is expected to update.

## Non-blocking prerequisite rule

Per #2931's non-blocking prerequisite rule, this document and the readiness
harness are **runbook preparation, communication drafting, preflight design,
rollback planning, evidence templates, and package completion** — the
collision-safe category #2931 explicitly authorizes before #2930's candidate and
evidence manifest are accepted for final deployment binding. No preflight record
is filled in with real evidence here, and no Production authorization is
implied.

## Preflight record — required fields

| Field | Purpose |
| --- | --- |
| `changeWindowStart` / `changeWindowEnd` | Exact, bounded deployment window — no open-ended change window |
| `executorRole` | Who performs the deployment (a role, not necessarily a name) |
| `verifierRole` | Who independently confirms live behavior — must not be the same actor as `executorRole` performing unverified self-checks |
| `preflightChecklistEvidence` | Citation to the completed preflight checklist run |
| `communicationPlan` | Pre/during/post-deployment communication channels and audiences |
| `credentialBoundaryStatement` | Exactly which credentials are used and confirmation they never appear in Issues/PRs/logs/reports |
| `smokeTestPlan` | Immediate post-deploy smoke tests: public, auth/member, content/data/media, email/fundraiser state, monitoring, failure behavior (per #2782 work unit 5) |
| `completeVerificationPlan` | Complete post-deployment verification plan (#2782 work unit 6) |
| `stopTriggers` | Explicit conditions that halt deployment before/during execution |
| `rollbackCandidateSha` | The already-qualified candidate to roll back to — must differ from the deployment candidate |
| `recoveryOwner` | Named accountable owner for executing rollback/recovery |

## Readiness harness

`scripts/ci/production_deployment_preflight_readiness.mjs` validates a preflight
record against the schema above and, when given `--manifest` pointing at #2930's
candidate manifest JSON, cross-checks that `rollbackCandidateSha` differs from
the manifest's `candidateSha` — the mechanical enforcement of "no untested
recovery path": a rollback target identical to what's being deployed cannot
recover anything.

```bash
node scripts/ci/production_deployment_preflight_readiness.mjs \
  --preflight preflight-record.json \
  --manifest candidate-manifest.json
```

## Stop-trigger reference

Per #2782's own recorded stop and rollback rules, deployment stops before or
during execution for: candidate drift, failed preflight, missing authority,
binding/configuration mismatch, failed critical smoke test, security/privacy
exposure, data integrity risk, unavailable recovery owner, or monitoring
failure. This runbook does not invent new stop conditions — `stopTriggers` in
the real preflight record cites this list plus any deployment-specific
additions.

## What #2932 inherits from this task

- The preflight record schema and readiness harness, ready to validate the real
  preflight record once #2930's manifest is accepted.
- The rollback-distinctness invariant, so #2932's actual deployment cannot
  proceed with a rollback target indistinguishable from what it's deploying.

## Validation

- `npx vitest run tests/production-deployment-preflight-readiness.test.mjs` — all tests passing.
- `node scripts/ci/production_deployment_preflight_readiness.mjs --preflight <sample> --manifest <sample>` — verified `ready: true` when the rollback candidate differs from the deployment candidate, and `ready: false` with the correct blocker when they match, including with a null preflight record and without `--manifest` supplied.
