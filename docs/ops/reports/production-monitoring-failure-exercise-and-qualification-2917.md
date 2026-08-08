---
Doc Type: Operations Report
Audience: Bill, Day-2 Operations, Implementation/Operations, PMO/Engineering, implementation agents
Authority Level: Controlled
Owns: #2780 Task 004 — offline controlled-failure exercise evidence and Promotion Candidate qualification for the production-monitoring-response component capability
Does Not Own: Production activation, live Production failure injection, CI/delivery monitoring (#2680), auto-remediation
Canonical Reference: /docs/ops/reports/production-monitoring-failure-exercise-and-qualification-2917.md
Related Issues: #2780, #2914, #2915, #2916, #2917, #2781
Last Reviewed: 2026-08-08
---

# Production monitoring failure exercise and qualification (#2917)

## Purpose

Record offline controlled-failure / recovery exercise evidence and the
Promotion Candidate qualification decision for the
`component/production-monitoring-response` monitoring capability delivered by
#2914–#2917.

## Scope

In scope: fixture-only exercise of collectors→routing create/update/recover/hold/disable
paths; component-capability Go/No-Go; rollback/disable proofs that preserve
manual Ops Issue intake.

Out of scope: Production activation, live Production failure injection,
CI/delivery monitoring (#2680), and auto-remediation.

## Current known truth

Collectors (#2915) and deduplicated Ops routing (#2916) already exist on the
component tip. #2917 adds `scripts/ci/production_health_failure_exercise.mjs`
and focused tests that prove the failure/recovery/hold/disable loop offline
without live GitHub or Production side effects. Production activation is not
authorized by this report.

## Intended final state

After independent review and authorized component integration, the monitoring
capability is qualified for continued Day-2 use on the component branch, with
durable exercise/qualification evidence and an explicit No-Go for Production
activation until Product Authority issues a separate Production Go.

## Candidate identity

| Field | Value |
| --- | --- |
| Component branch | `component/production-monitoring-response` |
| Starting SHA (pre-#2917) | `e714cee18a5055484c45daddc98ac62f6f14102a` |
| Capability under qualification | Zero-cost Production health collectors (#2915) + deduplicated Ops routing (#2916) + offline failure/recovery exercise (#2917) |
| Production activation | **Not authorized** by this report |

## Exercise method (controlled, offline)

`scripts/ci/production_health_failure_exercise.mjs` seeds collector-shaped
results and drives `routeResults` through:

1. seeded unhealthy create (`unavailable` / `degraded` / `stale`);
2. still-unhealthy update of the **same** stable Issues (no duplicates);
3. healthy recovery → resolution comment + close;
4. `monitoring-hold` blocking auto-close;
5. collector disable (empty results → zero upserts);
6. routing disable with **manual Ops Issue intake preserved**.

No live Production HTTP probes and no live GitHub Issue mutations occur in
the exercise path used for qualification evidence.

## Acceptance mapping

| Acceptance criterion | Evidence |
| --- | --- |
| Seeded failures route correctly | Exercise phases `seeded_failures_create` / `seeded_failures_update`; `tests/production-health-failure-exercise.test.mjs` |
| Recovery evidence closes the loop | Exercise phase `recovery_close` |
| Rollback preserves manual intake | Exercise phases `collector_disable_no_results` + `routing_disable_manual_intake` |
| Zero-additional-cost | Reuses existing Actions + GitHub Issues; no paid vendor |
| Operator ownership verified | Severity/owner table remains #2914/#2916 runbook authority; Day-2 handoff in `docs/ops/reports/production-monitoring-day2-handoff-2917.md` |

## Rollback / disable proof

| Surface | Disable method | Effect |
| --- | --- | --- |
| Collectors | Disable/remove schedule on `.github/workflows/production-health-collectors-2915.yml` or skip collect step | No new health result JSON → routing has nothing to upsert |
| Routing | Skip/remove the routing step while collectors remain | No automated Issue create/update/close; **manual Ops Issue intake still works** |
| Hold | Add `monitoring-hold` on an open per-check Issue | Routing skips update/close until label removed |

## Qualification decision (component capability)

**Go for component monitoring capability** on `component/production-monitoring-response` after #2917 merges and required independent review / authorized integration complete.

**No-Go for Production activation** until a separately authorized Production decision exists. This report does not grant Production Go.

## Related surfaces

| Path | Role |
| --- | --- |
| `docs/ops/reports/production-monitoring-service-journey-map-2914.md` | Journey/gap inventory + severity |
| `scripts/ci/production_health_collectors.mjs` | Collectors |
| `scripts/ci/production_health_routing.mjs` | Routing |
| `docs/ops/reports/production-monitoring-incident-runbook-2916.md` | Incident lifecycle |
| `scripts/ci/production_health_failure_exercise.mjs` | Offline exercise runner |
| `docs/ops/reports/production-monitoring-day2-handoff-2917.md` | Day-2 / stabilization handoff |
