#!/usr/bin/env node
/**
 * #2859 Preview D1/B2 preflight — read-only evidence for Gate 1 criterion 7 (Preview half).
 *
 * Authorized by PR #3282 §9 (docs/ops/reports/website-launch-gate1-prerequisite-matrix.md,
 * "Authorization packet — read-only Preview D1/B2 preflight for #2859") and carried forward
 * by PR #3330. Executed under WORK's 2026-08-11 "WORK RELEASE — bounded Preview D1/B2
 * preflight" comment on #2780.
 *
 * Performs exactly two read-only checks against the Preview (never Production) D1 database
 * and R2/B2 bucket:
 *   1. D1: enumerates table names (excluding sqlite_%/d1_migrations%/_cf_% bookkeeping
 *      tables, same exclusion this repo already uses in scripts/d1-seed-all.mjs and
 *      scripts/ci/d1_backup_phase2_restore_verify_3268.mjs) and a per-table row COUNT(*) --
 *      schema and counts only, never row content.
 *   2. R2/B2: a single bounded ListObjectsV2 call (max 1000 keys, one page) to confirm
 *      reachability. Only the object count and truncation flag are recorded; individual
 *      object keys are never persisted to the result.
 *
 * This script contains no INSERT/UPDATE/DELETE/PUT/D1-migration code path -- there is
 * nothing here that can write to D1 or R2.
 *
 * SAFETY (the one stop condition PR #3282 §9 names explicitly -- "any indication the
 * binding resolves to Production rather than Preview"): the resolved Preview D1 database
 * uuid is checked, before and after the live `wrangler d1 info` call, against the known
 * Production database_id declared in wrangler.toml (itself non-secret repo config, not a
 * credential) and fails closed if they ever match.
 *
 * Required env (GitHub Actions repository secrets; values are never logged):
 *   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID -- existing, account-scoped secrets already
 *     used by every other #3268/#2913 D1 script; reused here, not newly created.
 *   PREVIEW_D1_DATABASE_NAME, PREVIEW_D1_DATABASE_ID -- the Preview D1 database's identity.
 *   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY -- existing, account-scoped R2 S3 credentials
 *     already used by scripts/ci/d1_backup_r2_phase1_preflight_3268.mjs and the #3268
 *     Phase 2 export/upload/restore scripts; reused here, not newly created.
 *   PREVIEW_R2_BUCKET_NAME -- the Preview R2/B2 bucket's identity.
 * If PREVIEW_D1_DATABASE_NAME/PREVIEW_D1_DATABASE_ID/PREVIEW_R2_BUCKET_NAME are not yet
 * configured as repository secrets, this fails closed with a clear missing-credential
 * message rather than guessing or falling back to a Production identity.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { AwsClient } from '../../functions/_lib/aws4fetch.ts';
import { parseWranglerJson, extractDatabaseUuid, extractD1Rows } from './production_d1_preflight_2913.mjs';
import { redactSecrets, extractS3ErrorCode, parseListObjectsV2Page } from './d1_backup_r2_phase1_preflight_3268.mjs';

export const RESULT_JSON_PATH = 'production-content-preview-preflight-2859-result.json';
export const RESULT_MD_PATH = 'production-content-preview-preflight-2859-result.md';

// Known Production D1 database_id from wrangler.toml (non-secret repo config, checked into
// this repository). Used solely to fail closed if the "Preview" identity ever resolves to
// the real Production database -- never used to query Production.
export const PRODUCTION_D1_DATABASE_ID = '22d0dc3e-ad34-43af-8e6a-2063df1a1e04';

const INTERNAL_TABLE_PREFIXES = ['sqlite_', 'd1_migrations', '_cf_'];

export function requireEnv(env = process.env) {
  return [
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_ACCOUNT_ID',
    'PREVIEW_D1_DATABASE_NAME',
    'PREVIEW_D1_DATABASE_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'PREVIEW_R2_BUCKET_NAME',
  ].filter((name) => !env[name]);
}

export function buildTableExclusionSql() {
  return INTERNAL_TABLE_PREFIXES.map((prefix) => `AND name NOT LIKE '${prefix}%'`).join(' ');
}

export function buildTableListSql() {
  return `SELECT name FROM sqlite_master WHERE type='table' ${buildTableExclusionSql()} ORDER BY name`;
}

/** One combined UNION ALL query for every table's row count, instead of N wrangler invocations. */
export function buildRowCountSql(tableNames) {
  return tableNames
    .map((table) => `SELECT '${table}' AS table_name, COUNT(*) AS row_count FROM "${table}"`)
    .join(' UNION ALL ');
}

export function parseRowCountRows(rows) {
  return (rows ?? [])
    .map((row) => ({ table: String(row.table_name ?? ''), rowCount: Number(row.row_count ?? 0) }))
    .filter((row) => row.table)
    .sort((a, b) => a.table.localeCompare(b.table));
}

export function buildResultMarkdown(result) {
  const lines = [
    '<!-- production-content-preview-preflight-2859 -->',
    '## #2859 Preview D1/B2 preflight — read-only evidence (Gate 1, criterion 7 Preview half)',
    '',
    `- Checked at: ${result.checkedAt}`,
    '- Target: Preview D1 database and Preview R2/B2 bucket only -- identity checked against the known Production database_id before and after every D1 call; Production is never queried.',
    '',
    '### D1 -- table presence and row counts (schema/count only, no row content)',
    '',
    `- Table count: ${result.d1.tableCount}`,
    '',
    '| table | row count |',
    '| --- | --- |',
    ...result.d1.tables.map((t) => `| \`${t.table}\` | ${t.rowCount} |`),
    '',
    '### R2/B2 -- reachability (object count only, no keys/filenames recorded)',
    '',
    `- Reachable: ${result.r2.reachable ? 'YES' : 'NO'}${result.r2.failureReason ? ` (${result.r2.failureReason})` : ''}`,
    result.r2.reachable
      ? `- Object count (first page, max 1000): ${result.r2.objectCount}${result.r2.truncated ? '+' : ''}`
      : '',
    '',
    '### What this does and does not establish',
    '',
    "This is Preview-environment evidence only -- it does not read, write, or otherwise touch Production D1 (`lgfc_lite`) or the Production R2/B2 bucket. It satisfies the Preview half of #2859 acceptance criterion 7 (\"Preview... evidence is recorded\"). It does **not** by itself satisfy #2859 criterion 3 (real D1/B2 population), criteria 5/6 (blocked on real content existing), the Production half of criterion 7, or advance #2780's entry gate -- those remain gated on a separate, still-unauthorized Production-write decision. Gate 1 remains HOLD; Gate 2 remains NO-GO.",
  ].filter((line) => line !== '');
  return lines.join('\n');
}

function resolveWranglerCmd() {
  const local = path.resolve(process.cwd(), 'node_modules', '.bin', 'wrangler');
  if (fs.existsSync(local)) return [local];
  return ['npx', '--no-install', 'wrangler'];
}

function runWrangler(args) {
  const cmd = resolveWranglerCmd();
  return spawnSync(cmd[0], [...cmd.slice(1), ...args], { encoding: 'utf8', env: process.env });
}

function failClosed(message) {
  console.error(`FAIL-CLOSED: ${message}`);
  console.error('No Preview evidence recorded. No write of any kind was attempted.');
  process.exitCode = 1;
}

export async function main() {
  const missing = requireEnv(process.env);
  if (missing.length > 0) {
    failClosed(`missing required credential(s): ${missing.join(', ')} (values are never logged).`);
    return;
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  const previewDbName = process.env.PREVIEW_D1_DATABASE_NAME;
  const previewDbId = process.env.PREVIEW_D1_DATABASE_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const previewBucketName = process.env.PREVIEW_R2_BUCKET_NAME;

  const redact = (text) =>
    redactSecrets(text, [accountId, apiToken, previewDbName, previewDbId, accessKeyId, secretAccessKey, previewBucketName]);

  if (previewDbId === PRODUCTION_D1_DATABASE_ID) {
    failClosed('PREVIEW_D1_DATABASE_ID matches the known Production database_id in wrangler.toml -- refusing to treat Production as Preview.');
    return;
  }

  const info = runWrangler(['d1', 'info', previewDbName, '--json']);
  if (info.error || info.status !== 0) {
    failClosed(`wrangler d1 info failed for the configured Preview database (exit ${info.status ?? 'spawn error'}). Check credentials and PREVIEW_D1_DATABASE_NAME.`);
    return;
  }
  let infoParsed;
  try {
    infoParsed = parseWranglerJson(info.stdout);
  } catch (error) {
    failClosed(`could not parse "wrangler d1 info" output: ${redact(error.message)}`);
    return;
  }
  const remoteUuid = extractDatabaseUuid(infoParsed);
  if (!remoteUuid) {
    failClosed('wrangler d1 info returned no database uuid -- cannot confirm database identity.');
    return;
  }
  if (remoteUuid === PRODUCTION_D1_DATABASE_ID) {
    failClosed('the live database uuid matches the known Production database_id -- refusing to proceed; this binding does not resolve to Preview.');
    return;
  }
  if (remoteUuid !== previewDbId) {
    failClosed('wrong database identity -- the live database uuid does not match the PREVIEW_D1_DATABASE_ID secret.');
    return;
  }

  const listRes = runWrangler(['d1', 'execute', previewDbName, '--remote', '--command', buildTableListSql(), '--json']);
  if (listRes.error || listRes.status !== 0) {
    failClosed(`wrangler d1 execute failed enumerating tables (exit ${listRes.status ?? 'spawn error'}).`);
    return;
  }
  let listParsed;
  try {
    listParsed = parseWranglerJson(listRes.stdout);
  } catch (error) {
    failClosed(`could not parse table-listing output: ${redact(error.message)}`);
    return;
  }
  const tableNames = extractD1Rows(listParsed)
    .map((row) => String(row.name ?? ''))
    .filter(Boolean)
    .sort();

  let tables = [];
  if (tableNames.length > 0) {
    const countRes = runWrangler(['d1', 'execute', previewDbName, '--remote', '--command', buildRowCountSql(tableNames), '--json']);
    if (countRes.error || countRes.status !== 0) {
      failClosed(`wrangler d1 execute failed counting rows (exit ${countRes.status ?? 'spawn error'}).`);
      return;
    }
    let countParsed;
    try {
      countParsed = parseWranglerJson(countRes.stdout);
    } catch (error) {
      failClosed(`could not parse row-count output: ${redact(error.message)}`);
      return;
    }
    tables = parseRowCountRows(extractD1Rows(countParsed));
  }

  const hostname = `${accountId}.r2.cloudflarestorage.com`;
  const endpoint = `https://${hostname}`;
  const aws = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
  const pathBucket = previewBucketName.split('/').map(encodeURIComponent).join('/');
  const qs = new URLSearchParams({ 'list-type': '2', 'max-keys': '1000' });
  const listUrl = `${endpoint}/${pathBucket}?${qs.toString()}`;

  const r2 = { reachable: false, objectCount: null, truncated: false, failureReason: '' };
  try {
    const res = await aws.fetch(listUrl, { method: 'GET' });
    if (!res.ok) {
      const text = await res.text();
      const code = extractS3ErrorCode(text);
      r2.failureReason = code ? `HTTP ${res.status}: ${code}` : `HTTP ${res.status}`;
    } else {
      const xml = await res.text();
      const page = parseListObjectsV2Page(xml);
      r2.reachable = true;
      r2.objectCount = page.keys.length;
      r2.truncated = page.isTruncated;
    }
  } catch (error) {
    r2.failureReason = redact(error.message || 'fetch failed');
  }

  const result = {
    checkedAt: new Date().toISOString(),
    d1: { tableCount: tableNames.length, tables },
    r2,
  };

  fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);

  console.log(`OK: Preview D1 tables=${tableNames.length}, R2 reachable=${r2.reachable}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().then(() => {
    if (process.exitCode) process.exit(process.exitCode);
  });
}
