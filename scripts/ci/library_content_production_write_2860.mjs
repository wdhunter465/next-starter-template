#!/usr/bin/env node
/**
 * #2860 — controlled Production write path for the library_entries -> content_inventory
 * migration batch (all-drafts-first, per #2913's batch plan and the #2860 Production Go
 * evidence package, PR #3266).
 *
 * Built per Bill's 2026-08-12 GO decision on #2860: "Build + validate + PR + merge only.
 * Do not dispatch, trigger, or execute a Production D1 write." This script is merged but
 * not dispatched by the same actor who built it — a separate, later, explicit dispatch
 * decision is required before it ever runs, in either mode.
 *
 * Two independent gates must both be satisfied before any write is attempted, enforced by
 * this script itself (not just the workflow's own input validation — defense in depth for
 * the one script in this repo capable of writing to Production D1):
 *   1. CONFIRM_WRITE env var must be exactly "confirm".
 *   2. MODE env var must be exactly "apply" — "dry-run" (the workflow's default) never
 *      writes, regardless of CONFIRM_WRITE.
 * Even in "apply" mode, this reuses the exact same pure planning logic already proven in
 * #2911/#2912 (scripts/migrations/library-content-backfill.mjs, 27 passing tests) — it does
 * not reimplement row classification, field mapping, or SQL generation.
 *
 * Batch shape: all-drafts-first (#2913's batch plan) — Production's own schema (no
 * is_approved column, re-confirmed live on every run, not trusted from stale evidence)
 * makes this the only viable shape today; every eligible row migrates as status: 'draft',
 * nothing publishes in this batch.
 *
 * Safety:
 *   - Confirms the resolved database uuid matches wrangler.toml's Production database_id,
 *     both from the D1_DATABASE_ID secret directly and from the live `wrangler d1 info`
 *     result, before any read or write — fails closed on any mismatch.
 *   - Every legacy row read from Production is passed through the same field-mapping logic
 *     that structurally never carries `email` into any written field (buildMigratedFields).
 *   - Output (console, result artifact, issue comment) is aggregate counts, exception
 *     codes, and legacy numeric ids only — matching the existing dry-run CLI's own output
 *     shape. No row title/content/name/email text is ever printed or recorded.
 *   - Writes execute as a single generated SQL file via `wrangler d1 execute --file`
 *     (many separate statements, not a combined UNION ALL query — the same execution mode
 *     already proven safe at scale in #3268 Phase 2/3's restore-verify script).
 *   - Rollback command (proven end-to-end in #2912, verbatim): see ROLLBACK_SQL below.
 *   - On any `wrangler d1` failure, a redacted, truncated (800-char) snippet of stderr/
 *     stdout is included in the fail-closed message — built in from the start this time,
 *     after #2859's Preview preflight needed three live iterations to reach the same place.
 *
 * Required env (GitHub Actions repository secrets; values are never logged):
 *   CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, D1_DATABASE_NAME, D1_DATABASE_ID — the
 *   existing Production D1 secrets already used by scripts/ci/production_d1_preflight_2913.mjs;
 *   no new secret is introduced.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  MIGRATION_TAG_PREFIX,
  buildInsertStatement,
  buildPlanForBackfill,
  buildUpdateStatement,
  hasApprovalColumn,
} from '../migrations/library-content-backfill.mjs';
import { parseWranglerJson, extractDatabaseUuid, extractD1Rows } from './production_d1_preflight_2913.mjs';
import { parseProdAndPreviewD1 } from './d1_prod_dev_identity_check.mjs';
import { redactSecrets } from './d1_backup_r2_phase1_preflight_3268.mjs';

export const RESULT_JSON_PATH = 'library-content-production-write-2860-result.json';
export const RESULT_MD_PATH = 'library-content-production-write-2860-result.md';

export const ROLLBACK_SQL = "DELETE FROM content_inventory WHERE canonical = 1 AND tag LIKE 'legacy-library-%';";

export function requireEnv(env = process.env) {
  return ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'D1_DATABASE_NAME', 'D1_DATABASE_ID'].filter(
    (name) => !env[name],
  );
}

/** Both gates -- MODE and CONFIRM_WRITE -- must independently agree before any write is attempted. */
export function isApplyMode(env = process.env) {
  return env.MODE === 'apply' && env.CONFIRM_WRITE === 'confirm';
}

export function buildStatementsForPlan(plan) {
  const statements = [];
  for (const p of plan.plans) {
    if (p.action === 'insert') {
      statements.push(buildInsertStatement(p.fields, p.fields.status === 'published'));
    } else if (p.action === 'update') {
      statements.push(buildUpdateStatement(p.id, p.fields, p.willBecomePublished));
    }
  }
  return statements;
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
    '<!-- library-content-production-write-2860 -->',
    '## #2860 library-content Production write — all-drafts-first batch',
    '',
    `- Checked at: ${result.checkedAt}`,
    `- Mode: **${result.mode}**`,
    '- Database identity: confirmed Production (name/uuid verified against wrangler.toml and live `wrangler d1 info`; not printed, matching this repo\'s existing D1 preflight convention)',
    '',
    '### Row classification (aggregate counts only — no row content, no email)',
    '',
    `- \`is_approved\` column present (checked live, this run): ${result.approvalColumnPresent ? 'YES' : 'NO'}`,
    `- Legacy rows total: ${result.counts?.LE_TOTAL ?? 'n/a'}`,
    `- Already migrated (existing legacy-tagged canonical rows): ${result.counts?.CI_LEGACY_TAG ?? 'n/a'}`,
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
      ? ['### Exceptions (legacy id + code only)', '', ...exceptions.map((e) => `- \`${e.legacyId}\`: ${e.code}`), ''].join('\n')
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
          `- \`library_entries\`: before ${result.preLegacyTotal}, after ${result.postLegacyTotal ?? 'n/a'} (must match — no deletes)`,
          `- Migrated (legacy-tagged canonical): before ${result.preMigratedCount}, after ${result.postMigratedCount ?? 'n/a'}`,
          `- Published (legacy-tagged canonical), after: ${result.postPublishedCount ?? 'n/a'} (must be 0 for this all-drafts-first batch)`,
        ].join('\n'),
    '',
    '### Rollback command (proven end-to-end in #2912; reverts only this migration\'s own rows)',
    '',
    '```sql',
    ROLLBACK_SQL,
    '```',
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
  console.error('No Production write of any kind was attempted beyond what is explicitly reported above.');
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
      process.env.D1_DATABASE_NAME,
      process.env.D1_DATABASE_ID,
    ]);

  const wranglerPath = path.resolve(process.cwd(), 'wrangler.toml');
  if (!fs.existsSync(wranglerPath)) {
    failClosed('wrangler.toml not found — cannot confirm expected Production database identity.');
    return;
  }
  const identities = parseProdAndPreviewD1(fs.readFileSync(wranglerPath, 'utf8'));
  const expected = identities.production;
  if (!expected.databaseId || !expected.databaseName) {
    failClosed("wrangler.toml does not declare a Production [[d1_databases]] name/id.");
    return;
  }

  const dbName = process.env.D1_DATABASE_NAME;
  if (dbName !== expected.databaseName) {
    failClosed(`wrong database identity — D1_DATABASE_NAME secret does not match wrangler.toml's Production database ("${expected.databaseName}").`);
    return;
  }
  if (process.env.D1_DATABASE_ID !== expected.databaseId) {
    failClosed("wrong database identity — D1_DATABASE_ID secret does not match wrangler.toml's Production database_id.");
    return;
  }

  const info = runWrangler(['d1', 'info', dbName, '--json']);
  if (info.error || info.status !== 0) {
    const snippet = buildDiagnosticSnippet(info, redact);
    failClosed(`wrangler d1 info failed for Production database (exit ${info.status ?? 'spawn error'}).${snippet ? ` Raw (redacted) response snippet: ${snippet}` : ' (no output captured)'}`);
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
  if (remoteUuid !== expected.databaseId) {
    failClosed('live database uuid does not match the expected Production database_id from wrangler.toml — refusing.');
    return;
  }

  function runD1Query(sql, label) {
    const res = runWrangler(['d1', 'execute', dbName, '--remote', '--command', sql, '--json']);
    if (res.error || res.status !== 0) {
      const snippet = buildDiagnosticSnippet(res, redact);
      failClosed(`wrangler d1 execute failed (${label}) (exit ${res.status ?? 'spawn error'}).${snippet ? ` Raw (redacted) response snippet: ${snippet}` : ' (no output captured)'}`);
      return null;
    }
    try {
      return extractD1Rows(parseWranglerJson(res.stdout));
    } catch (error) {
      failClosed(`could not parse wrangler output (${label}): ${error.message}`);
      return null;
    }
  }

  const tableInfoRows = runD1Query('PRAGMA table_info(library_entries);', 'table_info');
  if (tableInfoRows === null) return;
  if (!tableInfoRows.length) {
    failClosed('PRAGMA table_info(library_entries) returned zero columns — the table may not exist.');
    return;
  }
  const approvalColumnPresent = hasApprovalColumn(tableInfoRows);

  // The entire all-drafts-first batch design (#2913's batch plan, and the Go decision built
  // on it) rests on Production's schema NOT having is_approved, confirmed live above -- not
  // on the SELECT below happening to omit it. If that assumption is ever violated, fail
  // closed rather than silently proceed on a batch shape nobody reviewed for this case.
  if (approvalColumnPresent) {
    failClosed(
      "PRAGMA table_info(library_entries) found an is_approved column, contradicting the all-drafts-first batch design this script implements (#2913's batch plan assumed it absent, confirmed live at build time). Refusing to proceed -- this schema state was never reviewed as part of #2860's Production Go decision.",
    );
    return;
  }

  // approvalColumnPresent is guaranteed false past the guard above, so is_approved is
  // deliberately not selected here -- there is nothing for classifyLegacyRow() to read.
  const legacyRows = runD1Query('SELECT id, name, email, title, content, created_at FROM library_entries;', 'legacy rows');
  if (legacyRows === null) return;

  const existingRows = runD1Query(
    `SELECT id, tag, title, text, credit_line, source_name, status, summary, search_text FROM content_inventory WHERE canonical = 1 AND tag LIKE '${MIGRATION_TAG_PREFIX}%';`,
    'existing migrated rows',
  );
  if (existingRows === null) return;

  const plan = buildPlanForBackfill(legacyRows, approvalColumnPresent, existingRows);
  const applyMode = isApplyMode(process.env);

  const result = {
    checkedAt: new Date().toISOString(),
    mode: applyMode ? 'apply' : 'dry-run',
    approvalColumnPresent,
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

  result.preLegacyTotal = legacyRows.length;
  result.preMigratedCount = existingRows.length;

  const statements = buildStatementsForPlan(plan);

  if (statements.length === 0) {
    result.writeOk = true;
    result.statementCount = 0;
    result.postLegacyTotal = result.preLegacyTotal;
    result.postMigratedCount = result.preMigratedCount;
    result.postPublishedCount = existingRows.filter((r) => r.status === 'published').length;
    fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);
    console.log('OK: apply mode, nothing to write (idempotent no-op).');
    return;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'library-content-write-'));
  const tmpFile = path.join(tmpDir, 'backfill.sql');
  try {
    fs.writeFileSync(tmpFile, statements.join('\n'));
    const writeRes = runWrangler(['d1', 'execute', dbName, '--remote', '-y', '--file', tmpFile, '--json']);
    if (writeRes.error || writeRes.status !== 0) {
      const snippet = buildDiagnosticSnippet(writeRes, redact);
      result.writeOk = false;
      result.writeFailureReason = `wrangler d1 execute failed (exit ${writeRes.status ?? 'spawn error'})`;
      fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
      fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);
      failClosed(`Production write failed (exit ${writeRes.status ?? 'spawn error'}).${snippet ? ` Raw (redacted) response snippet: ${snippet}` : ' (no output captured)'}`);
      return;
    }
    result.writeOk = true;
    result.statementCount = statements.length;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const postLegacyRows = runD1Query('SELECT COUNT(*) AS n FROM library_entries;', 'post legacy count');
  if (postLegacyRows === null) return;
  const postMigratedRows = runD1Query(
    `SELECT COUNT(*) AS n FROM content_inventory WHERE canonical = 1 AND tag LIKE '${MIGRATION_TAG_PREFIX}%';`,
    'post migrated count',
  );
  if (postMigratedRows === null) return;
  const postPublishedRows = runD1Query(
    `SELECT COUNT(*) AS n FROM content_inventory WHERE canonical = 1 AND tag LIKE '${MIGRATION_TAG_PREFIX}%' AND status = 'published';`,
    'post published count',
  );
  if (postPublishedRows === null) return;

  result.postLegacyTotal = parseCount(postLegacyRows);
  result.postMigratedCount = parseCount(postMigratedRows);
  result.postPublishedCount = parseCount(postPublishedRows);

  fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);
  console.log(`OK: apply mode complete. statements=${statements.length}, postLegacyTotal=${result.postLegacyTotal}, postMigratedCount=${result.postMigratedCount}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().then(() => {
    if (process.exitCode) process.exit(process.exitCode);
  });
}
