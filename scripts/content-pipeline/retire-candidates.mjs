#!/usr/bin/env node
/**
 * #5044: retire archived content_items rows (soft delete) on Product Authority's word.
 *
 * Follows resolve-near-duplicate.mjs (#3760): content_items stays append-only and auditable, so a
 * retirement is a soft delete through softDeleteCandidate (deleted_at, retention_reason,
 * purge_eligible_at, and a soft_delete moderation event). Nothing is hard-deleted from D1, and the
 * Backblaze object and media_assets row are left in place; physical removal needs a separate,
 * approved delete helper.
 *
 * Writes only with --apply. Without it the tool lists what it would retire.
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
 *   node --experimental-strip-types scripts/content-pipeline/retire-candidates.mjs \
 *     --issue 5044 --reason "Outside the club's scope (Product Authority 2026-11-01)" \
 *     [--candidate-id id[,id]] [--title-match 'pattern'] [--max 25] \
 *     [--actor wdhunter465] [--database lgfc_lite] [--local|--remote] [--apply]
 */

import path from 'node:path';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';
import { parseArgs, selectTargets } from './retire-candidates-lib.mjs';

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

const { makeWranglerD1 } = await import('../ci/wrangler-d1-adapter.mjs');
const { softDeleteCandidate } = await import('../../functions/_lib/content-pipeline-candidate-repository.ts');

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const db = makeWranglerD1({ database: options.database, target: options.target, cwd: repoRoot });

  // Active (not already retired) rows that have a picture in the archive.
  const rows =
    (
      await db
        .prepare(
          `SELECT candidate_id, title FROM content_items
           WHERE media_asset_id IS NOT NULL AND deleted_at IS NULL AND superseded_at IS NULL
           ORDER BY id`,
        )
        .all()
    ).results ?? [];

  const targets = selectTargets(rows, options);
  console.log(`${targets.length} archived candidate(s) selected${options.apply ? '' : ' (dry run, nothing will be written)'}:`);
  for (const row of targets) console.log(`  ${row.candidate_id}  ${row.title ?? ''}`);

  if (!targets.length) return;
  if (!options.apply) {
    console.log(`\nDry run. Re-run with --apply to soft-delete these, citing #${options.issue}.`);
    return;
  }

  const now = new Date().toISOString();
  let retired = 0;
  for (const row of targets) {
    const result = await softDeleteCandidate(
      db,
      row.candidate_id,
      { retention_reason: `${options.reason} (#${options.issue})`, purge_eligible_at: now },
      { actor: options.actor, notes: `Retired per #${options.issue}: ${options.reason}`, deleted_at: now },
    );
    if (result) {
      retired += 1;
      console.log(`Soft-deleted ${row.candidate_id}.`);
    } else {
      console.log(`Skipped ${row.candidate_id}: not found.`);
    }
  }
  console.log(`\nRetired ${retired} of ${targets.length}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
