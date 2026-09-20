#!/usr/bin/env node
// Generates and (optionally) applies INSERT OR REPLACE statements for the
// Club Home pilot content pack (seed/content/club-home-pilot-pack.json),
// so #4180's picture-routing has real published stories with associated,
// ready renditions to render in every placement zone.
//
// Usage:
//   node scripts/seed-club-home-pilot.mjs --print > /tmp/club-home-pilot.sql
//   node scripts/seed-club-home-pilot.mjs --apply --local   # wrangler d1 execute --local
//   node scripts/seed-club-home-pilot.mjs --apply --remote  # wrangler d1 execute --remote (production)
//   node scripts/seed-club-home-pilot.mjs --cleanup --local
//
// The rendition rows point at the pack's own Wikimedia Commons source URL
// rather than a real resized JPEG in B2 -- there is no B2 write access in
// this environment. For a real deploy, regenerate renditions for media_id
// 9401 via /admin/editorial's "Renditions" control once B2 credentials are
// configured, which will overwrite these rows with real generated files.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packPath = path.join(__dirname, '..', 'seed', 'content', 'club-home-pilot-pack.json');
const pack = JSON.parse(readFileSync(packPath, 'utf8'));

function sqlString(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlInteger(value) {
  if (value === null || value === undefined) return 'NULL';
  const n = Number(value);
  return Number.isFinite(n) ? String(Math.trunc(n)) : 'NULL';
}

function nowIso() {
  return new Date().toISOString().replace(/\.\d+Z$/, (m) => m).replace('Z', '000Z').slice(0, 24);
}

function photoInsert(record) {
  const columns = [
    'id', 'photo_id', 'url', 'title', 'description', 'year', 'source',
    'is_memorabilia', 'rights_hold', 'publication_eligible', 'rights_status',
  ];
  const values = columns.map((c) => {
    if (['id', 'year', 'is_memorabilia', 'rights_hold', 'publication_eligible'].includes(c)) {
      return sqlInteger(record[c]);
    }
    return sqlString(record[c] ?? null);
  });
  return `INSERT OR REPLACE INTO photos (${columns.join(', ')}) VALUES (${values.join(', ')});`;
}

function inventoryInsert(record) {
  const now = nowIso();
  const columns = [
    'id', 'tag', 'title', 'text', 'summary', 'story_type', 'canonical',
    'perspective_label', 'allowed_sections', 'priority', 'search_text',
    'source_name', 'source_url', 'credit_line', 'event_date', 'event_year',
    'rotation_group', 'feature_weight', 'status', 'media',
    'created_at', 'updated_at', 'published_at',
  ];
  const row = { ...record, media: '[]', created_at: now, updated_at: now, published_at: now };
  const values = columns.map((c) => {
    if (['id', 'canonical', 'priority', 'feature_weight', 'event_year'].includes(c)) {
      return sqlInteger(row[c]);
    }
    return sqlString(row[c] ?? null);
  });
  return `INSERT OR REPLACE INTO content_inventory (${columns.join(', ')}) VALUES (${values.join(', ')});`;
}

function mediaAssociationInsert(record) {
  const now = nowIso();
  const columns = [
    'id', 'story_id', 'media_id', 'media_role', 'display_order', 'caption',
    'alt_text', 'source_name', 'source_url', 'credit_line', 'created_at', 'updated_at',
  ];
  const row = { ...record, created_at: now, updated_at: now };
  const values = columns.map((c) => {
    if (['id', 'story_id', 'media_id', 'display_order'].includes(c)) return sqlInteger(row[c]);
    return sqlString(row[c] ?? null);
  });
  return `INSERT OR REPLACE INTO content_inventory_media (${columns.join(', ')}) VALUES (${values.join(', ')});`;
}

function renditionInsert(record) {
  const now = nowIso();
  const columns = [
    'media_id', 'size', 'b2_key', 'url', 'width_px', 'height_px', 'bytes',
    'content_type', 'status', 'error', 'generated_at', 'generated_by',
  ];
  const row = { ...record, bytes: null, error: null, generated_at: now };
  const values = columns.map((c) => {
    if (['media_id', 'width_px', 'height_px', 'bytes'].includes(c)) return sqlInteger(row[c]);
    return sqlString(row[c] ?? null);
  });
  return `INSERT INTO content_inventory_media_renditions (${columns.join(', ')}) VALUES (${values.join(', ')})
  ON CONFLICT(media_id, size) DO UPDATE SET
    b2_key = excluded.b2_key, url = excluded.url, width_px = excluded.width_px,
    height_px = excluded.height_px, content_type = excluded.content_type,
    status = excluded.status, generated_at = excluded.generated_at, generated_by = excluded.generated_by;`;
}

function buildSeedSql() {
  const statements = [
    ...pack.photos.map(photoInsert),
    ...pack.inventory.map((item) => inventoryInsert(item.record)),
    ...pack.media_associations.map(mediaAssociationInsert),
    ...pack.renditions.map(renditionInsert),
  ];
  return statements.join('\n');
}

function buildCleanupSql() {
  const inventoryIds = pack.inventory.map((item) => item.record.id).join(', ');
  const photoIds = pack.photos.map((p) => p.id).join(', ');
  const associationIds = pack.media_associations.map((a) => a.id).join(', ');
  return [
    `DELETE FROM content_inventory_media_renditions WHERE media_id IN (${photoIds});`,
    `DELETE FROM content_inventory_media WHERE id IN (${associationIds});`,
    `DELETE FROM content_inventory WHERE id IN (${inventoryIds});`,
    `DELETE FROM photos WHERE id IN (${photoIds});`,
  ].join('\n');
}

const args = process.argv.slice(2);
const mode = args.includes('--cleanup') ? 'cleanup' : args.includes('--apply') ? 'apply' : 'print';
const isRemote = args.includes('--remote');

const sql = mode === 'cleanup' ? buildCleanupSql() : buildSeedSql();

if (mode === 'print') {
  process.stdout.write(sql + '\n');
  process.exit(0);
}

// Production is the top-level `lgfc_lite` D1 database (wrangler.toml).
// Local/preview dev uses the `DB` binding under env.preview (`lgfc-litedev`).
const d1Args = isRemote
  ? ['wrangler', 'd1', 'execute', 'lgfc_lite', '--remote']
  : ['wrangler', 'd1', 'execute', 'DB', '--local', '--env', 'preview'];

const tmpFile = path.join(__dirname, '..', `.club-home-pilot-${mode}.sql`);
import('node:fs').then(({ writeFileSync, unlinkSync }) => {
  writeFileSync(tmpFile, sql, 'utf8');
  const result = spawnSync(
    'npx',
    [...d1Args, '--file', tmpFile],
    { stdio: 'inherit', cwd: path.join(__dirname, '..') },
  );
  try { unlinkSync(tmpFile); } catch {}
  process.exit(result.status ?? 1);
});
