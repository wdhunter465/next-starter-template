---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Owns: How to seed the baseline CMS content blocks into the local D1 database and verify them
Does Not Own: The `content_blocks` schema, key naming and seed behavior (see /docs/reference/architecture/cms-data-layer.md); publishing or editing CMS content (see /docs/how-to/website/admin-cms-and-page-content.md)
Canonical Reference: /docs/reference/architecture/cms-data-layer.md
Related Issues: #4853, #4826
Last Reviewed: 2026-10-25
---

# Seed the baseline CMS content blocks (local)

The seed script creates the 9 baseline `content_blocks` rows as drafts. It is idempotent, so running it again does not create duplicates. The table, keys and seed behavior are defined in `docs/reference/architecture/cms-data-layer.md`; this page holds only the commands.

This procedure targets the local database (`--local`). It does not write to Production.

## Steps

1. Apply the migrations to the local database first:

   ```bash
   npx wrangler d1 migrations apply lgfc_lite --local
   ```

2. Run the seed script (`scripts/seed_cms_content_blocks.mjs`):

   ```bash
   node scripts/seed_cms_content_blocks.mjs
   ```

3. Verify the seeded rows:

   ```bash
   npx wrangler d1 execute lgfc_lite --local --command \
     "SELECT key, page, status FROM content_blocks ORDER BY key;"
   ```

   Expect 9 rows with `status = 'draft'`, the keys listed in the reference document.

## Validation

All 9 baseline keys are present as drafts. Running step 2 again leaves the row count unchanged.

## Rollback

The seed only inserts rows (`INSERT OR IGNORE`) with `updated_by = 'seed'`. To undo it locally, delete those rows or reset the local database; nothing outside the local database is changed.
