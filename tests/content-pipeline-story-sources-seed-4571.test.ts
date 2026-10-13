// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

// #4571: the Wikipedia, Wikisource and Internet Archive sources seed, applied to a scratch
// database with every repo migration.

const SEED_PATH = path.join(process.cwd(), 'scripts/content-pipeline/seeds/4571_story_sources.sql');
const SEED_DOMAINS = ['archive.org', 'en.wikipedia.org', 'en.wikisource.org'];

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  const migrationsDir = path.join(process.cwd(), 'migrations');
  for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }
  return db;
}

function applySeed(db: DatabaseSync) {
  db.exec(fs.readFileSync(SEED_PATH, 'utf8'));
}

function allSources(db: DatabaseSync) {
  return db.prepare('SELECT * FROM sources ORDER BY id').all();
}

function seededRows(db: DatabaseSync) {
  return db
    .prepare(
      `SELECT source_domain, source_type, source_trust_status, cost_model, cost_notes,
              search_enabled, standing, standing_at, cost_flagged_at
       FROM sources WHERE source_domain IN (${SEED_DOMAINS.map(() => '?').join(', ')})
       ORDER BY source_domain`,
    )
    .all(...SEED_DOMAINS) as Array<Record<string, unknown>>;
}

describe('story sources seed (#4571)', () => {
  it('inserts the three sources as free, searchable and of unknown standing', () => {
    const db = freshDb();
    const before = allSources(db).length;

    applySeed(db);

    expect(allSources(db).length).toBe(before + 3);
    const rows = seededRows(db);
    expect(rows.map((r) => r.source_domain)).toEqual(SEED_DOMAINS);
    for (const row of rows) {
      expect(row).toMatchObject({
        cost_model: 'free',
        search_enabled: 1,
        standing: 'unknown',
        standing_at: null,
        cost_flagged_at: null,
      });
      expect(String(row.cost_notes)).toMatch(/per item/);
    }
  });

  it('is idempotent: a second apply changes nothing', () => {
    const db = freshDb();
    applySeed(db);
    const afterFirst = allSources(db);

    applySeed(db);

    expect(allSources(db)).toEqual(afterFirst);
  });

  it('does not change or delete any other source row', () => {
    const db = freshDb();
    const before = allSources(db);

    applySeed(db);

    const untouched = allSources(db).filter(
      (row) => !SEED_DOMAINS.includes(String((row as Record<string, unknown>).source_domain)),
    );
    expect(untouched).toEqual(before);
  });

  it('leaves an existing row for one of the domains unchanged', () => {
    const db = freshDb();
    db.exec(
      "INSERT INTO sources (source_domain, source_name, source_type, cost_model, standing) VALUES ('archive.org', 'Existing', 'archive', 'unknown', 'pending')",
    );
    const existing = db.prepare("SELECT * FROM sources WHERE source_domain = 'archive.org'").get();

    applySeed(db);

    expect(db.prepare("SELECT * FROM sources WHERE source_domain = 'archive.org'").get()).toEqual(existing);
    expect(seededRows(db).map((r) => r.source_domain)).toEqual(SEED_DOMAINS);
  });

  it('contains only inserts', () => {
    const sql = fs
      .readFileSync(SEED_PATH, 'utf8')
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');
    expect(sql).toMatch(/INSERT OR IGNORE INTO sources/);
    expect(sql).not.toMatch(/\b(UPDATE|DELETE|DROP|ALTER|REPLACE)\b/i);
  });
});
