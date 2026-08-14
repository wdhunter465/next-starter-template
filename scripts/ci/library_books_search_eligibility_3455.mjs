#!/usr/bin/env node
/**
 * #3455 — gated Development-only update that adds `search` to allowed_sections
 * for the six authorized Lou Gehrig library-book records. Library eligibility
 * is preserved. Production D1 writes are refused.
 *
 * TARGET is implicit: Development `lgfc-litedev` / wrangler env.preview only.
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
import { sqlLiteral } from '../migrations/events-public-content-backfill.mjs';
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
  BOOK_RECORDS,
  BOOK_TAGS,
  existingBooksQuery,
  libraryEligibleCountQuery,
  totalInventoryCountQuery,
} from './library_books_content_load_3451.mjs';

export const RESULT_JSON_PATH = 'library-books-search-eligibility-3455-result.json';
export const RESULT_MD_PATH = 'library-books-search-eligibility-3455-result.md';
export const SOURCE_ISSUE = 3455;
export const TARGET_SECTIONS_JSON = '["library","search"]';

const UPDATED_AT_EXPR = `(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

export function isApplyMode(env = process.env) {
  return env.MODE === 'apply' && env.CONFIRM_WRITE === 'confirm';
}

export function requireEnv(env = process.env) {
  return ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'D1_DEV_DATABASE_NAME', 'D1_DEV_DATABASE_ID'].filter(
    (name) => !env[name],
  );
}

export function refuseProductionTarget(env = process.env) {
  const target = String(env.TARGET || '').trim().toLowerCase();
  return target === 'prod' || target === 'production';
}

export function parseAllowedSections(raw) {
  if (raw == null || String(raw).trim() === '') {
    return { ok: false, code: 'MISSING_ALLOWED_SECTIONS' };
  }
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return { ok: false, code: 'INVALID_ALLOWED_SECTIONS_JSON' };
    }
  }
  if (!Array.isArray(parsed) || parsed.some((value) => typeof value !== 'string' || !value.trim())) {
    return { ok: false, code: 'INVALID_ALLOWED_SECTIONS_JSON' };
  }
  return { ok: true, sections: parsed };
}

export function mergeLibraryAndSearch(sections) {
  const lower = sections.map((value) => value.toLowerCase());
  if (lower.includes('club_home')) {
    return { ok: false, code: 'UNEXPECTED_CLUB_HOME' };
  }
  if (!lower.includes('library')) {
    return { ok: false, code: 'MISSING_LIBRARY_ELIGIBILITY' };
  }
  if (lower.includes('search')) {
    return { ok: true, next: JSON.stringify(sections), changed: false, previous: JSON.stringify(sections) };
  }
  return {
    ok: true,
    next: JSON.stringify([...sections, 'search']),
    changed: true,
    previous: JSON.stringify(sections),
  };
}

export function searchEligibleCountQuery() {
  return `SELECT COUNT(1) AS n FROM content_inventory WHERE status = 'published' AND lower(COALESCE(allowed_sections,'')) LIKE '%library%' AND lower(COALESCE(allowed_sections,'')) LIKE '%search%' AND COALESCE(TRIM(source_name), '') != '' AND COALESCE(TRIM(credit_line), '') != '' AND canonical = 1 AND tag IN (${BOOK_TAGS.map(sqlLiteral).join(', ')});`;
}

export function planSearchEligibility(existingRows) {
  const rows = existingRows || [];
  const tagCounts = new Map();
  const existingByTag = new Map();
  for (const row of rows) {
    tagCounts.set(row.tag, (tagCounts.get(row.tag) || 0) + 1);
    if (!existingByTag.has(row.tag)) existingByTag.set(row.tag, row);
  }
  const plans = BOOK_RECORDS.map((book) => {
    if ((tagCounts.get(book.tag) || 0) > 1) {
      return { action: 'conflict', tag: book.tag, exceptionCode: 'DUPLICATE_CANONICAL_TAG' };
    }
    const existing = existingByTag.get(book.tag);
    if (!existing) {
      return { action: 'conflict', tag: book.tag, exceptionCode: 'MISSING_RECORD' };
    }
    if (String(existing.title || '') !== book.title) {
      return {
        action: 'conflict',
        tag: book.tag,
        exceptionCode: 'TAG_COLLISION_NON_MATCHING_TITLE',
        existingId: existing.id,
      };
    }
    if (String(existing.status || '') !== 'published') {
      return { action: 'conflict', tag: book.tag, exceptionCode: 'UNEXPECTED_STATUS', existingId: existing.id };
    }
    if (Number(existing.canonical) !== 1) {
      return { action: 'conflict', tag: book.tag, exceptionCode: 'UNEXPECTED_CANONICAL', existingId: existing.id };
    }
    const parsed = parseAllowedSections(existing.allowed_sections);
    if (!parsed.ok) {
      return { action: 'conflict', tag: book.tag, exceptionCode: parsed.code, existingId: existing.id };
    }
    const merged = mergeLibraryAndSearch(parsed.sections);
    if (!merged.ok) {
      return { action: 'conflict', tag: book.tag, exceptionCode: merged.code, existingId: existing.id };
    }
    if (!merged.changed) {
      return {
        action: 'noop',
        tag: book.tag,
        id: existing.id,
        previous: merged.previous,
        next: merged.next,
      };
    }
    return {
      action: 'update',
      tag: book.tag,
      id: existing.id,
      title: book.title,
      previous: merged.previous,
      next: merged.next,
    };
  });

  const summary = { insert: 0, update: 0, noop: 0, conflict: 0 };
  for (const plan of plans) summary[plan.action] += 1;
  return { plans, summary };
}

export function buildUpdateAllowedSectionsStatement(item, columnNames) {
  const assignments = [`allowed_sections = ${sqlLiteral(item.next)}`];
  if (columnNames.has('updated_at')) assignments.push(`updated_at = ${UPDATED_AT_EXPR}`);
  return `UPDATE content_inventory SET ${assignments.join(', ')} WHERE id = ${Number(item.id)} AND tag = ${sqlLiteral(item.tag)} AND title = ${sqlLiteral(item.title)} AND canonical = 1 AND status = 'published' AND allowed_sections = ${sqlLiteral(item.previous)};`;
}

export function buildStatementsForPlan(plan, columnNames) {
  return plan.plans
    .filter((item) => item.action === 'update')
    .map((item) => buildUpdateAllowedSectionsStatement(item, columnNames));
}

export function buildRollbackSql(plan) {
  const statements = plan.plans
    .filter((item) => item.action === 'update' || item.action === 'noop')
    .map((item) => {
      const previous = item.previous || TARGET_SECTIONS_JSON;
      return `UPDATE content_inventory SET allowed_sections = ${sqlLiteral(previous)} WHERE id = ${Number(item.id)} AND tag = ${sqlLiteral(item.tag)} AND canonical = 1;`;
    });
  return statements.join('\n');
}

export function buildResultMarkdown(result) {
  const lines = [
    '<!-- library-books-search-eligibility-3455 -->',
    `## #3455 Dev search eligibility — ${result.mode} (${result.target})`,
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
    '- Production D1: refused (this child is Dev-only)',
  ];
  if (result.exceptions?.length) {
    lines.push('', 'Conflicts:');
    for (const item of result.exceptions) {
      lines.push(`- ${item.tag}: ${item.code}`);
    }
  }
  if (result.rollbackSql) {
    lines.push('', 'Rollback (restore prior allowed_sections on the six authorized tags):', '', '```sql', result.rollbackSql, '```');
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
  if (refuseProductionTarget(process.env)) {
    failClosed('TARGET=prod is refused — #3455 is Development/Preview only. Production promotion is #3456.');
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

  const dbName = process.env.D1_DEV_DATABASE_NAME;
  const dbId = process.env.D1_DEV_DATABASE_ID;
  if (dbName !== preview.databaseName) {
    failClosed(`wrong database identity — secret name does not match wrangler.toml preview database ("${preview.databaseName}").`);
    return;
  }
  if (dbId !== preview.databaseId) {
    failClosed('wrong database identity — secret id does not match wrangler.toml preview database_id.');
    return;
  }
  if (dbId === production.databaseId) {
    failClosed('D1_DEV_DATABASE_ID matches Production — refusing to proceed.');
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
  if (remoteUuid !== preview.databaseId) {
    failClosed('live database uuid does not match expected Development/Preview database_id — refusing.');
    return;
  }
  if (remoteUuid === production.databaseId) {
    failClosed('live database uuid matches Production — refusing.');
    return;
  }

  const executeArgs = ['d1', 'execute', dbName, '--remote', '--env', 'preview'];

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
    target: 'dev',
    mode: applyMode ? 'apply' : 'dry-run',
    databaseName: preview.databaseName,
    databaseId: preview.databaseId,
    summary: plan.summary,
    exceptions: plan.plans
      .filter((item) => item.action === 'conflict')
      .map((item) => ({ tag: item.tag, code: item.exceptionCode })),
    preInventoryCount: parseCount(preInventory),
    rollbackSql: buildRollbackSql(plan),
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
      `OK: dry-run complete (dev). update=${plan.summary.update} noop=${plan.summary.noop} conflict=0.`,
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
    console.log('OK: apply mode, nothing to write (idempotent no-op) on dev.');
    return;
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'library-books-3455-'));
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
    `OK: apply complete (dev). statements=${statements.length}, postInventoryCount=${result.postInventoryCount}, library=6 search=6.`,
  );
}

const isDirectRun = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isDirectRun) {
  await main();
}
