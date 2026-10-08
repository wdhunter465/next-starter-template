---
Doc Type: Operations
Audience: Human + AI
Authority Level: Controlled
Owns: Program 1 Task 006 operational health review, cross-track P0/P1/P2 findings, and Program 2/3 follow-up slug recommendations
Does Not Own: GitHub issue state changes, workflow behavior changes, or Program 2 launch authorization
Canonical Reference: /docs/ops/implementation-plans/program-1-phase1-wrapup-rollout.md
Related issues: #1344, #1335, #1058, #1132, #1255
Last Reviewed: 2026-06-06
---

# Program 1 Operational Health Review

## Purpose

Synthesize Program 1 Tasks 002–005 closeout evidence with live repository signals
as of **2026-06-05** for Task 006 (`#1344`). This review records prioritized
findings only. It does **not** implement fixes or close GitHub issues.

## Boundary Statement

This task is **documentation and classification only**.

- No application code, workflow YAML, or branch protection changes
- No GitHub issue closure or label mutation by this report
- P0 items block Program 2 launch gate (`#1346`) unless explicitly waived with
  rationale in Task 008

## Assessment Baseline

| Source | Task | Role |
|---|---|---|
| CI as-built closeout | Task 002 / `#1340` | `docs/ops/program-1-task-002-ci-closeout-evidence.md`, `docs/reference/ci/lgfc-ci-as-built-reconciliation.md` |
| Website as-built reconciliation | Task 003 / `#1341` | `docs/reference/website/lgfc-website-as-built-reconciliation.md` |
| DIATAXIS transition status | Task 004 / `#1342` | `docs/ops/reports/program-1-diataxis-transition-status.md` |
| OPS monitoring snapshot | Task 005 / `#1343` | `docs/ops/reports/program-1-ops-monitoring-snapshot.md` |
| Program 1 plan | `#1335` | `docs/ops/implementation-plans/program-1-phase1-wrapup-rollout.md` |

Live signal capture date: **2026-06-05** (post Task 005 merge `05784fa`).

## Live Repository Signals

| Signal | Observation | Evidence |
|---|---|---|
| Workflow file count | **60** `*.yml` files under `.github/workflows/` | `find .github/workflows -name '*.yml' \| wc -l` on `main` |
| Workflow inventory doc | **54** workflows recorded | `docs/reference/ci/workflow-inventory.md` (stale as of 2026-06-03) |
| Open post-merge-failure issues | **34** open | GitHub search `label:post-merge-failure is:open` |
| Program 1 queue | Tasks 002–005 closed complete; `#1344` carries both `status:blocked` and `status:implementation` | issue labels on `#1340`–`#1345` |
| Open CI redesign closeout orphans | `#1011`, `#1009`, `#1199` still open per Task 002 evidence | `docs/ops/program-1-task-002-ci-closeout-evidence.md` |
| DIATAXIS repo-wide header check | Fails on pre-existing template only | Task 004 disclosure; changed files pass per-file checks |
| OPS runtime inventory | 7 workflows in `OPS_RUNTIME_SURFACE`; 5 audit gaps recorded | Task 005 snapshot gap register |

## Cross-Track Health Summary

| Surface | Phase 1 closeout state | Residual health |
|---|---|---|
| **CI** | Redesign Tasks 001–006 merged; Program 1 Task 002 evidence on `main` | Post-merge remediation backlog; inventory drift; open redesign orphan issues |
| **Website** | As-built reconciliation doc landed (Task 003) | Tracker/GitHub lifecycle drift; T43+ backlog under `#1255` |
| **Docs** | DIATAXIS status report + mapping populated (Task 004) | Legacy root migration deferred; header gaps on `PROMPTS/` and template |
| **OPS** | Runtime surface matrix + gap register (Task 005) | Soft-fail assess, duplicate nightly, manual CF retry, launch-readiness not scheduled |

Overall Phase 1 **documentation closeout is on track**. Residual risk concentrates in
**CI post-merge governance churn** and **OPS runtime observability gaps**, not in
missing as-built surfaces for Tasks 002–005.

## Findings Register

Each row lists one finding, severity, affected surface, evidence, and a **single**
recommended follow-up issue slug for Program 2 or Program 3 disposition.

### P0 — Blocks Program 2 launch gate unless waived in Task 008

| ID | Finding | Surface | Evidence | Recommended slug |
|---|---|---|---|---|
| H-001 | **Post-merge remediation issue backlog** — 34 open `post-merge-failure` issues indicate repeated metadata validator failures and closeout-chain drift; operators cannot treat post-merge state as stable | CI | GitHub search 2026-06-05; closeout pattern in PRs `#1367`–`#1371`; `docs/reference/ci/post-merge-validation-surface.md` | `#1058` — Program 2 CI maintenance umbrella (pre-merge blocking + post-merge verify-only redesign) |
| H-002 | **OPS assessment soft-fail masks runtime failures** — `ops-assess.yml` uses `continue-on-error: true`; scheduled health signal may show green while assessment failed | OPS | `docs/ops/reports/program-1-ops-monitoring-snapshot.md` (Known Audit Gaps); `ops-assess.yml` on `main` | `#1058` — OPS hardening under CI Phase 2 maintenance plan |
| H-003 | **Open CI redesign closeout orphans** — `#1011`, `#1009`, `#1199` remain open despite merged redesign evidence; obscures true CI program state | CI | `docs/ops/program-1-task-002-ci-closeout-evidence.md` (Open row); merge PRs `#1239`, `#1244` | `#1058` — ChatGPT closeout batch under Program 2 CI maintenance (or program-owner waiver recorded in `#1346`) |

### P1 — Should be dispositioned before or during Program 2 activation

| ID | Finding | Surface | Evidence | Recommended slug |
|---|---|---|---|---|
| H-004 | **Workflow inventory drift** — inventory doc claims 54 workflows; repository has 60 YAML workflows | CI | `docs/reference/ci/workflow-inventory.md` vs live count; `docs/reference/ci/lgfc-ci-as-built-reconciliation.md` deferral note | `#1276` — Phase 2 Task 005 workflow inventory table rewrite |
| H-005 | **Duplicate nightly assessment workflows** — `assess-nightly.yml` and `ops-assess.yml` overlap at 02:00 UTC | OPS | Task 005 gap register; both workflows on `main` | `#1275` — Phase 2 Task 004 legacy workflow retirement |
| H-006 | **Website tracker vs GitHub lifecycle drift** — merged T-task evidence conflicts with stale queue snapshots and open legacy issues | Website | `lgfc-website-as-built-reconciliation.md` (T21–T23, #943–#1017 disposition); stale tracker banners | `#1255` — Website program umbrella (Phase 0 reconciliation batch) |
| H-007 | **Post-merge closeout two-PR pattern** — body remediation lands via follow-on PR; automatic closeout validates wrong PR number | CI | Task 004/005 closeout chain `#1368`–`#1371`; `scripts/ci/post-merge-closeout/pr-*-body.md` pattern | `#1058` — CI Phase 2 post-merge redesign (same program as H-001) |

### P2 — Defer to Program 2 or Program 3 without blocking launch gate

| ID | Finding | Surface | Evidence | Recommended slug |
|---|---|---|---|---|
| H-008 | **DIATAXIS legacy root migration incomplete** — `ops/ai/`, `governance/ai/`, `PROMPTS/` remain live at legacy paths | Docs | `program-1-diataxis-transition-status.md`; `DIATAXIS-MAPPING.md` | `#1132` — documentation-remediation workstream (Program 3) |
| H-009 | **Pre-existing repo-wide header check failure** — `docs/templates/ai-build-issue-template.md` missing required header fence | Docs | Task 004 disclosure; `./scripts/ci/docs_check_headers.sh .` | `#1132` — Program 3 documentation remediation |
| H-010 | **Manual-only Cloudflare Pages retry** — no automatic hook on deploy failure | OPS | Task 005 gap register; `ops-cf-pages-retry.yml` trigger class | `#1058` — OPS automation candidate (Task 007 input) |
| H-011 | **Launch-readiness e2e not scheduled** — specs exist; no scheduled CI workflow | OPS / Website | Task 005 gap register; T50 queued under `#1112` | `#1112` — T50 launch readiness (Program 2 QA track) |
| H-012 | **Design-compliance OPS audit absent from runtime surface validator** — inventory drift between ops docs and `ops_runtime_surface.mjs` | OPS | Task 005 gap register; `ops-design-compliance-audit.yml` | `#1058` — extend OPS runtime inventory or document exclusion |
| H-013 | **PMO portfolio worklist lag** — worklist still listed Task 003 as next eligible after Tasks 002–005 merged | Governance | `docs/ops/pmo/program-portfolio-worklist.md` (pre–Task 006) | `#1345` — Task 007 automation backlog (PMO portfolio sync candidate) |
| H-014 | **Program 1 queue label conflict on `#1344`** — simultaneous `status:blocked` and `status:implementation` | Governance | GitHub issue `#1344` issue labels 2026-06-05 | `#1058` — Program 2 orchestration maintenance (queue label reconciliation) |

## Program 2 vs Program 3 Routing Summary

| Program | Primary findings | Count |
|---|---|---|
| **Program 2** (`#1058`, `#1255`, `#1273`–`#1276`, `#1112`, `#1345`) | H-001 through H-007, H-010 through H-014 | 12 |
| **Program 3** (`#1132`) | H-008, H-009 | 2 |
| **Program 1 launch gate** (`#1346`) | P0 waivers only (H-001 through H-003) | — |

Task 007 (`#1345`) should expand H-010, H-012, and automation opportunities into
the formal automation backlog. Task 008 (`#1346`) must address P0 items or record
explicit waivers before Program 2 authorization.

## Validation Commands

Task 006 validation (same as issue `#1344`):

```bash
./scripts/ci/docs_check_headers.sh \
  docs/ops/reports/program-1-operational-health-review.md \
  docs/ops/pmo/program-portfolio-worklist.md \
  docs/ops/pmo/parallel-agent-rules.md
./scripts/ci/docs_canonical_hashes_verify.sh .
```

Repo-wide `./scripts/ci/docs_check_headers.sh .` may fail on pre-existing
`docs/templates/ai-build-issue-template.md` (out of scope; disclosed in Task 004).

## Related References

- Program 1 plan Task 006: `docs/ops/implementation-plans/program-1-phase1-wrapup-rollout.md`
- PMO critical path: `docs/ops/pmo/critical-path.md`
- CI Phase 2 maintenance: `docs/ops/implementation-plans/issue-1075-ci-phase2-closeout-rollout.md`
- Post-merge validation surface: `docs/reference/ci/post-merge-validation-surface.md`
