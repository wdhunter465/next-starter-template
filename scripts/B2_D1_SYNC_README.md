# B2 → D1 Incremental Sync

## Overview

The `b2_d1_incremental_sync.sh` script provides a **daily, idempotent** synchronization of Backblaze B2 objects to Cloudflare D1 database. It detects new files and inserts only previously unseen objects into the `photos` table.

## Scope: which tables this covers

**`b2_d1_incremental_sync.sh` (the additive insert side) only knows about
the legacy `photos` table.** It has no awareness of the newer #3551/#3552
content pipeline tables (`content_items`, `rights_evidence`, `media_assets`)
even though those tables also track photos backed by B2 objects — new B2
objects belonging to the newer pipeline are ingested by the content-pipeline
ingest paths (`scripts/content-pipeline/ingest-batch.mjs`, the admin ingest
endpoint), not by this script.

**`b2_d1_deletion_reconcile.sh` (the deletion-reconciliation side) covers
both models as of #3714 phase 2b:** it soft-retires `photos` rows
(`is_matchup_eligible = -1`) *and* soft-deletes `content_items` rows whose
linked `media_assets.b2_key` is missing from B2 (via `deleted_at` /
`retention_reason`), reusing the same B2 listing for both. It skips the
`content_items`/`media_assets` reconciliation gracefully when those tables
are absent from the target database (e.g. `lgfc-litedev`).

**Maintenance requirement: if a table that stores photo-library rows backed
by B2 objects is ever added, removed, or renamed — in either the legacy
`photos` model or the `content_items`/`media_assets` pipeline — this sync
job's scope must be reviewed and, if needed, updated in the same PR.** A
table holding B2-backed photo rows that this job doesn't know about means
orphaned/missing-object rows in that table are never caught. See
`docs/reference/content-pipeline-rights-data-dictionary.md` for the
newer pipeline's table definitions and its own maintenance requirement.

## Key Features

- ✅ **Idempotent**: Safe to re-run indefinitely, no duplicates
- ✅ **Additive insert sync**: Discovers and inserts new B2 objects
- ✅ **Deletion reconciliation**: Retires D1 rows whose B2 objects are missing (`is_matchup_eligible = -1`)
- ✅ **Delta-based**: Compares B2 against D1
- ✅ **Secure**: SQL injection protection, no secrets logged
- ✅ **Robust**: Explicit error codes for different failure scenarios

## Usage

### GitHub Actions (Automated)

The workflow runs automatically daily at **04:00 EST** (`0 9 * * *` UTC) via `.github/workflows/b2-d1-daily-sync.yml` (incremental sync + deletion reconciliation). During daylight time (EDT) that fire time is 05:00 Eastern.

Manual trigger:
```bash
# Via GitHub UI: Actions → B2 → D1 Daily Sync → Run workflow
```

### Manual Execution

```bash
export B2_ENDPOINT="https://s3.us-west-004.backblazeb2.com"
export B2_BUCKET="your-bucket-name"
export B2_KEY_ID="your-key-id"
export B2_APP_KEY="your-app-key"
export D1_DATABASE_ID="your-d1-database-name"
export CLOUDFLARE_API_TOKEN="your-cf-token"
export CLOUDFLARE_ACCOUNT_ID="your-cf-account-id"
export PUBLIC_B2_BASE_URL="https://cdn.example.com"

bash scripts/b2_d1_incremental_sync.sh
bash scripts/b2_d1_deletion_reconcile.sh
```

### Dry Run Mode

Test without making changes:

```bash
export DRY_RUN=1
bash scripts/b2_d1_incremental_sync.sh
bash scripts/b2_d1_deletion_reconcile.sh
```

## Idempotency Guarantees

- Incremental sync uses `INSERT ... WHERE NOT EXISTS` guards.
- Deletion reconciliation updates only rows with `is_matchup_eligible >= 0` for
  keys absent from B2; already-retired rows are left unchanged.
- Safe to run multiple times per day.
- Soft-retire only: no `DELETE FROM photos`.

## Required Environment Variables

| Variable | Description |
|----------|-------------|
| `B2_ENDPOINT` | B2 S3-compatible endpoint URL |
| `B2_BUCKET` | B2 bucket name |
| `B2_KEY_ID` | B2 application key ID |
| `B2_APP_KEY` | B2 application key |
| `D1_DATABASE_NAME` | D1 database name for wrangler (defaults to `lgfc_lite`; `D1_DATABASE_ID` accepted as alias) |
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with **Account → D1 → Edit** and **User → User Details → Read** |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (`CF_ACCOUNT_ID` accepted as alias) |

## Optional Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `CF_API_TOKEN` / `CF_ACCOUNT_ID` | Aliases for Cloudflare credentials | optional |
| `PUBLIC_B2_BASE_URL` | Base URL for public access | `B2_ENDPOINT` |
| `DRY_RUN` | Generate SQL but don't execute (1=yes, 0=no) | `0` |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Missing required environment variable |
| 2 | B2 connection/authentication failure |
| 3 | D1 query failure |
| 4 | SQL execution failure |

## Data Schema

The script inserts into the `photos` table with the following mapping:

| D1 Column | B2 Source | Description |
|-----------|-----------|-------------|
| `photo_id` | Object `Key` | Unique identifier (external_id) |
| `url` | Object `Key` + base URL | Full public URL |
| `is_memorabilia` | Hardcoded | Set to `0` |
| `description` | Hardcoded | Empty string (for future use) |
| `created_at` | Object `LastModified` | Upload timestamp |

## Workflow

1. **Fetch B2 objects** via S3-compatible API (with pagination)
2. **Normalize** to standard format (external_id, filename, public_url, size, uploaded_at)
3. **Query D1** for existing `photo_id` values
4. **Calculate delta** (new objects = B2 objects - D1 records)
5. **Generate SQL** `INSERT ... WHERE NOT EXISTS` statements for new objects only
6. **Execute SQL** via `wrangler d1 execute`
7. **Deletion reconciliation** (`scripts/b2_d1_deletion_reconcile.sh`):
   - keys present in D1 (`is_matchup_eligible >= 0`) but absent from B2
   - soft-retire with `is_matchup_eligible = -1` and `PURGE_ELIGIBLE` note
   - repair active `weekly_matchups` still referencing excluded photos
   - clear `weekly_votes` when a repaired pair changes
   - refuse to retire when B2 inventory is empty (fail closed)
   - emit `has_findings` / counts to GitHub Actions; open findings issue only on
     actionable retires/repairs (failure still uses ops runtime escalation)
   - idempotent (reruns update zero already-retired rows)
8. **Log summary** (counts/keys only, no credentials)

Between daily runs, missing objects may still be repaired by
`GET /api/matchup/current` (eligibility + object probe) or
`POST /api/matchup/repair` from browser image failures.

## Testing

Run integration tests:

```bash
bash scripts/test_b2_d1_incremental_sync.sh
bash scripts/test_b2_d1_deletion_reconcile.sh
node scripts/test_ops_reconcile_findings.mjs
```

Tests verify:
- Script syntax and executability
- Environment variable validation
- Documentation completeness
- DRY_RUN mode support
- Error handling patterns
- SQL injection protection
- Idempotency patterns

## Security

- **No secrets logged**: All logging to stderr, no credentials exposed
- **SQL injection protection**: All user inputs escaped via `sql_escape()`
- **Strict error handling**: Uses `set -euo pipefail`
- **CodeQL verified**: 0 security alerts
- **Shellcheck clean**: All warnings resolved

## Rollback

To disable:
1. Delete or disable `.github/workflows/b2-d1-daily-sync.yml`
2. No data rollback needed (additive only)

## GitHub Actions secrets

The `OPS — B2 D1 Daily Sync` workflow requires:

- `CLOUDFLARE_API_TOKEN` with **Account → D1 → Edit** and **User → User Details → Read**
- `CLOUDFLARE_ACCOUNT_ID` (or `CF_ACCOUNT_ID`)
- `D1_DATABASE_NAME` (optional; defaults to `lgfc_lite` from `wrangler.toml`)
- B2 secrets: `B2_ENDPOINT`, `B2_BUCKET`, `B2_KEY_ID`, `B2_APP_KEY`

The workflow runs `scripts/ci/verify_cloudflare_d1_auth.mjs` before sync. If you see
`Authentication error [code: 10000]`, rotate the API token with the permissions above.

## Troubleshooting

### "ERROR: Required environment variable X is not set"
Ensure all required env vars are set. See [Required Environment Variables](#required-environment-variables).

### "ERROR: Failed to list B2 objects"
- Verify B2 credentials are valid
- Check B2_ENDPOINT matches bucket region
- Ensure key has `listBucket` permission

### "ERROR: Failed to query D1 database"
- Verify Cloudflare API token has D1 access
- Check D1 database ID/name is correct
- Ensure wrangler is installed and accessible

### "ERROR: Failed to execute SQL against D1"
- Check D1 database has `photos` table
- Verify API token has write permissions
- Review generated SQL in dry-run mode

## References

- Problem statement: See PR description
- D1 schema: `migrations/0003_photos.sql`, `migrations/0007_photos_metadata.sql`
- Workflow: `.github/workflows/b2-d1-daily-sync.yml`
