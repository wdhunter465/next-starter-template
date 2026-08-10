---
Doc Type: Operations Report
Audience: Bill, Work, Cursor, LGFC maintainers, and implementation agents
Authority Level: Evidence Snapshot
Owns: Consolidated Production Go evidence package for #2860's controlled Production library-content batch (candidate identity, backup status, dry-run evidence, write batch definition, rollback command, verifier) — assembled per Bill's 2026-08-10 bounded-Production-Go instruction on #2860
Does Not Own: The Production Go decision itself (Product Authority); the #2779 backup/recovery gap this report identifies but does not close; execution of any Production D1 write
Source Issue: #2860
Canonical Reference: /docs/ops/reports/library-content-production-go-evidence-2860.md
Related Issues: #2860, #2910, #2911, #2912, #2913, #2778, #2779
Last Reviewed: 2026-08-10
Executor: Claude Code
---

# #2860 Production Go evidence package — library-content migration

## Purpose

Bill's instruction (2026-08-10, on #2860): "begin with a bounded Production Go for #2860 only. Require Claude to post the exact candidate identity, backup, dry-run evidence, write batch, rollback command, and verifier before executing any D1 write. Then WORK reviews the results before advancing #2859."

This report assembles all six required items. **No Production read or write has been performed or attempted by this report.** Five of the six items are genuinely ready, each citing real, already-reviewed evidence from #2910–#2913. The sixth — backup — is not ready, and this report says so explicitly rather than fabricating it, per #2860's own stop condition: "Stop for uncertain record ownership, **missing backup/restore proof**, destructive statements without explicit Production authority..."

## Scope

Covers the six evidence items Bill's instruction requires, for #2860's library_entries → content_inventory migration only. It does not cover #2859 (explicitly gated behind WORK's review of this package) or any other #2860 sibling project. It does not itself authorize, perform, or build a Production write path — that remains a separate implementation step, itself requiring review, after this package's gaps are resolved or explicitly risk-accepted.

## Current known truth

- 5 of 6 required evidence items are ready today, each backed by real, already-merged, already-reviewed work (#2910 map, #2911 tooling + real local-D1 evidence, #2912 recovery proof, #2913 batch plan + live Production schema preflight).
- The 6th item, backup, is **not ready**: #2860 names #2779 as its backup/recovery gate, but #2779's actual delivered work is a local-only synthetic simulation (disposable `node:sqlite`, fabricated fixtures) that was never merged to `main` and is explicitly self-documented as non-Production ("live wrangler export when credentials authorized" — i.e., aspirational). No real Cloudflare D1 export/backup mechanism exists anywhere in this repository today.
- Per #2860's own stop conditions, this is a named stop trigger, not a minor gap: "Stop for uncertain record ownership, missing backup/restore proof, destructive statements without explicit Production authority, irreversible identifier changes, privacy exposure, or any paid tooling requirement."
- No Production D1 write capability exists in this repo's tooling today, at all — #2911's `scripts/migrations/library-content-backfill.mjs` hardcodes `--local` with no override flag, by design.

## Intended final state

Once the backup gap below is closed — either by completing real Production-capable D1 backup/export tooling (a genuine #2779 completion), or by Bill/WORK recording an explicit, documented risk-acceptance decision to proceed without a live export mechanism (citing whatever durability guarantee is being relied on instead) — this report's six items become a complete, actionable Production Go package. At that point, a bounded implementation task builds the actual secret-backed GitHub Actions write path (modeled directly on #2913's existing read-only preflight workflow), which itself requires independent review and a separate explicit dispatch before any row is written. This report does not build that path; it only proves the package that path would consume is otherwise ready.

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

## 2. Backup — NOT READY (blocking gap)

No real Production-capable D1 backup/export/restore mechanism exists in this repository:

- #2860 names #2779 ("Verify LGFC Production Backup, Restore, Rollback, and Disaster Recovery") as its backup/recovery entry gate. #2779 closed complete, but its actual deliverable (PR #3024, merged only to the unmerged `component/platform-recovery-readiness` branch — never promoted to `main`) is `scripts/ci/platform-recovery-d1-b2-isolation.mjs`: it writes a **fabricated, synthetic** fixture SQL file, restores it into a disposable local `node:sqlite` database, and validates row-count/join probes against that synthetic data — never touching real Cloudflare D1 or Production credentials. Its own evidence report states plainly: *"Synthetic/redacted fixtures only — not a live Production D1 export or live B2 ListObjects. Credentialed live CF/D1/B2 restore remains deferred and separately authorized."* The corresponding inventory record's `backupMethod` field literally reads: *"Provider durability + synthetic export/restore proof (#2895); live wrangler export when credentials authorized"* and its `testedStatus` was only ever raised to `partial`, never `tested`.
- No workflow in `.github/workflows/` performs a D1 export or backup. `d1-migrations.yml` / `lgfc-d1-migrate.yml` run schema migrations against Production (`wrangler d1 migrations apply ... --remote`), not backups. `snapshot.yml` ("OPS — Snapshot Backup") snapshots the repository and Cloudflare Pages project config/deployments — not D1 row data. `b2-d1-daily-sync.yml` is a B2→D1 ingest sync, not a backup.
- No `wrangler d1 export` (or equivalent) invocation exists anywhere in this repository's committed code.

**This is a real stop condition, not a formality.** #2860's acceptance criteria include the unchecked box "Backup, rollback, verification, and stop conditions are executable," and its readiness statement is explicit: "READY FOR LAUNCH — implementation entry-gated by #2778 D1 inventory and #2779 isolated recovery proof before Production migration." That gate has not actually been satisfied for a real Production write, regardless of #2779's closed/complete label.

**What would close this gap** (Product Authority decision required — not something this report resolves):
- (a) A bounded follow-up task builds a real `wrangler d1 export` (or Cloudflare's D1 Time Travel / point-in-time-recovery, if applicable to this database's plan) invocation, run via a secret-backed CI workflow analogous to #2913's preflight, with its output verified before any write proceeds; or
- (b) Bill/WORK explicitly records a documented risk-acceptance decision to proceed on Cloudflare's underlying storage durability alone (no independent export taken), understanding that the rollback command in Section 5 below only reverts rows this migration itself wrote — it does not restore from an independent backup, because none would exist.

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
  summary, media, created_at
) VALUES (
  'legacy-library-{id}', '{title}', '{content}', '{credit_line}',
  'LGFC Fan Club Library (legacy submission)', NULL, 'brief',
  '["library"]', 1, 0, 1, 'draft', '{search_text}', '{summary}', '[]', '{created_at}'
);
```

**What still needs building, separately, before this batch can execute against Production**: a secret-backed GitHub Actions `workflow_dispatch` path — modeled directly on the already-merged #2913 read-only preflight (`library-content-production-preflight-2913.yml` / `production_d1_preflight_2913.mjs`) — that runs this exact planning code against real Production data and executes the generated statements via `wrangler d1 execute lgfc_lite --remote`. This report does not build that path; per Bill's instruction, this package is posted first, for WORK's review, before that implementation step is authorized.

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
- [ ] Backup — **not ready**; gap identified and explained, not fabricated
- [ ] No Production read or write performed by this report

## Rollback (of this report)

Revert the documentation PR that introduces this report. No data action is implied or required — this report performs no Production access.
