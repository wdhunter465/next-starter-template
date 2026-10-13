#!/usr/bin/env node
/**
 * #4569 / #4528: report-only check of published content_inventory stories against D1 permission
 * status. Lists every published story whose effective final_status (from its linked active
 * content_items records, the same rule as the publishing gate) is not 'permitted'. These are the
 * stories the gate hides when it is turned on.
 *
 * Read-only: one SELECT. Never unpublishes, rotates or writes anything. Exits 0 whatever it finds;
 * exits 1 only if the query fails. Prints story id and tag only, never story text.
 *
 * Usage:
 *   node scripts/ci/content-permission-monitor-4569.mjs --database <lgfc-litedev|lgfc_lite> [--local|--remote]
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
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

const { effectiveFinalStatusSql } = await import('../../functions/_lib/content-inventory-permission-gate.ts');

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');

export const MONITOR_SQL = `SELECT ci.id, ci.tag, ci.allowed_sections,
  ${effectiveFinalStatusSql('ci')} AS effective_final_status
FROM content_inventory ci
WHERE ci.status = 'published'
ORDER BY ci.id;`;

const CATEGORIES = ['permitted', 'not_permitted', 'for_admin_review', 'no_linked_record'];

export function categorize(row) {
  return row.effective_final_status == null ? 'no_linked_record' : String(row.effective_final_status);
}

export function buildReport(rows, database) {
  const counts = Object.fromEntries(CATEGORIES.map((category) => [category, 0]));
  const hidden = [];
  for (const row of rows) {
    const category = categorize(row);
    counts[category] = (counts[category] ?? 0) + 1;
    if (category !== 'permitted') hidden.push({ id: row.id, tag: row.tag, category });
  }

  const lines = [
    `## Published content vs D1 permission status (${database})`,
    '',
    'Report only. Nothing was unpublished or changed.',
    '',
    '| Status | Published stories |',
    '| --- | --- |',
    ...Object.entries(counts).map(([category, count]) => `| ${category} | ${count} |`),
    `| **total** | ${rows.length} |`,
    '',
    `Stories the publishing gate would hide: **${hidden.length}**`,
  ];
  if (hidden.length > 0) {
    lines.push('', '| Story id | Tag | Status |', '| --- | --- | --- |');
    for (const item of hidden) lines.push(`| ${item.id} | ${item.tag} | ${item.category} |`);
  }
  return { counts, hidden, total: rows.length, markdown: lines.join('\n') };
}

function parseArgs(argv) {
  const options = { database: null, target: 'remote' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--database') {
      options.database = argv[index + 1];
      index += 1;
    } else if (arg === '--local') {
      options.target = 'local';
    } else if (arg === '--remote') {
      options.target = 'remote';
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!options.database || options.database.startsWith('--')) throw new Error('--database is required');
  return options;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const args = ['wrangler', 'd1', 'execute', options.database];
  if (options.database === 'lgfc-litedev') args.push('--env', 'preview');
  args.push(options.target === 'local' ? '--local' : '--remote', '--json', '--command', MONITOR_SQL);

  const output = execFileSync('npx', args, { cwd: repoRoot, encoding: 'utf8', env: process.env });
  const rows = JSON.parse(output)[0]?.results ?? [];
  const report = buildReport(rows, options.database);

  console.log(report.markdown);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report.markdown}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
