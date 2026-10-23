---
Doc Type: Operations
Audience: Human + AI
Authority Level: Operational Authority
Owns: Live operating procedures, incident response, monitoring, operator workflows
Does Not Own: Redefining design/architecture/platform specs; historical records
Canonical Reference: /docs/ops/OPERATING_MANUAL.md
Last Reviewed: 2026-02-20
---

# Operations Documentation Map

Status: _MASTER (Operations authoritative)
Last Updated: 2026-02-05

## Purpose
Define the authoritative Operations documentation layer and how it is maintained.

## Authority
Operations documentation (_MASTER) is authoritative for production behavior.
Project documentation (_INCOMPLETE/_DRAFT) is reference-only until turnover.

If documents conflict, follow:
- `/docs/governance/standards/document-authority-hierarchy_MASTER.md`
- `Agent.md` is the agent entry point. The old build prompt is archived at `docs/archive/superseded/governance/ai/AI-GUIDE.md` (#4138, 2026-10-23).
  
## Category model
- Category A: Operations authority (production-ready). Stored as `_MASTER.md`.
- Category B: Project reference (usable but evolving). Stored as `_INCOMPLETE.md`.
- Category C: Project intent (design/future state). Stored as `_DRAFT.md`.

Category assignments are recorded in:
- `/docs/governance/document-review-summary_MASTER.md`

## Required coverage areas
- Governance and change control
- Startup and stability procedures
- Verification and quality gates
- Platform/CI operations
- Incident response
- Deployment and recovery logs
- Postmortems and prevention gates

## Operator navigation (Day-2)
Start here:
- `/docs/governance/startup_MASTER.md`
- `/docs/governance/stability-playbook_MASTER.md`
- `/docs/incident-response/quickstart_MASTER.md`
- `/docs/governance/verification-criteria_MASTER.md`

Then consult:
- `/docs/ops/workflow-control_MASTER.md`
- `/docs/ops/operational-standards_MASTER.md`
