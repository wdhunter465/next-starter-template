---
Doc Type: Governance
Audience: Human + AI
Authority Level: Canonical
Owns: Document structure, ownership boundaries, path resolution rules
Does Not Own: Implementation sequencing, tracker state, product/design decisions, platform decisions, or CI verification decisions
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #2486, #2686, #2690
Last Reviewed: 2026-07-21
---

# DOCUMENT ARCHITECTURE (AUTHORITY)

## Purpose
Defines the authoritative document structure, ownership boundaries, and path resolution rules for the repository.
All CI scripts, AI agents, and contributors must follow this model.

Constitutional precedence and domain ownership:
[`REPOSITORY-AUTHORITY.md`](./REPOSITORY-AUTHORITY.md).

Disposition map for Task 2:
[`docs/reference/diataxis/two-model-authority-disposition-map.md`](../reference/diataxis/two-model-authority-disposition-map.md).

---

## Folder Ownership Model

### 1. docs/reference/design/
Purpose: Controlled supporting specifications for product behavior, UX, layout, routes, and design facts.

Canonical policy owner:
- `docs/governance/PRODUCT-AND-DESIGN.md`

Owns:
- Detailed site-structure facts
- Navigation specifications
- Page and route definitions
- UX and visual-behavior specifications

Does Not Own:
- Product or design policy
- Product Authority decisions
- Operational procedures
- CI/CD behavior
- Implementation tracking

Examples:
- LGFC-Production-Design-and-Standards.md
- home.md
- fanclub.md

---

### 2. docs/ops/

Purpose: Operational procedures, project tracking, and **runtime execution state**

Does Not Own:
- Binding system authority or domain policy (see `docs/governance/REPOSITORY-AUTHORITY.md`)

#### docs/ops/ai/

**Interim location** for legacy agent execution material during the delivery-system migration.

Target routing (binding policy → governance; contracts → reference; procedures → how-to; runtime state → ops):

| Material | Target canonical location |
| --- | --- |
| Binding agent policy | `docs/governance/**` |
| Agent facts and contracts | `docs/reference/**` |
| Agent execution procedures | `docs/how-to/**` |
| Live queues, handoffs, poll-wake state | `docs/ops/**` |

Until migrated under an explicit delivery-system child issue, these interim canonical files remain authoritative for execution:

- `CORE-RULES.md`
- `CHATGPT-RULES.md`
- `CURSOR-RULES.md`
- `CODEX-RULES.md` (retired #4165; historical pointer only)
- `COPILOT-RULES.md`
- `DEVIN-RULES.md`

Do not add new binding policy under `docs/ops/ai/`.

---

### 3. docs/governance/

Purpose: System-level authority, constitutional routing, domain policy, and process enforcement.

Owns:
- Repository constitution (`REPOSITORY-AUTHORITY.md`)
- One canonical policy owner for each constitutional domain
- PR process
- Documentation standards
- DOCUMENT-ARCHITECTURE.md (this file)

The active domain-policy ownership table is maintained only in `REPOSITORY-AUTHORITY.md`. Supporting references and procedures must route to those owners rather than duplicate their policy.

---

### 4. docs/ops/trackers/

Purpose: Execution tracking and project state

Owns:
- IMPLEMENTATION-WORKLIST_Master.md
- THREAD-LOG_Master.md

Does Not Own:
- Design decisions
- System rules

---

## Canonical File Rules

- Each domain must have ONE canonical policy owner (see `REPOSITORY-AUTHORITY.md`)
- No duplicate authority files allowed
- All references must point to the canonical file
- Detailed `docs/reference/**` documents are supporting specifications and contracts, not co-owners of domain policy

Interim example (legacy path until Task 4 migration):

```text
docs/ops/ai/CURSOR-RULES.md  → interim execution rules; binding policy migrates to governance
```

Invalid duplicate:

```text
docs/CURSOR_RULES.md  → non-canonical path
```

---

## Path Resolution Standard (CRITICAL)

Rule:
All file paths in CI scripts must resolve relative to the file that defines them.

Implementation:

If using a file list:
- Paths inside the list are relative to the list file directory

Example:
File: docs/reference/design/.canonical-files.txt
Entry: LGFC-Production-Design-and-Standards.md

Resolved path:
docs/reference/design/LGFC-Production-Design-and-Standards.md

Prohibited:
- Mixing repo-root-relative and local-relative paths
- Hardcoding inconsistent paths

---

## CI Script Requirements

All CI scripts must:
1. Resolve paths based on declared source file location
2. Not assume repo root unless explicitly defined
3. Fail fast on missing files
4. Follow this architecture document

CI check classification, evidence requirements, failure routing, and verification ownership are governed by `docs/governance/CI-AND-VERIFICATION.md`.

---

## Enforcement Rules

- CI must enforce canonical file existence
- CI must enforce no duplicate authority files
- CI must enforce path resolution consistency

---

## Governance Deduplication Rules (Workstream J)

Each governance topic must have exactly ONE canonical file. No second file may define, restate, or contradict the same authority.

Prohibited patterns:
- Two files both claiming to define the same process (e.g., two PR process docs)
- A non-canonical file overriding or restating rules from a canonical file
- Contradictory definitions of the same concept across multiple docs

Required actions when a duplicate is found:
1. Identify the canonical file: prefer the file with the highest Authority Level; if tied, prefer the file that is explicitly referenced by the most other docs; if still tied, escalate to operator decision before proceeding
2. Archive or delete the duplicate
3. Update all references to point to the canonical file
4. Do not create new files that duplicate existing canonical authority

Canonical governance files (single source per topic):
- Repository constitution: `/docs/governance/REPOSITORY-AUTHORITY.md`
- Product and Design policy: `/docs/governance/PRODUCT-AND-DESIGN.md`
- Platform and Environment policy: `/docs/governance/PLATFORM-AND-ENVIRONMENT.md`
- CI and Verification policy: `/docs/governance/CI-AND-VERIFICATION.md`
- PMO and Portfolio policy: `/docs/governance/PMO-PORTFOLIO.md`
- Delivery and Release policy: `/docs/governance/DELIVERY-AND-RELEASE.md`
- Agent Team policy: `/docs/governance/AGENT-TEAM.md`
- Administration and Communications policy: `/docs/governance/ADMINISTRATION-AND-COMMUNICATIONS.md`
- Operations and Recovery policy: `/docs/governance/OPERATIONS-AND-RECOVERY.md`
- PR process: `/docs/governance/PR_PROCESS.md`
- PR governance support: `/docs/governance/PR_GOVERNANCE.md`
- Document architecture: `/docs/governance/DOCUMENT-ARCHITECTURE.md` (this file)
- Design authority enforcement pointer: `/docs/governance/standards/design-authority_MASTER.md`
- Change control: `/docs/governance/standards/change-control_MASTER.md`

---

## Summary

This document defines:
- Where documents live
- Who owns what
- How paths are resolved
- How governance deduplication is enforced

All automation and contributors must follow this model to prevent drift and gate failures.
