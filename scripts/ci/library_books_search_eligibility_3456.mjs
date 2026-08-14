#!/usr/bin/env node
/**
 * #3456 — gated Production-only update that adds `search` to allowed_sections
 * for the six authorized Lou Gehrig library-book records. Library eligibility
 * is preserved. Development D1 writes are refused (that child was #3455).
 *
 * TARGET must be exactly "prod" → lgfc_lite / wrangler default env.
 * Production apply cites #3268 backup/recovery before mutate.
 *
 * Apply gates (both required):
 *   1. CONFIRM_WRITE === "confirm"
 *   2. MODE === "apply"  (default dry-run never writes)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  buildDiagnosticSnippet,
  extractD1Rows,
  extractDatabaseUuid,
  parseCount,
  parseProdAndPreviewD1,
  parseWranglerJson,
  redactSecrets,
} from './events_public_dev_write_2859.mjs';
import {
  BACKUP_EVIDENCE_COMMENT,
  BACKUP_EVIDENCE_ISSUE,
  BACKUP_R2_BUCKET,
  BOOK_TAGS,
  existingBooksQuery,
  libraryEligibleCountQuery,
  totalInventoryCountQuery,
} from './library_books_content_load_3451.mjs';
import {
  buildRollbackSql,
  buildStatementsForPlan,
  isApplyMode,
  planSearchEligibility,
  searchEligibleCountQuery,
} from './library_books_search_eligibility_3455.mjs';

export const RESULT_JSON_PATH = 'library-books-search-eligibility-3456-result.json';
export const RESULT_MD_PATH = 'library-books-search-eligibility-3456-result.md';
export const SOURCE_ISSUE = 3456;
export { BACKUP_EVIDENCE_COMMENT, BACKUP_EVIDENCE_ISSUE, BACKUP_R2_BUCKET };

export function parseTarget(env = process.env) {
  const target = String(env.TARGET || '').trim().toLowerCase();
  return target === 'prod' ? 'prod' : '';
}

export function refuseDevelopmentTarget(env = process.env) {
  const target = String(env.TARGET || '').trim().toLowerCase();
  return target === 'dev' || target === 'development' || target === 'preview';
}

export function requireEnv(env = process.env) {
  return ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'D1_DATABASE_NAME', 'D1_DATABASE_ID'].filter(
    (name) => !env[name],
  );
}

export function buildResultMarkdown(result) {
  const lines = [
    '<!-- library-books-search-eligibility-3456 -->',
    `## #3456 Production search eligibility — ${result.mode} (${result.target})`,
    '',
    `- Checked at: ${result.checkedAt}`,
    `- Target: ${result.target}`,
    `- Database name: ${result.databaseName}`,
    `- Database id: ${result.databaseId}`,
    `- Mode: ${result.mode}`,
    `- Update: ${result.summary?.update ?? 0}`,
    `- Noop: ${result.summary?.noop ?? 0}`,
    `- Conflict: ${result.summary?.conflict ?? 0}`,
    `- Pre inventory count: ${result.preInventoryCount ?? 'n/a'}`,
    `- Post inventory count: ${result.postInventoryCount ?? 'n/a'}`,
    `- Library-eligible authorized tags: ${result.libraryEligibleCount ?? 'n/a'} / 6`,
    `- Search-eligible authorized tags: ${result.searchEligibleCount ?? 'n/a'} / 6`,
    `- Authorized tags: ${BOOK_TAGS.join(', ')}`,
    `- Backup/recovery evidence: Issue #${BACKUP_EVIDENCE_ISSUE} Phase 2 R2 bucket \`${BACKUP_R2_BUCKET}\` (comment ${BACKUP_EVIDENCE_COMMENT}) cited before Production mutation.`,
    '- Development D1: refused (this child is Production-only; Dev was #3455)',
  ];
  if (result.exceptions?.length) {
    lines.push('', 'Conflicts:');
    for (const item of result.exceptions) {
      lines.push(`- ${item.tag}: ${item.code}`);
    }
  }
  if (result.rollbackSql) {
    lines.push(
      '',
      'Rollback (restore prior allowed_sections on the six authorized tags):',
      '',
      '```sql',
      result.rollbackSql,
      '```',
    );
  }
  if (result.writeOk === false) {
    lines.push('', `Write failed: ${result.writeFailureReason || 'unknown'}`);
  }
  lines.push('');
  return `${lines.join('\n')}\n`;
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
  console.error('No write beyond what is explicitly reported above was attempted.');
  process.exitCode = 1;
}

export async function main() {
  if (refuseDevelopmentTarget(process.env)) {
    failClosed('TARGET=dev is refused — #3456 is Production only. Development eligibility was #3455.');
    return;
  }

  const target = parseTarget(process.env);
  if (!target) {
    failClosed('TARGET must be exactly "prod".');
    return;
  }

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
    failClosed('wrangler.toml not found — cannot confirm expected database identity.');
    return;
  }
  const identities = parseProdAndPreviewD1(fs.readFileSync(wranglerPath, 'utf8'));
  const production = identities.production;
  const preview = identities.preview;
  if (!production.databaseId || !production.databaseName || !preview.databaseId || !preview.databaseName) {
    failClosed('Development and Production D1 identities are missing or shared — refusing (isolation contract).');
    return;
  }
  if (production.databaseId === preview.databaseId) {
    failClosed('Development and Production D1 identities are shared — refusing (isolation contract).');
    return;
  }

  const dbName = process.env.D1_DATABASE_NAME;
  const dbId = process.env.D1_DATABASE_ID;
  if (dbName !== production.databaseName) {
    failClosed(
      `wrong database identity — secret name does not match wrangler.toml production database ("${production.databaseName}").`,
    );
    return;
  }
  if (dbId !== production.databaseId) {
    failClosed('wrong database identity — secret id does not match wrangler.toml production database_id.');
    return;
  }
  if (dbId === preview.databaseId) {
    failClosed('D1_DATABASE_ID matches Development/Preview — refusing to proceed.');
    return;
  }

  const info = runWrangler(['d1', 'info', dbName, '--json']);
  if (info.error || info.status !== 0) {
    const snippet = buildDiagnosticSnippet(info, redact);
    failClosed(
      `wrangler d1 info failed (exit ${info.status ?? 'spawn error'}).${snippet ? ` Raw (redacted) response snippet: ${snippet}` : ' (no output captured)'}`,
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
  if (remoteUuid !== production.databaseId) {
    failClosed('live database uuid does not match expected Production database_id — refusing.');
    return;
  }
  if (remoteUuid === preview.databaseId) {
    failClosed('live database uuid matches Development/Preview — refusing.');
    return;
  }

  const executeArgs = ['d1', 'execute', dbName, '--remote'];

  function runD1Query(sql, label) {
    const res = runWrangler([...executeArgs, '--command', sql, '--json']);
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

  const existingRows = runD1Query(existingBooksQuery(), 'existing authorized tags');
  if (existingRows === null) return;
  const preInventory = runD1Query(totalInventoryCountQuery(), 'pre inventory count');
  if (preInventory === null) return;

  const plan = planSearchEligibility(existingRows);
  const applyMode = isApplyMode(process.env);
  const result = {
    checkedAt: new Date().toISOString(),
    target: 'prod',
    mode: applyMode ? 'apply' : 'dry-run',
    databaseName: production.databaseName,
    databaseId: production.databaseId,
    summary: plan.summary,
    exceptions: plan.plans
      .filter((item) => item.action === 'conflict')
      .map((item) => ({ tag: item.tag, code: item.exceptionCode })),
    preInventoryCount: parseCount(preInventory),
    rollbackSql: buildRollbackSql(plan),
    backupEvidence: {
      issue: BACKUP_EVIDENCE_ISSUE,
      comment: BACKUP_EVIDENCE_COMMENT,
      bucket: BACKUP_R2_BUCKET,
    },
  };

  if (plan.summary.conflict > 0) {
    fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);
    failClosed(`refusing: ${plan.summary.conflict} fail-closed conflict(s).`);
    return;
  }

  function attachEligibility(labelPrefix) {
    const libraryEligible = runD1Query(libraryEligibleCountQuery(), `${labelPrefix} library eligible count`);
    if (libraryEligible === null) return false;
    const searchEligible = runD1Query(searchEligibleCountQuery(), `${labelPrefix} search eligible count`);
    if (searchEligible === null) return false;
    result.libraryEligibleCount = parseCount(libraryEligible);
    result.searchEligibleCount = parseCount(searchEligible);
    return true;
  }

  if (!applyMode) {
    if (!attachEligibility('dry-run')) return;
    fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);
    console.log(
      `OK: dry-run complete (prod). update=${plan.summary.update} noop=${plan.summary.noop} conflict=0.`,
    );
    return;
  }

  const statements = buildStatementsForPlan(plan, new Set(['allowed_sections', 'updated_at']));
  if (statements.length === 0) {
    result.writeOk = true;
    result.statementCount = 0;
    result.postInventoryCount = result.preInventoryCount;
    if (!attachEligibility('idempotent')) return;
    fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);
    console.log('OK: apply mode, nothing to write (idempotent no-op) on prod.');
    return;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'library-books-3456-'));
  const tmpFile = path.join(tmpDir, 'search-eligibility.sql');
  try {
    fs.writeFileSync(tmpFile, `${statements.join('\n')}\n`);
    const writeArgs = [...executeArgs, '-y', '--file', tmpFile, '--json'];
    const writeRes = runWrangler(writeArgs);
    if (writeRes.error || writeRes.status !== 0) {
      const snippet = buildDiagnosticSnippet(writeRes, redact);
      result.writeOk = false;
      result.writeFailureReason = `wrangler d1 execute failed (exit ${writeRes.status ?? 'spawn error'})`;
      fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
      fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);
      failClosed(
        `write failed (exit ${writeRes.status ?? 'spawn error'}).${snippet ? ` Raw (redacted) response snippet: ${snippet}` : ' (no output captured)'}`,
      );
      return;
    }
    result.writeOk = true;
    result.statementCount = statements.length;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const postInventory = runD1Query(totalInventoryCountQuery(), 'post inventory count');
  if (postInventory === null) return;
  result.postInventoryCount = parseCount(postInventory);
  if (result.postInventoryCount !== result.preInventoryCount) {
    result.writeOk = false;
    result.writeFailureReason = `unrelated row-count delta: expected 0, observed ${result.postInventoryCount - result.preInventoryCount}`;
    fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);
    failClosed(result.writeFailureReason);
    return;
  }
  if (!attachEligibility('post')) return;
  if (result.libraryEligibleCount !== 6 || result.searchEligibleCount !== 6) {
    result.writeOk = false;
    result.writeFailureReason = `eligibility counts library=${result.libraryEligibleCount} search=${result.searchEligibleCount}, expected 6/6`;
    fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
    fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);
    failClosed(result.writeFailureReason);
    return;
  }

  fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);
  console.log(
    `OK: apply complete (prod). statements=${statements.length}, postInventoryCount=${result.postInventoryCount}, library=6 search=6.`,
  );
}

const isDirectRun = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectRun) {
  await main();
}
