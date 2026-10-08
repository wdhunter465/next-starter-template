---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: project #1132 documentation ownership map
Does Not Own: Final product design, implementation mechanics, or runtime configuration
Canonical Reference: /docs/README.md
Related issues: #1132, #1133
Last Reviewed: 2026-05-29
---

# Documentation Ownership Map — project #1132

## Purpose

This map identifies where LGFC documentation ownership currently lives so production-definition packages can be completed without duplicate authority or agent invention.

## Ownership Model

| Documentation area | Primary owner | Supporting sources | Notes |
|---|---|---|---|
| Documentation structure and first-read order | `docs/README.md` | Governance standards | Canonical entry point for repo docs |
| Authority resolution | `docs/governance/standards/` | `docs/reference/repository-authority-index.md` | Governance standards win over indexes |
| Runtime website behavior | `docs/reference/design/LGFC-Production-Design-and-Standards.md` | Worklists, issues, as-built logs | Product behavior authority |
| Access and permissions | `docs/reference/architecture/access-model.md` | Admin/Fan Club design package issues | Used for member/admin boundaries |
| Content inventory architecture | `docs/reference/content-inventory-design-spec.md` | `docs/reference/content-inventory-d1-schema.md` | Source for content package |
| CI orchestration design | `docs/explanation/ci/lgfc-ci-production-design.md` | `docs/how-to/ci/`, `docs/reference/ci/`, issues #1075/#1058/#1096/#1131 | Existing CI package appears mature and needs reconciliation |
| Implementation sequencing | `docs/how-to/` and `docs/ops/trackers/` | GitHub issues | How-to docs and trackers should support plans, not override design |
| Operational state | `docs/ops/` | GitHub issues and PRs | Live process/status surface |
| As-built records | `docs/reference/` | Closed PRs and deployment records | Receives agent-created operational documentation after implementation |
| Historical/legacy material | `docs/archive/` and legacy paths | Migration issues #1019/#1039/#1076 | Reference only unless promoted |
| AI/agent rules | `docs/ops/ai/`, `.agents/skills/`, `ops/ai/` | Agent.md | Must be normalized to avoid split authority |

## Package Ownership Targets

| Package | Design document location target | Implementation plan location target | As-built destination |
|---|---|---|---|
| Fan Club System | `docs/reference/` | `docs/how-to/` | `docs/reference/` |
| Admin System | `docs/reference/` | `docs/how-to/` | `docs/reference/` |
| Content Collection System | `docs/reference/` | `docs/how-to/` | `docs/reference/` |
| CI Orchestration System | `docs/reference/projects/ci-orchestration-production-definition.md`, `docs/explanation/ci/`, `docs/reference/ci/`, `docs/how-to/ci/` | `docs/how-to/ci/ci-orchestration-production-implementation-plan-1138.md` | `docs/reference/` |
| DIATAXIS Migration project | `docs/reference/` or `docs/governance/standards/` as applicable | `docs/how-to/` | `docs/reference/` |
| Legacy Retirement project | `docs/reference/` | `docs/how-to/` | `docs/reference/` |

## Rule

Design packages define Who, What, Where, and Why. Implementation agents determine How, execute through issues and PRs, and then document the as-built result.
