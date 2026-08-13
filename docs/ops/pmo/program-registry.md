---
Doc Type: Operations
Audience: Human + AI
Authority Level: Operational Authority
Owns: Verified PMO program status, active implementation assignment, launch-state control, and terminal program disposition
Does Not Own: Product priority decisions, task implementation detail, Production approval, or undocumented inferred status
Canonical Reference: /docs/governance/PMO-PORTFOLIO.md
Related Issues: #1255, #1719, #2615, #2678, #2779, #2784
Last Reviewed: 2026-08-04
---

# PMO Program Registry

## Governing rules

GitHub Issues are the executable portfolio authority. This registry records only status verified against live Issues and merged repository evidence.

Documentation completeness and a final AS-BUILT record are mandatory project closeout gates under `docs/governance/PROJECT-DOCUMENTATION-AND-AS-BUILT.md`. A project may not be listed as complete merely because code merged, child counts reached 100%, or the parent Issue was closed.

## Current implementation assignments

| Project | Status | Implementer | Current task | PMO owner |
| --- | --- | --- | --- | --- |
| #2615 | Active | Cursor | #2622 | ChatGPT / Atlas |
| #2784 | Active | Claude | #2918 | ChatGPT / Atlas |

Cursor and Claude are implementers. ChatGPT / Atlas is PMO / Engineering. Bill is Product and Production Authority.

Post-merge exceptions return immediately to the implementer of the originating PR. PMO defines, routes, independently reviews, verifies, and closes the remediation.

## Recently completed or closeout-remediation programs

| Program / Project | Repository disposition | Documentation disposition |
| --- | --- | --- |
| #1719 — PMO Governance / Workflow Automation Completion | Candidate `a68e1390934e7617b7975edc2627a03772fd8e95` promoted by PR #3040; merge `d6418d769190d56754f22d2d0d4cb46ef1ce8d49` | `CLOSEOUT BLOCKED — DOCUMENTATION INCOMPLETE` until the #1719 remediation package, AS-BUILT, PMO/GitHub reconciliation, and independent verification are merged and complete |
| #2678 | Implementation reported complete | Closure remains subject to documentation and AS-BUILT verification; closed Issue state alone is insufficient |
| #2779 | Implementation reported complete | Closure remains subject to documentation and AS-BUILT verification; closed Issue state alone is insufficient |

## #1719 authoritative records

- AS-BUILT: `docs/ops/as-built/pmo-governance-workflow-automation-1719.md`
- final closeout remediation: `docs/ops/reports/pmo-governance-workflow-automation-final-closeout-1719.md`
- Production candidate qualification: `docs/ops/reports/pmo-governance-workflow-automation-promotion-candidate-qualification-2775.md`
- Production PR: #3040
- Production merge: `d6418d769190d56754f22d2d0d4cb46ef1ce8d49`

Prior language describing #2775 as active requalification or #1719 as awaiting Production promotion is superseded.

## Closeout requirements

Before moving any project into the completed section, PMO must verify:

- all implementation and promotion work is merged;
- every child task has a terminal disposition;
- the named AS-BUILT document matches the final implementation;
- all DIATAXIS, governance, PMO, queue, dashboard, dependency, operations, role, and GitHub surfaces are current;
- final post-merge verification and rollback disposition are recorded;
- repository search exposes no stale current-authority statement;
- final closeout evidence is merged.

Failure of any requirement means `CLOSEOUT BLOCKED — DOCUMENTATION INCOMPLETE`.

## Historical authority

Historical program detail remains available in Git history and project-specific reports. Historical documents must not be used as current status authority when this registry, the live Issue, or a newer AS-BUILT record supersedes them.
