#!/usr/bin/env node
/**
 * #4592 dry run. Groups stored source_url values by their normalized form and
 * prints how many existing rows would match as duplicates. Does not write.
 *
 *   node --experimental-strip-types scripts/content-pipeline/report-normalized-url-duplicates.mjs --development
 *   node --experimental-strip-types scripts/content-pipeline/report-normalized-url-duplicates.mjs --json rows.json
 *
 * --development reads Development database lgfc-litedev (wrangler --env preview --remote).
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { normalizeSourceUrl } from '../../functions/_lib/content-pipeline-url-normalize.ts';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const QUERY = `SELECT ci.source_url AS source_url,
  ci.final_status AS final_status,
  re.usage_decision AS usage_decision,
  re.fee_required AS fee_required
FROM content_items ci
LEFT JOIN rights_evidence re ON re.content_item_id = ci.id
WHERE ci.source_url IS NOT NULL AND ci.superseded_at IS NULL`;

function parseArgs(argv) {
  const options = { development: false, json: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--development') options.development = true;
    else if (arg === '--json') options.json = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!options.development && !options.json) throw new Error('Pass --development or --json <file>');
  return options;
}

function loadDevelopmentRows() {
  const stdout = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', 'lgfc-litedev', '--env', 'preview', '--remote', '--json', '--command', QUERY],
    { cwd: repoRoot, encoding: 'utf8', env: process.env },
  );
  const parsed = JSON.parse(stdout);
  return parsed?.[0]?.results ?? [];
}

function report(rows) {
  const groups = new Map();
  let unparsed = 0;
  for (const row of rows) {
    const normalized = normalizeSourceUrl(row.source_url);
    if (!normalized) {
      unparsed += 1;
      continue;
    }
    const group = groups.get(normalized) ?? { normalized, spellings: new Set(), rows: 0, denied: false };
    group.spellings.add(row.source_url);
    group.rows += 1;
    if (row.final_status === 'not_permitted' || row.usage_decision === 'deny' || Number(row.fee_required) === 1) {
      group.denied = true;
    }
    groups.set(normalized, group);
  }
  const duplicateGroups = [...groups.values()].filter((group) => group.spellings.size > 1);
  const deniedGroups = [...groups.values()].filter((group) => group.denied);
  console.log(`Rows read: ${rows.length}`);
  console.log(`Rows with a source_url that could not be normalized: ${unparsed}`);
  console.log(`Distinct normalized URLs: ${groups.size}`);
  console.log(`Normalized URLs with more than one stored spelling (would match as duplicates): ${duplicateGroups.length}`);
  console.log(`Normalized URLs that include a not_permitted, deny, or fee-required row: ${deniedGroups.length}`);
  for (const group of duplicateGroups) {
    console.log(`- ${group.normalized} (${group.spellings.size} spellings${group.denied ? ', includes a do-not-use row' : ''})`);
    for (const spelling of group.spellings) console.log(`    ${spelling}`);
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const rows = options.json ? JSON.parse(fs.readFileSync(options.json, 'utf8')) : loadDevelopmentRows();
  report(rows);
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectRun) main();
