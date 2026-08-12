#!/usr/bin/env node
/**
 * #2859 Preview/Development evidence preflight — post-#3355/#3360 D1 split (#3337).
 *
 * Environment model (controlling):
 *   Production D1: lgfc_lite
 *   Preview/Development D1: lgfc-litedev
 *   Logical binding: DB
 *
 * Always validates Production vs Preview D1 identities from current wrangler.toml
 * (fail-closed on shared/mismatched IDs). Does not trust a duplicated hardcoded
 * Production UUID as the sole source of truth (#3337 late-review finding).
 *
 * Live D1 table/count probes (Dev only) run when Cloudflare + D1_DEV credentials
 * are present. The Actions workflow may still supply B2-only credentials; in that
 * case the script records the wrangler identity contract and skips the live Dev
 * probe without inventing Production-as-Preview evidence.
 *
 * Backblaze B2: one read-only ListObjectsV2 page (object count only; no keys stored).
 * No Put/Delete/D1-write paths.
 *
 * On any `wrangler d1` failure during the live Dev probe, a redacted, truncated (800-char)
 * snippet of wrangler's stderr/stdout is included in the fail-closed message -- an initial
 * live run (2026-08-12) failed on the row-count query with only "exit 1" and no way to see
 * why. Every response shape `wrangler d1 info`/`wrangler d1 execute --json` can return here
 * carries only aggregate metadata (uuid, query/row counts) or a schema/count-level query
 * result -- never row content -- so surfacing a redacted snippet is safe, matching the same
 * evidence-first diagnostic pattern already proven in
 * scripts/ci/d1_backup_phase2_restore_verify_3268.mjs (#3268 Phase 2 Package 3).
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { AwsClient } from '../../functions/_lib/aws4fetch.ts';
import { redactSecrets, extractS3ErrorCode, parseListObjectsV2Page } from './d1_backup_r2_phase1_preflight_3268.mjs';
import { parseProdAndPreviewD1, evaluateIdentities } from './d1_prod_dev_identity_check.mjs';
import { parseWranglerJson, extractDatabaseUuid, extractD1Rows } from './production_d1_preflight_2913.mjs';

export const RESULT_JSON_PATH = 'production-content-preview-preflight-2859-result.json';
export const RESULT_MD_PATH = 'production-content-preview-preflight-2859-result.md';

const INTERNAL_TABLE_PREFIXES = ['sqlite_', 'd1_migrations', '_cf_'];

/** Escape a value for use as a SQLite single-quoted string literal. */
export function quoteSqlStringLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** Escape a value for use as a SQLite double-quoted identifier. */
export function quoteSqlIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function requireEnv(env = process.env) {
  return ['B2_ENDPOINT', 'B2_BUCKET', 'B2_KEY_ID', 'B2_APP_KEY'].filter((name) => !env[name]);
}

export function hasLiveDevD1Credentials(env = process.env) {
  return Boolean(
    env.CLOUDFLARE_API_TOKEN &&
      env.CLOUDFLARE_ACCOUNT_ID &&
      env.D1_DEV_DATABASE_NAME &&
      env.D1_DEV_DATABASE_ID,
  );
}

/**
 * Load Production + Preview D1 identities from the current repository wrangler.toml.
 * Fail-closed caller must treat missing/shared IDs as errors (#3337).
 */
export function loadD1IdentitiesFromWrangler(wranglerPath = path.resolve(process.cwd(), 'wrangler.toml')) {
  if (!fs.existsSync(wranglerPath)) {
    throw new Error(`wrangler.toml not found at ${wranglerPath}`);
  }
  return parseProdAndPreviewD1(fs.readFileSync(wranglerPath, 'utf8'));
}

/** Production database_id sourced from current wrangler.toml (not a stale hardcoded copy). */
export function productionD1IdFromWrangler(wranglerPath) {
  return loadD1IdentitiesFromWrangler(wranglerPath).production.databaseId;
}

/**
 * Exclude SQLite/D1/CF bookkeeping tables.
 * Uses GLOB so `_` is literal (SQLite LIKE treats `_` as a single-char wildcard).
 */
export function buildTableExclusionSql() {
  return INTERNAL_TABLE_PREFIXES.map((prefix) => `AND name NOT GLOB '${prefix}*'`)
    .join(' ');
}

export function buildTableListSql() {
  return `SELECT name FROM sqlite_master WHERE type='table' ${buildTableExclusionSql()} ORDER BY name`;
}

/**
 * One combined UNION ALL query for every table's row count.
 * Table names are escaped for both the string literal and the identifier (#3337).
 */
export function buildRowCountSql(tableNames) {
  return (tableNames || [])
    .map(
      (table) =>
        `SELECT ${quoteSqlStringLiteral(table)} AS table_name, COUNT(*) AS row_count FROM ${quoteSqlIdentifier(table)}`,
    )
    .join(' UNION ALL ');
}

export function parseRowCountRows(rows) {
  return (rows ?? [])
    .map((row) => ({ table: String(row.table_name ?? ''), rowCount: Number(row.row_count ?? 0) }))
    .filter((row) => row.table)
    .sort((a, b) => a.table.localeCompare(b.table));
}

export function buildResultMarkdown(result) {
  const d1 = result.d1 || {};
  const lines = [
    '<!-- production-content-preview-preflight-2859 -->',
    '## #2859 Preview/Development evidence preflight — post-D1 split (#3355/#3360/#3337)',
    '',
    `- Checked at: ${result.checkedAt}`,
    '',
    '### D1 identity contract (from current wrangler.toml)',
    '',
    `- Production: \`${d1.productionName || ''}\` / \`${d1.productionId || ''}\``,
    `- Preview/Development: \`${d1.previewName || ''}\` / \`${d1.previewId || ''}\``,
    `- Distinct IDs: ${d1.distinct ? 'YES' : 'NO'}`,
    `- Contract: ${d1.contractOk ? 'PASS' : 'FAIL'}${d1.contractFailures?.length ? ` (${d1.contractFailures.join('; ')})` : ''}`,
    '',
    '### D1 live Dev probe (lgfc-litedev only when credentials present)',
    '',
    d1.liveProbe === 'skipped_missing_credentials'
      ? '- Live Dev D1 probe skipped: Cloudflare / D1_DEV credentials not provided in this run (identity contract still enforced from wrangler.toml).'
      : d1.liveProbe === 'ok'
        ? [
            `- Live Dev probe: OK against \`${d1.liveDatabaseName}\``,
            `- Table count: ${d1.tableCount}`,
            '',
            '| table | row count |',
            '| --- | --- |',
            ...(d1.tables || []).map((t) => `| \`${t.table}\` | ${t.rowCount} |`),
          ].join('\n')
        : `- Live Dev probe: ${d1.liveProbe || 'n/a'}${d1.liveFailureReason ? ` (${d1.liveFailureReason})` : ''}`,
    '',
    '### Backblaze B2 — reachability (object count only, no keys/filenames recorded)',
    '',
    '- Shared content-media bucket (B2 remains the LGFC media store; D1 split does not create a separate B2 env).',
    '',
    `- Reachable: ${result.b2.reachable ? 'YES' : 'NO'}${result.b2.failureReason ? ` (${result.b2.failureReason})` : ''}`,
    result.b2.reachable
      ? `- Object count (first page, max 1000): ${result.b2.objectCount}${result.b2.truncated ? '+' : ''}`
      : '',
    '',
    '### What this does and does not establish',
    '',
    'This validates the post-#3355 Production vs Preview/Development D1 split and optional read-only Dev counts, plus B2 reachability. It does **not** mutate Production, does not satisfy #2859 criterion 3 alone, and does not advance #2780 entry gates by itself.',
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
  console.error('No write of any kind was attempted.');
  process.exitCode = 1;
}

/**
 * Redacted, truncated (800-char) snippet of a wrangler subprocess's stderr (preferred) or
 * stdout, for inclusion in a fail-closed diagnostic message. Returns '' when both are empty.
 */
export function buildDiagnosticSnippet(procResult, redact) {
  const stderr = String(procResult?.stderr ?? '').trim();
  const stdout = String(procResult?.stdout ?? '').trim();
  const raw = stderr || stdout;
  if (!raw) return '';
  const redacted = redact(raw);
  return redacted.length > 800 ? `${redacted.slice(0, 800)}...` : redacted;
}

export async function main() {
  const missing = requireEnv(process.env);
  if (missing.length > 0) {
    failClosed(`missing required credential(s): ${missing.join(', ')} (values are never logged).`);
    return;
  }

  let identities;
  try {
    identities = loadD1IdentitiesFromWrangler();
  } catch (error) {
    failClosed(error.message);
    return;
  }

  const identityResult = evaluateIdentities(identities, process.env);
  if (!identityResult.ok) {
    failClosed(`D1 identity contract failed: ${identityResult.failures.join('; ')}`);
    return;
  }

  const redact = (text) =>
    redactSecrets(text, [
      process.env.B2_ENDPOINT,
      process.env.B2_ENDPOINT?.replace(/\/$/, ''),
      process.env.B2_BUCKET,
      process.env.B2_KEY_ID,
      process.env.B2_APP_KEY,
      process.env.CLOUDFLARE_API_TOKEN,
      process.env.CLOUDFLARE_ACCOUNT_ID,
      process.env.D1_DEV_DATABASE_NAME,
      process.env.D1_DEV_DATABASE_ID,
    ]);

  const d1 = {
    productionName: identities.production.databaseName,
    productionId: identities.production.databaseId,
    previewName: identities.preview.databaseName,
    previewId: identities.preview.databaseId,
    distinct: identities.production.databaseId !== identities.preview.databaseId,
    contractOk: true,
    contractFailures: [],
    liveProbe: 'skipped_missing_credentials',
    liveDatabaseName: null,
    liveFailureReason: '',
    tableCount: null,
    tables: [],
  };

  if (hasLiveDevD1Credentials(process.env)) {
    const previewDbName = process.env.D1_DEV_DATABASE_NAME;
    const previewDbId = process.env.D1_DEV_DATABASE_ID;
    const productionId = identities.production.databaseId;

    if (previewDbId === productionId) {
      failClosed('D1_DEV_DATABASE_ID matches Production database_id from wrangler.toml — refusing.');
      return;
    }
    if (previewDbId !== identities.preview.databaseId) {
      failClosed('D1_DEV_DATABASE_ID does not match wrangler Preview/Development database_id.');
      return;
    }

    const info = runWrangler(['d1', 'info', previewDbName, '--json']);
    if (info.error || info.status !== 0) {
      const snippet = buildDiagnosticSnippet(info, redact);
      failClosed(
        `wrangler d1 info failed for Dev database (exit ${info.status ?? 'spawn error'}).${snippet ? ` Raw (redacted) response snippet: ${snippet}` : ' (no output captured)'}`,
      );
      return;
    }
    let infoParsed;
    try {
      infoParsed = parseWranglerJson(info.stdout);
    } catch (error) {
      failClosed(`could not parse wrangler d1 info output: ${error.message}`);
      return;
    }
    const remoteUuid = extractDatabaseUuid(infoParsed);
    if (!remoteUuid) {
      failClosed('wrangler d1 info returned no database uuid.');
      return;
    }
    if (remoteUuid === productionId) {
      failClosed('live database uuid matches Production — refusing to treat Production as Preview/Dev.');
      return;
    }
    if (remoteUuid !== previewDbId) {
      failClosed('live database uuid does not match D1_DEV_DATABASE_ID.');
      return;
    }

    const listRes = runWrangler([
      'd1',
      'execute',
      previewDbName,
      '--remote',
      '--env',
      'preview',
      '--command',
      buildTableListSql(),
      '--json',
    ]);
    if (listRes.error || listRes.status !== 0) {
      const snippet = buildDiagnosticSnippet(listRes, redact);
      failClosed(
        `wrangler d1 execute failed enumerating Dev tables (exit ${listRes.status ?? 'spawn error'}).${snippet ? ` Raw (redacted) response snippet: ${snippet}` : ' (no output captured)'}`,
      );
      return;
    }
    let listParsed;
    try {
      listParsed = parseWranglerJson(listRes.stdout);
    } catch (error) {
      failClosed(`could not parse table-listing output: ${error.message}`);
      return;
    }
    const tableNames = extractD1Rows(listParsed)
      .map((row) => String(row.name || ''))
      .filter(Boolean)
      .sort();

    let tables = [];
    if (tableNames.length > 0) {
      const countRes = runWrangler([
        'd1',
        'execute',
        previewDbName,
        '--remote',
        '--env',
        'preview',
        '--command',
        buildRowCountSql(tableNames),
        '--json',
      ]);
      if (countRes.error || countRes.status !== 0) {
        const snippet = buildDiagnosticSnippet(countRes, redact);
        failClosed(
          `wrangler d1 execute failed counting Dev rows (exit ${countRes.status ?? 'spawn error'}).${snippet ? ` Raw (redacted) response snippet: ${snippet}` : ' (no output captured)'}`,
        );
        return;
      }
      let countParsed;
      try {
        countParsed = parseWranglerJson(countRes.stdout);
      } catch (error) {
        failClosed(`could not parse row-count output: ${error.message}`);
        return;
      }
      tables = parseRowCountRows(extractD1Rows(countParsed));
    }

    d1.liveProbe = 'ok';
    d1.liveDatabaseName = previewDbName;
    d1.tableCount = tableNames.length;
    d1.tables = tables;
  }

  const endpoint = process.env.B2_ENDPOINT.replace(/\/$/, '');
  const bucket = process.env.B2_BUCKET;
  const accessKeyId = process.env.B2_KEY_ID;
  const secretAccessKey = process.env.B2_APP_KEY;

  const aws = new AwsClient({
    accessKeyId,
    secretAccessKey,
    sessionToken: undefined,
    service: 's3',
    region: undefined,
    cache: undefined,
    retries: 2,
    initRetryMs: undefined,
  });

  const pathBucket = bucket.split('/').map(encodeURIComponent).join('/');
  const qs = new URLSearchParams({ 'list-type': '2', 'max-keys': '1000' });
  const listUrl = `${endpoint}/${pathBucket}?${qs.toString()}`;

  const b2 = { reachable: false, objectCount: null, truncated: false, failureReason: '' };
  try {
    const res = await aws.fetch(listUrl, { method: 'GET' });
    if (!res.ok) {
      const text = await res.text();
      const code = extractS3ErrorCode(text);
      b2.failureReason = code ? `HTTP ${res.status}: ${code}` : `HTTP ${res.status}`;
    } else {
      const xml = await res.text();
      const page = parseListObjectsV2Page(xml);
      b2.reachable = true;
      b2.objectCount = page.keys.length;
      b2.truncated = page.isTruncated;
    }
  } catch (error) {
    b2.failureReason = redact(error.message || 'fetch failed');
  }

  const result = { checkedAt: new Date().toISOString(), d1, b2 };

  fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);

  console.log(
    `OK: D1 contract PASS (prod=${d1.productionName}, preview=${d1.previewName}); liveProbe=${d1.liveProbe}; B2 reachable=${b2.reachable}.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().then(() => {
    if (process.exitCode) process.exit(process.exitCode);
  });
}
