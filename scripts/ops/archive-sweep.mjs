#!/usr/bin/env node
/**
 * #5098: the archive sweep. Purges archive records approved for deletion (lifecycle state
 * `ok_to_delete`, waiting period passed): writes a tombstone, deletes the B2 objects, removes the
 * picture rows and marks the record `purged`. Dry run by default; nothing is deleted without --apply.
 * Running it against Production needs Product Authority's Go on #5098.
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
 *   B2_ENDPOINT=... B2_BUCKET=... B2_KEY_ID=... B2_APP_KEY=... \
 *   node --experimental-strip-types scripts/ops/archive-sweep.mjs \
 *     [--database lgfc_lite] [--local|--remote] [--limit 5] [--apply]
 */
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

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
const { requireB2, deleteB2ObjectAllVersions } = await import('../../functions/_lib/b2.ts');
const { parseArgs, runSweep } = await import('./archive-sweep-lib.mjs');


async function main() {
  const options = parseArgs(process.argv.slice(2));
  const db = makeWranglerD1({ database: options.database, target: options.target, cwd: process.cwd() });
  let deleteObject = async () => {
    throw new Error('dry run: no B2 deletion');
  };
  if (options.apply) {
    const b2 = requireB2(process.env);
    if (!b2.ok) throw new Error('--apply needs B2_ENDPOINT, B2_BUCKET, B2_KEY_ID and B2_APP_KEY.');
    deleteObject = (key) => deleteB2ObjectAllVersions(b2.cfg, key);
  }
  const nowIso = new Date().toISOString();
  const report = await runSweep(db, { deleteObject, apply: options.apply, limit: options.limit, nowIso, sweepRun: nowIso });
  console.log(JSON.stringify({ mode: options.apply ? 'apply' : 'dry-run', ...report }, null, 2));
  if (report.failed.length > 0) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
