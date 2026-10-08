---
Doc Type: Reference
Audience: human project owner and AI agents
Authority Level: supporting
Owns: legacy-to-DIATAXIS migration planning for project #1132
Does Not Own: implementation code or archival execution
Canonical Reference: docs/reference/documentation-gap-analysis-1132.md
Related issues: #1132, #1134, #1342, #3155
Last Reviewed: 2026-09-27
---

# Legacy to DIATAXIS Migration Matrix

## Purpose

Define how legacy documentation is evaluated and migrated into the repository documentation structure.

Program 1 Task 004 (`#1342`) populated legacy root rows in
`docs/reference/DIATAXIS-MAPPING.md` and recorded Phase 1 status in
`docs/ops/reports/program-1-diataxis-transition-status.md`. This matrix still owns
evaluation rules; execution remains Program 3 unless promoted.

| Legacy State | Action | Destination |
|---|---|---|
| Active authoritative document | Keep | Existing authority location |
| Duplicate authority | Merge | Canonical authority document |
| Historical reference | Archive | docs/archive |
| Mixed design and implementation content | Split | Reference + How-To + As-Built |
| Obsolete material | Retire | Archive with retirement note |

## Migration order

1. Authority documents
2. Production definitions
3. Implementation plans
4. Operations documents
5. Historical material

## Acceptance criteria

- One authority source per subject.
- No duplicate production definitions.
- Legacy material preserved when historically valuable.
- Migration decisions documented before execution.

## Phase 1 status (Program 1 Task 004)

Legacy roots audited for Phase 1 closeout:

| Legacy root | Mapping status | Execution |
|---|---|---|
| `docs/ops/ai/` | Migrated | Retain canonical agent rules |
| `ops/ai/` | Mapped | Retired #3155 — archived; authority is `docs/ops/ai/CORE-RULES.md` |
| `governance/ai/` | Mapped | Retired #3155 — archived; authority is `docs/governance/AGENT-TEAM.md` |
| `PROMPTS/` | Mapped | Retired #3155 — archived with canonical headers |
| Split trackers | Mapped | Retain with routing to as-built reconciliation |

Authoritative row-level table: `docs/reference/DIATAXIS-MAPPING.md`.
