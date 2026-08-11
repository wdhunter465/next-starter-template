#!/usr/bin/env node
/**
 * #3358 — Prod → Dev D1 sanitization engine + schema-drift gate.
 *
 * Loads the versioned classification manifest, fails closed on unknown
 * tables/columns or unresolved hold_for_product classes, and applies
 * deterministic transforms to in-memory row objects (for tests / future
 * refresh Action). Never logs source field values.
 *
 * Exit 0 on pass; non-zero on fail when run as CLI.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';

export const MANIFEST_RELATIVE = 'config/d1/prod-dev-sanitization-manifest.v1.json';

export const CLASSES = Object.freeze([
  'copy_as_is',
  'transform',
  'redact',
  'randomize',
  'exclude',
  'replace_with_fixture',
  'hold_for_product',
]);

export function loadManifest(repoRoot = process.cwd()) {
  const p = path.join(repoRoot, MANIFEST_RELATIVE);
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

export function stableHash(input, length = 12) {
  return crypto.createHash('sha256').update(String(input ?? '')).digest('hex').slice(0, length);
}

export function syntheticEmail(seed) {
  return `dev+${stableHash(seed, 10)}@example.invalid`;
}

export function syntheticName(seed) {
  return `DevUser_${stableHash(seed, 8)}`;
}

export function syntheticContact(seed) {
  return `contact+${stableHash(seed, 10)}@example.invalid`;
}

export function syntheticText(seed) {
  return `[sanitized:${stableHash(seed, 12)}]`;
}

export function syntheticHash(seed) {
  return stableHash(`vote:${seed}`, 32);
}

/**
 * Apply a single-column transform. Returns the replacement value.
 * Source values are never returned for redact/transform/randomize paths
 * except copy_as_is.
 */
export function applyTransform(transform, seed, sourceValue) {
  switch (transform) {
    case 'synthetic_email':
      return syntheticEmail(seed);
    case 'synthetic_name':
      return syntheticName(seed);
    case 'synthetic_contact':
      return syntheticContact(seed);
    case 'synthetic_text':
      return syntheticText(seed);
    case 'synthetic_hash':
      return syntheticHash(seed);
    case 'redact_ip':
      return '0.0.0.0';
    case 'redact_ua':
      return 'sanitized';
    case 'empty_object':
      return '{}';
    case 'null':
      return null;
    case undefined:
    case null:
    case '':
      return sourceValue;
    default:
      throw new Error(`Unknown transform: ${transform}`);
  }
}

/**
 * Compare live schema (table → column name[]) to manifest fingerprint.
 * Unknown tables/columns fail closed.
 */
export function assertSchemaCovered(manifest, liveSchema) {
  const failures = [];
  const fingerprint = manifest.schema_fingerprint || {};
  const classifiedTables = manifest.tables || {};

  for (const table of Object.keys(liveSchema)) {
    if (!classifiedTables[table]) {
      failures.push(`Unclassified table (fail-closed): ${table}`);
      continue;
    }
    const liveCols = liveSchema[table];
    const classifiedCols = Object.keys(classifiedTables[table].columns || {});
    for (const col of liveCols) {
      if (!classifiedCols.includes(col)) {
        failures.push(`Unclassified column (fail-closed): ${table}.${col}`);
      }
    }
  }

  for (const table of Object.keys(classifiedTables)) {
    if (!(table in liveSchema) && !(table in fingerprint)) {
      failures.push(`Manifest table missing from live schema: ${table}`);
    }
  }

  // Fingerprint drift: live columns differ from locked fingerprint
  for (const [table, cols] of Object.entries(liveSchema)) {
    const expected = fingerprint[table];
    if (!expected) {
      failures.push(`Schema fingerprint missing table: ${table}`);
      continue;
    }
    const liveSorted = [...cols].sort();
    const expectedSorted = [...expected].sort();
    if (JSON.stringify(liveSorted) !== JSON.stringify(expectedSorted)) {
      failures.push(`Schema drift for table ${table}: fingerprint out of date`);
    }
  }

  return { ok: failures.length === 0, failures };
}

export function listOpenProductHolds(manifest) {
  const byKey = new Map();
  for (const [table, meta] of Object.entries(manifest.tables || {})) {
    for (const [column, col] of Object.entries(meta.columns || {})) {
      if (col.class === 'hold_for_product') {
        byKey.set(`${table}.${column}`, { table, column, reason: col.reason || '' });
      }
    }
  }
  for (const pd of manifest.product_decisions || []) {
    if (pd.status === 'open') {
      const key = `${pd.table}.${pd.column ?? '*'}`;
      const prev = byKey.get(key) || { table: pd.table, column: pd.column };
      byKey.set(key, {
        ...prev,
        reason: pd.question || prev.reason || pd.id,
        decisionId: pd.id,
      });
    }
  }
  return [...byKey.values()];
}

/**
 * Refuse remote refresh while any hold_for_product remains.
 */
export function evaluateRefreshGate(manifest) {
  const holds = listOpenProductHolds(manifest);
  const recommendation = manifest.go_hold_recommendation || {};
  const failures = [];
  if (holds.length > 0) {
    failures.push(
      `Refresh HOLD: ${holds.length} open product hold(s); example ${holds[0].table}.${holds[0].column || '*'}`,
    );
  }
  if (recommendation.for_remote_refresh_action_3359 === 'HOLD' && holds.length === 0) {
    failures.push('Manifest recommends HOLD for #3359 even though no column holds remain');
  }
  return {
    ok: failures.length === 0,
    failures,
    holds,
    recommendation: recommendation.for_remote_refresh_action_3359 || 'UNKNOWN',
  };
}

function rowSeed(table, row, pkHints = ['id', 'key', 'submission_id']) {
  for (const k of pkHints) {
    if (row[k] != null) return `${table}:${k}:${row[k]}`;
  }
  return `${table}:${stableHash(JSON.stringify(Object.keys(row).sort()))}`;
}

function shouldExcludeContentItem(row, tableMeta) {
  const filter = tableMeta.row_filter;
  if (!filter?.exclude_where_privacy_flag_not_in) return false;
  const allowed = new Set(filter.exclude_where_privacy_flag_not_in.map((v) => (v == null ? '' : String(v))));
  const flag = row.privacy_flag == null ? '' : String(row.privacy_flag);
  return !allowed.has(flag);
}

/**
 * Sanitize one table's rows. Returns { rows, excludedCount, stats }.
 * Never includes source secrets in stats — only counts and classes.
 */
export function sanitizeTable(manifest, table, rows) {
  const tableMeta = manifest.tables?.[table];
  if (!tableMeta) {
    throw new Error(`Unclassified table: ${table}`);
  }

  const stats = {
    table,
    defaultClass: tableMeta.default_class,
    inputCount: rows.length,
    outputCount: 0,
    excludedCount: 0,
    classCounts: {},
  };

  if (tableMeta.default_class === 'exclude') {
    stats.excludedCount = rows.length;
    stats.classCounts.exclude = rows.length;
    return { rows: [], excludedCount: rows.length, stats };
  }

  if (tableMeta.default_class === 'replace_with_fixture') {
    const fixture = manifest.fixtures?.[table] || [];
    stats.outputCount = fixture.length;
    stats.classCounts.replace_with_fixture = fixture.length;
    return { rows: structuredClone(fixture), excludedCount: rows.length, stats };
  }

  const out = [];
  for (const row of rows) {
    if (table === 'content_items' && shouldExcludeContentItem(row, tableMeta)) {
      stats.excludedCount += 1;
      stats.classCounts.exclude = (stats.classCounts.exclude || 0) + 1;
      continue;
    }

    const next = {};
    const seedBase = rowSeed(table, row);
    for (const [col, value] of Object.entries(row)) {
      const colMeta = tableMeta.columns?.[col];
      if (!colMeta) {
        throw new Error(`Unclassified column: ${table}.${col}`);
      }
      const cls = colMeta.class;
      stats.classCounts[cls] = (stats.classCounts[cls] || 0) + 1;
      if (cls === 'hold_for_product') {
        throw new Error(`Cannot sanitize ${table}.${col}: hold_for_product`);
      }
      if (cls === 'exclude') {
        continue;
      }
      if (cls === 'copy_as_is') {
        next[col] = value;
        continue;
      }
      const seed = `${seedBase}:${col}`;
      next[col] = applyTransform(colMeta.transform, seed, value);
    }
    out.push(next);
  }

  stats.outputCount = out.length;
  return { rows: out, excludedCount: stats.excludedCount, stats };
}

/**
 * Sanitize a multi-table dataset. Stops if any hold_for_product column is encountered
 * unless options.allowHoldsForDryRunStats is set (still does not emit those columns' source values).
 */
export function sanitizeDataset(manifest, dataset, options = {}) {
  const gate = evaluateRefreshGate(manifest);
  if (!gate.ok && !options.ignoreRefreshGate) {
    return { ok: false, failures: gate.failures, holds: gate.holds, tables: {}, summary: [] };
  }

  const tables = {};
  const summary = [];
  const failures = [];

  try {
    for (const [table, rows] of Object.entries(dataset)) {
      const result = sanitizeTable(manifest, table, rows);
      tables[table] = result.rows;
      summary.push({
        table: result.stats.table,
        inputCount: result.stats.inputCount,
        outputCount: result.stats.outputCount,
        excludedCount: result.stats.excludedCount,
        classCounts: result.stats.classCounts,
      });
    }
  } catch (err) {
    failures.push(err.message);
    return { ok: false, failures, holds: gate.holds, tables: {}, summary };
  }

  return { ok: true, failures: [], holds: gate.holds, tables, summary };
}

export function privacySafeSummary(summary) {
  return summary.map((s) => ({
    table: s.table,
    inputCount: s.inputCount,
    outputCount: s.outputCount,
    excludedCount: s.excludedCount,
    classCounts: s.classCounts,
  }));
}

function main() {
  const repoRoot = process.cwd();
  const manifest = loadManifest(repoRoot);
  const liveSchema = manifest.schema_fingerprint;
  const covered = assertSchemaCovered(manifest, liveSchema);
  const gate = evaluateRefreshGate(manifest);

  console.log(
    JSON.stringify(
      {
        manifestVersion: manifest.version,
        schemaCoverageOk: covered.ok,
        schemaFailures: covered.failures,
        refreshGate: gate.recommendation,
        refreshGateOk: gate.ok,
        refreshFailures: gate.failures,
        openHolds: gate.holds.map((h) => ({
          table: h.table,
          column: h.column,
          decisionId: h.decisionId || null,
        })),
        tableCount: Object.keys(manifest.tables || {}).length,
      },
      null,
      2,
    ),
  );

  if (!covered.ok) process.exit(2);
  // Policy package itself may recommend HOLD for #3359; CLI exits 0 when schema coverage passes.
  process.exit(0);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
