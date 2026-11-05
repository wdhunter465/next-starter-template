#!/usr/bin/env node
/**
 * #5084: read-only archive report. Runs SELECT statements against D1 and writes a CSV (one row per
 * B2 picture) and a Markdown summary. It never writes to D1 or B2.
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
 *   node scripts/ops/archive-report.mjs [--database lgfc_lite] [--local|--remote] [--out-dir archive-report]
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { makeWranglerD1 } from '../ci/wrangler-d1-adapter.mjs';
import {
  CONTENT_WITHOUT_MEDIA_SQL,
  PHOTOS_WITHOUT_MEDIA_SQL,
  REPORT_SQL,
  assertSelectOnly,
  classifyRow,
  renderMarkdown,
  summarize,
  toCsv,
} from './archive-report-lib.mjs';

export function parseArgs(argv) {
  const options = { database: 'lgfc_lite', target: 'remote', outDir: 'archive-report' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--database') options.database = argv[++i];
    else if (arg === '--local') options.target = 'local';
    else if (arg === '--remote') options.target = 'remote';
    else if (arg === '--out-dir') options.outDir = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const db = makeWranglerD1({ database: options.database, target: options.target, cwd: process.cwd() });
  const read = async (sql) => (await db.prepare(assertSelectOnly(sql)).all()).results ?? [];

  const rows = (await read(REPORT_SQL)).map(classifyRow);
  const photosWithoutMedia = await read(PHOTOS_WITHOUT_MEDIA_SQL);
  const contentWithoutMedia = await read(CONTENT_WITHOUT_MEDIA_SQL);
  const summary = summarize(rows);

  fs.mkdirSync(options.outDir, { recursive: true });
  fs.writeFileSync(path.join(options.outDir, 'archive-report.csv'), toCsv(rows));
  fs.writeFileSync(path.join(options.outDir, 'photos-without-media.csv'), toCsv(photosWithoutMedia, ['photo_id', 'url', 'publication_eligible', 'rights_hold', 'rights_status']));
  fs.writeFileSync(path.join(options.outDir, 'content-without-media.csv'), toCsv(contentWithoutMedia, ['content_item_id', 'candidate_id', 'media_asset_id']));
  const markdown = renderMarkdown(summary, { photosWithoutMedia, contentWithoutMedia }, new Date().toISOString());
  fs.writeFileSync(path.join(options.outDir, 'archive-report.md'), markdown);
  console.log(markdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
