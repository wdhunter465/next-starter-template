#!/usr/bin/env node
// Activates a Club Home edition pointing at the club-home-pilot-pack.json
// stories, directly via SQL -- equivalent to clicking "Regenerate edition"
// in /admin/editorial, but runnable headlessly (no admin browser session)
// wherever a Cloudflare D1 write credential is available.
//
// Usage:
//   node scripts/activate-club-home-pilot-edition.mjs --print
//   node scripts/activate-club-home-pilot-edition.mjs --apply --local
//   node scripts/activate-club-home-pilot-edition.mjs --apply --remote

import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packPath = path.join(__dirname, '..', 'seed', 'content', 'club-home-pilot-pack.json');
const pack = JSON.parse(readFileSync(packPath, 'utf8'));

const EDITION_ID = 9601; // Fixed id for this pilot pack's edition (see #4183).

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function nowIso() {
  return new Date().toISOString().replace('Z', '000Z').slice(0, 24);
}

function zoneOf(record) {
  return record.zone;
}

function buildSql() {
  const now = nowIso();
  const lead = pack.inventory.find((i) => zoneOf(i) === 'lead-story');
  const rail = pack.inventory.filter((i) => zoneOf(i) === 'story-rail');
  const spotlight = pack.inventory.find((i) => zoneOf(i) === 'archive-spotlight');

  const statements = [
    `INSERT OR REPLACE INTO content_inventory_club_home_editions (id, status, created_at, created_by, completed_at, failure_reason) VALUES (${EDITION_ID}, 'ready', ${sqlString(now)}, 'club-home-pilot-seed', ${sqlString(now)}, NULL);`,
    `DELETE FROM content_inventory_club_home_edition_placements WHERE edition_id = ${EDITION_ID};`,
  ];

  let position = 0;
  if (lead) {
    statements.push(
      `INSERT INTO content_inventory_club_home_edition_placements (edition_id, zone_id, story_id, position, selection_mode, feature_size, created_at) VALUES (${EDITION_ID}, 'lead-story', ${lead.record.id}, 0, 'automatic', NULL, ${sqlString(now)});`,
    );
    statements.push(
      `INSERT INTO content_inventory_club_home_edition_placements (edition_id, zone_id, story_id, position, selection_mode, feature_size, created_at) VALUES (${EDITION_ID}, 'media-feature', ${lead.record.id}, 0, 'automatic', 'photo', ${sqlString(now)});`,
    );
  }
  for (const item of rail) {
    statements.push(
      `INSERT INTO content_inventory_club_home_edition_placements (edition_id, zone_id, story_id, position, selection_mode, feature_size, created_at) VALUES (${EDITION_ID}, 'story-rail', ${item.record.id}, ${position}, 'automatic', NULL, ${sqlString(now)});`,
    );
    position += 1;
  }
  if (spotlight) {
    statements.push(
      `INSERT INTO content_inventory_club_home_edition_placements (edition_id, zone_id, story_id, position, selection_mode, feature_size, created_at) VALUES (${EDITION_ID}, 'archive-spotlight', ${spotlight.record.id}, 0, 'automatic', NULL, ${sqlString(now)});`,
    );
  }

  statements.push(
    `INSERT INTO content_inventory_club_home_active_edition (singleton, edition_id, activated_at, activated_by) VALUES (1, ${EDITION_ID}, ${sqlString(now)}, 'club-home-pilot-seed') ON CONFLICT(singleton) DO UPDATE SET edition_id = excluded.edition_id, activated_at = excluded.activated_at, activated_by = excluded.activated_by;`,
  );

  return statements.join('\n');
}

const args = process.argv.slice(2);
const mode = args.includes('--apply') ? 'apply' : 'print';
const isRemote = args.includes('--remote');
const sql = buildSql();

if (mode === 'print') {
  process.stdout.write(sql + '\n');
  process.exit(0);
}

// Production is the top-level `lgfc_lite` D1 database (wrangler.toml).
// Local/preview dev uses the `DB` binding under env.preview (`lgfc-litedev`).
const d1Args = isRemote
  ? ['wrangler', 'd1', 'execute', 'lgfc_lite', '--remote']
  : ['wrangler', 'd1', 'execute', 'DB', '--local', '--env', 'preview'];

const tmpFile = path.join(__dirname, '..', '.club-home-pilot-edition.sql');
writeFileSync(tmpFile, sql, 'utf8');
const result = spawnSync(
  'npx',
  [...d1Args, '--file', tmpFile],
  { stdio: 'inherit', cwd: path.join(__dirname, '..') },
);
try { unlinkSync(tmpFile); } catch {}
process.exit(result.status ?? 1);
