#!/usr/bin/env node
/**
 * #2913 Production D1 preflight — read-only schema check.
 *
 * Runs the single routed preflight query from #2913 (`PRAGMA table_info(library_entries);`)
 * against the real Production D1 database and records whether `is_approved` exists, so
 * #2913's batch plan can use the correct LE_APPROVED/LE_UNAPPROVED split instead of the
 * unconfirmed local-replay assumption in docs/ops/reports/library-content-backfill-2911.md.
 *
 * This script executes exactly one hardcoded, read-only SQL statement. It never accepts
 * SQL from CLI args or env, and never runs `d1 execute` without that constant — there is
 * no code path in this file that can perform a Production write.
 *
 * Fails closed (non-zero exit, no batch-plan guidance emitted) on: missing/invalid
 * credentials, a target database whose name/id does not match this repo's wrangler.toml
 * D1 binding, a failed wrangler invocation, or a `library_entries` table with zero columns
 * (ambiguous — the table may not exist in this database).
 *
 * Required env (GitHub Actions repository secrets; values are never logged):
 *   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, D1_DATABASE_NAME, D1_DATABASE_ID
 *   (CF_API_TOKEN / CF_ACCOUNT_ID accepted as aliases, matching verify_cloudflare_d1_auth.mjs)
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const TARGET_TABLE = 'library_entries';
export const PREFLIGHT_SQL = `PRAGMA table_info(${TARGET_TABLE});`;
export const RESULT_JSON_PATH = 'production-d1-preflight-2913-result.json';
export const RESULT_MD_PATH = 'production-d1-preflight-2913-result.md';

function aliasEnv(primary, aliases) {
  if (process.env[primary]) return;
  for (const name of aliases) {
    if (process.env[name]) {
      process.env[primary] = process.env[name];
      return;
    }
  }
}

export function requireEnv(env = process.env) {
  const missing = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'D1_DATABASE_NAME', 'D1_DATABASE_ID'].filter(
    (name) => !env[name],
  );
  return missing;
}

export function parseWranglerToml(text = '') {
  const nameMatch = text.match(/database_name\s*=\s*"([^"]+)"/);
  const idMatch = text.match(/database_id\s*=\s*"([^"]+)"/);
  return {
    databaseName: nameMatch?.[1] || '',
    databaseId: idMatch?.[1] || '',
  };
}

function resolveWranglerCmd() {
  const local = path.resolve(process.cwd(), 'node_modules', '.bin', 'wrangler');
  if (fs.existsSync(local)) return [local];
  return ['npx', '--no-install', 'wrangler'];
}

export function parseWranglerJson(stdout) {
  const text = String(stdout || '').trim();
  if (!text) return null;
  // wrangler prints CLI banners before its JSON payload. Anchor on the FIRST bracket, not
  // the last — the payload is a single top-level JSON value that itself contains nested
  // objects (e.g. "meta": {...}), so the last '{'/'[' in the text is typically one of those
  // nested braces, not the start of the top-level value.
  const startArr = text.indexOf('[');
  const startObj = text.indexOf('{');
  const candidates = [startArr, startObj].filter((index) => index >= 0);
  if (!candidates.length) return null;
  return JSON.parse(text.slice(Math.min(...candidates)));
}

export function extractDatabaseUuid(parsed) {
  if (!parsed) return '';
  if (Array.isArray(parsed)) {
    for (const entry of parsed) {
      const found = extractDatabaseUuid(entry);
      if (found) return found;
    }
    return '';
  }
  if (typeof parsed === 'object') {
    if (typeof parsed.uuid === 'string' && parsed.uuid) return parsed.uuid;
    if (typeof parsed.result?.uuid === 'string' && parsed.result.uuid) return parsed.result.uuid;
  }
  return '';
}

export function extractD1Rows(parsed) {
  if (!parsed) return [];
  if (Array.isArray(parsed)) {
    for (const entry of parsed) {
      if (entry && Array.isArray(entry.results)) return entry.results;
      if (Array.isArray(entry)) return entry;
    }
    return [];
  }
  if (parsed.results && Array.isArray(parsed.results)) return parsed.results;
  return [];
}

function runWrangler(args) {
  const cmd = resolveWranglerCmd();
  return spawnSync(cmd[0], [...cmd.slice(1), ...args], { encoding: 'utf8', env: process.env });
}

export function buildResultMarkdown(result) {
  const lines = [
    '<!-- production-d1-preflight-2913 -->',
    '## #2913 Production D1 preflight — `PRAGMA table_info(library_entries)`',
    '',
    `- Checked at: ${result.checkedAt}`,
    `- Table: \`${TARGET_TABLE}\``,
    `- Column count: ${result.columnCount}`,
    `- \`is_approved\` present: ${result.isApprovedPresent ? 'YES' : 'NO'}`,
    '',
    '### Batch-planning guidance',
    result.isApprovedPresent
      ? '`is_approved` is present in Production. Record its actual value distribution (counts only) per docs/ops/reports/library-content-production-batch-plan-2913.md before using the LE_APPROVED/LE_UNAPPROVED split.'
      : '`is_approved` is absent in Production, confirming the local-replay finding in docs/ops/reports/library-content-backfill-2911.md. Every legacy row must be treated as unapproved/draft-only per the accepted #2910 migration map.',
    '',
    '### Columns (schema metadata only — no row content)',
    '',
    '| name | type | notnull | pk |',
    '| --- | --- | --- | --- |',
    ...result.columns.map((c) => `| \`${c.name}\` | ${c.type} | ${c.notnull} | ${c.pk} |`),
  ];
  return lines.join('\n');
}

function writeOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) fs.appendFileSync(outputPath, `${name}=${value}\n`);
}

function failClosed(message) {
  console.error(`FAIL-CLOSED: ${message}`);
  console.error('No Production batch-planning guidance emitted. No D1 write was attempted.');
  process.exitCode = 1;
}

export async function main() {
  aliasEnv('CLOUDFLARE_API_TOKEN', ['CF_API_TOKEN']);
  aliasEnv('CLOUDFLARE_ACCOUNT_ID', ['CF_ACCOUNT_ID']);

  const missing = requireEnv(process.env);
  if (missing.length > 0) {
    failClosed(`missing required credential(s): ${missing.join(', ')} (values are never logged).`);
    return;
  }

  const tomlPath = path.resolve(process.cwd(), 'wrangler.toml');
  if (!fs.existsSync(tomlPath)) {
    failClosed('wrangler.toml not found — cannot confirm expected database identity.');
    return;
  }
  const expected = parseWranglerToml(fs.readFileSync(tomlPath, 'utf8'));
  if (!expected.databaseName || !expected.databaseId) {
    failClosed('wrangler.toml does not declare a [[d1_databases]] name/id — cannot confirm expected database identity.');
    return;
  }

  // D1_DATABASE_NAME/D1_DATABASE_ID are treated as opaque secrets: only equality is checked
  // against the non-secret repo config below, never their literal values are logged.
  const dbName = process.env.D1_DATABASE_NAME;
  if (dbName !== expected.databaseName) {
    failClosed(`wrong database identity — D1_DATABASE_NAME secret does not match this repo's configured database ("${expected.databaseName}").`);
    return;
  }

  const info = runWrangler(['d1', 'info', dbName, '--json']);
  if (info.error || info.status !== 0) {
    failClosed(`wrangler d1 info failed for the configured database (exit ${info.status ?? 'spawn error'}). Check credentials and D1_DATABASE_NAME.`);
    return;
  }
  let infoParsed;
  try {
    infoParsed = parseWranglerJson(info.stdout);
  } catch (error) {
    failClosed(`could not parse "wrangler d1 info" output: ${error.message}`);
    return;
  }
  const remoteUuid = extractDatabaseUuid(infoParsed);
  if (!remoteUuid) {
    failClosed('wrangler d1 info returned no database uuid — cannot confirm database identity.');
    return;
  }
  if (remoteUuid !== expected.databaseId || remoteUuid !== process.env.D1_DATABASE_ID) {
    failClosed('wrong database identity — the live database uuid does not match wrangler.toml and/or the D1_DATABASE_ID secret.');
    return;
  }

  const execResult = runWrangler(['d1', 'execute', dbName, '--remote', '--command', PREFLIGHT_SQL, '--json']);
  if (execResult.error || execResult.status !== 0) {
    // Never echo wrangler's raw stderr/stdout here: its error text can embed the database
    // name/uuid or account id sourced from the env/args above, and we treat those as opaque
    // secrets throughout this script. The exit code is the only diagnostic surfaced.
    failClosed(`wrangler d1 execute failed (exit ${execResult.status ?? 'spawn error'}) running the read-only preflight query.`);
    return;
  }

  let parsed;
  try {
    parsed = parseWranglerJson(execResult.stdout);
  } catch (error) {
    failClosed(`could not parse "wrangler d1 execute --json" output: ${error.message}`);
    return;
  }

  const rows = extractD1Rows(parsed);
  if (!rows.length) {
    failClosed(`PRAGMA table_info(${TARGET_TABLE}) returned zero columns — the table may not exist in this database. Ambiguous evidence; not resolving #2913's preflight.`);
    return;
  }

  const columns = rows.map((row) => ({
    name: String(row.name ?? ''),
    type: String(row.type ?? ''),
    notnull: Number(row.notnull ?? 0),
    pk: Number(row.pk ?? 0),
  }));
  const isApprovedPresent = columns.some((c) => c.name === 'is_approved');

  const result = {
    checkedAt: new Date().toISOString(),
    table: TARGET_TABLE,
    columnCount: columns.length,
    isApprovedPresent,
    columns,
  };

  fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);

  writeOutput('is_approved_present', String(isApprovedPresent));
  writeOutput('column_count', String(columns.length));

  console.log(`OK: PRAGMA table_info(${TARGET_TABLE}) resolved — ${columns.length} column(s), is_approved present: ${isApprovedPresent}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().then(() => {
    if (process.exitCode) process.exit(process.exitCode);
  });
}
