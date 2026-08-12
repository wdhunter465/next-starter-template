---
Doc Type: Operations Report
Audience: Bill, Work, Cursor, LGFC maintainers, and implementation agents
Authority Level: Evidence Snapshot
Owns: Consolidated Production Go evidence package for #2860's controlled Production library-content batch (candidate identity, backup status, dry-run evidence, write batch definition, rollback command, verifier) — assembled per Bill's 2026-08-10 bounded-Production-Go instruction on #2860; reconciled 2026-08-12 once the backup gap (#3268) and write-tooling build (this report's own Section 4) both closed
Does Not Own: The Production Go/dispatch decision itself (Product Authority); execution of any Production D1 write
Source Issue: #2860
Canonical Reference: /docs/ops/reports/library-content-production-go-evidence-2860.md
Related Issues: #2860, #2910, #2911, #2912, #2913, #2778, #2779, #3268, #3386, #3388, #3390, #3391, #3392
Last Reviewed: 2026-08-12
Executor: Claude Code
---

# #2860 Production Go evidence package — library-content migration

## Purpose

Bill's instruction (2026-08-10, on #2860): "begin with a bounded Production Go for #2860 only. Require Claude to post the exact candidate identity, backup, dry-run evidence, write batch, rollback command, and verifier before executing any D1 write. Then WORK reviews the results before advancing #2859."

This report assembles all six required items. **No Production write has been performed, attempted, or authorized by this report or by any of the work it cites.** As of 2026-08-10, five of six items were ready; the sixth (backup) was reported not ready rather than fabricated. As of this 2026-08-12 reconciliation, **all six items are ready**: #3268 Phase 2 closed the backup gap with real, live, checksummed export/restore evidence, and the secret-backed Production write path referenced in Section 4 below (as "what still needs building") has since been built, tested, reviewed, and merged to `main`. Building and merging that tooling is not itself a Production write and did not perform one — see Section 4 for the exact boundary.

## Scope

Covers the six evidence items Bill's instruction requires, for #2860's library_entries → content_inventory migration only. It does not cover #2859 or any other #2860 sibling project. It does not itself authorize or perform any Production write — the write tooling described in Section 4 exists, gated and undispatched, but dispatching it (in either `dry-run` or `apply` mode) requires a separate, explicit Bill/WORK Production-dispatch authorization that this report does not grant.

## Current known truth

- All 6 required evidence items are now ready, each backed by real, already-merged, already-reviewed work: #2910 map, #2911 tooling + real local-D1 evidence, #2912 recovery proof, #2913 batch plan + live Production schema preflight, #3268 Phase 2 real backup/restore proof, and the merged (not dispatched) Production write tooling from PRs #3386 → #3390 → #3392.
- The backup gap is **closed**: #3268 Phase 2 performed a real `wrangler d1 export --remote` of `lgfc_lite`, uploaded it to private R2 with an independently re-verified SHA-256 checksum, and completed an isolated restore-drill proof (37/37 tables matched exactly, 5,711 rows written) against a disposable, uniquely-named, never-`wrangler.toml`-bound database that was torn down unconditionally afterward. Full citation in Section 2.
- The write-tooling gap is **closed**: `scripts/ci/library_content_production_write_2860.mjs` and `.github/workflows/library-content-production-write-2860.yml` exist on `main`, are unit-tested (19 tests), and enforce two independent gates (`MODE=apply` AND `CONFIRM_WRITE=confirm`) plus three-way Production identity verification before any write statement would execute. The workflow has never been dispatched, in either mode, by any of the work this report cites.
- No Production D1 write has occurred. Building, testing, and merging the write tooling is bounded "build + validate + PR + merge only" work, distinct from dispatching it — per Bill's own instruction framing that authorized the build without authorizing execution.

## Intended final state

This report's six items are now a complete, actionable Production Go package. What remains is a separate, later decision: Bill/WORK reviews this reconciled package and either records an explicit Production-dispatch authorization (specifying batch scope and confirming the two workflow gates) or holds. This report does not request or assume that decision — it exists so that decision can be made against real, current evidence rather than the 2026-08-10 partial package.

## 1. Exact candidate identity

| Field | Value |
| --- | --- |
| Component branch | `component/library-content-migration` |
| Current branch tip | `65b0c208` (merge of PR #3195) |
| Migration map | #2910 — `docs/ops/reports/library-content-migration-map-2910.md`, accepted |
| Backfill tooling | #2911 — `scripts/migrations/library-content-backfill.mjs`, `tests/library-content-backfill.test.ts` (27 tests), accepted |
| Recovery/verification | #2912 — `tests/library-content-mixed-version.test.ts` (9), `tests/library-content-recovery.test.ts` (7), accepted |
| Batch plan + preflight | #2913 — `docs/ops/reports/library-content-production-batch-plan-2913.md`; status:complete |
| Legacy schema (candidate) | `migrations/0002_library_entries.sql`: `id, name, email, title, content, created_at` — **no `is_approved` column**, confirmed live in Production (see preflight below), matching the local-replay finding in #2911 |
| Canonical schema (target) | `content_inventory`, per `migrations/0035_editorial_archive.sql` + `0036_content_inventory_schema_delta.sql` |
| Source identity contract | `tag = legacy-library-{id}` (deterministic, collision-safe, per #2910) |

**Live Production preflight already executed** (read-only, via the #2913 secret-backed CI workflow, `library-content-production-preflight-2913.yml`, promoted to `main` in PR #3201):

> Checked at: 2026-08-08T15:38:12.573Z — Table: `library_entries` — Column count: 6 — `is_approved` present: **NO**

This resolves #2913's own "blocking preflight" item. Per the #2910 map's explicit rule for this exact case: **every legacy row must be treated as unapproved/draft-only.** This also means the migration's only viable batch shape is **all-drafts-first** (#2913's batch plan): since no row becomes `published`, #2912's proven "section-level cutover" visibility risk does not apply to this batch at all — drafts never trigger the legacy-fallback cutover.

## 2. Backup — READY (closed by #3268 Phase 2, 2026-08-11)

At the time this report was first posted (2026-08-10), no real Production-capable D1 backup/export/restore mechanism existed in this repository — #2779's actual deliverable was a local-only synthetic simulation that never touched real Cloudflare D1 credentials. That gap is now closed by #3268 Phase 2's real, live, independently verified evidence:

- **Package 1 — capability preflight** (PR #3306, corrective PR #3309): confirmed R2 write capability (PUT/GET/DELETE round-trip on a disposable test key) and D1 admin capability (create/execute/delete an isolated, uniquely-named test database, never referenced in `wrangler.toml`). Zero orphaned resources; no write to `lgfc_lite` at any point.
- **Package 2 — real export, checksum, R2 upload** (PR #3311): a real `wrangler d1 export --remote` of `lgfc_lite` (Cloudflare's documented read-only backup mechanism — no restore, no write), 469,630 bytes, SHA-256 computed and uploaded as a sidecar, then independently re-downloaded and re-hashed to confirm an exact match. Stored privately at `d1-backups/lgfc_lite/2026-08-11T10-33-48-870Z/backup.sql` in the private `lgfc-d1-backups` R2 bucket.
- **Package 3 — isolated restore proof** (final live run 2026-08-11T12:00:07Z, after 4 earlier dispatches each finding and fixing a real evidence-grounded issue in turn — a wrangler stdout-preamble parsing bug, a genuine table-count mismatch, D1's auto-created `_cf_KV` internal table): backup found and checksum re-verified, an isolated restore-drill database (uniquely named, never in `wrangler.toml`, orphan-swept first) imported the export (1,313 queries executed, 5,711 rows written), and table verification matched exactly — 37 expected vs. 37 actual. The restore-drill database was torn down unconditionally afterward.
- Full sequence summary: issue #3268, comment [5252882921](https://github.com/wdhunter465/next-starter-template/issues/3268#issuecomment-5252882921). At no point in any package was `lgfc_lite` written to, restored into, or otherwise mutated.

**Downstream note, not a #2860 blocker:** #3268's own summary states Gate 1 (feeding this evidence through #2859 → #2780 → #2926) remains HOLD and Gate 2 remains NO-GO pending separate review — that is a different downstream chain than #2860's own six-item checklist. For #2860's purposes specifically, this section's backup/restore-proof requirement is satisfied by the live evidence above.

## 3. Dry-run evidence

Real, end-to-end evidence against a real local D1 instance (not simulated), from #2911 and #2912:

- **#2911, dry-run first pass** (5 seeded legacy rows): 3 valid → planned inserts; 2 excluded (`LE_INVALID_EMPTY` — one empty title, one whitespace-only content). Zero writes; verified via `SELECT COUNT(*)` before/after.
- **#2911, apply first pass**: 3 rows inserted; verified correct tags, correct draft status, correct credit-line fallback, and confirmed no `email` value present in any written row.
- **#2911, apply second pass (idempotency proof)**: re-run against the migrated state → `insert: 0, update: 0, noop: 3`. Row count unchanged.
- **#2911, collision detection**: a manually-inserted non-tool row sharing a legacy tag was correctly flagged `TAG_COLLISION_NON_MIGRATION_SOURCE` and left untouched by `--apply`.
- **#2912, full cycle proof**: seeded 3 legacy + 1 unrelated editorial `content_inventory` row → `--apply` (3 inserted, unrelated row untouched) → executed the exact recovery `DELETE` (Section 5) → all 3 legacy-migrated rows removed, unrelated row still present untouched → re-ran `--apply` → 3 fresh inserts, `update: 0`, byte-for-byte identical shape to the original run.
- **#2912, real handler verification**: confirmed directly against `functions/api/fanclub/library.ts`'s actual `onRequestGet` export (not a reimplementation) that dual-read cutover is section-level, and that draft-status legacy-tagged rows do **not** trigger cutover — consistent with the all-drafts-first batch shape this candidate requires.
- **Test suite evidence**: 27 tests (#2911) + 16 tests (#2912) passing; full repo suite green at each point (1012 and 1040 tests respectively, 0 regressions); `tsc --noEmit` clean; `git diff --check` clean at each PR.

## 4. Write batch

**Batch shape: all-drafts-first**, per #2913's batch plan — the only viable shape given the confirmed-absent `is_approved` column. Every eligible legacy row migrates as `status: 'draft'`; nothing publishes in this batch, so #2912's visibility-cutover risk does not apply.

**Exact, deterministic generation mechanism** — not hand-written SQL, but the same tested, reviewed code path already proven in #2911/#2912 (`scripts/migrations/library-content-backfill.mjs`):

1. Read Production `library_entries` (`SELECT id, name, email, title, content, created_at FROM library_entries`) and existing tagged `content_inventory` rows (`WHERE canonical = 1 AND tag LIKE 'legacy-library-%'`) — both read-only.
2. `buildPlanForBackfill(legacyRows, approvalColumnPresent=false, existingRows)` classifies every row per the #2910 map (excluded / insert / update / noop / conflict) — pure, unit-tested logic, unchanged from #2911.
3. For each `insert`/`update` action, `buildInsertStatement` / `buildUpdateStatement` produce parameterized-equivalent SQL (values passed through `sqlLiteral`, which quotes and escapes; `email` is never read into `buildMigratedFields` at all, structurally, not just by omission).
4. Statements execute as a single file via `wrangler d1 execute --file` (today's tool: `--local`; a Production run requires the CI write path described below, not a modification to this tool's Production refusal).

**Exact SQL statement template** (from `buildInsertStatement`, per-row, illustrative — literal values depend on real Production row content this report has no access to):

```sql
INSERT INTO content_inventory (
  tag, title, text, credit_line, source_name, source_url, story_type,
  allowed_sections, canonical, priority, feature_weight, status, search_text,
  summary, media
) VALUES (
  'legacy-library-{id}', '{title}', '{content}', '{credit_line}',
  'LGFC Fan Club Library (legacy submission)', NULL, 'brief',
  '["library"]', 1, 0, 1, 'draft', '{search_text}', '{summary}', '[]'
);
```

`buildInsertStatement` appends two columns conditionally, not unconditionally as the base template above shows: `created_at` is only added (with the legacy row's original timestamp) when the legacy row actually has one — `buildMigratedFields` sets `created_at: row.created_at || null`, and a `null` value is omitted from the column list entirely rather than written as SQL `NULL`. `published_at` is only added, set to the current time, when a row transitions to `published` for the first time (`setPublishedAtNow`) — which never happens in this batch, since every row here migrates as `draft` (Section 1).

**Now built** (2026-08-12): the secret-backed GitHub Actions write path described above as a future step has since been built, reviewed, and merged to `main` — `.github/workflows/library-content-production-write-2860.yml` and `scripts/ci/library_content_production_write_2860.mjs`, modeled directly on the #2913 read-only preflight as planned. It runs this exact planning code (`buildPlanForBackfill`/`buildInsertStatement`/`buildUpdateStatement`, unchanged) against real Production data and, only under two independently-required gates, executes the generated statements via `wrangler d1 execute lgfc_lite --remote -y --file`:

1. `CONFIRM_WRITE` must be exactly `"confirm"`.
2. `MODE` must be exactly `"apply"` — the workflow's default, `"dry-run"`, performs the identical Production reads and plan classification but writes nothing, regardless of `CONFIRM_WRITE`.

Both gates are enforced by the script itself, not just the workflow's `workflow_dispatch` input validation — defense in depth, since this is the one script in the repository capable of writing to Production D1. Before any read, the script three-way-verifies the resolved database identity (secret value vs. `wrangler.toml`'s declared Production `database_id` vs. the live `wrangler d1 info` result), failing closed on any mismatch, and fails closed if a live `PRAGMA table_info(library_entries)` check ever finds an `is_approved` column present (this batch's all-drafts-first shape assumes it absent). Merged via PR #3386, with three real Copilot findings from that PR — D1 identity opacity, this exact fail-closed guard being absent, and an independent `is_approved`-SELECT omission bug in the promoted `scripts/migrations/library-content-backfill.mjs` CLI — landed by follow-up PRs #3390 (fixes) and #3392 (a fourth finding, a vacuous test assertion, found on #3390 itself). `main` now carries the fully-reviewed version with no outstanding findings. 46 tests across the write script and the promoted `library-content-backfill.mjs` pass.

**Building and merging this tooling is not a Production write and did not perform one.** The workflow has never been dispatched, in either `dry-run` or `apply` mode, by any of the work this report cites — dispatching it remains a separate, later, explicit decision, per Bill's own instruction that authorized "build + validate + PR + merge only."

The four repository secrets this path consumes already existed (per the 2026-08-08 Product Authority clarification on #2913, reused unchanged): `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID`, `D1_DATABASE_NAME`. No new credential provisioning was required.

**Pre/post count evidence to record** (redacted, no PII, exactly as #2911/#2912's local evidence did):

```sql
-- Before
SELECT COUNT(*) AS legacy_total FROM library_entries;
SELECT COUNT(*) AS already_migrated FROM content_inventory WHERE canonical = 1 AND tag LIKE 'legacy-library-%';

-- After
SELECT COUNT(*) AS legacy_total FROM library_entries;               -- must be unchanged (no deletes)
SELECT COUNT(*) AS migrated_now FROM content_inventory WHERE canonical = 1 AND tag LIKE 'legacy-library-%';
SELECT COUNT(*) AS published_now FROM content_inventory WHERE canonical = 1 AND tag LIKE 'legacy-library-%' AND status = 'published'; -- must be 0 for this batch
```

## 5. Rollback command

Proven end-to-end against real local D1 in #2912 (backfill → revert → re-backfill cycle). Verbatim from `docs/ops/reports/library-content-recovery-verification-2912.md`:

```sql
-- 1. Confirm current legacy-tagged canonical row count before acting.
SELECT COUNT(*) AS n FROM content_inventory WHERE canonical = 1 AND tag LIKE 'legacy-library-%';

-- 2. Revert: removes only canonical rows under the migration's own tag prefix.
--    Non-legacy inventory (any other tag) is never touched by this statement.
DELETE FROM content_inventory WHERE canonical = 1 AND tag LIKE 'legacy-library-%';

-- 3. Confirm the count is now zero (or matches the intended partial-revert scope,
--    if reverting a single id: WHERE tag = 'legacy-library-{id}' instead of the LIKE form).
SELECT COUNT(*) AS n FROM content_inventory WHERE canonical = 1 AND tag LIKE 'legacy-library-%';
```

This reverts only what this migration itself wrote (proven not to touch unrelated inventory, #2912). **It is not a substitute for the backup gap in Section 2** — it cannot recover from any failure mode other than "these specific rows need to be un-migrated" (e.g., it does nothing for a corrupted `library_entries` source table, unrelated D1 damage, or any failure outside `content_inventory`'s legacy-tagged rows).

## 6. Verifier

Post-migration verification checklist, from #2913's batch plan, to run after any authorized batch:

- [ ] Pre/post counts recorded (Section 4) and match expected batch size.
- [ ] `library_entries` row count unchanged (no deletes performed by this migration).
- [ ] Member-facing `/api/fanclub/library` list, search, and detail behavior spot-checked — no regression versus the pre-batch legacy-only view for any not-yet-migrated class. (Not applicable in the same way for this specific all-drafts batch, since nothing publishes — but still confirms the legacy fallback remains fully intact.)
- [ ] No `email` value present in any migrated `content_inventory` row (spot-check).
- [ ] Every published row has non-empty `source_name`/`credit_line` (not applicable to this batch — no row publishes; schema triggers enforce this regardless).
- [ ] Legacy retirement/retention disposition explicitly recorded as a separate, later Product Authority decision — not implied or defaulted by this batch.

## Acceptance checklist (this report)

- [x] Exact candidate identity posted, citing real accepted work and a real live-Production preflight result
- [x] Dry-run evidence posted, citing real local-D1 end-to-end proof (not simulated)
- [x] Write batch posted: exact deterministic mechanism, exact statement template, exact batch shape and its rationale
- [x] Rollback command posted, verbatim from proven #2912 evidence
- [x] Verifier posted, verbatim from #2913's batch plan
- [x] Backup — **ready**; real, live, checksummed export/restore evidence from #3268 Phase 2 (Section 2)
- [x] Secret-backed Production write path — **built, tested, reviewed, merged to `main`** (Section 4); never dispatched
- [x] No Production write performed, attempted, or authorized by this report or any work it cites
- [ ] Production-dispatch authorization — **not requested by this report**; a separate, later Bill/WORK decision

## Rollback (of this report)

Revert the documentation PR that introduces this report. No data action is implied or required — this report performs no Production access.
