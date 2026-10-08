---
Doc Type: Governance
Audience: Human + AI
Authority Level: Canonical
Owns: Documentation structure, authority model, first-read order, Diátaxis alignment
Does Not Own: Product design specs; architecture specs; platform specs; operational procedures
Canonical Reference: /docs/governance/standards/document-authority-hierarchy_MASTER.md
Last Reviewed: 2026-02-20
---

# LGFC Documentation Index (Canonical Entry Point)

This file defines how documentation in this repository is structured, interpreted, and enforced.

If two documents conflict, the higher Authority Level wins.

---

# 1. Documentation Authority Model

## Authority Levels (Highest → Lowest)

1. Canonical  
2. Operational Authority  
3. Controlled  
4. Informational  
5. Historical  

Historical and Informational documents never override Canonical documents.

Canonical documents define the system.

Operational Authority documents define how the system is run.

---

# 2. Diátaxis Alignment

This repository documentation follows the Diátaxis framework:

| Diátaxis Type | Folder |
|---------------|--------|
| Specification | docs/reference/ |
| How-To | docs/how-to/ |
| Explanation | docs/explanation/ |
| Governance | docs/governance/ |
| Operations | docs/ops/ |
| Templates | docs/templates/ |
| Historical | docs/reference/ (former as-built), docs/ops/incident-response/ (former postmortems), docs/ops/reports/ (former top-level reports) |

Specifications define what the system **is**.  
How-To defines how to perform tasks.  
Explanation defines why decisions were made.  
Governance defines enforcement and control.  
Operations defines live procedures.  
Historical documents record past state.

---

# 3. First-Read Order (Human)

1. docs/governance/standards/document-authority-hierarchy_MASTER.md  
2. docs/reference/design/LGFC-Production-Design-and-Standards.md  
3. docs/reference/architecture/access-model.md  
4. docs/reference/platform/CLOUDFLARE.md  
5. docs/ops/OPERATING_MANUAL.md  

This sequence provides:

Authority → Design → Architecture → Platform → Operations

---

# 4. First-Read Order (AI)

AI agents must load context in this order:

1. Governance (authority hierarchy + AI guide)
2. Canonical Design Specification
3. Architecture Specification
4. Platform Specification
5. Operational Standards

AI must never infer design beyond Canonical Specification documents.

---

# 5. Folder Responsibilities

## docs/governance/
Defines rules, PR process, AI guardrails, verification standards.

## docs/reference/
Defines canonical technical and design specifications.

## docs/how-to/
Defines task execution procedures.

## docs/explanation/
Provides context and reasoning. Not authoritative.

## docs/ops/
Defines operational procedures and incident response.

## docs/templates/
Reusable structured artifacts.

## Retired top-level folders (#4480)
`docs/as-built/` now lives under `docs/reference/`. `docs/postmortems/` now lives under `docs/ops/incident-response/`. `docs/reports/` now lives under `docs/ops/reports/`.

---

# 6. Conflict Resolution Rule

If two documents disagree:

1. Governance overrides everything.
2. Canonical Specification overrides How-To and Explanation.
3. Operations must not redefine Specification.
4. Historical documents never override live documents.

---

# 7. Non-Negotiable Rule

The repository ZIP is the source of truth.

All documentation changes must respect:

- Folder taxonomy
- Authority model
- Canonical references
- Design invariants

Unauthorized structural drift is considered a documentation failure.
---

# 8. Documentation Header Enforcement

Active documentation files must start with the canonical header template at:

- `docs/templates/markdown-header-template.md`

Validation is enforced by:

- `./scripts/ci/docs_check_headers.sh .`
- `.github/workflows/docs-guardrails.yml`

When the check fails, remediation output is file-specific and includes:

- which file is missing a header fence or keys
- which exact header keys are missing
- the exact template block expected

Run the header check locally before opening or updating docs PRs to prevent avoidable gate failures.

