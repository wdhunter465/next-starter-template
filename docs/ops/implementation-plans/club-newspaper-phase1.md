---
Doc Type: Implementation Plan
Audience: Bill, ChatGPT / Atlas / WORK, Cursor, Claude Code, LGFC maintainers, and reviewers
Authority Level: Operational
Owns: Club Newspaper Phase 1 master Issue specification, ordered child graph (P1-01…P1-10), proposed branches/scopes/dependencies/collision controls, migration/test/rollout/rollback/Production-verification/operator-handoff envelopes, minimum visible runtime slice, and serial release sequence
Does Not Own: Phase 0 aggregate acceptance decision, fabricating #2464 findings, canonical Phase 0 contracts (#2662/#2663/#2664), Production Go, or self-approval of runtime PRs
Canonical Reference: /docs/ops/reports/club-newspaper-phase0-acceptance-2665.md
Related Issues: #2461, #2463, #2464, #2661, #2662, #2663, #2664, #2934, #2665, #3055
Last Reviewed: 2026-08-12
---

# Club Newspaper Phase 1 Implementation Launch Package

## Purpose

Define a complete, chat-independent Phase 1 Development launch package from accepted Phase 0 authority (#2661–#2664), #2934 (complete), and the Product Authority waiver of external advisory #2464 — so WORK can create/release serial children without inference. This document does **not** authorize Production.

## Scope

In scope: master Issue specification; ordered child graph with exact proposed file scopes; branches; dependencies; collision controls; migrations; tests; rollout; rollback; Production verification; operator handoff; minimum visible runtime slice; serial release sequence; Development GO / Production HOLD.

Out of scope: inventing #2464 recommendations; editing canonical design/ops docs in this PR; implementing runtime in this documentation increment; Production merge.

## Current known truth

- Phase 0 contracts and as-built maps exist on `component/club-newspaper-phase0` at starting SHA `9526d79fe2da4dc5ce154b55d7197d01824fc0be` (post PR #3114).
- Known gaps (rotation fairness, placement history, pinning, editions, renditions, responsive two-column CSS, structured audit, admin-write tests, takedown reconciliation) are documented in #2661–#2664 / #2934 — authorized for Development after Phase 0 reconciliation, not by this docs PR alone.
- Product Authority (2026-08-10): #2464 waived; #2934 complete with no-advisory/no-change disposition; Phase 1 Development GO after final Phase 0 reconciliation; Production remains separately NO-GO.
- Companion acceptance framework: `docs/ops/reports/club-newspaper-phase0-acceptance-2665.md`.

## Intended final state

- WORK can open a Phase 1 project master and serial children directly from this plan after Phase 0 reconciliation.
- Every child has objective, branch/target, exact file scope, dependencies, positive/failure tests, evidence, rollback, review boundary, and successor.
- First visible runtime slice is explicit and small enough to ship without requiring the full gap matrix.
- P1-10 advisory incorporation is N/A under the waiver (no findings to apply).

## Development GO / Production HOLD

**Development:** Product Authority authorized Phase 1 Development GO (2026-08-10) effective after WORK accepts the final #2665 Phase 0 packet and reconciles #2463. Use project branch `component/club-newspaper-runtime` and this P1-01…P1-10 graph; begin with P1-01.

**Do not create, assign, or implement Phase 1 runtime children until** Bill / WORK Phase 0 acceptance is recorded against the companion checklist (C1 cleared).

**Production:** merge, Production D1/B2 mutation, credentials/provider commitments, public publication/editorial approval, and destructive migration remain prohibited without separate Production authority.

---

## 1. Proposed Phase 1 master Issue specification

| Field | Proposed value |
| --- | --- |
| Title | `PROJECT: Club Newspaper Phase 1 — Runtime gap closure against Phase 0 contracts` |
| Parent | #2463 (or successor Phase 1 project Issue created by WORK/PMO) |
| Delivery model | Model B project with serial Model B children |
| Component / PR target | `component/club-newspaper-runtime` (create from accepted Phase 0 tip after Phase 0 reconciliation; do not invent a second parallel Club Home surface) |
| Production merge | Prohibited until Production Go |
| Self-approve / self-merge | Prohibited |
| Authority inputs | Phase 0 reports #2661–#2664; #2934 complete + Product Authority #2464 waiver; `fanclub-home.md`; `content-strategy.md`; club-home runbook; CLUB-001; this plan; companion acceptance report |
| Non-goals | New `/newspaper` product route; redesign of Gallery/Library/Memorabilia destinations; paid provider commitments without Product; weakening CC-002 rights/privacy gates; fabricating advisory follow-ups |

### Master acceptance (project-level)

- Minimum visible runtime slice (child P1-01) merged to component and operator-verified.
- Remaining children complete or explicitly deferred with Issue evidence.
- No regression of preserved capabilities listed in #2934 §4.
- Builder/reviewer separation held on every PR.
- Production verification only after Promotion Candidate + Production Go.

---

## 2. Ordered child graph

Release **serially** unless a child is marked docs-only and collision-proof. Suggested Task IDs are proposals for WORK/PMO Issue creation — not live Issues.

| Order | Proposed ID | Title | Objective | Depends on |
| --- | --- | --- | --- | --- |
| 1 | P1-01 | Club Home responsive two-column composition | Implement tablet/desktop composition per `fanclub-home.md` without changing zone order on mobile | Phase 0 ACCEPT; D1 Product note may remain open if current below-fold placement retained |
| 2 | P1-02 | Admin-write editorial endpoint tests | Add direct tests for `review` / `inventory` / `publish` / `media-associations` before new write capability | P1-01 optional parallel only if zero file overlap; prefer serial before P1-04+ |
| 3 | P1-03 | Rotation fairness (usage-count + hard cooldown + least-used) | Close #2663 scoring gaps without inventing edition persistence yet | P1-02 recommended |
| 4 | P1-04 | Placement-history log | Persist per-placement records; feed rotation / audit | P1-03 |
| 5 | P1-05 | Manual pinning API + admin UI | Pin/unpin without breaking exclusion via unpublish/archive | P1-03 |
| 6 | P1-06 | Edition persistence / regenerate / rollback | Introduce edition concept; define cache/concurrency approach (D4) | P1-04; architecture decision D4 |
| 7 | P1-07 | Media renditions | Size-specific URLs/generation per contract; cost decision D5 | P1-05 or parallel after collision review with media libs |
| 8 | P1-08 | Structured editorial audit trail | Per-action audit beyond `review_notes` | P1-05 |
| 9 | P1-09 | Takedown/suppress reconciliation | Align CC-002 / #2919 fields onto this component lineage | Integration planning D3; may HOLD |
| 10 | P1-10 | Advisory incorporation wave | Apply accepted #2934 dispositions to contracts and/or runtime follow-ups | **N/A — waived** (#2464 Product Authority waiver; no findings). Do not invent work. Retain ID for graph stability only. |

**Successor after graph:** Promotion Candidate qualification → Production Go → Production PR (separate authorities; not children of this plan’s runtime wave).

---

## 3. Branches, scopes, collisions

### Project branch

- Proposed: `component/club-newspaper-runtime` (Product Authority 2026-08-10)
- Base: accepted `component/club-newspaper-phase0` tip after Phase 0 reconciliation (exact SHA recorded at branch creation)
- Working-branch pattern: `cursor/newspaper-p1-<child-id>-<short-slug>-2e48` (or Claude equivalent per assignment)

### Per-child proposed file scopes (exact starting allowlists — WORK may narrow, not silently widen)

**P1-01 — responsive composition**

```text
src/app/fanclub/page.tsx
src/components/fanclub/ClubHome*.tsx
src/components/fanclub/ArchivesTiles.tsx
src/components/fanclub/clubHomeStyles.ts
tests/fanclub-home-*.test.tsx
docs/ops/reports/club-newspaper-p1-01-as-built.md   # if evidence report required by package
```

Do not touch: `src/app/fanclub/layout.tsx` unless auth bug explicitly scoped; subpage grids; FloatingLogo.

**P1-02 — admin-write tests**

```text
tests/admin-editorial-*.test.ts
tests/admin-editorial-*.test.tsx
# read-only fixtures against functions/api/admin/editorial/*.ts
```

**P1-03 — rotation fairness**

```text
functions/_lib/content-inventory-rotation.ts
functions/_lib/content-inventory-club-home.ts
migrations/<next>_club_home_rotation_fairness.sql
tests/content-inventory-rotation.test.ts
tests/content-inventory-club-home.test.ts
```

**P1-04 — placement history**

```text
migrations/<next>_club_home_placement_history.sql
functions/_lib/content-inventory-rotation.ts
functions/_lib/content-inventory-club-home.ts
tests/content-inventory-rotation.test.ts
tests/content-inventory-club-home.test.ts
```

**P1-05 — pinning**

```text
migrations/<next>_club_home_pinning.sql
functions/api/admin/editorial/inventory.ts
functions/api/admin/editorial/publish.ts
functions/_lib/content-inventory-club-home.ts
src/app/admin/editorial/page.tsx
tests/admin-editorial-*.test.*
tests/content-inventory-club-home.test.ts
```

**P1-06 — editions**

```text
migrations/<next>_club_home_editions.sql
functions/_lib/content-inventory-club-home.ts
functions/api/fanclub/home.ts
functions/api/admin/editorial/*   # regenerate/rollback endpoints as packaged
src/app/admin/editorial/page.tsx
tests/**
docs/how-to/website/club-home-content-operations-runbook.md
```

**P1-07 — media renditions**

```text
migrations/<next>_content_inventory_media_renditions.sql
functions/_lib/content-inventory-media.ts
functions/api/admin/editorial/media-associations.ts
src/components/fanclub/ClubHomeMediaFeature.tsx
tests/content-inventory-media.test.ts
```

**P1-08 — structured audit**

```text
migrations/<next>_editorial_audit.sql
functions/api/admin/editorial/review.ts
functions/api/admin/editorial/publish.ts
functions/api/admin/editorial/inventory.ts
tests/admin-editorial-*.test.*
```

**P1-09 — takedown reconciliation**

```text
migrations/<next>_content_inventory_takedown_reconcile.sql
functions/api/admin/editorial/*
docs/reference/**   # only if package explicitly allowlists CC-002 field doc updates
tests/**
```

**P1-10 — advisory incorporation**

**N/A under Product Authority waiver.** Do not invent allowlist paths or recommendation IDs. Graph ID retained only for stable sequencing references.

### Collision controls

| Control | Rule |
| --- | --- |
| Shared shell | Serialize any PR touching `layout.tsx`, `fanclubGridStyles.ts`, `fanclubApi.ts` |
| Rotation + club-home libs | P1-03 → P1-04 → P1-06 serial |
| Admin editorial page | Serialize P1-05 / P1-06 / P1-08 |
| Media libs | Serialize P1-07 vs media-association admin changes |
| Docs-only | May parallel only with empty intersection of writable paths |
| Parallel default | **Off** — continuous serial implementation (#3055) |

---

## 4. Migrations, tests, rollout, rollback

### Migrations

- Forward-only additive migrations only (new columns/tables).
- No destructive drops in Phase 1 children without separate Production-authorized migration plan.
- Each migration child records expand/contract order and backfill needs in its package.

### Tests (positive / failure)

Every runtime child package must require:

- Positive path: unit/integration covering new behavior; Club Home smoke where UI changes.
- Failure path: unauthorized/invalid input, CC-002 / publication gate precedence, pin/edition conflicts, migration absent/failed handling as applicable.
- Regression: existing `tests/content-inventory-*.test.ts`, `tests/fanclub-home-*.test.tsx`, admin archive tests remain green.
- Commands baseline (narrow/widen per child package):

```bash
npm test -- <focused suites>
bash scripts/ci/docs_check_headers.sh <allowlisted docs>
git diff --check
```

### Rollout

1. Merge child → component branch only (`component/club-newspaper-runtime`).
2. Operator verify via `docs/how-to/website/club-home-content-operations-runbook.md` for content-affecting children.
3. No automatic Production deploy from component merges.

### Rollback

- Documentation-only child: revert PR.
- Runtime child: revert PR; for migrations, follow packaged expand/contract rollback (never ad-hoc DROP in Production).
- Edition/pin features must document operator undo (unpin, regenerate previous edition, unpublish).

### Production verification (after separate Go)

- Member `/fanclub` zone order + responsive composition.
- Rotation fairness observable across multiple regenerations/requests per contract.
- Admin pin/preview/publish/takedown paths as shipped.
- No secrets/provider keys in logs; no CC-002 gate bypass.

### Operator handoff

Each child ends with `IMPLEMENTATION HANDOFF` including SHAs, allowlist, validation, residual risk, and successor. WORK accepts before next release. Runbook updates ship in the same child that changes operator procedure (especially P1-06).

---

## 5. Minimum visible runtime slice + serial release sequence

### Minimum visible slice = **P1-01 only**

Ship responsive tablet/desktop composition against the already-accepted zone contract so members see a tangible Phase 1 change **without** requiring schema/edition/pin work.

Preserved: mobile single-column order; existing content selection; admin flows unchanged.

### Serial release sequence (after Phase 0 reconciliation)

```text
Phase 0 ACCEPT (advisory waived by Product Authority 2026-08-10)
  → create component/club-newspaper-runtime from recorded Phase 0 tip
  → P1-01 (minimum visible slice)
  → P1-02 (test foundation)
  → P1-03 → P1-04 → P1-05
  → D4 decision gate → P1-06
  → P1-07 / P1-08 (serialize on shared files)
  → P1-09 when D3 unblocked
  → P1-10 skipped (N/A — advisory waived)
  → Promotion Candidate → Production Go → Production PR
```

---

## 6. Cross-links and gate fields

| Item | State |
| --- | --- |
| Phase 0 acceptance checklist | Companion report §2 |
| #2464 recommendations | **WAIVED** — Product Authority 2026-08-10; do not invent |
| #2934 disposition | **COMPLETE** — no-advisory / no-change via waiver |
| Final #2665 incorporation | This documentation increment |
| Product D1 side-rail placement | Open; P1-01 may retain current placement |
| Architecture D4 edition caching | Blocks P1-06 design detail |
| Cost D5 renditions | Blocks P1-07 provider/storage choices |
| Integration D3 takedown | May HOLD P1-09 |
| Production Go | Separate authority — not granted here |

---

## Validation (this documentation increment)

- `bash scripts/ci/docs_check_headers.sh docs/ops/reports/club-newspaper-phase0-acceptance-2665.md docs/ops/implementation-plans/club-newspaper-phase1.md`
- `node scripts/ci/diataxis_folder_audit.mjs`
- `git diff --check`
- Cited Phase 0 authority paths verified present at starting SHA `9526d79fe2da4dc5ce154b55d7197d01824fc0be`
- PR diff must contain only the two #2665 allowlisted files

## Rollback

Revert the documentation-only component PR that updates this plan and the companion acceptance report.

## Boundaries confirmation

- No Phase 1 runtime authorized by this docs PR alone (Development GO waits for WORK Phase 0 reconciliation).
- No advisory content fabricated.
- No Production commitment.
- P1-01…P1-09 graph preserved; P1-10 marked N/A under waiver.
