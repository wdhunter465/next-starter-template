---
Doc Type: Archive
Audience: Human + AI
Authority Level: Historical Record
Owns: Historical lock-point notes for the LGFC-Lite v1 baseline tag
Does Not Own: Active operational authority, design, or implementation instructions
Canonical Reference: /docs/ops/pmo/diataxis-legacy-retirement-policy.md
Last Reviewed: 2026-08-06
---

# LGFC-Lite v1 Baseline (Lock Point)

> ARCHIVED 2026-10-26. Historical and non-authoritative. Replacement: none. Source: #4896.

When Steps 1–5 are green and deployed, tag the repository:

- Tag name: `lgfc-lite-v1.0-baseline`
- Purpose: a clean rollback point before adding new features.

Baseline expectations:
- B2 S3 smoke test passes in CI (Step 1)
- Inventory script produces JSON + CSV (Step 2)
- Enrichment script produces enriched inventory (Step 3)
- Site surfaces real Gehrig content and the Photo Archive reads from inventory (Step 4)
- No ZIP artifacts are committed to the repo (hygiene rule)

Operational rule:
- After baseline tag: additive PRs only. No more recovery ZIP cycles.

---

## B2 → D1 Sync Operations

### One-Command Sync

To sync B2 inventory to D1 photos table:

```bash
bash scripts/b2_sync_photos_to_d1.sh
```

This runs the full pipeline:
1. B2 inventory report
2. Inventory enrichment
3. SQL seed generation
4. D1 execution via wrangler
5. Photo count verification

### Required Environment Variables

**B2 Credentials:**
- `B2_KEY_ID` - B2 application key ID
- `B2_APP_KEY` - B2 application key
- `B2_ENDPOINT` - B2 S3-compatible endpoint (e.g., `https://s3.us-west-004.backblazeb2.com`)
- `B2_BUCKET` - B2 bucket name
- `PUBLIC_B2_BASE_URL` - Public base URL for images

**Cloudflare D1:**
- `CLOUDFLARE_API_TOKEN` (or `CF_API_TOKEN`) - Cloudflare API token with D1 edit permissions
- `CLOUDFLARE_ACCOUNT_ID` (or `CF_ACCOUNT_ID`) - Cloudflare account ID

**Optional:**
- `D1_DB_NAME` - D1 database name (default: `lgfc_lite`)

### Required Tools

- `bash` - Shell interpreter
- `node` - Node.js runtime (for converter script)
- `wrangler` - Cloudflare Wrangler CLI (or `npx`)
- `aws` - AWS CLI (for S3-compatible B2 access)
- `jq` - JSON processor
- `python3` - Python 3 (for enrichment script)

### Output Files

- **Logs:** `.tmp/b2_sync_*.log`
- **SQL:** `.tmp/seed_photos.sql`
- **Inventory:** `data/b2/inventory*.{json,csv}`
- **Enriched:** `data/b2/inventory_enriched.json`

### Daily Sync

A GitHub Actions workflow runs daily at 06:17 UTC to sync B2 content to D1:
- Workflow: `.github/workflows/b2-d1-daily-sync.yml`
- Incrementally syncs new B2 objects to D1
- Fully idempotent and safe to run repeatedly
- Can be manually triggered via workflow_dispatch
