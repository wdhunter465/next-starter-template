---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Program 1 DIATAXIS transition status, quadrant health snapshot, header enforcement gaps, legacy path disposition, and split-authority recommendations
Does Not Own: Legacy file moves, deletions, full #1132 migration execution, or GitHub issue state changes
Canonical Reference: /docs/reference/DIATAXIS-MAPPING.md
Related Issues: #1342, #1335, #1132, #1134
Last Reviewed: 2026-06-05
---

# Program 1 DIATAXIS Transition Status

## Purpose

Record Program 1 Task 004 (`#1342`) DIATAXIS transition **status** on `main` as of
2026-06-05. This report summarizes quadrant health, header enforcement gaps, and
legacy path disposition. It does **not** execute migration work.

## Boundary Statement

This task is **status-only**.

- Full legacy migration, retirement, and manifest execution remain **deferred to
  Program 3** (`#1132` documentation-remediation workstream) unless explicitly
  promoted by the program owner.
- No legacy folders are deleted or moved by this report.
- Agents must treat DIATAXIS paths as current authority per
  `/docs/ops/pmo/diataxis-legacy-retirement-policy.md`.

## Scope

This document owns:

- DIATAXIS quadrant health snapshot
- Header enforcement gap disclosure
- Legacy root disposition (`ops/ai/`, `governance/ai/`, `PROMPTS/`, split trackers)
- Recommended canonical targets for split agent authority paths

This document does not own:

- Individual legacy file migration PRs (Program 3)
- Post-merge DIATAXIS validation workflow behavior
- `#1132` child issue creation or closure

## Assessment Baseline

| Source | Role |
|---|---|
| Program 1 plan | `docs/ops/implementation-plans/program-1-phase1-wrapup-rollout.md` Task 004 |
| Mapping table | `docs/reference/DIATAXIS-MAPPING.md` |
| Transition project | `docs/ops/projects/DIATAXIS-TRANSITION.md` |
| Legacy retirement policy | `docs/ops/pmo/diataxis-legacy-retirement-policy.md` |
| `#1132` gap analysis | `docs/reference/documentation-gap-analysis-1132.md` |
| `#1132` migration matrix | `docs/reference/legacy-to-diataxis-migration-matrix-1132.md` |

## Quadrant Health

Assessment date: **2026-06-05**.

| DIATAXIS quadrant | `.md` file count (direct) | Health |
|---|---:|---|
| `docs/tutorials/` | 3 | Scaffold present; learning paths exist but are not exhaustive |
| `docs/how-to/` | 22 | Active execution surface; Cursor PMO how-tos landed (Task 001) |
| `docs/reference/` | 81 | Primary facts layer; CI and website as-built reconciliations present |
| `docs/explanation/` | 23 | Rationale layer populated for CI, PMO, DIATAXIS lifecycle |
| `docs/governance/` | 25 | Standards and folder authority enforced |
| `docs/ops/` | 94 | Trackers, plans, PMO registry, agent rules under `docs/ops/ai/` |
| **Total under `docs/`** | **274** | Skeleton enforced; mapping table now populated (this task) |

Supporting checks on `main`:

| Check | Result |
|---|---|
| `node scripts/ci/diataxis_folder_audit.mjs` | PASS — no folder hygiene defects detected |
| `docs/reference/DIATAXIS-MAPPING.md` | Populated — legacy root rows added (this task) |
| Legacy live roots | Still present — disposition recorded below; execution deferred |

Quadrant health is **stable for Phase 1 closeout**. Remaining work is row-level
legacy retirement and `#1132` package completion, not structural DIATAXIS absence.

## Header Enforcement Gaps

Repo-wide header enforcement runs via `./scripts/ci/docs_check_headers.sh .`.

| Gap | Disposition |
|---|---|
| `docs/templates/ai-build-issue-template.md` missing required YAML header fence | **Pre-existing, out of scope** for Task 004. Disclose only; do not fix in this PR. |
| Legacy root `PROMPTS/*.md` (4 of 5 files) | Missing canonical header block. Deferred Program 3; routed in mapping table. |
| Legacy root `ops/ai/` and `governance/ai/` | Headers present but paths remain transitional; canonical targets under `docs/ops/ai/` and future `docs/governance/standards/` win on conflict. |
| Changed files in this task | Must pass per-file header checks before PR |

Standard disclosure when repo-wide check fails only on the template above:

```text
Repo-wide validation failed due to pre-existing out-of-scope file:
docs/templates/ai-build-issue-template.md
Changed-file validation passed.
```

## Legacy Path Disposition

| Legacy root | Live files (approx.) | DIATAXIS status | Program disposition |
|---|---:|---|---|
| `docs/ops/ai/` | 9 | **Migrated** (canonical agent rules live here) | Retain; legacy root duplicates deferred |
| `ops/ai/` | 1 | **Deferred Program 3** | `CROSS-AGENT-OPERATING-RULES.md` → target `docs/ops/ai/CROSS-AGENT-OPERATING-RULES.md` |
| `governance/ai/` | 1 | **Deferred Program 3** | `AGENT-GOVERNANCE.md` → target `docs/governance/standards/agent-governance.md` |
| `docs/governance/ai/` | 1 | **Retain** (historical build prompt) | Non-authority for agent routing; do not expand |
| `PROMPTS/` | 5 | **Deferred Program 3** | Route to `docs/ops/ai/*-RULES.md` and `docs/how-to/cursor/` |
| Split trackers (website queue) | 2 primary | **Retain with routing** | Ops truth → `docs/reference/website/lgfc-website-as-built-reconciliation.md` |

See `docs/reference/DIATAXIS-MAPPING.md` for the authoritative row-level mapping table.

## Split Agent Authority — Recommended Canonical Targets

When legacy and DIATAXIS paths disagree, agents must use **one canonical target per
topic** below until Program 3 migration PRs retire the legacy live paths.

| Topic | Recommended canonical target | Legacy paths to ignore for authority |
|---|---|---|
| Shared agent law | `docs/ops/ai/SHARED-AGENT-RULES.md` | `PROMPTS/*-Rules.md` summaries |
| Detailed execution rules | `docs/ops/ai/CORE-RULES.md` | ad-hoc prompt fragments |
| Tool-specific agent rules | `docs/ops/ai/{CHATGPT,CURSOR,CODEX,COPILOT,DEVIN}-RULES.md` | `PROMPTS/Cursor-Rules.md`, `PROMPTS/Codex-Rules.md` |
| Cross-agent handoff contract | `docs/ops/ai/CROSS-AGENT-OPERATING-RULES.md` *(target; file migration deferred)* | `ops/ai/CROSS-AGENT-OPERATING-RULES.md` |
| Long-form agent governance | `docs/governance/standards/agent-governance.md` *(target; file creation deferred)* | `governance/ai/AGENT-GOVERNANCE.md` |
| Cursor program execution | `docs/reference/pmo/lgfc-cursor-execution-contract.md` | launch prompts under `PROMPTS/` |
| Cursor task procedures | `docs/how-to/cursor/run-program-task.md` | `PROMPTS/Cursor-Launch-Prompt.md` |

**Primary recommendation:** consolidate split agent authority under
`docs/ops/ai/SHARED-AGENT-RULES.md` as the single shared-law entry point, with
tool-specific rules in sibling `docs/ops/ai/*-RULES.md` files. Cross-agent and
long-form governance documents should migrate into that tree (ops) or
`docs/governance/standards/` (governance) in Program 3 — not remain duplicated at
repo-root `ops/ai/` and `governance/ai/`.

## Split Tracker Disposition

Website and implementation tracking currently spans ops trackers and reference maps.
Task 003 established non-authority banners on stale tracker claims.

| Tracker / map | Role | Canonical target for ops decisions |
|---|---|---|
| `docs/ops/trackers/IMPLEMENTATION-WORKLIST_Master.md` | Master worklist | **Retain** — canonical ops tracker for cross-project worklist state |
| `docs/ops/trackers/LGFC-WEBSITE-IMPLEMENTATION-QUEUE-NORMALIZATION.md` | Website queue snapshot | **Route** — use `docs/reference/website/lgfc-website-as-built-reconciliation.md` + GitHub issues |
| `docs/reference/lgfc-implementation-coverage-map.md` | Surface-to-authority map | **Retain** — reference-only; non-authoritative for ops queue state |
| `docs/ops/trackers/THREAD-LOG_Master.md` | Historical thread log | **Retain** — historical context only |
| `docs/ops/trackers/LGFC-REPO-RECOVERY-AND-IMPLEMENTATION_PLAN.md` | Recovery-era plan | **Deferred Program 3** — archive candidate after manifest row |

## Program 3 Handoff

Items explicitly deferred (not blockers for Program 1 Task 004 closeout):

1. Move `ops/ai/CROSS-AGENT-OPERATING-RULES.md` into `docs/ops/ai/`
2. Author `docs/governance/standards/agent-governance.md` and retire `governance/ai/AGENT-GOVERNANCE.md`
3. Retire or archive `PROMPTS/` after manifest rows
4. Execute `#1132` migration matrix rows and append `docs/archive/MIGRATION-MANIFEST.md`
5. Fix pre-existing header gap in `docs/templates/ai-build-issue-template.md` under a separate scoped task

## Related Documents

| Document | Role |
|---|---|
| `docs/reference/DIATAXIS-MAPPING.md` | Authoritative legacy → DIATAXIS mapping table |
| `docs/ops/projects/DIATAXIS-TRANSITION.md` | Transition project scope and worklist |
| `docs/reference/documentation-gap-analysis-1132.md` | `#1132` gap matrix (DIATAXIS row updated) |
| `docs/reference/legacy-to-diataxis-migration-matrix-1132.md` | Migration evaluation rules |
| `docs/ops/pmo/program-registry.md` | Program 3 owns full migration execution |
