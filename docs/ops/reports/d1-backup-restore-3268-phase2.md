---
Doc Type: Operations Report
Audience: Bill, Work, Cursor, LGFC maintainers, and implementation agents
Authority Level: Evidence Snapshot
Owns: #3268 Phase 2 ("real D1 export → private R2 backup → checksum/integrity verification → isolated non-Production restore proof") target design and package plan
Does Not Own: #3268 Phase 1 (see d1-backup-restore-3268-phase1.md, complete as of 2026-08-10); Phase 3 (scheduled/recurring backup service); Phase 4/quarterly recovery-testing cadence; any Production D1 write, mutation, or restore; the #2860/#2859/#2926 Production population decisions themselves
Source Issue: #3268
Canonical Reference: /docs/ops/reports/d1-backup-restore-3268-phase2.md
Related Issues: #3268, #2860, #2779, #2780, #2859, #2926, #2913, #3302, #3303
Last Reviewed: 2026-08-10
Executor: Claude Code
---

# #3268 Phase 2 — real backup/restore proof: target design

## Purpose

Bill's 2026-08-10 authorization, given after Phase 1's last blocker (item 3:
account plan tier / D1 Time Travel retention) was answered directly from the
Cloudflare dashboard (Workers Free plan; Time Travel retention = 7 days),
starts Phase 2: **a single, bounded, one-shot proof** that a real D1 export
can be produced, uploaded to the private R2 bucket, verified by checksum,
and restored into an isolated non-Production target with the restored
content verified against the source.

This document is the "detailed target design" #3268's own required delivery
method calls for *before* implementation — per its opening comment: "Define
the detailed target design... Implement and validate step by step... complete
one bounded package at a time; independently review and verify each
package." No implementation code ships in this PR. It exists so the design,
and specifically the two genuinely open questions below, can be reviewed
before any write-capable script is built.

## What this increment is not

- **Not Phase 3.** A recurring/scheduled backup service (cadence, alerting,
  cost limits, credential-rotation runbook, Day-2 operator dashboard) is
  explicitly out of scope here. This is a one-shot proof only.
- **Not quarterly recovery-drill automation.** #3268's own requirement 5
  ("quarterly backup recovery testing") is a durable Day-2 commitment to be
  designed once this one-shot proof exists as a working reference, not
  built here.
- **Not a Production write of any kind.** No code path in this design ever
  issues a mutating statement against `lgfc_lite`. Export is a read;
  restore targets a new, separate, non-Production database only.
- **Not #2860's migration.** This proves the backup/restore mechanism
  works; it does not itself authorize #2860's Production population write
  — that authorization still flows through #2859 → #2780 → #2926, per
  Gate 1/Gate 2 below.

## Gates preserved (restated verbatim from Bill's authorization)

- Preserve all Production/destructive-data/credential gates.
- Do not perform a Production restore or destructive D1 action.
- **Gate 1 remains HOLD** until this backup/restore evidence feeds through
  #2859 → #2780 → #2926.
- **Gate 2 remains NO-GO until Gate 1 passes.**

Nothing in this design, or in any package it proposes, changes Gate 1 or
Gate 2 status by itself. Completing Phase 2 produces the *evidence* Gate 1
needs; it does not advance the gate.

## Architecture / data flow for this one-shot proof

```
lgfc_lite (Production D1, read-only export)
    │  wrangler d1 export (schema + data, point-in-time snapshot)
    ▼
CI runner local disk (ephemeral, private repo compute, never committed)
    │  SHA-256 checksum computed locally
    ▼
R2 bucket lgfc-d1-backups (private, public access disabled)
    │  PutObject: dated prefix, e.g. d1-backups/lgfc_lite/<UTC timestamp>/backup.sql
    │  PutObject: companion backup.sql.sha256 sidecar
    ▼
New isolated non-Production D1 database (created for this proof only,
NOT referenced anywhere in wrangler.toml's runtime bindings — the deployed
Worker/app can never read or write it)
    │  wrangler d1 execute --file=<downloaded backup.sql>
    ▼
Verification: re-download from R2, re-hash, compare to stored checksum;
query the restored database for table count / row counts / a handful of
representative queries; compare against the source export's own recorded
counts (never against live lgfc_lite, to avoid any read/write race with
Production traffic during the proof).
```

## Component design

### 1. Export

`wrangler d1 export lgfc_lite --output=<local-file>.sql` (schema + data,
Cloudflare's standard D1 backup mechanism). This is a **read** against D1 —
it produces a snapshot without issuing any mutating statement, the same
class of operation as Phase 1's already-verified `wrangler d1 info` /
`d1 time-travel info` reads. The output file exists only on the CI runner's
ephemeral disk for the duration of the job; it is never committed, never
printed to logs or issue comments (this repo's evidence-posting convention
throughout Phase 1 already treats file contents as something to redact or
withhold when it could carry sensitive values — see `redactSecrets()` in
`scripts/ci/d1_backup_r2_phase1_preflight_3268.mjs`), and is deleted when
the job ends regardless of outcome.

### 2. Checksum / integrity

SHA-256 of the local export file, computed before upload. Stored as a
companion object (`backup.sql.sha256`) alongside the backup in R2, not
relied upon via R2's own ETag (single-part PUT ETags are MD5-based and not
a integrity primitive this design should depend on). Verification re-hashes
the object after a fresh download from R2 and compares byte-for-byte to the
stored checksum before any restore attempt proceeds — a checksum mismatch
must fail the run closed, not attempt a restore anyway.

### 3. Upload

Reuses the already-verified `AwsClient` S3 SigV4 signer
(`functions/_lib/aws4fetch.ts`) and the already-working R2 credential
(`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET_NAME`, keyed off
`CLOUDFLARE_ACCOUNT_ID` per PR #3302) — the same credential Phase 1 proved
can reach the bucket via `ListObjectsV2`. **Its write capability
(`PutObject`) has not yet been exercised or confirmed** — see Open Question
1 below.

### 4. Isolated restore target

Since `docs/reference/platform/component-environment-isolation.md`
(cited in the Phase 1 report) confirms this repository has **no existing
separate Preview D1 database** — `lgfc_lite` is production-shared — there is
no existing non-Production D1 to restore into. Proposal: create a new,
dedicated D1 database solely for this restore proof (working name:
`lgfc_lite_restore_drill_3268`), created via `wrangler d1 create` using the
existing `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`. Critically, this
database is **never added to `wrangler.toml`'s `[[d1_databases]]` bindings**
— it is not wired into the deployed Worker/app in any way, so no code path
outside this proof's own CI job can ever read or write it. This makes it
genuinely isolated by construction, not merely by convention.

Whether this drill database is destroyed at the end of the proof or kept
for reuse in future quarterly drills (#3268 requirement 5) is a Phase 3
question, not decided here — this design only needs it to exist long enough
to prove restore + verification, and defaults to tearing it down at the end
of the same job unless Bill says otherwise.

**Its creation requires D1 admin-level token scope, which has not yet been
confirmed** — see Open Question 2 below.

## Data sensitivity — real table inventory (grounds #3268 item 6, not
completed in Phase 1)

Phase 1 explicitly deferred item 6 (data sensitivity classification) as "not
attempted this pass." Because Phase 2 exports *real row content*, not just
metadata, a lightweight version of that classification belongs here rather
than being deferred again. Grounded in an actual grep of every
`CREATE TABLE` in `migrations/*.sql` (37 real tables, consistent with the
`num_tables: 38` Phase 1 already confirmed live from `wrangler d1 info`; the
one-table difference is expected drift from migrations added after that
snapshot and is not investigated further here):

- **Member/auth/PII-bearing**: `members`, `join_requests`,
  `join_requests_new`, `join_email_log`, `member_sessions`,
  `member_submissions`, `login_attempts`.
- **Moderation/audit**: `moderation_events`, `reports`,
  `admin_team_worklist`, `ask_inbox`.
- **Editorial/public content** (lower sensitivity, largely already
  public-facing or intended for publication): `content_blocks`,
  `content_inventory`, `content_inventory_media`, `content_item_tags`,
  `content_items`, `content_revisions`, `discussions`, `events`,
  `faq_entries`, `footer_quotes`, `friends`, `library_entries`,
  `media_assets`, `membership_card_content`, `milestones`, `page_content`,
  `page_content_history`, `photos`, `publication_candidates`, `sources`,
  `submission_queue`, `submission_queue_next`, `submitters`, `tags`,
  `weekly_matchups`, `weekly_votes`, `welcome_email_content`.

This is a table-name-level pass, not a column-level PII audit — it is
sufficient to establish that the export **does** contain member PII and
auth-adjacent data (login attempts, session records), which drives the
handling constraints below. A full column-level classification remains a
legitimate follow-up but does not block this proof, since the handling
constraints already assume "treat the whole export as sensitive."

**Handling constraints this design commits to:**
- The export file is never logged, never printed to a CI step output,
  never posted to a public GitHub issue/PR comment, and never committed to
  the repository.
- The export file is deleted from the CI runner's disk at job end,
  unconditionally (success or failure).
- The R2 object itself inherits the bucket's existing private,
  public-access-disabled configuration (Bill-confirmed in Phase 1) — no new
  bucket policy or access grant is introduced by this design.
- The restore-drill database, once created, holds the same sensitive
  content as the source and must be treated with the same handling
  discipline — it is not a "safe to expose" copy merely because it is
  non-Production.

## Open questions — must be answered by a bounded capability preflight
## before the real export/upload/restore package is written

Consistent with Phase 1's own methodology (never assume a credential's
scope; prove it with a bounded, reversible preflight first), two
capabilities this design depends on are currently **unverified**:

1. **R2 write scope.** Phase 1 proved the R2 credential can `ListObjectsV2`.
   It has never attempted `PutObject`, `GetObject` of a written object, or
   `DeleteObject`. Least-privilege credentials are not guaranteed to include
   write scope merely because the use case implies it.
2. **D1 admin scope.** Phase 1 proved `CLOUDFLARE_API_TOKEN` can run
   `wrangler d1 info` / `d1 time-travel info` (reads) against the existing
   database. It has never attempted `wrangler d1 create` or
   `wrangler d1 execute` (schema/data writes) against any database,
   existing or new.

**Proposed next package (Package 1 below) is a capability preflight that
tests both, fully reversibly**: a small disposable object is written to R2
under a clearly-scoped test prefix, read back to verify content, and
deleted; and D1 admin scope is checked in a way that does not leave a
persistent resource behind if avoidable (or, if `wrangler d1 create` must
actually run to prove the capability, the created database is immediately
described and then deleted in the same job — never left dangling). If
either capability is missing, that becomes this proof's next bounded
blocker, reported with the same evidence discipline as every #3268 R2/D1
preflight so far — not worked around by requesting broader credentials
without Bill's explicit decision.

## Package plan (one bounded PR per package, each independently reviewed)

1. **Capability preflight** — R2 write round-trip (PUT/GET/DELETE on a
   disposable test key) + D1 admin-scope check. Read/write but fully
   reversible; no real backup content touched; no persistent new resource
   left behind on success.
2. **Real export + checksum + upload** — the actual bounded backup: export
   `lgfc_lite`, compute SHA-256, upload `backup.sql` + `backup.sql.sha256`
   to `lgfc-d1-backups` under a dated prefix. Produces the first real
   backup artifact. Still no restore attempted in this package.
3. **Isolated restore + verification** — create
   `lgfc_lite_restore_drill_3268` (not wired into `wrangler.toml`),
   download and re-verify the checksum, import via
   `wrangler d1 execute --file=`, then verify table count and row counts
   against the export's own recorded counts. This is the actual restore
   proof Bill authorized.
4. **Teardown / disposition** — destroy the drill database (default) or
   document the decision to keep it, per Bill's direction at that point;
   record final Phase 2 evidence in this document for Gate 1's #2859 →
   #2780 → #2926 evidence chain.

Each package gets its own PR, its own live-run evidence posted to #3268 (or
a dedicated tracking comment), and its own review — matching the cadence
Phase 1 already used across PRs #3283 through #3303.

## What this document does not do (explicitly, so it isn't assumed)

- Does not implement any of the four packages above.
- Does not create any new D1 database, R2 object, or other Cloudflare
  resource.
- Does not request or provision any new credential.
- Does not change Gate 1 (HOLD) or Gate 2 (NO-GO).
- Does not authorize a Production D1 write or restore under any
  circumstance — no package in this plan ever targets `lgfc_lite` with a
  mutating operation.

## Acceptance checklist (this report)

- [x] Target design defined before any implementation code, per #3268's own
      required delivery method.
- [x] Both genuinely open capability questions (R2 write scope, D1 admin
      scope) are named as unverified rather than assumed.
- [x] Data sensitivity (item 6) grounded in a real grep of `migrations/*.sql`
      rather than left unaddressed a second time, without blocking on a full
      column-level audit.
- [x] Isolated restore target is isolated by construction (never referenced
      in `wrangler.toml`), not merely by naming convention.
- [x] Gate 1/Gate 2 status and the no-Production-write/restore constraint are
      restated explicitly, not assumed carried over silently.
