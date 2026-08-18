#!/usr/bin/env node
/**
 * #3552/#3553: closes a gap in the Path B content-collection pipeline
 * (rights review -> rights_evidence -> media_assets.rights_hold cleared ->
 * B2 ingestion -> daily B2->D1 sync into `photos`). The B2->D1 incremental
 * sync inserts new `photos` rows with the column defaults (rights_hold = 1,
 * publication_eligible = 0) even when the same file already has a real,
 * human-reviewed clearance recorded in media_assets -- it never looks at
 * media_assets at all. This script propagates that already-recorded
 * decision onto the matching `photos` row (matched by the identical B2
 * object key: media_assets.b2_key = photos.photo_id). It never invents a
 * new rights decision -- see RECONCILE_PHOTOS_RIGHTS_FROM_MEDIA_ASSETS_SQL
 * for exactly what is copied and from where.
 *
 * Idempotent: intended to run after every B2->D1 sync (wired into
 * b2-d1-daily-sync.yml), not just once.
 *
 * Usage:
 *   node --experimental-strip-types scripts/ops/reconcile-photos-rights-from-media-assets.mjs \
 *     --confirm [--database lgfc_lite] [--local|--remote] [--dry-run]
 */

import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';

register(
  `data:text/javascript,${encodeURIComponent(`
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\\.(?:js|mjs|cjs|json|ts|tsx)$/i.test(specifier)) {
    try {
      return await nextResolve(specifier + '.ts', context);
    } catch {
      return nextResolve(specifier, context);
    }
  }
  return nextResolve(specifier, context);
}
`)}`,
  import.meta.url,
);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');

const { makeWranglerD1 } = await import('../ci/wrangler-d1-adapter.mjs');
const { RECONCILE_PHOTOS_RIGHTS_FROM_MEDIA_ASSETS_SQL } = await import(
  '../../functions/_lib/photos-rights-reconcile.ts'
);

function printUsage() {
  console.log(
    'Usage: node --experimental-strip-types scripts/ops/reconcile-photos-rights-from-media-assets.mjs --confirm [--database lgfc_lite] [--local|--remote] [--dry-run]',
  );
}

function readFlagValue(argv, index, flagName) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flagName}`);
  }
  return value;
}

function parseArgs(argv) {
  const options = { confirm: false, database: 'lgfc_lite', target: 'local', dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--confirm') {
      options.confirm = true;
    } else if (arg === '--database') {
      options.database = readFlagValue(argv, index, '--database');
      index += 1;
    } else if (arg === '--local') {
      options.target = 'local';
    } else if (arg === '--remote') {
      options.target = 'remote';
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
}

async function countPending(db) {
  const row = await db
    .prepare(
      `SELECT COUNT(*) AS n
       FROM photos
       WHERE photos.rights_hold = 1
         AND EXISTS (
           SELECT 1 FROM media_assets ma
           WHERE ma.b2_key = photos.photo_id AND ma.rights_hold = 0
         )`,
    )
    .first();
  return Number(row?.n ?? 0);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.dryRun && !options.confirm) {
    throw new Error('--confirm is required to actually update rows (or pass --dry-run to preview the count only)');
  }

  const db = makeWranglerD1({ database: options.database, target: options.target, cwd: repoRoot });

  const pendingBefore = await countPending(db);
  console.log(`\nphotos rows currently held with a matching cleared media_assets row: ${pendingBefore}`);

  if (options.dryRun) {
    console.log('\nDry run -- no rows updated.');
    return;
  }

  if (pendingBefore === 0) {
    console.log('\nNothing to reconcile.');
    return;
  }

  const out = await db.prepare(RECONCILE_PHOTOS_RIGHTS_FROM_MEDIA_ASSETS_SQL).run();
  const changed = Number(out?.meta?.changes ?? 0);

  const pendingAfter = await countPending(db);

  console.log(`\nUpdated ${changed} photos row(s).`);
  console.log(`photos rows still held with a matching cleared media_assets row: ${pendingAfter}`);

  if (pendingAfter !== 0) {
    throw new Error(`Expected 0 rows still pending reconciliation, but found ${pendingAfter}`);
  }
}

main();
