---
Doc Type: Operations Report
Audience: Bill, Day-2 Operations, Implementation/Operations, PMO/Engineering
Authority Level: Controlled
Owns: #2780 Task 004 — Day-2 / stabilization handoff packet for the production-monitoring-response capability after offline exercise and component qualification
Does Not Own: Production activation authority, CI/delivery monitoring (#2680), launch rehearsal entry criteria (#2781)
Canonical Reference: /docs/ops/reports/production-monitoring-day2-handoff-2917.md
Related Issues: #2780, #2914, #2915, #2916, #2917, #2781, #2782
Last Reviewed: 2026-08-08
---

# Production monitoring Day-2 handoff (#2917)

## Ownership

| Concern | Owner |
| --- | --- |
| Incident triage for `OPS — Production health: *` Issues | Bill / Day-2 Operations (P1 `d1_health`); Implementation/Operations (P3 read-path checks) |
| Collector/routing code remediation | Implementation / Operations |
| Runbook maintenance | Implementation / Operations under Day-2 review |
| Production activation decision | Product Authority (separate authorization required) |
| Successor rehearsal entry (#2781) | Team:PMO after #2780 monitoring capability is integrated |

## Operator surfaces

1. Workflow: `.github/workflows/production-health-collectors-2915.yml` (hourly + `workflow_dispatch`)
2. Issues: stable titles `OPS — Production health: <check>`
3. Hold label: `monitoring-hold`
4. Runbook: `docs/ops/reports/production-monitoring-incident-runbook-2916.md`
5. Qualification/exercise evidence: `docs/ops/reports/production-monitoring-failure-exercise-and-qualification-2917.md`

## Stabilization expectations (post any future authorized activation)

- Watch the first several hourly cycles for false-positive noise.
- Confirm recoveries auto-close with resolution comments.
- Confirm `monitoring-hold` remains effective when applied.
- Confirm disable of collector or routing stops automation without blocking manual Ops Issue intake.
- Escalate material exceptions via the source Ops Issue; do not invent parallel chat transport.

## Zero-additional-cost constraints (binding)

- No paid monitoring, paging, or alerting vendor.
- No auto-remediation that mutates Production.
- Collectors remain read-only public GETs only.
- Routing side effects remain GitHub Issues API only.

## Explicit deferrals

| Item | Disposition |
| --- | --- |
| Production activation of monitoring | Deferred — requires separate Product Authority Production Go |
| Member signup/login synthetics | Deferred — recorded in #2914 map; not in #2915 collectors |
| Launch rehearsal entry criteria | Successor #2781 |
| CI/delivery pipeline monitoring | Remains #2680 |

## Handoff checklist

- [x] Offline failure/recovery exercise exists and is tested
- [x] Collector/routing independent disable + manual intake preserved (documented + exercised)
- [x] Severity/owner table unchanged from #2914/#2916
- [x] Qualification report states Go for component capability / No-Go for Production activation
- [ ] Independent review + authorized component integration of #2917
- [ ] #2780 parent reconciliation per standing continuous-execution rules after clean post-merge verification
