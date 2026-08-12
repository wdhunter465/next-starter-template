#!/usr/bin/env node
/**
 * #2859 — controlled Development write path for events -> content_inventory
 * (mapping: docs/ops/reports/events-public-content-inventory-mapping-2859.md).
 *
 * Targets isolated Development D1 only (`lgfc-litedev` / wrangler env.preview).
 * Production D1 writes are refused (fail-closed identity guard).
 *
 * Gates (both required for apply):
 *   1. CONFIRM_WRITE === "confirm"
 *   2. MODE === "apply"  (default dry-run never writes)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  MIGRATION_TAG_PREFIX,
  ROLLBACK_SQL,
  buildPlanForBackfill,
  buildStatementsForPlan,
} from '../migrations/events-public-content-backfill.mjs';

export const RESULT_JSON_PATH = 'events-public-dev-write-2859-result.json';
export const RESULT_MD_PATH = 'events-public-dev-write-2859-result.md';

export function requireEnv(env = process.env) {
  return ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'D1_DEV_DATABASE_NAME', 'D1_DEV_DATABASE_ID'].filter(
    (name) => !env[name],
  );
}

export function isApplyMode(env = process.env) {
  return env.MODE === 'apply' && env.CONFIRM_WRITE === 'confirm';
}

/** Minimal Production + Preview D1 parse from wrangler.toml (fail-closed callers). */
export function parseProdAndPreviewD1(text = '') {
  const production = { databaseName: '', databaseId: '' };
  const preview = { databaseName: '', databaseId: '' };

  const top = text.match(
    /\[\[d1_databases\]\][\s\S]*?database_name\s*=\s*"([^"]+)"[\s\S]*?database_id\s*=\s*"([^"]+)"/,
  );
  if (top) {
    production.databaseName = top[1];
    production.databaseId = top[2];
  }

  const prev = text.match(
    /\[\[env\.preview\.d1_databases\]\][\s\S]*?database_name\s*=\s*"([^"]+)"[\s\S]*?database_id\s*=\s*"([^"]+)"/,
  );
  if (prev) {
    preview.databaseName = prev[1];
    preview.databaseId = prev[2];
  }

  return { production, preview };
}

export function redactSecrets(text, secrets = []) {
  let out = String(text || '');
  for (const secret of secrets) {
    if (!secret) continue;
    out = out.split(String(secret)).join('[REDACTED]');
  }
  return out;
}

export function parseWranglerJson(stdout) {
  const text = String(stdout || '').trim();
  if (!text) return null;
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

export function parseCount(rows) {
  return Number(rows?.[0]?.n ?? 0);
}

export function buildDiagnosticSnippet(procResult, redact) {
  const stderr = String(procResult?.stderr ?? '').trim();
  const stdout = String(procResult?.stdout ?? '').trim();
  const raw = stderr || stdout;
  if (!raw) return '';
  const redacted = redact(raw);
  return redacted.length > 800 ? `${redacted.slice(0, 800)}...` : redacted;
}

export function buildResultMarkdown(result) {
  const exceptions = result.exceptions || [];
  const lines = [
    '<!-- events-public-dev-write-2859 -->',
    '## #2859 events-public Development write — `lgfc-litedev` only',
    '',
    `- Checked at: ${result.checkedAt}`,
    `- Mode: **${result.mode}**`,
    '- Database identity: confirmed Development/Preview (`lgfc-litedev`; Production refused)',
    '',
    '### Row classification (aggregate counts only)',
    '',
    `- Events total: ${result.counts?.EV_TOTAL ?? 'n/a'}`,
    `- Posted / hidden / invalid: ${result.counts?.EV_POSTED ?? 'n/a'} / ${result.counts?.EV_HIDDEN ?? 'n/a'} / ${result.counts?.EV_INVALID_EMPTY ?? 'n/a'}`,
    `- Already migrated (\`legacy-events-%\`): ${result.counts?.CI_CALENDAR_TAG ?? 'n/a'}`,
    '',
    '### Plan summary',
    '',
    `- Insert: ${result.summary?.insert ?? 0}`,
    `- Update: ${result.summary?.update ?? 0}`,
    `- No-op: ${result.summary?.noop ?? 0}`,
    `- Excluded: ${result.summary?.excluded ?? 0}`,
    `- Conflict: ${result.summary?.conflict ?? 0}`,
    '',
    exceptions.length
      ? ['### Exceptions (legacy id + code only)', '', ...exceptions.map((e) => `- \`${e.legacyId}\`: ${e.code}`), ''].join(
          '\n',
        )
      : '',
    result.mode === 'dry-run'
      ? '### No write performed — dry-run only'
      : [
          '### Write result',
          '',
          `- Executed: ${result.writeOk ? 'YES' : 'NO'}${result.writeFailureReason ? ` (${result.writeFailureReason})` : ''}`,
          result.writeOk ? `- Statements executed: ${result.statementCount}` : '',
          '',
          '### Pre/post counts',
          '',
          `- \`events\`: before ${result.preEventsTotal}, after ${result.postEventsTotal ?? 'n/a'} (must match — no deletes)`,
          `- Migrated (\`legacy-events-%\`): before ${result.preMigratedCount}, after ${result.postMigratedCount ?? 'n/a'}`,
          `- Published (\`legacy-events-%\`), after: ${result.postPublishedCount ?? 'n/a'}`,
        ].join('\n'),
    '',
    '### Rollback command (Dev only; reverts only this migration\'s rows)',
    '',
    '```sql',
    ROLLBACK_SQL,
    '```',
    '',
    '### Boundaries',
    '',
    '- Production D1: not targeted',
    '- `/api/events/*` and `/api/search`: unchanged by this write (`allowed_sections=["calendar"]` only)',
    '- Library / final editorial publication: not authorized here',
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
  console.error('No Development write was attempted beyond what is explicitly reported above. Production was never targeted.');
  process.exitCode = 1;
}

export async function main() {
  const missing = requireEnv(process.env);
  if (missing.length > 0) {
    failClosed(`missing required credential(s): ${missing.join(', ')} (values are never logged).`);
    return;
  }

  const redact = (text) =>
    redactSecrets(text, [
      process.env.CLOUDFLARE_API_TOKEN,
      process.env.CLOUDFLARE_ACCOUNT_ID,
      process.env.D1_DEV_DATABASE_NAME,
      process.env.D1_DEV_DATABASE_ID,
      process.env.D1_DATABASE_NAME,
      process.env.D1_DATABASE_ID,
    ]);

  const wranglerPath = path.resolve(process.cwd(), 'wrangler.toml');
  if (!fs.existsSync(wranglerPath)) {
    failClosed('wrangler.toml not found — cannot confirm Development database identity.');
    return;
  }
  const identities = parseProdAndPreviewD1(fs.readFileSync(wranglerPath, 'utf8'));
  const expectedDev = identities.preview;
  const production = identities.production;
  if (!expectedDev.databaseId || !expectedDev.databaseName) {
    failClosed('wrangler.toml does not declare env.preview [[d1_databases]] name/id.');
    return;
  }
  if (!production.databaseId || expectedDev.databaseId === production.databaseId) {
    failClosed('Development and Production D1 identities are missing or shared — refusing (isolation contract).');
    return;
  }

  const dbName = process.env.D1_DEV_DATABASE_NAME;
  if (dbName !== expectedDev.databaseName) {
    failClosed(
      `wrong database identity — D1_DEV_DATABASE_NAME does not match wrangler.toml Preview/Development database ("${expectedDev.databaseName}").`,
    );
    return;
  }
  if (process.env.D1_DEV_DATABASE_ID !== expectedDev.databaseId) {
    failClosed('wrong database identity — D1_DEV_DATABASE_ID does not match wrangler.toml Preview/Development database_id.');
    return;
  }
  if (process.env.D1_DEV_DATABASE_ID === production.databaseId) {
    failClosed('D1_DEV_DATABASE_ID matches Production — refusing to proceed.');
    return;
  }

  const info = runWrangler(['d1', 'info', dbName, '--json']);
  if (info.error || info.status !== 0) {
    const snippet = buildDiagnosticSnippet(info, redact);
    failClosed(
      `wrangler d1 info failed for Development database (exit ${info.status ?? 'spawn error'}).${snippet ? ` Raw (redacted) response snippet: ${snippet}` : ' (no output captured)'}`,
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
  if (remoteUuid !== expectedDev.databaseId) {
    failClosed('live database uuid does not match expected Development database_id — refusing.');
    return;
  }
  if (remoteUuid === production.databaseId) {
    failClosed('live database uuid matches Production — refusing.');
    return;
  }

  function runD1Query(sql, label) {
    const res = runWrangler(['d1', 'execute', dbName, '--remote', '--env', 'preview', '--command', sql, '--json']);
    if (res.error || res.status !== 0) {
      const snippet = buildDiagnosticSnippet(res, redact);
      failClosed(
        `wrangler d1 execute failed (${label}) (exit ${res.status ?? 'spawn error'}).${snippet ? ` Raw (redacted) response snippet: ${snippet}` : ' (no output captured)'}`,
      );
      return null;
    }
    try {
      return extractD1Rows(parseWranglerJson(res.stdout));
    } catch (error) {
      failClosed(`could not parse wrangler output (${label}): ${error.message}`);
      return null;
    }
  }

  const eventRows = runD1Query(
    'SELECT id, title, start_date, end_date, location, host, fees, description, external_url, status, created_at, updated_at FROM events;',
    'events rows',
  );
  if (eventRows === null) return;

  const existingRows = runD1Query(
    `SELECT id, tag, title, text, credit_line, source_name, source_url, status, summary, search_text, event_date, event_year, rotation_group, allowed_sections FROM content_inventory WHERE canonical = 1 AND tag LIKE '${MIGRATION_TAG_PREFIX}%';`,
    'existing migrated rows',
  );
  if (existingRows === null) return;

  const plan = buildPlanForBackfill(eventRows, existingRows);
  const applyMode = isApplyMode(process.env);

  const result = {
    checkedAt: new Date().toISOString(),
    mode: applyMode ? 'apply' : 'dry-run',
    counts: plan.counts,
    summary: plan.summary,
    exceptions: plan.plans
      .filter((p) => p.action === 'excluded' || p.action === 'conflict')
      .map((p) => ({ legacyId: p.legacyId, code: p.exceptionCode })),
  };

  if (!applyMode) {
    fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);
    console.log(
      `OK: dry-run complete. insert=${plan.summary.insert} update=${plan.summary.update} noop=${plan.summary.noop} excluded=${plan.summary.excluded} conflict=${plan.summary.conflict}.`,
    );
    return;
  }

  if (plan.summary.conflict > 0) {
    failClosed(`refusing apply: ${plan.summary.conflict} unresolved TAG_COLLISION_NON_MIGRATION_SOURCE conflict(s).`);
    return;
  }

  result.preEventsTotal = eventRows.length;
  result.preMigratedCount = existingRows.length;

  const statements = buildStatementsForPlan(plan);
  if (statements.length === 0) {
    result.writeOk = true;
    result.statementCount = 0;
    result.postEventsTotal = result.preEventsTotal;
    result.postMigratedCount = result.preMigratedCount;
    result.postPublishedCount = existingRows.filter((r) => r.status === 'published').length;
    fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);
    console.log('OK: apply mode, nothing to write (idempotent no-op).');
    return;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'events-public-dev-write-'));
  const tmpFile = path.join(tmpDir, 'backfill.sql');
  try {
    fs.writeFileSync(tmpFile, `${statements.join('\n')}\n`);
    const writeRes = runWrangler([
      'd1',
      'execute',
      dbName,
      '--remote',
      '--env',
      'preview',
      '-y',
      '--file',
      tmpFile,
      '--json',
    ]);
    if (writeRes.error || writeRes.status !== 0) {
      const snippet = buildDiagnosticSnippet(writeRes, redact);
      result.writeOk = false;
      result.writeFailureReason = `wrangler d1 execute failed (exit ${writeRes.status ?? 'spawn error'})`;
      fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
      fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);
      failClosed(
        `Development write failed (exit ${writeRes.status ?? 'spawn error'}).${snippet ? ` Raw (redacted) response snippet: ${snippet}` : ' (no output captured)'}`,
      );
      return;
    }
    result.writeOk = true;
    result.statementCount = statements.length;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const postEvents = runD1Query('SELECT COUNT(*) AS n FROM events;', 'post events count');
  if (postEvents === null) return;
  const postMigrated = runD1Query(
    `SELECT COUNT(*) AS n FROM content_inventory WHERE canonical = 1 AND tag LIKE '${MIGRATION_TAG_PREFIX}%';`,
    'post migrated count',
  );
  if (postMigrated === null) return;
  const postPublished = runD1Query(
    `SELECT COUNT(*) AS n FROM content_inventory WHERE canonical = 1 AND tag LIKE '${MIGRATION_TAG_PREFIX}%' AND status = 'published';`,
    'post published count',
  );
  if (postPublished === null) return;

  result.postEventsTotal = parseCount(postEvents);
  result.postMigratedCount = parseCount(postMigrated);
  result.postPublishedCount = parseCount(postPublished);

  fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);
  console.log(
    `OK: apply mode complete. statements=${statements.length}, postEventsTotal=${result.postEventsTotal}, postMigratedCount=${result.postMigratedCount}.`,
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().then(() => {
    if (process.exitCode) process.exit(process.exitCode);
  });
}
