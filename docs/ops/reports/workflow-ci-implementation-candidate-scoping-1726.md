---
Doc Type: Operations
Audience: Bill, Atlas, Cursor, LGFC maintainers, and reviewers
Authority Level: Controlled
Owns: Task #1726 durable workflow/CI implementation-candidate scoping matrix separating docs-only, workflow YAML, and script-sensitive work for Program #1719 successors
Does Not Own: Workflow YAML edits, CI script edits, runtime code, secrets, unauthorized issue mutation, Cursor self-merge, or automatic merge to main
Canonical Reference: /docs/ops/pmo/workflow-automation.md
Related Issues: #1726, #1719, #1721, #1725, #1724, #1727, #1500
Last Reviewed: 2026-08-18
---

# Workflow / CI Implementation Candidate Scoping (#1726)

## Purpose

Convert remaining automation gaps from Task `#1721` (and `#1500` deferred
register items consumed by `#1725`) into **bounded future implementation
candidates**, explicitly separating:

1. **Docs-only** work (writable under documentation allowlists);
2. **Workflow YAML** work (`.github/workflows/**` — requires a future source issue);
3. **CI script-sensitive** work (`scripts/ci/**` — requires a future source issue).

This task does **not** edit workflow YAML or CI scripts. Surfaces below were
inspected **read-only**.

Assessment date: **2026-07-16**.
Read-only counts: **62** workflow files under `.github/workflows/`; **70**
entries under `scripts/ci/` (including `post-merge-closeout/`).

## Scope

This report owns the Task #1726 candidate matrix that separates docs-only, workflow YAML, and CI-script work for Program #1719 successors. It does not edit workflow YAML, CI scripts, runtime code, or GitHub issue state.

## Current known truth

Remaining automation gaps from #1721 / #1500 are classified into bounded future candidates. This task inspected `.github/workflows/**` and `scripts/ci/**` read-only and did not implement those surfaces.

## Intended final state

Successor issues can launch from this matrix without inferring class, owner, or non-action from chat history.

## Authority and delivery model

| Level | Surface | Meaning |
| --- | --- | --- |
| Project construction | `component/pmo-governance-workflow-automation` | Authority for Program `#1719` construction docs |
| Repository-wide | `main` | Authority after Bill/ChatGPT-approved promotion |

This child uses Model B / `component-auto-integration`. No intermediate human
gate solely for documentation. No automatic merge to `main`.

Predecessor for Program `#1719` execution: `#1724` complete; `#1725` remains
complete and is **not** rerun (issue `#1726` body still lists `#1725` as
predecessor historically; continuous chain skips rerun).

## Candidate matrix

| ID | Candidate | Class | Recommended future owner | Launch prerequisite | Explicit non-action now |
| --- | --- | --- | --- | --- | --- |
| C-01 | Wave / run label automation (G-05) | Workflow YAML (+ optional script helpers) | New CI/PMO source issue after Bill acceptance that labels become real | Design fields in `workflow-automation.md` wave section; non-interference with `#1255` | Keep as planning concepts |
| C-02 | Runtime umbrella / program closeout classifier (G-06) | CI script (+ possible workflow hook) | New CI hardening source issue | Closeout protocol remains policy truth; classifier is additive safety | Do not reopen `#1500` |
| C-03 | Mechanical `.github/workflows/**` inventory rewrite (G-07) | Docs-only first, then optional CI maintenance | Docs child or CI docs issue; YAML retirement only via separate issue | Start from `#1500` Task 005 inventory excerpt; expand mechanically | No mass YAML delete/rename here |
| C-04 | Orchestrator ↔ PMO July 2026 component-project mapping (G-08) | Docs-only first; Workflow only if behavior must change | Docs mapping in `#1727` or follow-on; YAML only if gaps are behavioral | Map `orchestrator-*.yml` + `project-implementation-orchestrator.yml` to Model B language | No orchestrator YAML edits in `#1726` |
| C-05 | Preview-isolation mutating-handler inventory gap (`functions/api/matchup/repair.ts` missing from `scripts/ci/preview-isolation-manifest.json`) | CI script (manifest) | New CI maintenance source issue | Unblocks `quality` unit test on component children | Outside `#1719` docs allowlists; do not fix from `#1726` |
| C-06 | Stale historical issues `#1417`–`#1424` hygiene (G-09) | Operator / configuration | Bill/Atlas-approved hygiene package | Evidence-only; no Cursor mutation from `#1719` docs tasks | Leave open until operator package |
| C-07 | Program `#1719` promotion-to-`main` handoff package (G-10) | Docs-only | **#1727** | Component chain complete or dispositioned | Owned by terminal task |
| C-08 | Implementation-plan residual “protected governance review” dependency wording | Docs-only | **#1727** (allowlist includes scoped `docs/ops/implementation-plans/**`) | Align plan with `#1723`/`#1724` component-doc model | Outside `#1726` writable allowlist |

## Classification rules (for future issues)

| Class | Writable paths | Required approval notes |
| --- | --- | --- |
| Docs-only | Named `docs/**` allowlist | Component-auto-integration OK on project branch; promotion to `main` needs Bill/ChatGPT |
| Workflow YAML | `.github/workflows/**` | Explicit source issue; trusted review expectations; never inferred from docs tasks |
| CI script-sensitive | `scripts/ci/**` | Explicit source issue; same trusted-review bar; prefer smallest script change |
| Mixed | Split into separate PRs / issues | Do not mix workflow YAML with unrelated docs in one PR |

## Read-only surface inventory (summary)

| Class | Example surfaces (read-only) | Candidate link |
| --- | --- | --- |
| Pre-merge readiness | `gate-post-merge-readiness.yml`, `post_merge_readiness_gate.mjs` | Baseline satisfied (`#1500`); maintenance only |
| Post-merge closeout owner | `post-merge-closeout.yml`, `scripts/ci/post-merge-closeout/**` | Baseline satisfied; C-02 additive |
| Component child gates | `component-child-integration.yml`, `component_integration_eligibility.mjs` | Related to Model B; no edit here |
| Queue / orchestrator | `orchestrator-queue-advance.yml`, `orchestrator-draft-pr.yml`, `orchestrator-issue-factory.yml`, `project-implementation-orchestrator.yml` | C-04 |
| Reviewer disposition | `reviewer-response-completion.yml`, `reviewer_*.mjs` | Maintenance only unless new issue |
| Preview isolation | `preview-invariants.yml`, `preview-isolation-manifest.json` | C-05 |
| Docs guardrails | `docs-guardrails.yml`, `docs_check_headers.sh`, `docs_check_paths.sh` | Used by docs children |
| Label / intent helpers | `gate-intent-labeler.yml`, `ops-stale-issue-label-cleanup.yml` | Adjacent to C-01; do not expand |

**Explicit non-action:** No `.github/workflows/**` or `scripts/ci/**` files were modified.

## Gap disposition update (from #1721)

| Gap | Disposition after #1726 |
| --- | --- |
| G-01 / G-02 | Closed by `#1722` (docs) |
| G-03 / G-04 | Closed by `#1723` / `#1724` (docs; component-doc model) |
| G-05 | Candidate **C-01** — deferred pending acceptance |
| G-06 | Candidate **C-02** — deferred to new CI issue |
| G-07 | Candidate **C-03** — deferred |
| G-08 | Candidate **C-04** — docs mapping preferred first |
| G-09 | Candidate **C-06** — operator hygiene |
| G-10 | Candidate **C-07** — `#1727` |

## Successor

After this PR’s technical component integration succeeds, begin Task `#1727`
(program closeout and launch-control package). Do not implement C-01–C-05 from
`#1727` unless that issue’s allowlist explicitly authorizes the class.

## Out of scope

- Runtime / website / package files
- Workflow YAML or CI script edits
- Unauthorized issue mutation
- Cursor approval or merge to `main`
- Automatic merge to `main`
- Rerunning `#1725`
