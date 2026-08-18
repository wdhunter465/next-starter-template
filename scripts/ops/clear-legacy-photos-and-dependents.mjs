#!/usr/bin/env node
/**
 * #3552: one-time cleanup after Bill manually reduced the B2 bucket down to
 * 15 real files (10 newly LGFC_-ingested + 5 pre-existing). The legacy
 * `photos` table still has rows for every object that used to be in B2 --
 * clearing it and letting the existing b2_d1_incremental_sync.sh rebuild it
 * from the real bucket contents is the intended fix.
 *
 * `content_inventory_media.media_id` has `FOREIGN KEY ... REFERENCES
 * photos(id) ON DELETE RESTRICT`, so a blind `DELETE FROM photos` fails
 * outright while any row references it. `weekly_matchups`/`weekly_votes`
 * and `milestones.photo_id` aren't FK-enforced but would silently go stale
 * (point at photo IDs that no longer exist) if left alone. Per Bill's
 * explicit direction, all four are cleared/nulled alongside photos --
 * this is a full reset, not a partial one.
 *
 * No schema changes. Reports row counts before and after for the record.
 *
 * Usage:
 *   node --experimental-strip-types scripts/ops/clear-legacy-photos-and-dependents.mjs \
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
const { LEGACY_PHOTOS_CLEANUP_STATEMENTS } = await import('../../functions/_lib/legacy-photos-cleanup-plan.ts');

function printUsage() {
  console.log(
    'Usage: node --experimental-strip-types scripts/ops/clear-legacy-photos-and-dependents.mjs --confirm [--database lgfc_lite] [--local|--remote] [--dry-run]',
  );
}

function parseArgs(argv) {
  const options = { confirm: false, database: 'lgfc_lite', target: 'local', dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--confirm') {
      options.confirm = true;
    } else if (arg === '--database') {
      options.database = argv[index + 1];
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

async function countRows(db, table, whereClause) {
  const sql = whereClause ? `SELECT COUNT(*) AS n FROM ${table} WHERE ${whereClause}` : `SELECT COUNT(*) AS n FROM ${table}`;
  const row = await db.prepare(sql).first();
  return Number(row?.n ?? 0);
}

async function reportCounts(db, label) {
  const counts = {
    photos: await countRows(db, 'photos'),
    content_inventory_media: await countRows(db, 'content_inventory_media'),
    weekly_matchups: await countRows(db, 'weekly_matchups'),
    weekly_votes: await countRows(db, 'weekly_votes'),
    milestones_with_photo: await countRows(db, 'milestones', 'photo_id IS NOT NULL'),
  };
  console.log(`\n${label}:`);
  for (const [table, count] of Object.entries(counts)) {
    console.log(`  ${table}: ${count}`);
  }
  return counts;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (!options.dryRun && !options.confirm) {
    throw new Error('--confirm is required to actually delete rows (or pass --dry-run to preview counts only)');
  }

  const db = makeWranglerD1({ database: options.database, target: options.target, cwd: repoRoot });

  const before = await reportCounts(db, 'Row counts before clearing');

  if (options.dryRun) {
    console.log('\nDry run -- no rows deleted.');
    return;
  }

  for (const statement of LEGACY_PHOTOS_CLEANUP_STATEMENTS) {
    console.log(`\nRunning: ${statement}`);
    await db.prepare(statement).run();
  }

  const after = await reportCounts(db, 'Row counts after clearing');

  const stillPresent = Object.entries(after).filter(([, count]) => count > 0);
  if (stillPresent.length > 0) {
    throw new Error(`Expected all counts to be 0 after clearing, but found: ${JSON.stringify(Object.fromEntries(stillPresent))}`);
  }

  console.log(
    `\nCleared ${before.photos} photos, ${before.content_inventory_media} content_inventory_media, ${before.weekly_matchups} weekly_matchups, ${before.weekly_votes} weekly_votes, and nulled ${before.milestones_with_photo} milestones.photo_id reference(s).`,
  );
}

main();
