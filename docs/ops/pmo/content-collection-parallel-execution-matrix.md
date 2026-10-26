---
Doc Type: Operations
Audience: Bill, Governance, Cursor, LGFC maintainers
Authority Level: Operational Plan (non-authoritative until linked from program issue)
Owns: Pairwise parallel matrix, per-lane file allowlists, hot zones, freeze marker, merge order, and review throttle
Does Not Own: Merge authorization, GitHub issue creation, or CI workflow implementation
Canonical Reference: /docs/ops/reports/content-collection-docs-audit-dedup-2360.md
Related Issues: #2363, #2359, #2360, #4776
Last Reviewed: 2026-10-26
---

# Content Collection Parallel Execution Matrix and File Allowlist Plan

## Purpose

Define safe parallel Cursor Local sessions for Content Collection without file conflicts, dependency churn, or PR queue overload.

## Scope

Owns lane definitions (P1–P6), concurrency ceilings, pairwise matrix, freeze marker, per-lane file allowlists, hot zones, merge order, and PR review throttle.

Does not own merge authorization, GitHub issue creation, or CI workflow implementation.

## Current known truth

- Cursor is the sole LGFC implementation executor; Codex is inactive.
- Default max concurrent sessions: 3; exceptional: 4 with disjoint allowlists.
- Gallery/Library/Memorabilia parallel code work requires `CONTRACT-FROZEN: content-asset-model v1`.
- Package docs live under `docs/ops/implementation-plans/content-collection/packages/`.

## Intended final state

Every parallel implementation task cites lane ID, file allowlist, hot-zone halt rules, and review throttle before work begins.

## Lane definitions

| Lane | Title |
| --- | --- |
| P1 | Content Asset Model (CC-001/CC-002) |
| P2 | Gallery (`/fanclub/photo`) |
| P3 | Library (`/fanclub/library`) |
| P4 | Memorabilia (`/fanclub/memorabilia`) |
| P5 | Club Newspaper (`/fanclub`) |
| P6 | CI Orchestration |

## Concurrency ceilings

| Phase | Max sessions |
| --- | ---: |
| Phase 0 docs | 1 |
| Phase 1 foundation | 1–2 |
| Phase 3 surfaces (post-freeze) | 3 |
| Exceptional | 4 |

Six simultaneous full implementation sessions at launch is **not** authorized.

## Pairwise matrix

| A | B | Result |
| --- | --- | --- |
| P1 | P2/P3/P4 | SERIAL |
| P1 | P5 | CONDITIONAL |
| P1 | P6 | CONDITIONAL (docs/read-only OK) |
| P2 | P3 | SAFE after freeze |
| P2 | P4 | SAFE after freeze |
| P3 | P4 | SAFE after freeze |
| P2/P3/P4 | P5 | CONDITIONAL — shell risk |
| P6 workflow impl | P2–P5 | SERIAL |

## Freeze marker

Before P2/P3/P4 **code** work:

```text
CONTRACT-FROZEN: content-asset-model v1
```

Must cite source issue, package path, PR/commit, downstream lanes released, and Product Authority authorization.

## Per-lane allowlists (repo-verified)

### P1 — Content Asset Model

- `docs/reference/content/lgfc-content-candidate-model.md`
- `docs/reference/content/content-pipeline-storage-model.md`
- `docs/reference/website/lou-gehrig-*` (metadata, provenance, rights)
- `docs/ops/implementation-plans/content-collection/packages/cc-001-*.md`
- `docs/ops/implementation-plans/content-collection/packages/cc-002-*.md`
- `functions/_lib/content-pipeline-*.ts`
- `migrations/*content*`
- `tests/content-pipeline-*.test.ts`

### P2 — Gallery

- `src/app/fanclub/photo/**`
- `tests/*gallery*`, `tests/*photo*`
- `docs/ops/implementation-plans/content-collection/packages/gal-001-gallery-package.md`

Do not touch: library/memorabilia routes, `fanclub/page.tsx`, `layout.tsx`, `fanclubApi.ts`, `fanclubGridStyles.*`, `content-pipeline-*`.

### P3 — Library

- `src/app/fanclub/library/**`
- `functions/api/library/**`
- `tests/*library*`
- `docs/ops/implementation-plans/content-collection/packages/lib-001-library-package.md`

### P4 — Memorabilia

- `src/app/fanclub/memorabilia/**`
- `tests/*memorabilia*`
- `docs/ops/implementation-plans/content-collection/packages/mem-001-memorabilia-package.md`

### P5 — Club Newspaper

- `src/app/fanclub/page.tsx`
- `src/components/fanclub/ClubHome*.tsx`
- `docs/ops/implementation-plans/content-collection/packages/club-001-club-newspaper-design-package.md`

Start only after shared fanclub shell risk is controlled.

### P6 — CI Orchestration

Docs/read-only: `docs/reference/ci/**`, CI package docs, Stage 0 gap analysis plan.

Workflow/script (serialize): `.github/workflows/*`, `scripts/ci/**`, `scripts/orchestrator/**`.

## Shared hot zones

Single-lane-at-a-time unless Product Authority authorizes an exception:

- `functions/_lib/content-pipeline-*.ts`
- `src/app/fanclub/layout.tsx`, `src/app/fanclub/page.tsx`
- `src/lib/fanclubApi.ts`
- `src/components/fanclub/fanclubGridStyles.*`
- `.github/workflows/*`, `scripts/ci/**`, `scripts/orchestrator/**`

Check open PRs: `gh pr list --state open`

## Issue parallel-control block

```text
Parallel Execution Control:
- parallel_safe: true|false|conditional
- max_active_tasks_in_lane: 1
- contract_dependency: [P1 content-asset-model v1 / none]
- required_freeze_marker: [CONTRACT-FROZEN: content-asset-model v1 / none]
- file_allowlist: [paths]
- halt_if_open_pr_touches: [paths]
- allowed_parallel_lanes: [lanes]
- prohibited_parallel_lanes: [lanes]
- collision_action: pause until PR merge/close/conflict resolution
```

Issue-body packs remain GitHub-only per #2360 — paste this block when Bill authorizes issue creation.

## Merge order

1. P1 content model + rights contracts
2. P6 workflow changes if required for PR/closeout
3. P2/P3/P4 after freeze
4. P5 after shell risk controlled
5. VAL-001 / as-built closeout

## PR review throttle

Maximum **READY FOR REVIEW** PRs: **2–3**.

## Failure conditions

Stop or reduce parallelism when allowlists overlap, contracts drift after dependents start, P6 interferes with feature PRs, or hot zones collide.

## Related documents

- `docs/how-to/ops/cursor-parallel-worktree-standard.md`
- `docs/ops/pmo/content-collection-launch-readiness-checklist.md`
