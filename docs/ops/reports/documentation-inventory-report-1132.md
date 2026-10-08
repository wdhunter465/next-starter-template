---
Doc Type: Report
Audience: Human + AI
Authority Level: Controlled
Owns: Project #1132 Phase 1 documentation inventory findings
Does Not Own: Canonical product design, final architecture, implementation mechanics, or operational as-built state
Canonical Reference: /docs/README.md
Related Issues: #1132, #1133, #1134
Last Reviewed: 2026-05-29
---

# Documentation Inventory Report — Project #1132 Phase 1

## Purpose

This report starts the documentation completion program for Project #1132, "Documentation Completion & Production Definition." It records the repository documentation surfaces that must be used to complete production-definition documentation across LGFC projects.

The program goal is to define Who, What, Where, and Why for each major project area so implementation agents can determine How during execution and then produce as-built operational documentation.

## Inventory Scope

| Surface | Current role | Phase 1 disposition |
|---|---|---|
| `docs/README.md` | Canonical documentation entry point and first-read order | Use as primary documentation-structure authority |
| `docs/reference/repository-authority-index.md` | Repository authority location index | Use as seed authority map |
| `docs/reference/design/LGFC-Production-Design-and-Standards.md` | Runtime website behavior design authority | Use as canonical design source for public and Fan Club behavior |
| `docs/reference/architecture/access-model.md` | Access and permission architecture | Use for Fan Club/Admin permission boundaries |
| `docs/reference/content-inventory-design-spec.md` | Content inventory architecture | Use for Content Collection System package |
| `docs/reference/content-inventory-d1-schema.md` | Content inventory schema | Use for Content Collection System data boundary |
| `docs/explanation/ci/lgfc-ci-production-design.md` | CI orchestration rationale/design | Use for CI Orchestration System package |
| `docs/how-to/ci/lgfc-ci-implementation-plan.md` | CI orchestration implementation sequencing | Use as existing implementation-plan seed |
| `docs/how-to/ci/lgfc-ci-orchestration-issue-model.md` | Issue model for CI orchestration | Use for issue-generation framework |
| `docs/reference/ci/lgfc-ci-implementation-dependency-matrix.md` | CI dependency matrix | Use for orchestration dependency mapping |
| `docs/reference/ci/lgfc-ci-workflow-classification-matrix.md` | Workflow classification | Use for CI workflow ownership mapping |
| `docs/governance/` | Governance, authority hierarchy, PR rules, verification standards | Use as enforcement and conflict-resolution source |
| `docs/ops/` | Live operating procedures, worklists, trackers, task records | Use as operational status and sequencing source |
| `docs/reference/` (former `docs/as-built/`, #4480) | Historical implementation records | Use as as-built reference only, not future design authority |
| `docs/archive/` | Legacy and historical material | Use as migration/reference input only |
| `docs/ops/ai/` | AI/agent operating rules | Use for agent behavior boundaries |
| `.agents/skills/` | Reusable agent skills | Use for agent workflow support |
| `ops/ai/` | Cross-agent operating materials | Reconcile against `docs/ops/ai/` during normalization |
| `scripts/ci/` | Documentation and governance verification scripts | Use to validate documentation guardrails |
| GitHub Issues #1132-#1140 | Documentation completion program and child execution units | Use as live program tracker |
| GitHub Issues #1019, #1024, #1039, #1054, #1075, #1076, #1058, #1096, #1131 | Related governance, DIATAXIS, CI, and coverage programs | Use as related-source context without overriding canonical docs |

## Major Project Areas Identified

| Project area | Current documentation posture | Phase 1 conclusion |
|---|---|---|
| Fan Club System | Canonical behavior exists, but production design package must consolidate actors, journeys, permissions, boundaries, dependencies, success criteria, and implementation milestones | Requires Phase 3A package |
| Admin System | Access model and governance materials exist, but admin production design package is not yet complete | Requires Phase 3B package |
| Content Collection System | Content inventory design and schema authorities exist; editorial workflow and archive lifecycle need production-definition packaging | Requires Phase 3C package |
| CI Orchestration System | Strong existing CI design package appears present; must be reconciled into #1132 ownership model and implementation-plan dependency structure | Requires Phase 3D package |
| DIATAXIS Migration Project | Existing migration/governance issues and standards exist; migration design package must define serial order and validation rules | Requires Phase 3E package |
| Legacy Retirement Project | Legacy/archive surfaces exist; retirement criteria and closure process need formal package | Requires Phase 3F package |
| Documentation Normalization | Authority hierarchy exists; contradictions, duplicate authority, and path ownership must be resolved after gap analysis | Requires Phase 5 package |
| Issue Generation Framework | Existing orchestration issue model exists for CI; #1132 requires generalized documentation-derived issue generation | Requires Phase 6 package |

## Ownership Findings

1. `docs/README.md` owns the documentation structure, authority model, first-read order, and Diátaxis alignment.
2. `docs/reference/repository-authority-index.md` indexes authority locations but does not itself define authority-resolution rules.
3. `docs/governance/standards/` owns authority resolution and documentation governance.
4. `docs/reference/design/` owns canonical product and runtime behavior definitions.
5. `docs/how-to/` owns task-execution procedures and implementation plans.
6. `docs/explanation/` owns rationale and context; it must not become the only authority for project requirements.
7. `docs/ops/` owns live procedures, trackers, and operational sequencing.
8. Historical implementation records now live in `docs/reference/` after #4480 folded `docs/as-built/` there. They are not future design authority.
9. `docs/archive/` and legacy folders must be treated as migration/reference material unless explicitly promoted through governance.

## Immediate Risks

| Risk | Impact | Required follow-up |
|---|---|---|
| Project definitions split across docs, issues, trackers, and historical planning materials | Agents may infer requirements from stale or partial material | Phase 2 gap analysis must map conflicts and duplicates |
| Existing CI design may be more mature than Fan Club/Admin/Content packages | Work may advance unevenly | Phase 3 packages must normalize design depth across all major projects |
| Legacy documentation may still appear authoritative | Drift risk | Phase 3E/3F and Phase 5 must define migration and retirement rules |
| As-built documentation is historical but not consistently tied to project lifecycle | Operational docs may lag implementation | Phase 4/5 must require as-built creation after agent execution |

## Phase 1 Output Status

This report establishes the initial inventory baseline. It does not complete gap analysis, design-package creation, implementation plans, normalization, or issue generation.

Next required phase: #1134 Documentation Gap Analysis and Legacy-to-DIATAXIS Migration Matrix.
