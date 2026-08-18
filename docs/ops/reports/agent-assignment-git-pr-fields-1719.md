---
Doc Type: Operations Report
Audience: Bill, ChatGPT, Cursor, LGFC maintainers
Authority Level: Evidence / Status Index
Owns: Evidence that Follow-up 3/5 (#2564) made Git/branch/PR authority mandatory in the agent-assignment envelope
Does Not Own: Follow-ups 4–5, Program #1719 production promotion, or merge authority
Canonical Reference: /docs/templates/agent-assignment-template.md
Related Issues: #2564, #1719, #2528, #2563
Last Reviewed: 2026-08-18
---

# Agent assignment Git/PR field hardening — #2564

## Purpose

Make every future Cursor implementation assignment state execution environment and Git/PR authority as mandatory fields so local-only completion cannot be confused with authorized branch/PR delivery.

## Scope

This report owns evidence that Follow-up 3/5 (#2564) made Git/branch/PR authority mandatory in the agent-assignment envelope. It does not own Follow-ups 4–5, Program #1719 production promotion, or merge authority.

## Current known truth

The assignment template required-fields table (section 3) and the Git/PR fields in the mandatory template block are the field definitions. Historical heading **2A** was renumbered; live `CURSOR-RULES.md` cross-references section 3. Cursor must not treat narrative prose as Git or PR authority.

## Intended final state

Future assignments state runtime, working branch, base/target, create/commit/push/PR authorization, PR target, initial PR state, and post-PR continuation as exact fields, with self-approval/self-merge/`main` promotion remaining prohibited by default.

## Predecessor

#2563 / PR #2617 integrated into `component/pmo-governance-workflow-automation` at `eb729385`.

## Changed paths (allowlist only)

| Path | Change |
| --- | --- |
| `docs/templates/agent-assignment-template.md` | Added Git/PR authority as required-fields rows and mandatory template Git/PR fields; current heading is **3. Required assignment fields** (historical **2A** was renumbered); distinguished local-only vs branch/PR delivery |
| `docs/ops/ai/CURSOR-RULES.md` | Minimal cross-reference to section 3 required-fields table and the mandatory template Git/PR block; stop if Git/PR fields missing |
| `docs/reference/pmo/lgfc-cursor-execution-contract.md` | Minimal Default Permissions note that section 3 Git/PR fields are mandatory authorization |
| `docs/ops/reports/agent-assignment-git-pr-fields-1719.md` | This report |

## Mandatory fields added

- Runtime / execution environment (`local` / `cloud` / `either`) — already present; now labeled as Cursor Local vs Cursor Cloud explicitly
- Working branch name
- Base / target branch
- Branch creation authorized (`YES` / `NO`)
- Commit authorized (`YES` / `NO`)
- Push authorized (`YES` / `NO`)
- Open PR authorized (`YES` / `NO`)
- Required PR target
- PR initial state (`draft` / `ready-for-review` / `not-applicable`)
- Post-PR continuation (`stop-after-pr-open` / `continue-remediation-same-issue` / `not-applicable`)
- Self-approval / self-merge / promotion to `main` — default `NO` unless separately authorized

## Local-only vs branch/PR delivery

- **Local-only:** create, commit, push, and open-PR are all `NO`.
- **Branch/PR delivery:** any of those are `YES`; then working branch, base/target, and PR target (when Open PR is `YES`) must be exact names — not implied prose.

## Consistency

| Document | Alignment |
| --- | --- |
| Assignment template | Owns the mandatory field definitions and copy/paste block |
| `CURSOR-RULES.md` | Points Cursor at section 3 required-fields table; forbids treating narrative as Git/PR authority |
| Cursor execution contract | Restates that create/commit/push/PR require section 3 Git/PR fields |

## Acceptance mapping

| Criterion | Result |
| --- | --- |
| Future assignments must make local/cloud execution explicit | PASS — Runtime / execution environment required |
| Branch, base, create, commit, push, PR authority are mandatory fields | PASS — section 3 required-fields table + mandatory template Git/PR block |
| PR target and post-PR continuation explicit | PASS |
| Template distinguishes local-only from branch/PR delivery | PASS |
| Cursor rules and execution contract reference fields consistently | PASS |
| Concise report recorded | PASS (this file) |

## Boundaries honored

- No self-approval / self-merge
- No retarget to `main`
- No allowlist expansion
- No runtime product code or workflow changes
