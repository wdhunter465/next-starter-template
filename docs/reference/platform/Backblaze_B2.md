---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Backblaze B2 resource inventory and B2↔D1 sync facts as a supporting specification
Does Not Own: Platform and Environment Domain Policy; UI design specifics; PR process; incident response playbooks
Canonical Reference: /docs/governance/PLATFORM-AND-ENVIRONMENT.md
Related Issues: #2688
Last Reviewed: 2026-07-21
---

# Backblaze B2 — Resource Inventory (LGFC)

This document is the **supporting Backblaze B2 resource inventory** under the Platform and Environment Domain Policy (`docs/governance/PLATFORM-AND-ENVIRONMENT.md`).

Purpose: Design/resource inventory for Backblaze B2 as used by the LGFC site.  
No operational status notes. No secrets. No app keys.

This file is **not** a Domain Policy co-owner. Domain-policy conflicts resolve through `docs/governance/PLATFORM-AND-ENVIRONMENT.md`.

---

## Account Usage Pattern (LGFC)

- B2 is the canonical object store for site media (photos + memorabilia images + related documents).
- Public site and FanClub **read** from B2 via public base URL / S3-compatible endpoint.
- **Writes/uploads are admin-controlled** (no member/dev uploads).

---

## Bucket Inventory (from console screenshots)

Bucket:
- Name: `LouGehrigFanClub`
- Type: Public
- File lifecycle / versioning: Keep all versions
- Encryption: Enabled
- Object Lock: Disabled
- Current files: ~51
- Current size: ~77.8 MB
- S3-compatible endpoint: `s3.us-east-005.backblazeb2.com`
- Replication: none configured

---

## App Configuration (no secrets)

Expected env vars (names only):
- `B2_KEY_ID`
- `B2_APP_KEY`
- `B2_BUCKET`
- `B2_ENDPOINT`
- `PUBLIC_B2_BASE_URL`

Notes:
- Keys are never stored in repo docs.
- Keys are never logged by scripts.
- all B2 variables are saved as Repo Secrets
---

## How the Site Uses B2

### Public surfaces
- Homepage Weekly Matchup uses B2 image URLs for photo display (via D1 rows that reference object keys / URLs).
- FanClub galleries use B2-backed media entries.

### FanClub surfaces
- `/fanclub/photo`: thumbnails + tag search (photos table references B2 objects).
- `/fanclub/memorabilia`: thumbnails + descriptions; long-form documents live in Library with linkage.
- `/fanclub/library`: reading materials; may link to B2 documents (PDFs/images) where applicable.

---

## D1 Integration Model

Design intent:
- D1 is the index/catalog.
- B2 is the blob store.
- “New media” appears in the site by inserting/upserting D1 rows that reference B2 object keys / URLs.

Primary table(s) involved (as implemented by sync tooling):
- `photos` (B2 → D1 sync targets this table)

Other media tables may exist depending on phase (catalog + metadata), but the current automated sync tooling is explicitly photo-focused.

### B2 inventory vs club-use curation (`photos.is_matchup_eligible`)

The B2 bucket may contain objects that are not approved for public club surfaces. D1 indexes every synced object; **club-use eligibility is a separate curation flag** on the `photos` row.

Canonical values (ChatGPT model):

| Value | Meaning | Matchup / homepage use |
| --- | --- | --- |
| `0` | Default / unreviewed | **Do not use** until an admin marks the row reviewed |
| `1` | Approved for club use | **Eligible** for Weekly Photo Matchup rotation and other approved public surfaces |
| `-1` | Explicitly excluded | **Never use** (e.g. logo images that clip badly in the matchup frame) |

Rules:

- B2 → D1 sync sets `is_matchup_eligible = 0` for newly ingested rows unless metadata overrides it.
- Admins promote suitable club photos to `1` and demote unsuitable rows to `-1` via `/admin/d1-test/` (curation editing deferred to an upcoming PMO program; inspect-only today).
- New rows are never blank: the column is `INTEGER NOT NULL DEFAULT 0`.
- **Weekly Photo Matchup selection uses only rows where `is_matchup_eligible = 1` — enforced as a literal value, not a range.** `0` (unreviewed) and `-1` (excluded) are both refused. This is a copyright-safety requirement: an unlicensed or not-yet-reviewed photo must never appear on the public site, even temporarily. See `functions/api/matchup/current.ts` and `scripts/ci/matchup_pair_monitor.mjs` (the two code paths that select/write photos into a live `weekly_matchups` row).
- Operational consequence of the rule above: until an admin has promoted at least two photos to `1`, the Weekly Photo Matchup has no eligible pair and fails closed (`items: []`) rather than showing an unreviewed photo. This is intended behavior, not a bug.
- After D1 recovery, rows whose URL/filename no longer match pre-failure records reset to `0` until re-reviewed (see recovery doctrine in ops docs).
- URL text in D1 must stay aligned with the B2 object key/path for migrations and eligibility rules to reapply correctly.

**Distinct from the copyright gate:** `is_matchup_eligible` governs curation/suitability for the matchup rotation specifically (e.g. an image that clips badly in the matchup frame). The actual copyright/rights-clearance gate is `rights_hold = 0 AND publication_eligible = 1` (`functions/_lib/rights-hold.ts`'s `rightsClearedClause`), which every public/member-facing read already requires independently and which defaults every new row to closed (`rights_hold` defaults to `1`, `publication_eligible` defaults to `0`). `is_matchup_eligible` is an additional, narrower layer on top of that gate for the matchup UI, not a substitute for it.

**Note on `scripts/b2_d1_deletion_reconcile.sh`'s use of `is_matchup_eligible >= 0`:** that is a different, correct use of the column — it means "not yet retired" (i.e. `0` or `1`, as opposed to `-1` excluded), used to decide which rows are still active enough to check against the live B2 bucket for the daily retirement sweep. It is not a display gate and should not be tightened to `= 1`; only the two code paths that actually select photos for public display (linked above) enforce the literal `= 1` requirement.

**Scope note:** this `-1`/`0`/`1` model is specific to the legacy `photos`
table. The daily B2 → D1 *additive insert* sync
(`scripts/b2_d1_incremental_sync.sh`) only ever writes to `photos`. The
daily *deletion-reconciliation* sweep (`scripts/b2_d1_deletion_reconcile.sh`)
covers both table families as of #3714 phase 2b: it still retires `photos`
rows via this `-1`/`0`/`1` flag, and separately soft-deletes `content_items`
rows whose linked `media_assets.b2_key` is missing from B2 — but that side
does **not** reuse this flag. `content_items` has its own soft-delete
columns (`deleted_at`, `retention_reason`, `purge_eligible_at`) suited to
that pipeline instead. See
`docs/reference/content-pipeline-rights-data-dictionary.md` for that
pipeline's schema and `scripts/B2_D1_SYNC_README.md` for the sync job's
current scope and the requirement to update it if a photo-library table is
ever added, removed, or renamed.

---

## Repo Tooling (B2 ↔ D1)

These scripts/docs exist in the repo ZIP and define the current sync approach:

Scripts:
- `scripts/b2_inventory_sync.sh`
  - Enumerates objects in the B2 bucket via S3-compatible API and emits normalized JSON inventory.
- `scripts/b2_sync_photos_to_d1.sh`
  - End-to-end pipeline: inventory → enrich → SQL seed → execute via wrangler → verify count.
- `scripts/b2_d1_daily_sync.sh`
  - Delta-only daily sync: compares B2 objects against committed snapshot and upserts only new keys into D1.
- `scripts/b2_d1_incremental_sync.sh`
  - Production daily additive sync: list B2 → insert unseen keys into `photos` (no deletes).
- `scripts/b2_d1_deletion_reconcile.sh`
  - Deletion reconciliation (#2519): soft-retire D1 rows whose B2 keys are missing
    (`is_matchup_eligible = -1`, `PURGE_ELIGIBLE` note); repair active matchups that
    still reference excluded photos and clear votes on pair change; emit findings
    for an ops issue only when retires/repairs occurred. Fails closed on empty B2
    inventory. Runs after incremental sync in `.github/workflows/b2-d1-daily-sync.yml`
    (daily **04:00 EST** / `0 9 * * *` UTC + `workflow_dispatch`).
- `scripts/ci/ops_reconcile_findings.mjs`
  - Upserts the actionable-findings issue for successful reconcile results.
- `scripts/d1_media_ingest.js`
  - Reads inventory JSON and inserts only previously unseen objects into D1 (idempotent).

Docs:
- `scripts/B2_D1_SYNC_README.md`
  - Describes daily idempotent B2→D1 incremental sync + deletion reconciliation.

Snapshot file (committed reference):
- `data/b2/inventory.json`

Automation:
- GitHub Actions workflow referenced in `scripts/B2_D1_SYNC_README.md`:
  - `.github/workflows/b2-d1-daily-sync.yml`

---

## CORS / Public Access

Bucket is public. The site expects direct GET access to objects via the public base URL.  
CORS rules (if needed) should be documented here once finalized in console.

---

## Future Enhancements (design only)

- Replication rules (optional) for redundancy.
- Snapshot retention policy for `data/b2/inventory.json` history (repo governance).
- Content-type normalization and metadata enrichment for better search/tagging.

