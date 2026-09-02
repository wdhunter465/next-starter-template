---
Doc Type: Operations
Audience: LGFC operators, on-call implementation agents, Human + AI
Authority Level: Operational Authority
Owns: Rollback and recovery procedures for the physical archive-acquisition surfaces (migration 0065, `archive_items`/`archive_item_custody_events`, `/admin/archive-items`), and this feature's promotion-candidate qualification for Production
Does Not Own: Day-to-day intake/custody operation (owned by `docs/ops/how-to/archive-item-intake-and-custody.md`); this repository's general rollback strategy (owned by `docs/ops/rollback_MASTER.md`); D1 whole-database backup/restore mechanics (owned by the #3268 workflow series, e.g. `.github/workflows/ops-d1-backup-phase2-restore-verify-3268.yml`)
Canonical Reference: /docs/ops/rollback_MASTER.md
Related Issues: #2073, #3268, #4059, #4060, #4061, #4062, #4063
Last Reviewed: 2026-09-02
---

# How to: archive-item rollback and recovery

## Purpose

This is #2073 Work Package item 6's rollback/recovery procedure for the
physical archive-acquisition surfaces PR #4067 shipped: migration 0065
(schema), `functions/_lib/archive-items-repository.ts` +
`functions/api/admin/archive-items/*` (intake/custody API), and
`/admin/archive-items` (admin UI). It follows this repo's general rollback
order (`rollback_MASTER.md`: revert last PR → redeploy last known good
state → restore prior configuration) and is scoped to what's actually new
here, not a restatement of that master doc.

**The short version: for this feature, a code-only rollback is almost
always the right and sufficient answer.** Migration 0065 is purely
additive — it widens two CHECK constraints (`content_items.input_stream`,
`rights_evidence.evidence_type`) and adds two new, previously-nonexistent
tables. Nothing outside this feature reads or depends on any of that, so
rolling back the *code* while leaving the *schema* in place is safe,
reversible in seconds, and loses no data. Only reach for the schema-level
rollback in Recovery scenario 2 below, and only after reading its
guardrails.

## Scope

Covers: three recovery scenarios for the physical archive-acquisition
surfaces (code-only rollback, schema-level reversal, catastrophic
D1 restore), the exercised reversal script's guardrails and how to run it,
and this feature's promotion-candidate qualification checklist for
Production.

Does not cover: day-to-day intake/custody operation (owned by
`docs/ops/how-to/archive-item-intake-and-custody.md`); this repository's
general rollback strategy, which this document narrows rather than
restates (owned by `docs/ops/rollback_MASTER.md`); D1 whole-database
backup/restore mechanics themselves, only how this feature uses them
(owned by the #3268 workflow series).

## Current known truth

Migration 0065 and the code it supports are live on `main`, applied to both
Development and Production D1, as of PR #4067 (merged 2026-09-02). No
schema-level rollback has ever been executed against a real database —
`scripts/ops/rollback/0065_archive_acquisition_core_rollback.sql` is
exercised only in-memory, by
`tests/migration-0065-archive-acquisition-rollback.test.ts` (4/4 passing:
one clean-reversal case, three guard-refusal cases). As of this writing no
`archive_items` row, `physical_acquisition` `content_items` row, or
`donor_agreement` `rights_evidence` row exists in Production yet, so the
schema-level reversal's guard would still pass if it were ever needed — see
Recovery scenario 2 before assuming that stays true.

## Recovery scenario 1: the admin UI or API is broken, but D1 is fine

**Symptoms:** `/admin/archive-items` errors, a custody transition silently
corrupts state, an intake creates a malformed row — anything where the bug
is in the deployed code, not the data.

**Procedure:**
1. Revert PR #4067 (or the specific bad follow-on commit) via a new PR, or
   use Cloudflare Pages' instant rollback to the last known-good deployment
   — either matches `rollback_MASTER.md`'s "Revert last PR" /
   "Redeploy last known good state" steps.
2. Do **not** touch the schema. `archive_items` and
   `archive_item_custody_events` simply become unreachable (no route calls
   them once the code is reverted); `content_items` rows with
   `input_stream = 'physical_acquisition'` and `rights_evidence` rows with
   `evidence_type = 'donor_agreement'` remain exactly as they were —
   inert, valid rows in tables every other stream also uses, causing zero
   interference with #3551's own pipeline (see
   `content-rights-runtime-as-built-2073.md`'s systems-relationship
   section).
3. Once the fix is ready, redeploy forward. No data was ever at risk.

This is the expected, low-risk path for the overwhelming majority of
incidents on this feature.

## Recovery scenario 2: the schema itself must be reverted

**Only use this if Scenario 1 is genuinely insufficient** — e.g. the widened
`content_items`/`rights_evidence` CHECK constraints are themselves causing
harm to the pre-existing #3551 pipeline (not merely to this feature), and
that harm can't be fixed by reverting code alone.

The reversal is a hand-authored SQL script, exercised (not just described)
by `tests/migration-0065-archive-acquisition-rollback.test.ts`:

```
scripts/ops/rollback/0065_archive_acquisition_core_rollback.sql
```

**This file is deliberately not in `migrations/`.** D1 has no down-migration
concept — `wrangler d1 migrations apply` only ever applies forward. Placing
a reversal script in `migrations/` would make every future
`wrangler d1 migrations apply` run (and every test harness that globs
`migrations/*.sql`) apply it automatically forward, which is the opposite
of a rollback. It must be applied manually and deliberately.

### Guardrails — read before running

The script refuses to run (the whole transaction aborts, touching nothing)
if any of the following is true:

- Any row exists in `archive_items`.
- Any `content_items` row has `input_stream = 'physical_acquisition'`.
- Any `rights_evidence` row has `evidence_type = 'donor_agreement'`.

This is intentional, not a bug to work around: reversing the CHECK
constraints while a now-forbidden value still exists would either silently
destroy real donor/custody data (if the new tables were dropped
unconditionally) or abort mid-rebuild in a half-applied state (a CHECK
violation partway through the `INSERT INTO ..._prev SELECT` step) — exactly
the failure mode migration 0059's own header warns a naive
`PRAGMA foreign_keys` toggle produces under D1's implicit per-migration
transaction. If the guard refuses:

1. **Do not** delete real archive/donor rows just to satisfy the guard.
2. Fall back to Scenario 1 (code-only rollback) instead — it's almost
   certainly the correct answer once real data exists.
3. If a genuine reason remains to shrink the schema back, that decision
   belongs to Product Authority (Bill), not an automated or unilateral
   agent action — this is exactly the kind of destructive-retention action
   #2073's own "Boundaries" section reserves.

### Running it (once the guard is confirmed clear)

Manual application against a target database, using the same `wrangler d1
execute` tooling `scripts/d1-prod-migrate.sh` uses for forward migrations:

```
npx wrangler d1 execute <DATABASE_NAME> --remote \
  --file=scripts/ops/rollback/0065_archive_acquisition_core_rollback.sql
```

Always run this against Development (`lgfc-litedev`) first and verify
before ever considering Production (`lgfc_lite`) — Production schema
changes remain a protected action under #2073's own "Active delivery
model" section (independent review required; Production promotion remains
separately protected).

### Proof this actually works

`tests/migration-0065-archive-acquisition-rollback.test.ts` applies every
migration through 0065 against an in-memory `node:sqlite` database (the
same harness every migration-safety test in this repo uses), then exercises
all four cases:

1. Clean reversal when the surface is unused: `archive_items`/
   `archive_item_custody_events` are dropped, a pre-existing #3551
   `content_items`/`rights_evidence` row survives under its original id and
   data, and the widened CHECK values are rejected again afterward.
2. The guard refuses when an `archive_items` row exists.
3. The guard refuses when a `content_items` row uses
   `input_stream = 'physical_acquisition'`.
4. The guard refuses when a `rights_evidence` row uses
   `evidence_type = 'donor_agreement'`.

All four passed on first write (`npx vitest run
tests/migration-0065-archive-acquisition-rollback.test.ts` — 4/4).

## Recovery scenario 3: catastrophic data loss (need a point-in-time restore)

If archive-item or any other D1 data is lost or corrupted beyond what
either scenario above fixes, this feature has no separate backup
mechanism of its own — it uses the same D1-wide backup/restore path #3268
built (`.github/workflows/ops-d1-backup-phase2-restore-verify-3268.yml` and
its sibling phase workflows), which snapshots the whole database to the
private `lgfc-d1-backups` R2 bucket and can restore it into an isolated
verification database. Follow that series' own operator procedure; there is
nothing archive-item-specific about it.

## Promotion-candidate qualification (for Production)

This section is the explicit checklist #2073's Work Package item 6 asks
for: what must be true before this feature is considered qualified for
Production, not a request for a separate promotion step (migration 0065
already applies to Production automatically via
`.github/workflows/d1-migrations.yml` on merge to `main`, the same path
migration 0064 took for the Weekly Matchup fix).

- [x] **Schema verified safe.** `tests/migration-0065-archive-acquisition.test.ts`
      proves zero data loss across all five pre-existing `content_items`
      dependents when migration 0065 runs.
- [x] **Rollback verified safe.** `tests/migration-0065-archive-acquisition-rollback.test.ts`
      proves the reversal path above, including its guardrails.
- [x] **Custody state machine tested.** `tests/archive-items-repository.test.ts`
      covers creation, every valid transition, invalid-transition rejection,
      filtering, and `rights_evidence`/`donor_agreement` integration.
- [x] **Admin API tested and access-gated.** `tests/archive-items-api.test.ts`
      covers both endpoints, including the `401` without an admin session.
- [x] **No unreviewed public exposure.** No public (non-`requireAdmin`)
      route reads `archive_items`; `serializeArchiveItemForAdmin` is the
      only projection of this row and it is only ever called from
      `requireAdmin`-gated handlers.
- [x] **Privacy boundaries match #4059's decisions.** Donor name/contact are
      admin-only by construction (see the intake runbook); a public credit
      line requires explicit `donor_consent_public_credit`.
- [x] **Operator runbook exists.** `docs/ops/how-to/archive-item-intake-and-custody.md`.
- [x] **Rollback/recovery documented and exercised.** This document, plus
      the passing rollback test cited above.
- [ ] **Acceptance exercise against #2073's own criteria.** Tracked as a
      dated comment on #2073/#4063 walking every item in #2073's
      "Acceptance and verification" section to direct evidence, matching
      #3551's own 2026-09-01/09-02 verification-comment lineage.
