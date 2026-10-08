---
Doc Type: Operations
Audience: Human + AI
Authority Level: Operational Authority
Owns: Live operating procedures, incident response, monitoring, operator workflows
Does Not Own: Redefining design/architecture/platform specs; historical records
Canonical Reference: /docs/ops/OPERATING_MANUAL.md
Last Reviewed: 2026-02-20
---

# Operations — Workflow Control

Status: _MASTER (Operations authoritative)
Last Updated: 2026-02-05

## Purpose
Define how Day-2 Operations runs the work loop without drift.

## The loop (authoritative)
1) Control: define scope and success conditions
2) Execute: apply bounded changes
3) Verify: prove stability and no regressions
4) Record: write operational truth into repo docs

Repeat until stable.

## Inputs (source of work)
- `active_tasklist.md`
- Incident reports / postmortems
- CI failures
- Production monitoring signals

## PR governance (required)
Follow:
- `/docs/governance/PR_GOVERNANCE.md`
- `/docs/governance/PR_PROCESS.md`
- `/docs/governance/PR_GOVERNANCE.md`

## Acceptance criteria rule
Every PR must include:
- What changes
- What is not allowed to change
- How to verify success
- Rollback plan (revert PR)

## When to stop
Stop and revert if:
- Verification fails
- CI gates are bypassed
- Behavior contradicts design authority

## Recordkeeping
- Deploys: `/docs/ops/deploy-log.md`
- Incidents: `/docs/ops/incident-response/`
- Governance changes: update the relevant `_MASTER` doc in the same PR
