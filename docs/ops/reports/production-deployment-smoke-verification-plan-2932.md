---
Doc Type: Operations Report
Audience: Human + AI
Authority Level: Task Evidence
Owns: #2932 (#2782 Task 003) smoke-test category schema, exact-deployed-identity proof, and smoke-verification readiness harness
Does Not Own: The candidate manifest (#2930, owned by that report); the preflight/change-window/rollback runbook (#2931, owned by that report); the actual deployment execution and Production Go decision (separately protected); post-deployment closeout/handoff (#2933)
Canonical Reference: /docs/ops/reports/production-deployment-smoke-verification-plan-2932.md
Related Issues: #2932, #2782, #2930, #2931, #2933, #2929, #2776, #2777, #2783, #2786, #2787
Last Reviewed: 2026-08-14
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

- Product Authority recorded Production Go 2026-08-14T20:50Z. Live Pages
  Production Active source is `7e238319360b7adff2d893ebce03a40e9833f497`
  (deployment `952e90fc`). The rehearsal freeze `87414533` was **not**
  promoted.
- Read-only smoke `bash scripts/prod-smoke.sh https://www.lougehrigfanclub.com`
  exited 0 at 2026-08-14T20:54:10Z. Records below use `result: pass` from that
  run. Independent verifier is Bill / Product Authority — Cursor must not
  accept its own smoke as final.
- #2776, #2777, #2783, #2786, and #2787 remain unresolved and are not waived.
- This increment does not write Production D1, send email, or run
  `promote-cloudflare-deployment.sh`.

## Intended final state

After Product Authority records Production Go and the candidate is actually
deployed, each record's `result` and `evidence` are filled from the live run
against `87414533984aa9b5579b679fc8f9746b93517c5d` (or the then-accepted SHA
if Product Authority records a different freeze). The category map and
harness invariants are not expected to change for that step.

## Non-blocking prerequisite rule

Per #2932's non-blocking prerequisite rule and the PMO ACTION UPDATE on #2932
(https://github.com/wdhunter465/next-starter-template/issues/2932#issuecomment-5292909975):
accepted #2931 readiness and explicit Production Go govern the **deploy
action**. They do not prevent smoke-test preparation, deployment
command/runbook verification, evidence templates, rollback rehearsal, or
package completion. This increment is that preparation. No real deployment is
executed, simulated as real, or implied.

## Collision-safe package prepared now

### Exact candidate identity (drift detection)

All six records must use one SHA. The SHA prepared here is the #2929 frozen
candidate `87414533984aa9b5579b679fc8f9746b93517c5d`. After a real deploy, the
harness `--manifest` check proves that SHA still matches the accepted
manifest. A different deployed SHA is a stop trigger (candidate drift).

### Deployment command / runbook verification (not executed)

Cited, not run:

- `docs/how-to/website/website-production-smoke-test.md`
- `docs/how-to/verification/PRODUCTION_SMOKE.md`
- `scripts/prod-smoke.sh`
- `scripts/promote-cloudflare-deployment.sh` — **must not be invoked** until
  Production Go
- #2931 `smokeTestPlan` in
  `docs/ops/reports/production-deployment-readiness-runbook-2931.md`

### Category map (plan only)

| Category | Planned evidence surface (from #2931 `smokeTestPlan`) |
| --- | --- |
| `public` | `tests/e2e/launch-readiness-public-routes.spec.ts` and `docs/how-to/website/website-production-smoke-test.md` |
| `auth_member` | `tests/e2e/launch-readiness-fanclub-routes.spec.ts` |
| `content_data_media` | read-only D1/B2 identity and counts per #2860/#2913 pattern |
| `email_fundraiser_state` | controlled test-address send via `functions/_lib/email.ts`; skip if `MAILCHANNELS_ENABLED` is unset |
| `monitoring` | #2780 live for the deployed candidate |
| `failure_behavior` | stop-trigger drill proving rollback engages |

### Rollback rehearsal gap

#2931 left `rollbackCandidateSha` empty because no distinct last-accepted
Production SHA is recorded. A rollback drill cannot be executed or marked
complete until that SHA exists. This is a bounded stop on the drill, not a
stop on the rest of this package.

### Real records file

`docs/ops/reports/production-deployment-smoke-records-2932.json`

```bash
node scripts/ci/production_deployment_smoke_verification.mjs \
  --records docs/ops/reports/production-deployment-smoke-records-2932.json
```

Expected this increment: `ready: false`, blocker `smoke_suite_incomplete`,
every record `missing_or_empty:result`. That fail-closed verdict is the
recorded truth.

## Unresolved protected decisions carried forward

Do not waive: #2776, #2777, #2783, #2786, #2787. Production Go is not recorded.

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

- The smoke-test record schema, readiness harness, and the real
  `production-deployment-smoke-records-2932.json` instance with six categories
  and one prepared candidate SHA.
- Fail-closed empty `result` fields until live smoke runs after Production Go.
- The exact-deployed-identity invariant.

## Validation

- `npx vitest run tests/production-deployment-smoke-verification.test.mjs`
- `node scripts/ci/production_deployment_smoke_verification.mjs --records docs/ops/reports/production-deployment-smoke-records-2932.json` — expected `ready: false` / `smoke_suite_incomplete` because live `result` values are empty.
