#!/usr/bin/env node
/**
 * #3552 phase 4: one-time backfill of media_assets.perceptual_hash for
 * rows ingested before phase 4 added hash computation to the ingest path.
 * Operates on whatever the live database currently holds (not a fixed
 * candidates JSON file, unlike the other content-pipeline scripts) --
 * every media_assets row with perceptual_hash IS NULL gets its object
 * downloaded from B2's public URL, hashed, and the row updated. After each
 * write it also runs the same near-duplicate check the live ingest path
 * runs, so pre-existing cross-source duplicates among the backfilled set
 * get flagged for admin review exactly like a newly-ingested one would.
 *
 * Safe to re-run: only rows still missing a hash are touched.
 *
 * #3761: in --dry-run mode, the near-duplicate check still runs (read-only)
 * against whatever is ALREADY hashed in the database, so a dry run gives a
 * real preview of matches against pre-existing hashed history. It cannot
 * preview matches between two rows that are BOTH missing a hash within the
 * same dry run, since neither one's hash is ever written during a dry run
 * for the other to compare against -- that class of match only appears
 * once the real (non-dry-run) apply actually persists hashes as it goes.
 *
 * If NEAR_DUPLICATE_FLAGS_FILE is set, every near-duplicate actually
 * flagged during a real (non-dry-run) run is also written there as a JSON
 * array of {candidateId, candidateSourceUrl, matchedCandidateId,
 * matchedSourceUrl, distance, title, body} -- the caller (the GitHub
 * Actions workflow) uses this to file one issue per flagged pair via `gh
 * issue create`, so review is "open the issue, compare two links" instead
 * of a manual D1 query session.
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
 *   B2_ENDPOINT=... B2_BUCKET=... [PUBLIC_B2_BASE_URL=...] \
 *   [NEAR_DUPLICATE_FLAGS_FILE=...] \
 *   node --experimental-strip-types scripts/content-pipeline/backfill-media-perceptual-hashes.mjs \
 *     [--database lgfc_lite] [--local|--remote] [--dry-run]
 */

import fs from 'node:fs';
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

const { makeWranglerD1 } = await import('../ci/wrangler-d1-adapter.mjs');
const {
  findNearDuplicateMediaAssets,
  flagCandidateAsNearDuplicate,
  buildNearDuplicateIssueContent,
} = await import('../../functions/_lib/content-pipeline-duplicate-detection.ts');
const { computePerceptualHash } = await import('../../functions/_lib/perceptual-hash.ts');

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');

function printUsage() {
  console.log(
    'Usage: node --experimental-strip-types scripts/content-pipeline/backfill-media-perceptual-hashes.mjs [--database lgfc_lite] [--local|--remote] [--dry-run]',
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
  const options = { database: 'lgfc_lite', target: 'local', dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--database') {
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

function resolvePublicBaseUrl() {
  if (process.env.PUBLIC_B2_BASE_URL) {
    return process.env.PUBLIC_B2_BASE_URL.replace(/\/+$/, '');
  }
  const endpoint = process.env.B2_ENDPOINT;
  const bucket = process.env.B2_BUCKET;
  if (!endpoint || !bucket) {
    throw new Error('Either PUBLIC_B2_BASE_URL, or both B2_ENDPOINT and B2_BUCKET, must be set.');
  }
  const endpointHost = endpoint.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  return `https://${endpointHost}/${bucket}`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const publicBaseUrl = resolvePublicBaseUrl();

  const db = makeWranglerD1({ database: options.database, target: options.target, cwd: repoRoot });

  const pending = await db
    .prepare(`SELECT media_uid, b2_key FROM media_assets WHERE perceptual_hash IS NULL`)
    .all();
  const rows = pending.results ?? [];

  console.log(`${rows.length} media_assets row(s) missing perceptual_hash.`);

  let hashed = 0;
  let failed = 0;
  let flaggedTotal = 0;
  const flaggedForIssues = [];

  for (const row of rows) {
    const objectUrl = `${publicBaseUrl}/${row.b2_key}`;
    try {
      const response = await fetch(objectUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} fetching ${objectUrl}`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      const perceptualHash = await computePerceptualHash(bytes);

      console.log(`${row.media_uid} (${row.b2_key}): hash=${perceptualHash}`);
      hashed += 1;

      if (!options.dryRun) {
        await db
          .prepare(`UPDATE media_assets SET perceptual_hash = ? WHERE media_uid = ?`)
          .bind(perceptualHash, row.media_uid)
          .run();
      }

      const contentItem = await db
        .prepare(`SELECT candidate_id, title, source_url FROM content_items WHERE media_asset_id = ? LIMIT 1`)
        .bind(`b2://${row.b2_key}`)
        .first();
      if (contentItem) {
        const matches = await findNearDuplicateMediaAssets(db, {
          perceptualHash,
          sourceFilename: contentItem.title ?? '',
          excludeMediaUid: row.media_uid,
        });
        if (matches.length > 0) {
          if (!options.dryRun) {
            await flagCandidateAsNearDuplicate(db, contentItem.candidate_id, matches);
          }
          flaggedTotal += 1;
          console.log(
            `  -> ${contentItem.candidate_id}: flagged ${matches.length} near-duplicate candidate(s)${
              options.dryRun ? ' (dry run -- not written)' : ' for admin review'
            }: ${matches.map((m) => `${m.matchedCandidateId} (distance=${m.distance})`).join(', ')}`,
          );

          if (!options.dryRun) {
            for (const match of matches) {
              const { title, body } = buildNearDuplicateIssueContent({
                candidateId: contentItem.candidate_id,
                candidateSourceUrl: contentItem.source_url ?? null,
                matchedCandidateId: match.matchedCandidateId,
                matchedSourceUrl: match.matchedSourceUrl,
                distance: match.distance,
              });
              flaggedForIssues.push({
                candidateId: contentItem.candidate_id,
                candidateSourceUrl: contentItem.source_url ?? null,
                matchedCandidateId: match.matchedCandidateId,
                matchedSourceUrl: match.matchedSourceUrl,
                distance: match.distance,
                title,
                body,
              });
            }
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`${row.media_uid} (${row.b2_key}): FAILED -- ${message}`);
      failed += 1;
    }
  }

  console.log(
    `\n${hashed} hashed${options.dryRun ? ' (dry run -- no writes)' : ''}, ${failed} failed, ${flaggedTotal} candidate(s) ${options.dryRun ? 'that would be' : 'newly'} flagged as near-duplicates, out of ${rows.length}.`,
  );

  if (process.env.NEAR_DUPLICATE_FLAGS_FILE && flaggedForIssues.length > 0) {
    fs.writeFileSync(process.env.NEAR_DUPLICATE_FLAGS_FILE, JSON.stringify(flaggedForIssues, null, 2));
    console.log(`Wrote ${flaggedForIssues.length} near-duplicate flag(s) to ${process.env.NEAR_DUPLICATE_FLAGS_FILE}`);
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
