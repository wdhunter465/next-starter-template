---
Doc Type: Reference
Audience: Human + AI
Authority Level: Canonical
Owns: Diataxis mapping coverage and transition model
Does Not Own: Design authority; execution details
Canonical Reference: /docs/governance/DOCUMENT-ARCHITECTURE.md
Related Issues: #1342, #1132, #1134
Last Reviewed: 2026-06-05
---

# DIATAXIS MAPPING

## Purpose

Defines complete mapping from legacy documentation to Diataxis structure.

This document is the single source of truth for:

- transition coverage
- migration status
- routing vs full-document decisions

Program 1 Task 004 (`#1342`) populated legacy root rows below. Full per-file
migration execution remains deferred to Program 3 unless promoted.

Status report: `docs/reports/program-1-diataxis-transition-status.md`

---

## Coverage Model

- Total legacy root groups mapped: **6** (agent rules, cross-agent ops, governance ai, prompts, split trackers, archive candidates)
- Total DIATAXIS targets referenced: **15+** canonical paths across `docs/ops/ai/`, `docs/governance/standards/`, `docs/how-to/cursor/`, `docs/reference/website/`, and `docs/ops/trackers/`
- Coverage status: **Phase 1 status complete** — row-level retirement execution deferred Program 3

DIATAXIS is considered 100% complete for Phase 1 when:

- every required legacy root has a DIATAXIS entry (full, routed, or retain)
- split authority paths name one recommended canonical target per topic

---

## Mapping Table — Legacy Roots

| Legacy root / path | DIATAXIS target | Type | Status | Action |
|---|---|---|---|---|
| `docs/ops/ai/SHARED-AGENT-RULES.md` | — | Reference (ops) | **Retired (#4091)** | Deleted — superseded pointer; chain is `Agent.md` → `REPOSITORY-AUTHORITY.md` → `AGENT-TEAM.md` → `CORE-RULES.md` |
| `docs/ops/ai/CORE-RULES.md` | `docs/ops/ai/CORE-RULES.md` | Reference (ops) | **Migrated** | Retain — canonical detailed execution rules |
| `docs/ops/ai/CHATGPT-RULES.md` | `docs/ops/ai/CHATGPT-RULES.md` | Reference (ops) | **Migrated** | Retain — ChatGPT control-plane rules |
| `docs/ops/ai/CURSOR-RULES.md` | `docs/ops/ai/CURSOR-RULES.md` | Reference (ops) | **Migrated** | Retain — Cursor tool rules |
| `docs/ops/ai/CODEX-RULES.md` | `docs/ops/ai/CODEX-RULES.md` | Reference (ops) | **Retired (#4165)** | Retain path only — historical pointer; not a live product |
| `docs/ops/ai/COPILOT-RULES.md` | `docs/ops/ai/COPILOT-RULES.md` | Reference (ops) | **Migrated** | Retain — Copilot tool rules |
| `docs/ops/ai/DEVIN-RULES.md` | `docs/ops/ai/DEVIN-RULES.md` | Reference (ops) | **Migrated** | Retain — Devin tool rules |
| `docs/ops/ai/pr-lifecycle-standard.md` | — | Operations | **Retired (#4091)** | Deleted — contradicted `PR_PROCESS.md` / `AGENT-TEAM.md` (ChatGPT-as-universal-PR-owner) |
| `ops/ai/CROSS-AGENT-OPERATING-RULES.md` | `docs/ops/ai/CROSS-AGENT-OPERATING-RULES.md` | Operations | **Deferred Program 3** | Migrate — move live file into `docs/ops/ai/`; retire repo-root path |
| `governance/ai/AGENT-GOVERNANCE.md` | `docs/governance/standards/agent-governance.md` | Governance | **Deferred Program 3** | Rewrite + migrate — create DIATAXIS standard; retire repo-root path |
| `docs/governance/ai/AI-GUIDE.md` | `docs/archive/superseded/governance/ai/AI-GUIDE.md` *(planned)* | Governance | **Retain** | Route — historical build prompt; not agent routing authority |
| `PROMPTS/Cursor-Rules.md` | `docs/ops/ai/CURSOR-RULES.md` | How-To / Reference | **Deferred Program 3** | Route → retire — prompt summary only |
| `PROMPTS/Codex-Rules.md` | `docs/ops/ai/CODEX-RULES.md` | How-To / Reference | **Removed (#4165)** | Deleted with Codex decommission |
| `PROMPTS/Cursor-Launch-Prompt.md` | `docs/how-to/cursor/run-program-task.md` | How-To | **Deferred Program 3** | Route → retire — use DIATAXIS how-to |
| `PROMPTS/Codex-Launch-Prompt.md` | `docs/ops/ai/CODEX-RULES.md` | How-To / Reference | **Removed (#4165)** | Deleted with Codex decommission |
| `PROMPTS/PR-as-ticket-template.md` | `docs/templates/agent-assignment-template.md` | Reference | **Deferred Program 3** | Route → retire — use DIATAXIS template |
| `docs/ops/trackers/LGFC-WEBSITE-IMPLEMENTATION-QUEUE-NORMALIZATION.md` | `docs/reference/website/lgfc-website-as-built-reconciliation.md` | Operations | **Retain** | Route — tracker readable; ops truth in as-built reconciliation |
| `docs/reference/lgfc-implementation-coverage-map.md` | `docs/reference/lgfc-implementation-coverage-map.md` | Reference | **Retain** | Route — reference-only; non-authoritative for ops queue |
| `docs/ops/trackers/IMPLEMENTATION-WORKLIST_Master.md` | `docs/ops/trackers/IMPLEMENTATION-WORKLIST_Master.md` | Operations | **Retain** | Retain — canonical master worklist |
| `docs/ops/trackers/THREAD-LOG_Master.md` | `docs/ops/trackers/THREAD-LOG_Master.md` | Operations | **Retain** | Retain — historical thread log |
| `docs/ops/trackers/LGFC-REPO-RECOVERY-AND-IMPLEMENTATION_PLAN.md` | `docs/archive/superseded/ops/trackers/LGFC-REPO-RECOVERY-AND-IMPLEMENTATION_PLAN.md` *(planned)* | Operations | **Deferred Program 3** | Archive — recovery-era plan |

---

## Split Agent Authority — Canonical Target Summary

One recommended canonical target per topic (details in status report):

| Topic | Canonical target |
|---|---|
| Shared agent law | `docs/ops/ai/CORE-RULES.md` |
| Cross-agent handoff | `docs/ops/ai/CROSS-AGENT-OPERATING-RULES.md` *(after Program 3 move)* |
| Long-form agent governance | `docs/governance/standards/agent-governance.md` *(after Program 3 authoring)* |
| Cursor program execution | `docs/reference/pmo/lgfc-cursor-execution-contract.md` |

---

## Status Definitions

| Status | Meaning |
|---|---|
| **Migrated** | Authoritative content lives at the DIATAXIS target; legacy duplicate absent or non-authoritative |
| **Retain** | Document stays at listed path; may carry routing banner; not scheduled for immediate move |
| **Deferred Program 3** | Mapping decided; file move, rewrite, or retirement executes under `#1132` / Program 3 only |

Legacy vocabulary (still used in `#1132` matrix):

- Viable → clean migration possible
- Weak → rewrite required
- Duplicate → remove or consolidate
- Missing → new DIATAXIS document required

---

## Action Definitions

- **Migrate** → convert legacy to DIATAXIS with minimal change
- **Rewrite** → create new DIATAXIS document
- **Route** → DIATAXIS routing document or banner references legacy; legacy not ops authority
- **Retire** → remove legacy after validation and manifest row

---

## Rules

- Every legacy root group in the Phase 1 audit appears exactly once in the table above
- Every mapping resolves to one DIATAXIS target (existing or planned)
- No unmapped legacy roots from the audit remain
- DIATAXIS remains authoritative at all times per `/docs/ops/pmo/diataxis-legacy-retirement-policy.md`
- This table records status only; it does not execute retirements

---

## Transition Tracking

- DIATAXIS coverage is Phase-1-complete for audited legacy roots (full, routed, or retain)
- Legacy usage should decrease as Program 3 migration PRs land
- `LEGACY_FALLBACK` events should create or update mapping gaps before reuse

---

## Notes

Population completed in Program 1 Task 004 (`#1342`). Prior scaffold rows replaced.
Full per-file inventory expansion remains Program 3 scope.
