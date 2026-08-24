#!/usr/bin/env node
/**
 * #3658 Task 1 -- freeze and inventory the exact remediation population.
 *
 * Read-only. Mutates nothing. Identifies every `photos` / `media_assets` row
 * affected by the blanket quarantine-lift from migration 0054 (rows carrying
 * `rights_hold_reason = 'b2_audit_cleared_lgfc_owned_2026_08_17'`, the exact
 * marker that migration set) and separates them into #3658 Task 1's
 * categories 1 and 3 (this table has no category-2 rows -- see below):
 *
 *   1. legacy rows with no valid per-item evidence (the substantive target
 *      population -- by definition all of them, since #3658's premise is
 *      that this population has never had real rights_evidence recorded);
 *   3. rows already quarantined / not publication-eligible, which must stay
 *      fail-closed unless independently supported.
 *
 * Any row landing in neither category is reported by exact id as
 * "unaccounted" -- Task 1's exit evidence requires reproducible counts AND
 * item ids per category, so a classification gap must never be silently
 * dropped into a count-only mismatch.
 *
 * The 10 already-evidenced Wikimedia photos (#3658's category 2) are
 * NOT `photos`/`media_assets` rows -- they are `content_items` rows in the
 * separate #3551/#3552 discovery-pipeline schema (linked via PR #3580's real
 * per-item `rights_evidence`). This script reports that population
 * separately, from `content_items`/`rights_evidence`, as a cross-check that
 * they are correctly out of scope for the `photos`-table remediation this
 * inventory targets.
 *
 * Usage:
 *   node --experimental-strip-types scripts/ops/inventory-legacy-photos-rights-remediation.mjs \
 *     [--database lgfc_lite] [--local|--remote] [--json]
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');

const { makeWranglerD1 } = await import('../ci/wrangler-d1-adapter.mjs');

const BLANKET_CLEARANCE_REASON = 'b2_audit_cleared_lgfc_owned_2026_08_17';

function printUsage() {
  console.log(
    'Usage: node --experimental-strip-types scripts/ops/inventory-legacy-photos-rights-remediation.mjs [--database lgfc_lite] [--local|--remote] [--json]',
  );
}

function parseArgs(argv) {
  const options = { database: 'lgfc_lite', target: 'local', json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--database') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('Missing value for --database');
      options.database = value;
      index += 1;
    } else if (arg === '--local') {
      options.target = 'local';
    } else if (arg === '--remote') {
      options.target = 'remote';
    } else if (arg === '--json') {
      options.json = true;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

async function countRow(db, sql) {
  const row = await db.prepare(sql).first();
  return Number(row?.n ?? 0);
}

async function listIds(db, sql) {
  const result = await db.prepare(sql).all();
  return (result.results ?? []).map((row) => row.id);
}

async function listRows(db, sql) {
  const result = await db.prepare(sql).all();
  return result.results ?? [];
}

async function buildInventory(db) {
  const photosTotal = await countRow(db, 'SELECT COUNT(*) AS n FROM photos');
  const mediaAssetsTotal = await countRow(db, 'SELECT COUNT(*) AS n FROM media_assets');

  const blanketClearedPhotosIds = await listIds(
    db,
    `SELECT id FROM photos WHERE rights_hold_reason = '${BLANKET_CLEARANCE_REASON}' ORDER BY id`,
  );
  const blanketClearedMediaAssetsIds = await listIds(
    db,
    `SELECT id FROM media_assets WHERE rights_hold_reason = '${BLANKET_CLEARANCE_REASON}' ORDER BY id`,
  );

  // Category 1: the substantive target population. Every blanket-cleared
  // row has no valid per-item evidence by construction -- migration 0054
  // was a batch UPDATE, not per-item review, and no rights_evidence table
  // existed yet when it ran.
  const category1PhotosIds = blanketClearedPhotosIds;
  const category1MediaAssetsIds = blanketClearedMediaAssetsIds;

  // Category 3: rows never touched by the blanket clearance -- still held
  // or not publication-eligible. Must remain fail-closed; not this
  // package's concern beyond confirming the count.
  const stillQuarantinedPhotosIds = await listIds(
    db,
    `SELECT id FROM photos
     WHERE (rights_hold_reason IS NULL OR rights_hold_reason != '${BLANKET_CLEARANCE_REASON}')
       AND (rights_hold = 1 OR publication_eligible = 0)
     ORDER BY id`,
  );
  const stillQuarantinedMediaAssetsIds = await listIds(
    db,
    `SELECT id FROM media_assets
     WHERE (rights_hold_reason IS NULL OR rights_hold_reason != '${BLANKET_CLEARANCE_REASON}')
       AND rights_hold = 1
     ORDER BY id`,
  );

  // Cross-check only: the #3658 "already-evidenced Wikimedia" category is
  // NOT part of this table. Report it from its real source so the two
  // populations are never conflated.
  let wikimediaContentItemIds = [];
  try {
    wikimediaContentItemIds = await listIds(
      db,
      `SELECT DISTINCT ci.id AS id
       FROM content_items ci
       JOIN rights_evidence re ON re.content_item_id = ci.id
       WHERE re.conclusion IS NOT NULL
         AND (
           COALESCE(re.evidence_url, '') LIKE '%wikimedia%'
           OR COALESCE(re.repository_or_collection, '') LIKE '%wikimedia%'
         )
       ORDER BY ci.id`,
    );
  } catch (err) {
    // content_items/rights_evidence may not exist against an older schema
    // snapshot -- do not fail the legacy-photos inventory over this
    // informational cross-check.
    console.error(`Wikimedia cross-check query failed (non-fatal): ${err.message}`);
  }

  // Cross-check only: confirms whether the LOC-sourced public-domain photo
  // group already has real per-item rights_evidence recorded from when it
  // was originally discovered, rather than assuming it needs a fresh
  // verification task. Matches the schema's actual evidence_type/conclusion
  // fields (not a text search), so this reports the real recorded
  // determination, not a guess.
  let locPublicDomainContentItemIds = [];
  try {
    locPublicDomainContentItemIds = await listIds(
      db,
      `SELECT DISTINCT ci.id AS id
       FROM content_items ci
       JOIN rights_evidence re ON re.content_item_id = ci.id
       WHERE re.evidence_type = 'loc_statement'
         AND re.conclusion = 'public_domain_confirmed'
       ORDER BY ci.id`,
    );
  } catch (err) {
    console.error(`LOC cross-check query failed (non-fatal): ${err.message}`);
  }

  const allPhotosIds = await listIds(db, 'SELECT id FROM photos ORDER BY id');
  const allMediaAssetsIds = await listIds(db, 'SELECT id FROM media_assets ORDER BY id');

  const accountedPhotosIds = new Set([...category1PhotosIds, ...stillQuarantinedPhotosIds]);
  const accountedMediaAssetsIds = new Set([...category1MediaAssetsIds, ...stillQuarantinedMediaAssetsIds]);
  const unaccountedPhotosIds = allPhotosIds.filter((id) => !accountedPhotosIds.has(id));
  const unaccountedMediaAssetsIds = allMediaAssetsIds.filter((id) => !accountedMediaAssetsIds.has(id));

  // Row detail for the unaccounted rows only -- these are the ones whose
  // actual disposition is unknown from category membership alone, so a
  // human needs the real column values (not just an id) to reconcile them
  // against an external source of truth (e.g. the actual B2 bucket
  // listing).
  let unaccountedPhotosDetail = [];
  let unaccountedMediaAssetsDetail = [];
  if (unaccountedPhotosIds.length > 0) {
    unaccountedPhotosDetail = await listRows(
      db,
      `SELECT id, photo_id, url, rights_hold, rights_hold_reason, rights_status, publication_eligible, created_at
       FROM photos WHERE id IN (${unaccountedPhotosIds.join(',')}) ORDER BY id`,
    );
  }
  if (unaccountedMediaAssetsIds.length > 0) {
    unaccountedMediaAssetsDetail = await listRows(
      db,
      `SELECT id, media_uid, b2_key, size, rights_hold, rights_hold_reason, ingested_at
       FROM media_assets WHERE id IN (${unaccountedMediaAssetsIds.join(',')}) ORDER BY id`,
    );
  }

  return {
    photos: {
      total: photosTotal,
      category1_no_valid_evidence: category1PhotosIds,
      category3_still_quarantined: stillQuarantinedPhotosIds,
      unaccounted_ids: unaccountedPhotosIds,
      unaccounted_count: unaccountedPhotosIds.length,
      unaccounted_detail: unaccountedPhotosDetail,
    },
    media_assets: {
      total: mediaAssetsTotal,
      category1_no_valid_evidence: category1MediaAssetsIds,
      category3_still_quarantined: stillQuarantinedMediaAssetsIds,
      unaccounted_ids: unaccountedMediaAssetsIds,
      unaccounted_count: unaccountedMediaAssetsIds.length,
      unaccounted_detail: unaccountedMediaAssetsDetail,
    },
    wikimedia_cross_check: {
      note: 'content_items rows with real per-item rights_evidence referencing wikimedia -- NOT photos/media_assets rows, out of scope for this table, listed only to confirm no overlap.',
      content_item_ids: wikimediaContentItemIds,
    },
    loc_public_domain_cross_check: {
      note: "content_items rows with real per-item rights_evidence recording evidence_type='loc_statement' and conclusion='public_domain_confirmed' -- confirms whether the LOC public-domain photo group already has its determination recorded, so it is not re-flagged as needing verification.",
      content_item_ids: locPublicDomainContentItemIds,
    },
  };
}

function printReport(label, inventory) {
  console.log(`\n=== ${label} ===`);
  console.log(`photos: ${inventory.photos.total} total rows`);
  console.log(`  category 1 (no valid per-item evidence -- substantive target): ${inventory.photos.category1_no_valid_evidence.length}`);
  console.log(`  category 3 (still quarantined / fail-closed, untouched): ${inventory.photos.category3_still_quarantined.length}`);
  if (inventory.photos.unaccounted_count !== 0) {
    console.log(
      `  ⚠ UNACCOUNTED: ${inventory.photos.unaccounted_count} row(s) not classified by either category -- ids: ${inventory.photos.unaccounted_ids.join(', ')}`,
    );
  }
  console.log(`media_assets: ${inventory.media_assets.total} total rows`);
  console.log(`  category 1 (no valid per-item evidence -- substantive target): ${inventory.media_assets.category1_no_valid_evidence.length}`);
  console.log(`  category 3 (still quarantined / fail-closed, untouched): ${inventory.media_assets.category3_still_quarantined.length}`);
  if (inventory.media_assets.unaccounted_count !== 0) {
    console.log(
      `  ⚠ UNACCOUNTED: ${inventory.media_assets.unaccounted_count} row(s) not classified by either category -- ids: ${inventory.media_assets.unaccounted_ids.join(', ')}`,
    );
  }
  console.log(`wikimedia cross-check (content_items, informational only): ${inventory.wikimedia_cross_check.content_item_ids.length} row(s)`);
  console.log(`LOC public-domain cross-check (content_items, informational only): ${inventory.loc_public_domain_cross_check.content_item_ids.length} row(s) already have recorded evidence`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const db = makeWranglerD1({ database: options.database, target: options.target, cwd: repoRoot });
  const inventory = await buildInventory(db);

  if (options.json) {
    console.log(JSON.stringify(inventory, null, 2));
    return;
  }

  printReport(`${options.database} (${options.target})`, inventory);
}

main();
