#!/usr/bin/env node
/**
 * #5231: read-only story inventory progress against the 396-story target. Runs one SELECT against D1 and writes a
 * Markdown report. It never writes to D1 or B2.
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
 *   node scripts/ops/inventory-progress.mjs [--database lgfc_lite] [--local|--remote] [--out inventory-progress.md] [--today YYYY-MM-DD]
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { makeWranglerD1 } from '../ci/wrangler-d1-adapter.mjs';
import { assertSelectOnly } from './archive-report-lib.mjs';
import { COUNTS_SQL, computeProgress, renderMarkdown } from './inventory-progress-lib.mjs';

export function parseArgs(argv) {
  const options = { database: 'lgfc_lite', target: 'remote', out: 'inventory-progress.md', today: new Date().toISOString().slice(0, 10) };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--database') options.database = argv[++i];
    else if (arg === '--local') options.target = 'local';
    else if (arg === '--remote') options.target = 'remote';
    else if (arg === '--out') options.out = argv[++i];
    else if (arg === '--today') options.today = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const db = makeWranglerD1({ database: options.database, target: options.target, cwd: process.cwd() });
  const rows = (await db.prepare(assertSelectOnly(COUNTS_SQL)).all()).results ?? [];
  if (rows.length !== 1) throw new Error(`Expected one counts row, got ${rows.length}`);
  const markdown = renderMarkdown(computeProgress(rows[0], options.today));
  fs.writeFileSync(options.out, `${markdown}\n`);
  console.log(markdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
