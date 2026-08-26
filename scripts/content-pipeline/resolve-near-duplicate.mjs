#!/usr/bin/env node
/**
 * #3760: resolve a near-duplicate flag raised by the perceptual-hash
 * backfill (#3740) once a human has reviewed the filed issue and decided
 * which of the two content_items rows to keep.
 *
 * --keep is cleared via resolveNearDuplicateFlag (duplicate_of and
 * review_priority reset to normal, with a review_state_change moderation
 * event). --remove is soft-deleted via the existing softDeleteCandidate
 * repository function (deleted_at/retention_reason set, with its own
 * soft_delete moderation event) -- content_items stays append-only/auditable,
 * nothing is hard-deleted from D1 or B2.
 *
 * Generic and reusable: not tied to any specific candidate pair, so it can
 * resolve any future near-duplicate flag the same way.
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
 *   node --experimental-strip-types scripts/content-pipeline/resolve-near-duplicate.mjs \
 *     --keep lgfc-gehrig-2026-505 --remove lgfc-gehrig-2026-519 --issue 3760 \
 *     [--actor wdhunter465] [--database lgfc_lite] [--local|--remote] [--dry-run]
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

const { makeWranglerD1 } = await import('../ci/wrangler-d1-adapter.mjs');
const { resolveNearDuplicateFlag } = await import('../../functions/_lib/content-pipeline-duplicate-detection.ts');
const { getCandidateByCandidateId, softDeleteCandidate } = await import(
  '../../functions/_lib/content-pipeline-candidate-repository.ts'
);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');

function printUsage() {
  console.log(
    'Usage: node --experimental-strip-types scripts/content-pipeline/resolve-near-duplicate.mjs --keep <candidate_id> --remove <candidate_id> --issue <n> [--actor wdhunter465] [--database lgfc_lite] [--local|--remote] [--dry-run]',
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
  const options = { database: 'lgfc_lite', target: 'local', dryRun: false, actor: 'wdhunter465' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--keep') {
      options.keep = readFlagValue(argv, index, '--keep');
      index += 1;
    } else if (arg === '--remove') {
      options.remove = readFlagValue(argv, index, '--remove');
      index += 1;
    } else if (arg === '--issue') {
      options.issue = readFlagValue(argv, index, '--issue');
      index += 1;
    } else if (arg === '--actor') {
      options.actor = readFlagValue(argv, index, '--actor');
      index += 1;
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
  if (!options.keep || !options.remove || !options.issue) {
    printUsage();
    throw new Error('--keep, --remove, and --issue are all required.');
  }
  if (options.keep === options.remove) {
    throw new Error('--keep and --remove must name different candidates.');
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const db = makeWranglerD1({ database: options.database, target: options.target, cwd: repoRoot });

  const keepCandidate = await getCandidateByCandidateId(db, options.keep);
  if (!keepCandidate) {
    throw new Error(`--keep candidate ${options.keep} was not found (or is already soft-deleted).`);
  }
  const removeCandidate = await getCandidateByCandidateId(db, options.remove);
  if (!removeCandidate) {
    throw new Error(`--remove candidate ${options.remove} was not found (or is already soft-deleted).`);
  }

  console.log(`Keep:   ${options.keep} (duplicate_of=${keepCandidate.duplicate_of ?? 'null'}, review_priority=${keepCandidate.review_priority})`);
  console.log(`Remove: ${options.remove} (duplicate_of=${removeCandidate.duplicate_of ?? 'null'}, review_priority=${removeCandidate.review_priority})`);

  if (options.dryRun) {
    console.log(`\nDry run -- no writes. Would clear ${options.keep}'s duplicate flag and soft-delete ${options.remove}, both citing #${options.issue}.`);
    return;
  }

  await resolveNearDuplicateFlag(db, options.keep, {
    actor: options.actor,
    notes: `Resolved per #${options.issue} -- kept as canonical, ${options.remove} is the duplicate being removed.`,
  });
  console.log(`Cleared duplicate flag on ${options.keep}.`);

  await softDeleteCandidate(
    db,
    options.remove,
    { retention_reason: `Duplicate of ${options.keep}, confirmed in #${options.issue}.` },
    {
      actor: options.actor,
      notes: `Resolved per #${options.issue} -- confirmed duplicate of ${options.keep}, which was kept as canonical.`,
    },
  );
  console.log(`Soft-deleted ${options.remove}.`);
}

main();
