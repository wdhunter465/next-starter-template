---
Doc Type: Implementation Plan
Audience: Bill, ChatGPT, Cursor, LGFC maintainers, implementation agents
Authority Level: Operational Plan
Owns: Index, asset inventory, promotion-status tracking, and Phase 1 preparation routing for Content Collection packages, control documents, and support documents
Does Not Own: Canonical content model, governance law, runtime implementation, launch authorization, or merge authority
Canonical Reference: /docs/ops/reports/content-collection-docs-audit-dedup-2360.md
Related Issues: #2365, #2361, #2362, #2363, #2364, #2359, #2360, #1738, #2286, #2431, #2432, #2433, #2434, #2435, #2436, #2437, #2438
Last Reviewed: 2026-08-22
---

# Content Collection Package Index

## Purpose

Navigate Content Collection implementation packages enriched from Drive intake drafts under `_incoming/drive-drafts/content-collection/` and now promoted into repository-operational planning docs.

These are **operational envelopes** for future Cursor tasks. They become executable only when a scoped GitHub Issue authorizes work and Bill / ChatGPT approve the relevant launch gate.

**Phase 0 closeout:** `docs/ops/reports/content-collection-phase0-promotion-closeout-2365.md`

**Phase 1 prep:** `docs/ops/implementation-plans/content-collection/phase1-launch-prep.md`

**Phase 1 closed complete (2026-07-22); post-closeout status:**
`docs/ops/reports/content-collection-phase1-post-closeout-status-review.md`

## Foundation packages (#2361)

| Package ID | Document | Phase | Blocks feature lanes | Status | PR |
| --- | --- | --- | --- | --- | --- |
| CC-001 | [cc-001-content-asset-model-package.md](./packages/cc-001-content-asset-model-package.md) | P0→P1 | **Yes** — until `CONTRACT-FROZEN: content-asset-model v1` | `validated` | #2405 |
| CC-002 | [cc-002-provenance-rights-contract-package.md](./packages/cc-002-provenance-rights-contract-package.md) | P0→P1 | **Yes** — public/member display enforcement | `validated` | #2405 |
| CI-001 | [ci-001-pr-body-generator-package.md](./packages/ci-001-pr-body-generator-package.md) | P1 | No — tooling gated by Stage 0 | `validated` | #2405 |
| CI-002 | [ci-002-admin-closeout-auto-repair-package.md](./packages/ci-002-admin-closeout-auto-repair-package.md) | P1 | No — admin boundary / CI tooling | `validated` | #2405 |
| VAL-001 | [val-001-integrated-program-validation-package.md](./packages/val-001-integrated-program-validation-package.md) | P1 terminal / P4 program closeout | Terminal closeout | `validated` | #2405 |

## Feature packages (#2362)

| Package ID | Document | Route | Blocked until freeze | Status | PR |
| --- | --- | --- | --- | --- | --- |
| GAL-001 | [gal-001-gallery-package.md](./packages/gal-001-gallery-package.md) | `/fanclub/photo` | **Yes** — CC-001/CC-002 freeze | `validated` | #2415 |
| LIB-001 | [lib-001-library-package.md](./packages/lib-001-library-package.md) | `/fanclub/library` | **Yes** | `validated` | #2415 |
| MEM-001 | [mem-001-memorabilia-package.md](./packages/mem-001-memorabilia-package.md) | `/fanclub/memorabilia` | **Yes** | `validated` | #2415 |
| CLUB-001 | [club-001-club-newspaper-design-package.md](./packages/club-001-club-newspaper-design-package.md) | `/fanclub` | **Conditional** — shell risk | `validated` | #2415 |

## Control documents (#2363)

| Doc ID | Title | Path | Status | PR |
| --- | --- | --- | --- | --- |
| CTRL-001 | Launch Readiness Checklist | [content-collection-launch-readiness-checklist.md](../../pmo/content-collection-launch-readiness-checklist.md) | `validated` | #2420 |
| CTRL-002 | Diataxis Promotion Map | [content-collection-diataxis-promotion-map.md](../../pmo/content-collection-diataxis-promotion-map.md) | `validated` | #2420, #2427 |
| CTRL-003 | Parallel Execution Matrix | [content-collection-parallel-execution-matrix.md](../../pmo/content-collection-parallel-execution-matrix.md) | `validated` | #2420 |
| CTRL-004 | Cursor Parallel Worktree Standard | [cursor-parallel-worktree-standard.md](../../../how-to/ops/cursor-parallel-worktree-standard.md) | `validated` | #2420 |
| CTRL-005 | Program Closeout Template | [content-collection-program-closeout-template.md](../../pmo/content-collection-program-closeout-template.md) | `validated` | #2420 |
| CTRL-006 | Dedup / Merge Plan | [content-collection-docs-audit-dedup-2360.md](../../reports/content-collection-docs-audit-dedup-2360.md) | `complete` | #2372 |
| CTRL-007 | Phase 0 Closeout Report | [content-collection-phase0-promotion-closeout-2365.md](../../reports/content-collection-phase0-promotion-closeout-2365.md) | `validated` | #2427 |
| CTRL-008 | Phase 1 Launch Prep | [phase1-launch-prep.md](./phase1-launch-prep.md) | `prepared` | #2431 prep PR |

## Support documents (#2364)

| Doc ID | Title | Path | Status | PR |
| --- | --- | --- | --- | --- |
| SUP-001 | Support docs index | [support-docs-index.md](./support/support-docs-index.md) | `validated` | #2419 |
| SUP-002 | Label/status mapping addendum | [github-label-status-mapping-addendum.md](./support/github-label-status-mapping-addendum.md) | `validated` | #2419, #2424 |
| SUP-003 | Cursor assignment prompt pack | [cursor-assignment-prompt-pack.md](./support/cursor-assignment-prompt-pack.md) | `validated` | #2419, #2424 |
| SUP-004 | Review throttle / PR queue standard | [review-throttle-pr-queue-standard.md](./support/review-throttle-pr-queue-standard.md) | `validated` | #2419, #2424 |
| SUP-005 | Deferred work register | [deferred-work-register.md](./support/deferred-work-register.md) | `validated` | #2419, #2424, #2427 |
| SUP-006 | Risk register | [risk-register.md](./support/risk-register.md) | `validated` | #2419, #2424 |

## Phase 1 issue graph (closed complete 2026-07-22)

| Order | Issue | Title | Package / lane | Launch state |
| ---: | --- | --- | --- | --- |
| 0 | #2432 | Phase 1 Gate 0 — Readiness Reconciliation and Stale-State Repair | Gate 0 | Closed complete — PR #2674 |
| 1 | #2433 | CC-001 Content Asset Contract Freeze | CC-001 / P1 | Closed complete — PR #2675; `CONTRACT-FROZEN: content-asset-model v1` verified |
| 2 | #2434 | CC-002 Provenance Rights and Publication Contract Freeze | CC-002 / P1 | Closed complete — PR #2684; `CONTRACT-FROZEN: provenance-rights-publication v1` verified |
| 3 | #2435 | CI Stage 0 Current-State Gap Analysis | CI Stage 0 / P6 | Closed complete — PR #2685 |
| 4 | #2436 | CI-001 PR Body Generator Preclearance Tooling | CI-001 / P6 | Closed complete — PR #2704, #2729 |
| 5 | #2437 | CI-002 Admin Closeout Auto-Repair Boundary | CI-002 / P6 | Closed complete (dry-run only) — PR #2738, #2742 |
| 6 | #2438 | Validation Closeout and Downstream Release Recommendation | VAL-001 | Closed complete — PR #2749, #2750; **CONDITIONAL GO** for explicit GAL/LIB/MEM child issues, **NO-GO** for automatic launch |

All Phase 1 evidence above lives on `component/content-collection-phase1`, which has not been promoted to
`main`. See `docs/ops/reports/content-collection-phase1-post-closeout-status-review.md` for the current gap
and next-step recommendations, including that no GAL-001/LIB-001/MEM-001/CLUB-001 implementation issue has
been opened as of 2026-08-22 despite the CONDITIONAL GO.

## GitHub-only (not repo docs)

| Intake draft | Use |
| --- | --- |
| Project Lane Issue Body Pack | Paste parallel-control blocks from parallel matrix when Bill authorizes |
| Per-Lane Task Issue Body Pack | Paste per-task bodies when Bill authorizes |

## Current known truth

- Phase 0 docs promotion (#2360–#2365) completed via PR #2427.
- Phase 1 (#2431) and its child issue set #2432–#2438 are **closed complete** (2026-07-22). See the
  Phase 1 issue graph table above and
  `docs/ops/reports/content-collection-phase1-post-closeout-status-review.md`.
- Both freeze markers are independently verified: `CONTRACT-FROZEN: content-asset-model v1` (#2433) and
  `CONTRACT-FROZEN: provenance-rights-publication v1` (#2434).
- Downstream recommendation from #2438 is **CONDITIONAL GO** for opening explicit GAL/LIB/MEM child issues
  and **NO-GO** for automatic launch. No such child issue has been opened as of 2026-08-22.
- `component/content-collection-phase1` has not been promoted to `main`; that promotion decision is open.
- Rejected target roots remain `docs/ops/programs/` and `docs/reference/website/content-collection/` per #2360.
- All four feature routes **exist** on `main` with member auth; packages document gaps vs CC-001/CC-002 and
  implementation allowlists. No GAL/LIB/MEM/CLUB feature-lane code has been implemented under Phase 1.
- Intake `.docx` remains on `ChatGPT/drive-draft-intake-2367` only.
- CI-001 / CI-002 dry-run tooling is complete for Phase 1 scope; CI-002 apply mode remains deferred (D-009).

## Source intake mapping

| Intake draft | Enriched package doc |
| --- | --- |
| `CC-001 … Draft.docx` | `packages/cc-001-content-asset-model-package.md` |
| `CC-002 … Draft.docx` | `packages/cc-002-provenance-rights-contract-package.md` |
| `CI-001 … Draft.docx` | `packages/ci-001-pr-body-generator-package.md` |
| `CI-002 … Draft.docx` | `packages/ci-002-admin-closeout-auto-repair-package.md` |
| `VAL-001 … Draft.docx` | `packages/val-001-integrated-program-validation-package.md` |
| `GAL-001 … Draft.docx` | `packages/gal-001-gallery-package.md` |
| `LIB-001 … Draft.docx` | `packages/lib-001-library-package.md` |
| `MEM-001 … Draft.docx` | `packages/mem-001-memorabilia-package.md` |
| `CLUB-001 … Draft.docx` | `packages/club-001-club-newspaper-design-package.md` |
| `LGFC Launch Readiness Checklist v2 …` | `docs/ops/pmo/content-collection-launch-readiness-checklist.md` |
| `LGFC Parallel Execution Matrix …` | `docs/ops/pmo/content-collection-parallel-execution-matrix.md` |
| `LGFC Cursor Parallel Worktree …` | `docs/how-to/ops/cursor-parallel-worktree-standard.md` |
| `LGFC Program Closeout …` | `docs/ops/pmo/content-collection-program-closeout-template.md` |
| `LGFC Diataxis Promotion Map …` | `docs/ops/pmo/content-collection-diataxis-promotion-map.md` |
| `LGFC GitHub Label and Status Mapping Addendum …` | `support/github-label-status-mapping-addendum.md` |
| `LGFC Cursor Assignment Prompt Pack …` | `support/cursor-assignment-prompt-pack.md` |
| `LGFC Review Throttle and PR Queue Standard …` | `support/review-throttle-pr-queue-standard.md` |
| `LGFC Deferred Work Register …` | `support/deferred-work-register.md` |
| `LGFC Risk Register …` | `support/risk-register.md` |
| `LGFC Package Index …` | This document |
| `LGFC Documentation Dedup …` | `docs/ops/reports/content-collection-docs-audit-dedup-2360.md` |

## Procedure

1. Read #2360 audit disposition before implementation.
2. Read `phase1-launch-prep.md` and #2431 before Phase 1 Go / NoGo.
3. Open the package or control/support doc for the assigned child issue.
4. Re-verify paths on `main` before edits.
5. Respect `CONTRACT-FROZEN: content-asset-model v1` for GAL/LIB/MEM code PRs.
6. Serialize CLUB-001 shell edits with other fanclub lanes.
7. Post `CHATGPT HANDOFF` when authority conflicts remain.

## Execution

Package, control, and support enrichment (#2361–#2364) completed at Phase 0 docs. Phase 1 issues
#2431–#2438 executed and closed complete on `component/content-collection-phase1` (2026-07-22); that
branch is not yet promoted to `main`. Feature-lane code implementation (GAL/LIB/MEM/CLUB) still requires a
launched child issue with an explicit allowlist and validation plan — the Phase 1 CONDITIONAL GO does not
by itself authorize it.
