#!/usr/bin/env node
// Idempotent dry-run / local-only backfill tooling: library_entries -> content_inventory.
// Authority: docs/ops/reports/library-content-migration-map-2910.md (#2910), executed for #2911.
//
// Usage:
//   node scripts/migrations/library-content-backfill.mjs --dry-run   (default; no writes)
//   node scripts/migrations/library-content-backfill.mjs --apply     (writes to LOCAL D1 only)
//
// This tool NEVER targets --remote or --preview D1. Production writes are explicitly out of
// scope for #2911 (left to #2913). There is no flag to override this.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const DB_NAME = 'lgfc_lite';
export const MIGRATION_TAG_PREFIX = 'legacy-library-';
export const DEFAULT_SOURCE_NAME = 'LGFC Fan Club Library (legacy submission)';
export const DEFAULT_CREDIT_LINE = 'Member library submission (legacy)';

// ---------------------------------------------------------------------------
// Pure logic (tested directly by tests/library-content-backfill.test.ts)
// ---------------------------------------------------------------------------

export function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function tagForLegacyId(id) {
  return `${MIGRATION_TAG_PREFIX}${id}`;
}

export function hasApprovalColumn(tableInfoRows) {
  return tableInfoRows.some((col) => col.name === 'is_approved');
}

function isBlank(value) {
  return !value || String(value).trim() === '';
}

export function deriveCreditLine(name) {
  const trimmed = typeof name === 'string' ? name.trim() : '';
  return trimmed || DEFAULT_CREDIT_LINE;
}

export function buildSearchText({ title, text, creditLine, sourceName, tag }) {
  return [title, text, creditLine, sourceName, tag]
    .filter((v) => typeof v === 'string' && v.trim())
    .join(' ')
    .toLowerCase();
}

export function buildSummary(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  return trimmed.length > 160 ? trimmed.slice(0, 160) : trimmed;
}

/**
 * Classifies one legacy row against the #2910 map's row-class model.
 * Returns flags (for privacy-safe aggregate counting) plus a disposition.
 */
export function classifyLegacyRow(row, approvalColumnPresent) {
  const titleBlank = isBlank(row.title);
  const contentBlank = isBlank(row.content);
  const nameBlank = isBlank(row.name);
  const hasEmail = !isBlank(row.email);

  const isApproved = approvalColumnPresent ? Number(row.is_approved) === 1 : false;

  const flags = {
    invalidEmpty: titleBlank || contentBlank,
    approved: isApproved,
    missingName: nameBlank,
    hasEmail,
  };

  if (flags.invalidEmpty) {
    return { ...flags, disposition: 'excluded', exceptionCode: 'LE_INVALID_EMPTY' };
  }

  // Per the #2910 map's default-credit rule, an approved row always has a usable
  // credit_line (the submitter's name, or the standing anonymous default) — so the
  // "approved but missing usable credit" cell in the map's table is not reachable
  // under the currently-approved default policy. Flagged in the evidence report.
  const status = flags.approved ? 'published' : 'draft';

  return { ...flags, disposition: 'migrate', status, exceptionCode: null };
}

export function computeRowClassCounts(legacyRows, approvalColumnPresent) {
  const counts = {
    LE_TOTAL: legacyRows.length,
    LE_APPROVED: 0,
    LE_UNAPPROVED: 0,
    LE_INVALID_EMPTY: 0,
    LE_MISSING_NAME: 0,
    LE_HAS_EMAIL: 0,
  };
  for (const row of legacyRows) {
    const c = classifyLegacyRow(row, approvalColumnPresent);
    if (c.invalidEmpty) counts.LE_INVALID_EMPTY += 1;
    if (c.approved) counts.LE_APPROVED += 1;
    else counts.LE_UNAPPROVED += 1;
    if (c.missingName) counts.LE_MISSING_NAME += 1;
    if (c.hasEmail) counts.LE_HAS_EMAIL += 1;
  }
  return counts;
}

/**
 * Builds the migrated field set for one eligible legacy row. Never includes email.
 */
export function buildMigratedFields(row, classification) {
  const tag = tagForLegacyId(row.id);
  const creditLine = deriveCreditLine(row.name);
  const sourceName = DEFAULT_SOURCE_NAME;
  const title = String(row.title).trim();
  const text = String(row.content).trim();
  return {
    tag,
    title,
    text,
    credit_line: creditLine,
    source_name: sourceName,
    source_url: null,
    story_type: 'brief',
    allowed_sections: '["library"]',
    canonical: 1,
    priority: 0,
    feature_weight: 1,
    status: classification.status,
    search_text: buildSearchText({ title, text, creditLine, sourceName, tag }),
    summary: buildSummary(text),
    media: '[]',
    created_at: row.created_at || null,
  };
}

/**
 * Decides insert / update / noop / conflict for one row against any existing
 * canonical inventory row sharing the same migration tag.
 */
export function planRow(row, approvalColumnPresent, existingByTag) {
  const classification = classifyLegacyRow(row, approvalColumnPresent);
  if (classification.disposition === 'excluded') {
    return { legacyId: row.id, action: 'excluded', exceptionCode: classification.exceptionCode };
  }

  const fields = buildMigratedFields(row, classification);
  const existing = existingByTag.get(fields.tag);

  if (!existing) {
    return { legacyId: row.id, action: 'insert', fields };
  }

  // Collision guard: without a dedicated migration-source column (deferred per the
  // #2910 map), the best available signal that an existing canonical row under this
  // exact tag was NOT created by this migration is a source_name that doesn't match
  // this tool's own default. Fail closed rather than overwrite an editor-owned row.
  if (existing.source_name !== DEFAULT_SOURCE_NAME) {
    return { legacyId: row.id, action: 'conflict', exceptionCode: 'TAG_COLLISION_NON_MIGRATION_SOURCE' };
  }

  const changed =
    existing.title !== fields.title ||
    existing.text !== fields.text ||
    existing.credit_line !== fields.credit_line ||
    existing.status !== fields.status ||
    existing.summary !== fields.summary ||
    existing.search_text !== fields.search_text;

  if (!changed) {
    return { legacyId: row.id, action: 'noop' };
  }

  // Never overwrite published_at on an already-published row; only set it the
  // moment a row transitions into 'published' for the first time.
  const willBecomePublished = fields.status === 'published' && existing.status !== 'published';

  return { legacyId: row.id, action: 'update', id: existing.id, fields, willBecomePublished };
}

export function buildInsertStatement(fields, setPublishedAtNow) {
  const columns = [
    'tag', 'title', 'text', 'credit_line', 'source_name', 'source_url', 'story_type',
    'allowed_sections', 'canonical', 'priority', 'feature_weight', 'status', 'search_text',
    'summary', 'media',
  ];
  const values = [
    fields.tag, fields.title, fields.text, fields.credit_line, fields.source_name,
    fields.source_url, fields.story_type, fields.allowed_sections, fields.canonical,
    fields.priority, fields.feature_weight, fields.status, fields.search_text,
    fields.summary, fields.media,
  ];
  if (fields.created_at) {
    columns.push('created_at');
    values.push(fields.created_at);
  }
  if (setPublishedAtNow) {
    columns.push('published_at');
    values.push(new Date().toISOString());
  }
  const columnSql = columns.join(', ');
  const valueSql = values.map(sqlLiteral).join(', ');
  return `INSERT INTO content_inventory (${columnSql}) VALUES (${valueSql});`;
}

export function buildUpdateStatement(id, fields, setPublishedAtNow) {
  const assignments = [
    `title = ${sqlLiteral(fields.title)}`,
    `text = ${sqlLiteral(fields.text)}`,
    `credit_line = ${sqlLiteral(fields.credit_line)}`,
    `source_name = ${sqlLiteral(fields.source_name)}`,
    `status = ${sqlLiteral(fields.status)}`,
    `search_text = ${sqlLiteral(fields.search_text)}`,
    `summary = ${sqlLiteral(fields.summary)}`,
    `updated_at = ${sqlLiteral(new Date().toISOString())}`,
  ];
  if (setPublishedAtNow) {
    assignments.push(`published_at = ${sqlLiteral(new Date().toISOString())}`);
  }
  return `UPDATE content_inventory SET ${assignments.join(', ')} WHERE id = ${Number(id)};`;
}

export function buildPlanForBackfill(legacyRows, approvalColumnPresent, existingRows) {
  const existingByTag = new Map(existingRows.map((r) => [r.tag, r]));
  const plans = legacyRows.map((row) => planRow(row, approvalColumnPresent, existingByTag));
  const counts = computeRowClassCounts(legacyRows, approvalColumnPresent);
  const existingLegacyTagged = existingRows.filter((r) => r.tag?.startsWith(MIGRATION_TAG_PREFIX));
  return {
    counts: {
      ...counts,
      CI_LEGACY_TAG: existingLegacyTagged.length,
      CI_LEGACY_PUBLISHED: existingLegacyTagged.filter((r) => r.status === 'published').length,
    },
    plans,
    summary: {
      insert: plans.filter((p) => p.action === 'insert').length,
      update: plans.filter((p) => p.action === 'update').length,
      noop: plans.filter((p) => p.action === 'noop').length,
      excluded: plans.filter((p) => p.action === 'excluded').length,
      conflict: plans.filter((p) => p.action === 'conflict').length,
    },
  };
}

// ---------------------------------------------------------------------------
// CLI / D1 I/O (not exercised by unit tests; requires wrangler + local D1)
// ---------------------------------------------------------------------------

function runD1Json(sql) {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB_NAME, '--local', '--json', '--command', sql],
    { encoding: 'utf-8' },
  );
  // wrangler's --json output is always a top-level JSON array, but some environments
  // (e.g. an HTTP(S) proxy configured via env vars) make wrangler print a warning line
  // to stdout before it. Slice from the first '[' so that noise doesn't break parsing.
  const jsonStart = out.indexOf('[');
  if (jsonStart === -1) {
    throw new Error(`wrangler d1 execute produced no JSON output for: ${sql}\n${out}`);
  }
  const parsed = JSON.parse(out.slice(jsonStart));
  return parsed[0]?.results ?? [];
}

function runD1File(filePath) {
  execFileSync('npx', ['wrangler', 'd1', 'execute', DB_NAME, '--local', '--file', filePath], {
    encoding: 'utf-8',
    stdio: 'inherit',
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--remote') || args.includes('--preview')) {
    console.error('Refusing: this tool only ever targets --local D1. Production writes are #2913 scope.');
    process.exit(1);
  }
  const apply = args.includes('--apply');

  const tableInfo = runD1Json('PRAGMA table_info(library_entries)');
  const approvalColumnPresent = hasApprovalColumn(tableInfo);

  const legacyRows = runD1Json('SELECT id, name, email, title, content, created_at FROM library_entries');
  const existingRows = runD1Json(
    `SELECT id, tag, title, text, credit_line, source_name, status, summary, search_text FROM content_inventory WHERE canonical = 1 AND tag LIKE '${MIGRATION_TAG_PREFIX}%'`,
  );

  const plan = buildPlanForBackfill(legacyRows, approvalColumnPresent, existingRows);

  console.log(JSON.stringify({
    mode: apply ? 'apply (local only)' : 'dry-run',
    approvalColumnPresent,
    counts: plan.counts,
    summary: plan.summary,
    exceptions: plan.plans
      .filter((p) => p.action === 'excluded' || p.action === 'conflict')
      .map((p) => ({ legacyId: p.legacyId, code: p.exceptionCode })),
  }, null, 2));

  if (!apply) return;

  const statements = [];
  for (const p of plan.plans) {
    if (p.action === 'insert') {
      statements.push(buildInsertStatement(p.fields, p.fields.status === 'published'));
    } else if (p.action === 'update') {
      statements.push(buildUpdateStatement(p.id, p.fields, p.willBecomePublished));
    }
  }

  if (statements.length === 0) {
    console.log('Nothing to apply (idempotent no-op).');
    return;
  }

  const dir = mkdtempSync(path.join(tmpdir(), 'library-backfill-'));
  const filePath = path.join(dir, 'backfill.sql');
  writeFileSync(filePath, statements.join('\n'));
  try {
    runD1File(filePath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
