#!/usr/bin/env node
/**
 * #3268 Phase 1 — read-only Production D1 identity/backup-support preflight.
 *
 * Gathers the facts #3268's own "Phase 1 — Current-state and security preflight"
 * asks for that are answerable from the live database itself: confirmed database
 * identity, `wrangler d1 info` metadata (size/table count/region/jurisdiction/
 * read-replication mode), and a best-effort Time Travel bookmark read via
 * `wrangler d1 time-travel info`.
 *
 * This script performs exactly two read-only wrangler invocations
 * (`d1 info`, `d1 time-travel info`) and never runs `d1 execute`, `d1 export`,
 * `d1 time-travel restore`, or any R2 command — there is no code path here that
 * can write to or restore the database. `d1 time-travel info` is attempted as
 * best-effort: if the installed wrangler version does not support it, that is
 * recorded as `timeTravelConfirmed: false` with the reason, not a hard failure,
 * since a missing/older subcommand is itself informative evidence for #3268
 * Phase 1 item 2 ("confirm the storage version supports Time Travel").
 *
 * Note: this repo has no separate Preview D1 database (see
 * docs/reference/platform/component-environment-isolation.md — `lgfc_lite` is
 * production-shared with no `[[env.preview.d1_databases]]` override), so this
 * preflight necessarily reads the same database #2913's precedent already read
 * read-only. It never reads or writes row content — only schema/metadata level
 * facts (table counts, sizes, bookmark identifiers).
 *
 * Required env (GitHub Actions repository secrets; values are never logged):
 *   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, D1_DATABASE_NAME, D1_DATABASE_ID
 *   (CF_API_TOKEN / CF_ACCOUNT_ID accepted as aliases, matching verify_cloudflare_d1_auth.mjs)
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { parseWranglerToml, parseWranglerJson, extractDatabaseUuid } from './production_d1_preflight_2913.mjs';

export const RESULT_JSON_PATH = 'd1-backup-phase1-preflight-3268-result.json';
export const RESULT_MD_PATH = 'd1-backup-phase1-preflight-3268-result.md';

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
  return ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'D1_DATABASE_NAME', 'D1_DATABASE_ID'].filter(
    (name) => !env[name],
  );
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

/**
 * Extracts the non-sensitive metadata fields #3268 Phase 1 asks about from `wrangler d1 info
 * --json`, plus the full raw record verbatim.
 *
 * Confirmed against the real, live response (#3268 issue comment, 2026-08-10 —
 * https://github.com/wdhunter645/next-starter-template/issues/3268#issuecomment-5244205336):
 * `{ uuid, name, created_at, num_tables, running_in_region, read_replication: { mode },
 * jurisdiction, database_size, read_queries_24h, write_queries_24h, rows_read_24h,
 * rows_written_24h }`. There is no `version`/`storage_version`/similar field in this API's
 * response at all — Time Travel support is confirmed instead by
 * `extractTimeTravelBookmark` returning a real bookmark, which is stronger evidence than a
 * version flag would have been. `runningInRegion` and `jurisdiction` are extracted because
 * they directly answer part of #3268's own "regional/jurisdictional considerations" decision
 * item for the R2 backup bucket. `raw` stays included for any future field this extraction
 * doesn't yet surface — schema/metadata-level only (no row content, no credentials).
 */
export function extractD1InfoMetadata(parsed) {
  const record = Array.isArray(parsed) ? parsed[0] : parsed?.result ?? parsed;
  if (!record || typeof record !== 'object') return null;
  return {
    fileSize: record.database_size ?? record.file_size ?? record.size ?? null,
    numTables: record.num_tables ?? null,
    runningInRegion: record.running_in_region ?? null,
    jurisdiction: record.jurisdiction ?? null,
    readReplicationMode: record.read_replication?.mode ?? null,
    raw: record,
  };
}

/**
 * Extracts a Time Travel bookmark identifier from `wrangler d1 time-travel info --json`, if
 * present, plus the full raw record verbatim (same "surface raw, don't re-guess" rationale as
 * extractD1InfoMetadata above).
 */
export function extractTimeTravelBookmark(parsed) {
  const record = Array.isArray(parsed) ? parsed[0] : parsed?.result ?? parsed;
  if (!record || typeof record !== 'object') return { bookmark: '', raw: null };
  return { bookmark: String(record.bookmark ?? record.timestamp ?? ''), raw: record };
}

export function buildResultMarkdown(result) {
  const lines = [
    '<!-- d1-backup-phase1-preflight-3268 -->',
    '## #3268 Phase 1 — Production D1 identity/backup-support preflight (read-only)',
    '',
    `- Checked at: ${result.checkedAt}`,
    `- Database identity confirmed: ${result.identityConfirmed ? 'YES' : 'NO'}`,
    `- \`wrangler d1 info\`: ${result.infoOk ? 'OK' : 'FAILED'}`,
    result.infoOk
      ? `  - database_size: ${result.metadata?.fileSize ?? 'unknown'} bytes, num_tables: ${result.metadata?.numTables ?? 'unknown'}, region: ${result.metadata?.runningInRegion ?? 'unknown'}, jurisdiction: ${result.metadata?.jurisdiction ?? 'none set'}, read_replication: ${result.metadata?.readReplicationMode ?? 'unknown'}`
      : `  - reason: ${result.infoFailureReason ?? 'unknown'}`,
    `- Time Travel confirmed via CLI: ${result.timeTravelConfirmed ? 'YES' : 'NO'}`,
    result.timeTravelConfirmed
      ? `  - bookmark present: ${result.timeTravelBookmark ? 'YES' : 'NO (empty bookmark field)'}`
      : `  - reason: ${result.timeTravelFailureReason ?? 'unknown'}`,
    ...(result.infoOk && result.metadata?.raw
      ? [
          '',
          '<details><summary>Raw `wrangler d1 info` response (schema/metadata only, no row content or credentials)</summary>',
          '',
          '```json',
          JSON.stringify(result.metadata.raw, null, 2),
          '```',
          '',
          '</details>',
        ]
      : []),
    ...(result.timeTravelConfirmed && result.timeTravelRaw
      ? [
          '',
          '<details><summary>Raw `wrangler d1 time-travel info` response</summary>',
          '',
          '```json',
          JSON.stringify(result.timeTravelRaw, null, 2),
          '```',
          '',
          '</details>',
        ]
      : []),
    '',
    '### Phase 1 items this preflight can and cannot answer',
    '',
    '- Item 1 (exact database name/UUID): answered above (identity confirmed against `wrangler.toml`, no secret value printed).',
    '- Item 2 (storage version / Time Travel support): answered above — `wrangler d1 info` exposes no separate storage-version field; Time Travel support is instead confirmed directly by a real bookmark being returned, which is stronger evidence.',
    '- Item 3 (account plan / Time Travel retention): **not answerable from this preflight** — `wrangler d1 info`/`time-travel info` do not expose plan tier; requires the Cloudflare dashboard or a separate account-level API call this script does not make.',
    '- Items 4-5 (R2 bucket inventory, non-D1 token inventory): **not answerable — no R2-scoped credential exists in this repository\'s secrets** (confirmed by grep of `.github/workflows/**` for `secrets.R2_*`, no matches). Requires Bill to provision an R2 API token before any R2 investigation can run. `region`/`jurisdiction` above partially inform the bucket\'s own regional/jurisdictional decision once R2 investigation is possible.',
    '- Items 6-7 (data sensitivity classification, no-public-exposure proof): out of this script\'s scope — documentation/design work, not a live read.',
  ];
  return lines.join('\n');
}

function writeOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) fs.appendFileSync(outputPath, `${name}=${value}\n`);
}

function failClosed(message) {
  console.error(`FAIL-CLOSED: ${message}`);
  console.error('No Production write was attempted; this script has no write code path.');
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
    failClosed("wrangler.toml does not declare a [[d1_databases]] name/id — cannot confirm expected database identity.");
    return;
  }

  const dbName = process.env.D1_DATABASE_NAME;
  if (dbName !== expected.databaseName) {
    failClosed(`wrong database identity — D1_DATABASE_NAME secret does not match this repo's configured database ("${expected.databaseName}").`);
    return;
  }

  const info = runWrangler(['d1', 'info', dbName, '--json']);
  let identityConfirmed = false;
  let infoOk = false;
  let infoFailureReason = '';
  let metadata = null;

  if (info.error || info.status !== 0) {
    infoFailureReason = `wrangler d1 info failed (exit ${info.status ?? 'spawn error'}).`;
  } else {
    try {
      const infoParsed = parseWranglerJson(info.stdout);
      const remoteUuid = extractDatabaseUuid(infoParsed);
      if (!remoteUuid) {
        infoFailureReason = 'wrangler d1 info returned no database uuid.';
      } else if (remoteUuid !== expected.databaseId || remoteUuid !== process.env.D1_DATABASE_ID) {
        failClosed('wrong database identity — the live database uuid does not match wrangler.toml and/or the D1_DATABASE_ID secret.');
        return;
      } else {
        identityConfirmed = true;
        infoOk = true;
        metadata = extractD1InfoMetadata(infoParsed);
      }
    } catch (error) {
      infoFailureReason = `could not parse "wrangler d1 info --json" output: ${error.message}`;
    }
  }

  if (!identityConfirmed) {
    failClosed(infoFailureReason || 'could not confirm database identity via wrangler d1 info.');
    return;
  }

  // Best-effort only: an older/newer wrangler CLI surface for this subcommand must not fail
  // the whole preflight, since a missing subcommand is itself Phase-1-relevant evidence.
  const timeTravel = runWrangler(['d1', 'time-travel', 'info', dbName, '--json']);
  let timeTravelConfirmed = false;
  let timeTravelFailureReason = '';
  let timeTravelBookmark = '';
  let timeTravelRaw = null;

  if (timeTravel.error || timeTravel.status !== 0) {
    timeTravelFailureReason = `wrangler d1 time-travel info did not succeed (exit ${timeTravel.status ?? 'spawn error'}) — CLI may not support this subcommand, or the account/plan may not expose it.`;
  } else {
    try {
      const ttParsed = parseWranglerJson(timeTravel.stdout);
      const extracted = extractTimeTravelBookmark(ttParsed);
      timeTravelBookmark = extracted.bookmark;
      timeTravelRaw = extracted.raw;
      timeTravelConfirmed = true;
    } catch (error) {
      timeTravelFailureReason = `could not parse "wrangler d1 time-travel info --json" output: ${error.message}`;
    }
  }

  const result = {
    checkedAt: new Date().toISOString(),
    identityConfirmed,
    infoOk,
    infoFailureReason: infoOk ? null : infoFailureReason,
    metadata,
    timeTravelConfirmed,
    timeTravelFailureReason: timeTravelConfirmed ? null : timeTravelFailureReason,
    timeTravelBookmark: timeTravelConfirmed ? timeTravelBookmark : null,
    timeTravelRaw: timeTravelConfirmed ? timeTravelRaw : null,
  };

  fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);

  writeOutput('identity_confirmed', String(identityConfirmed));
  writeOutput('time_travel_confirmed', String(timeTravelConfirmed));

  console.log(
    `OK: identity confirmed, wrangler d1 info ${infoOk ? 'succeeded' : 'failed'}, time-travel info ${timeTravelConfirmed ? 'succeeded' : 'not confirmed'}.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().then(() => {
    if (process.exitCode) process.exit(process.exitCode);
  });
}
