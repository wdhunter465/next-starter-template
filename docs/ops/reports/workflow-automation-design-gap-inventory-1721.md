---
Doc Type: Operations
Audience: Bill, Atlas, Cursor, LGFC maintainers, and reviewers
Authority Level: Controlled
Owns: Task #1721 durable evidence for workflow-automation design migration to PMO July 2026, gap classification, read-only workflow/CI inventory notes, and successor inputs for #1722 / #1726
Does Not Own: Workflow YAML implementation, CI script implementation, runtime code, secrets, merge to main, or GitHub issue mutation
Canonical Reference: /docs/ops/pmo/workflow-automation.md
Related Issues: #1721, #1719, #1720, #1722, #1723, #1724, #1725, #1726, #1727, #1411, #1500
Last Reviewed: 2026-08-18
---

# Workflow Automation Design Migration and Gap Inventory (#1721)

## Purpose

Deliver Task **#1721** for parent program **#1719**. Inventory current
workflow-automation authority, confirm migration to PMO July 2026, and classify
remaining gaps for successor tasks without implementing workflow YAML or CI
scripts.

## Scope

This report owns Task #1721 migration evidence and gap classification for Program #1719. It does not implement workflow YAML, CI scripts, runtime code, or merge to `main`.

## Current known truth

Planning authority is `docs/ops/pmo/workflow-automation.md` under the PMO July 2026 operating model. Historical #1411 / `#1417`–`#1424` surfaces are evidence only. Program #1500 / Task #1725 satisfy the closeout and queue/wave baseline and are not rebuilt here.

## Intended final state

Successor tasks #1722–#1727 receive classified gaps without reopening completed closeout work or inferring YAML/script authority from this inventory.

## Boundary statements

1. **Current planning authority** is `docs/ops/pmo/workflow-automation.md`,
   subordinate to `docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md`.
2. **Historical planning** from Program `#1411` and stale `#1417`–`#1424` is
   evidence only.
3. **Program `#1500` / Task `#1725`** satisfy the post-merge closeout and
   queue/wave planning baseline. Do not rebuild.
4. **This task is documentation-only.** `.github/workflows/**` and
   `scripts/ci/**` were inspected read-only.
5. **No merge or promotion to `main`.** This child integrates to
   `component/pmo-governance-workflow-automation` under Model B /
   `component-auto-integration`.

Assessment date: **2026-07-16**.

## Authority inventory (current vs historical)

| Surface | Role | Status |
| --- | --- | --- |
| `PMO-JULY-2026-OPERATING-MODEL.md` | Top-level PMO authority | Current |
| `workflow-automation.md` | Workflow automation planning authority | Current (reconciled in #1720/#1721) |
| `program-registry.md` / `pmo-backlog.md` | Subordinate PMO inventory | Current; route to July 2026 |
| `lgfc-cursor-execution-contract.md` | Cursor permissions / stop / mutation bounds | Current; hardening owned by **#1722** |
| `lgfc-program-queue-and-dependency-map.md` | Queue / dependency-map rules | Current; #1719 continuous chain needs refresh (#1722) |
| `program-1500-queue-wave-reconciliation.md` | #1725 closeout / wave evidence | Historical+current evidence; complete |
| `pmo-july-2026-authority-reconciliation-1720.md` | #1720 authority reconciliation | Current evidence; complete |
| `PMO-V3-OPERATING-MODEL.md` | Superseded operating model | Historical only |
| Program `#1411` / issues `#1417`–`#1424` | Prior planning cycle | Historical only; do not mutate |

## Design-area status (former #1411 areas → #1719 children)

| Design area | Docs status after #1721 | Remaining gap class | Owner |
| --- | --- | --- | --- |
| PMO July 2026 authority | Migrated / reconciled | No action (follow-ups deferred only) | #1720 done; #1727 terminal |
| Workflow automation design migration | Migrated; this inventory | Documentation complete for migration; implementation candidates → #1726 | #1721 (this report) |
| Cursor continuation and queue contract | Partial — still main-centric READY FOR REVIEW language; Model B / continuous reduced-gate not fully encoded | Documentation | **#1722** |
| PR readiness and batch review | Partial process in workflow-automation + PR governance | Documentation (governance) | **#1723** |
| Merge and issue mutation policy | Partial prohibitions exist; no full matrix | Documentation (governance) | **#1724** |
| Queue/wave model and labels | Planning concepts; #1725 reconciled baseline | No action for rebuild; label implementation remains candidate | #1725 done; **#1726** scoped as C-01 (deferred) |
| Post-merge closeout evidence | Baseline satisfied by #1500 | CI maintenance candidates only | #1725 done; **#1726** scoped as C-02–C-05 |
| PMO Backlog promotion | Rules exist in backlog + workflow-automation | Documentation checklist polish | **#1727** / promotion gate in terminal task |

## Gap inventory (classified)

| ID | Gap | Classification | Action |
| --- | --- | --- | --- |
| G-01 | Cursor continuation contract still frames universal stop-at-READY-FOR-REVIEW / human walkthrough without Model B component-auto-integration and continuous reduced-gate serial rules from #1719 | Documentation | **#1722** |
| G-02 | Queue/dependency-map Current Known Truth still carries pre-launch #1411/#1719 phrasing in places | Documentation | **#1722** (light refresh in allowlist) |
| G-03 | PR readiness / batch-review alignment with protected governance review points (#1723/#1724) incomplete | Documentation | **#1723** / **#1724** — component-doc model; obsolete protected-review stop removed |
| G-04 | Issue mutation permission matrix not authoritative across PMO program types | Documentation | **#1724** |
| G-05 | Wave/run labels remain planning concepts (confirmed by #1725) | No action now / Workflow implementation candidate | **#1726** scopes only if accepted |
| G-06 | Runtime umbrella/program closeout classifier not implemented (#1500 deferred) | CI script / Workflow implementation candidate | **#1726** |
| G-07 | Full mechanical `.github/workflows/**` inventory rewrite deferred from #1500 Task 005 | Documentation / CI maintenance | **#1726** candidate; not #1500 reopen |
| G-08 | Orchestrator queue-advance / draft-PR / issue-factory automation exists as-built but is not fully mapped to PMO July 2026 component-project delivery language | Documentation + optional Workflow implementation | Inventory note for **#1726**; no YAML edits in #1721 |
| G-09 | Stale open issues #1417–#1424 still present in GitHub | Configuration / operator hygiene (not Cursor docs mutation) | Separate operator-approved hygiene; do not start from #1721 |
| G-10 | Promotion-to-main path for `component/pmo-governance-workflow-automation` not documented as Program #1719 delivery step | Documentation | **#1727** handoff |

## Read-only workflow / CI surface notes (no edits)

Observed as-built classes relevant to workflow-automation design (non-exhaustive):

| Class | Examples (read-only) | Relation to gaps |
| --- | --- | --- |
| Pre-merge readiness | `gate-post-merge-readiness.yml`, `post_merge_readiness_gate.mjs` | Satisfied by #1500; maintenance only |
| Post-merge closeout owner | `post-merge-closeout.yml` + `scripts/ci/post-merge-closeout/**` | Satisfied by #1500 |
| Queue / orchestrator | `orchestrator-queue-advance.yml`, `orchestrator-draft-pr.yml`, `orchestrator-issue-factory.yml`, `project-implementation-orchestrator.yml` | G-08 |
| Reviewer disposition | `reviewer-response-completion.yml`, disposition scripts | Related to G-01 / G-03 |
| Self-healing CI | `ops-post-merge-self-healing.yml`, self-heal scripts | Adjacent program #1847; out of #1721 scope |
| Docs guardrails | `docs-guardrails.yml`, `docs_check_headers.sh`, `docs_check_paths.sh` | Used by this docs child |

**Explicit non-action:** No workflow YAML or CI script files were modified.

## Successor inputs

### For #1722 (Cursor continuation and queue contract)

1. Encode continuous reduced-gate serial continuation after predecessor merge + clean post-merge / component integration.
2. Distinguish Model B `component-auto-integration` (non-`main` base; no human review handoff between authorized children) from `main` merge authority (Bill/ChatGPT only).
3. Preserve stop conditions for material authority conflict, allowlist overrun, unsafe production/external effect, and unremediable technical failure.
4. Refresh queue/dependency-map #1719 rows to Implementation Active + #1720 complete + #1721 complete.

### For #1726 (implementation candidate scoping only) — complete

See `docs/ops/reports/workflow-ci-implementation-candidate-scoping-1726.md`
(candidates C-01–C-08). No YAML/script edits in `#1726`.

### For #1723 / #1724 / #1727

- G-03 / G-04 closed by `#1723` / `#1724`.
- G-10 / C-07 / C-08 owned by `#1727`.

## Out-of-scope confirmation

- No runtime website code.
- No workflow YAML or CI script implementation.
- No package files.
- No secrets, credentials, production bindings, or irreversible external changes.
- No merge or promotion to `main`.
- No GitHub issue mutation.
- Related/deferred issues (#2294, #2304, #2313, #2323, #2334, #2342) not started.
