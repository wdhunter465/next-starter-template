#!/usr/bin/env node
/**
 * Idempotent dry-run / local-only backfill tooling: events -> content_inventory.
 * Authority: docs/ops/reports/events-public-content-inventory-mapping-2859.md (#2859).
 *
 * Usage:
 *   node scripts/migrations/events-public-content-backfill.mjs --dry-run   (default; no writes)
 *   node scripts/migrations/events-public-content-backfill.mjs --apply     (writes to LOCAL D1 only)
 *
 * This tool NEVER targets --remote Production D1. Development (`lgfc-litedev`) proving writes
 * are executed only via scripts/ci/events_public_dev_write_2859.mjs under explicit gates.
 * There is no flag here to override that boundary.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DB_NAME = 'lgfc_lite';
export const MIGRATION_TAG_PREFIX = 'legacy-events-';
export const DEFAULT_SOURCE_NAME = 'LGFC Fan Club Calendar';
export const DEFAULT_CREDIT_LINE = 'LGFC Fan Club (event calendar)';
export const ALLOWED_SECTIONS_JSON = '["calendar"]';
export const ROTATION_GROUP = 'events';
export const STORY_TYPE = 'brief';

export function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function tagForLegacyId(id) {
  return `${MIGRATION_TAG_PREFIX}${id}`;
}

function isBlank(value) {
  return !value || String(value).trim() === '';
}

export function deriveSourceName(host) {
  const trimmed = typeof host === 'string' ? host.trim() : '';
  return trimmed || DEFAULT_SOURCE_NAME;
}

export function composeEventText(row) {
  const parts = [];
  const description = String(row.description || '').trim();
  if (description) parts.push(description);

  const start = String(row.start_date || '').trim();
  const end = String(row.end_date || '').trim();
  if (end && end !== start) {
    parts.push(`Through ${end}.`);
  }

  const location = String(row.location || '').trim();
  if (location) parts.push(`Location: ${location}.`);

  const fees = String(row.fees || '').trim();
  if (fees) parts.push(`Fees: ${fees}.`);

  return parts.join(' ').trim();
}

export function buildSummary({ title, startDate, location }) {
  const bits = [String(title || '').trim(), String(startDate || '').trim(), String(location || '').trim()].filter(
    Boolean,
  );
  const joined = bits.join(' — ');
  if (!joined) return null;
  return joined.length > 160 ? joined.slice(0, 160) : joined;
}

export function buildSearchText({ title, text, location, host, tag }) {
  return [title, text, location, host, tag]
    .filter((v) => typeof v === 'string' && v.trim())
    .join(' ')
    .toLowerCase();
}

export function eventYearFromStartDate(startDate) {
  const raw = String(startDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const year = Number(raw.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

/**
 * Classifies one events row against the #2859 mapping publication rules.
 */
export function classifyEventRow(row) {
  const titleBlank = isBlank(row.title);
  const descriptionBlank = isBlank(row.description);
  const startMissing = isBlank(row.start_date);

  const flags = {
    invalidEmpty: titleBlank || descriptionBlank || startMissing,
    posted: String(row.status || '').trim() === 'posted',
    hidden: String(row.status || '').trim() === 'hidden',
  };

  if (flags.invalidEmpty) {
    return { ...flags, disposition: 'excluded', exceptionCode: 'EV_INVALID_EMPTY', status: null };
  }

  const status = flags.posted ? 'published' : 'archived';
  return { ...flags, disposition: 'migrate', status, exceptionCode: null };
}

export function computeRowClassCounts(eventRows) {
  const counts = {
    EV_TOTAL: eventRows.length,
    EV_POSTED: 0,
    EV_HIDDEN: 0,
    EV_INVALID_EMPTY: 0,
  };
  for (const row of eventRows) {
    const c = classifyEventRow(row);
    if (c.invalidEmpty) counts.EV_INVALID_EMPTY += 1;
    if (c.posted) counts.EV_POSTED += 1;
    if (c.hidden) counts.EV_HIDDEN += 1;
  }
  return counts;
}

export function buildMigratedFields(row, classification) {
  const tag = tagForLegacyId(row.id);
  const title = String(row.title).trim();
  const text = composeEventText(row);
  const sourceName = deriveSourceName(row.host);
  const location = String(row.location || '').trim();
  const host = String(row.host || '').trim();
  const startDate = String(row.start_date).trim();
  const sourceUrl = isBlank(row.external_url) ? null : String(row.external_url).trim();

  return {
    tag,
    title,
    text,
    credit_line: DEFAULT_CREDIT_LINE,
    source_name: sourceName,
    source_url: sourceUrl,
    story_type: STORY_TYPE,
    allowed_sections: ALLOWED_SECTIONS_JSON,
    canonical: 1,
    priority: 0,
    feature_weight: 1,
    status: classification.status,
    search_text: buildSearchText({ title, text, location, host, tag }),
    summary: buildSummary({ title, startDate, location }),
    media: '[]',
    event_date: startDate,
    event_year: eventYearFromStartDate(startDate),
    rotation_group: ROTATION_GROUP,
    created_at: row.created_at || null,
    updated_at: row.updated_at || null,
  };
}

export function planRow(row, existingByTag) {
  const classification = classifyEventRow(row);
  if (classification.disposition === 'excluded') {
    return { legacyId: row.id, action: 'excluded', exceptionCode: classification.exceptionCode };
  }

  const fields = buildMigratedFields(row, classification);
  const existing = existingByTag.get(fields.tag);

  if (!existing) {
    return { legacyId: row.id, action: 'insert', fields };
  }

  // Collision guard: only rows this migration authored (credit_line + rotation_group markers)
  // may be updated. source_name may legitimately vary when events.host is non-empty.
  if (existing.credit_line !== DEFAULT_CREDIT_LINE || existing.rotation_group !== ROTATION_GROUP) {
    return { legacyId: row.id, action: 'conflict', exceptionCode: 'TAG_COLLISION_NON_MIGRATION_SOURCE' };
  }

  const changed =
    existing.title !== fields.title ||
    existing.text !== fields.text ||
    existing.credit_line !== fields.credit_line ||
    existing.source_name !== fields.source_name ||
    existing.source_url !== fields.source_url ||
    existing.status !== fields.status ||
    existing.summary !== fields.summary ||
    existing.search_text !== fields.search_text ||
    existing.event_date !== fields.event_date ||
    Number(existing.event_year ?? 0) !== Number(fields.event_year ?? 0) ||
    existing.rotation_group !== fields.rotation_group ||
    existing.allowed_sections !== fields.allowed_sections;

  if (!changed) {
    return { legacyId: row.id, action: 'noop' };
  }

  const willBecomePublished = fields.status === 'published' && existing.status !== 'published';
  return { legacyId: row.id, action: 'update', id: existing.id, fields, willBecomePublished };
}

export function buildInsertStatement(fields, setPublishedAtNow) {
  const columns = [
    'tag',
    'title',
    'text',
    'credit_line',
    'source_name',
    'source_url',
    'story_type',
    'allowed_sections',
    'canonical',
    'priority',
    'feature_weight',
    'status',
    'search_text',
    'summary',
    'media',
    'event_date',
    'event_year',
    'rotation_group',
  ];
  const values = [
    fields.tag,
    fields.title,
    fields.text,
    fields.credit_line,
    fields.source_name,
    fields.source_url,
    fields.story_type,
    fields.allowed_sections,
    fields.canonical,
    fields.priority,
    fields.feature_weight,
    fields.status,
    fields.search_text,
    fields.summary,
    fields.media,
    fields.event_date,
    fields.event_year,
    fields.rotation_group,
  ];
  if (fields.created_at) {
    columns.push('created_at');
    values.push(fields.created_at);
  }
  if (fields.updated_at) {
    columns.push('updated_at');
    values.push(fields.updated_at);
  }
  if (setPublishedAtNow) {
    columns.push('published_at');
    values.push(new Date().toISOString());
  }
  return `INSERT INTO content_inventory (${columns.join(', ')}) VALUES (${values.map(sqlLiteral).join(', ')});`;
}

export function buildUpdateStatement(id, fields, setPublishedAtNow) {
  const assignments = [
    `title = ${sqlLiteral(fields.title)}`,
    `text = ${sqlLiteral(fields.text)}`,
    `credit_line = ${sqlLiteral(fields.credit_line)}`,
    `source_name = ${sqlLiteral(fields.source_name)}`,
    `source_url = ${sqlLiteral(fields.source_url)}`,
    `status = ${sqlLiteral(fields.status)}`,
    `search_text = ${sqlLiteral(fields.search_text)}`,
    `summary = ${sqlLiteral(fields.summary)}`,
    `event_date = ${sqlLiteral(fields.event_date)}`,
    `event_year = ${sqlLiteral(fields.event_year)}`,
    `rotation_group = ${sqlLiteral(fields.rotation_group)}`,
    `allowed_sections = ${sqlLiteral(fields.allowed_sections)}`,
    `updated_at = ${sqlLiteral(new Date().toISOString())}`,
  ];
  if (setPublishedAtNow) {
    assignments.push(`published_at = ${sqlLiteral(new Date().toISOString())}`);
  }
  return `UPDATE content_inventory SET ${assignments.join(', ')} WHERE id = ${Number(id)};`;
}

export function buildPlanForBackfill(eventRows, existingRows) {
  const existingByTag = new Map(existingRows.map((r) => [r.tag, r]));
  const plans = eventRows.map((row) => planRow(row, existingByTag));
  const counts = computeRowClassCounts(eventRows);
  const existingLegacyTagged = existingRows.filter((r) => r.tag?.startsWith(MIGRATION_TAG_PREFIX));
  return {
    counts: {
      ...counts,
      CI_CALENDAR_TAG: existingLegacyTagged.length,
      CI_CALENDAR_PUBLISHED: existingLegacyTagged.filter((r) => r.status === 'published').length,
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

export const ROLLBACK_SQL =
  "DELETE FROM content_inventory WHERE canonical = 1 AND tag LIKE 'legacy-events-%';";

function runD1Json(sql) {
  const out = execFileSync(
    'npx',
    ['wrangler', 'd1', 'execute', DB_NAME, '--local', '--json', '--command', sql],
    { encoding: 'utf-8' },
  );
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
    console.error(
      'Refusing: this CLI only ever targets --local D1. Development proving writes use scripts/ci/events_public_dev_write_2859.mjs.',
    );
    process.exit(1);
  }
  const apply = args.includes('--apply');

  const eventRows = runD1Json(
    `SELECT id, title, start_date, end_date, location, host, fees, description, external_url, status, created_at, updated_at FROM events`,
  );
  const existingRows = runD1Json(
    `SELECT id, tag, title, text, credit_line, source_name, source_url, status, summary, search_text, event_date, event_year, rotation_group, allowed_sections FROM content_inventory WHERE canonical = 1 AND tag LIKE '${MIGRATION_TAG_PREFIX}%'`,
  );

  const plan = buildPlanForBackfill(eventRows, existingRows);

  console.log(
    JSON.stringify(
      {
        mode: apply ? 'apply (local only)' : 'dry-run',
        counts: plan.counts,
        summary: plan.summary,
        exceptions: plan.plans
          .filter((p) => p.action === 'excluded' || p.action === 'conflict')
          .map((p) => ({ legacyId: p.legacyId, code: p.exceptionCode })),
      },
      null,
      2,
    ),
  );

  if (!apply) return;

  const statements = buildStatementsForPlan(plan);
  if (statements.length === 0) {
    console.log('Nothing to apply (idempotent no-op).');
    return;
  }

  const dir = mkdtempSync(path.join(tmpdir(), 'events-backfill-'));
  const filePath = path.join(dir, 'backfill.sql');
  try {
    writeFileSync(filePath, `${statements.join('\n')}\n`);
    runD1File(filePath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
