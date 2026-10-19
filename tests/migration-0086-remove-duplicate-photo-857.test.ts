// #4705: migration 0086 takes duplicate photo 857 off the site and out of the matchup pool.
// It must touch photo 857 only, delete nothing, and be safe to run twice.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const migrationsDir = path.join(process.cwd(), 'migrations');
const TARGET_FILE = '0086_remove_duplicate_photo_857.sql';
const KEEP_NAME = 'LGFC_sha256_1366508701ac474296341b1ca8d8aa92bb1be135.jpg';
const DROP_NAME = 'LGFC_sha256_610c674e6e7899ff70b9d61d1c003d294f38c14f.jpg';

function schemaBeforeTarget(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    if (file === TARGET_FILE) break;
    db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }
  return db;
}

function seedPhoto(db: DatabaseSync, id: number, photoId: string) {
  db.prepare(
    `INSERT INTO photos (id, url, photo_id, publication_eligible, is_matchup_eligible, rights_status)
     VALUES (?, ?, ?, 1, 1, 'permission_granted')`,
  ).run(id, `https://b2.test/LouGehrigFanClub/${photoId}`, photoId);
}

function row(db: DatabaseSync, id: number) {
  return db
    .prepare('SELECT id, photo_id, publication_eligible, is_matchup_eligible, rights_notes FROM photos WHERE id = ?')
    .get(id) as { id: number; photo_id: string; publication_eligible: number; is_matchup_eligible: number; rights_notes: string | null };
}

const migrationSql = () => fs.readFileSync(path.join(migrationsDir, TARGET_FILE), 'utf8');

describe('migration 0086 removes duplicate photo 857', () => {
  it('hides photo 857 from the site and the matchup pool', () => {
    const db = schemaBeforeTarget();
    seedPhoto(db, 855, KEEP_NAME);
    seedPhoto(db, 857, DROP_NAME);
    db.exec(migrationSql());

    const dropped = row(db, 857);
    expect(dropped.publication_eligible).toBe(0);
    expect(dropped.is_matchup_eligible).toBe(-1);
    expect(dropped.rights_notes).toContain('DUPLICATE_REMOVED');
    expect(dropped.rights_notes).toContain('#4705');
  });

  it('leaves photo 855 and every other photo untouched', () => {
    const db = schemaBeforeTarget();
    seedPhoto(db, 855, KEEP_NAME);
    seedPhoto(db, 856, 'LGFC_sha256_52f668998643bfc6ea1129c4fdb5a0952fa40971.jpg');
    seedPhoto(db, 857, DROP_NAME);
    db.exec(migrationSql());

    for (const id of [855, 856]) {
      const kept = row(db, id);
      expect(kept.publication_eligible).toBe(1);
      expect(kept.is_matchup_eligible).toBe(1);
      expect(kept.rights_notes ?? '').not.toContain('DUPLICATE_REMOVED');
    }
  });

  it('keeps the row, so closed matchups that reference photo 857 still resolve', () => {
    const db = schemaBeforeTarget();
    seedPhoto(db, 857, DROP_NAME);
    db.exec(migrationSql());
    expect(row(db, 857)).toBeTruthy();
    expect((db.prepare('SELECT COUNT(*) AS n FROM photos').get() as { n: number }).n).toBe(1);
  });

  it('does nothing to a row whose id matches but whose file name does not', () => {
    const db = schemaBeforeTarget();
    seedPhoto(db, 857, 'some-other-file.jpg');
    db.exec(migrationSql());
    const untouched = row(db, 857);
    expect(untouched.publication_eligible).toBe(1);
    expect(untouched.is_matchup_eligible).toBe(1);
  });

  it('is safe to run twice: the second run changes nothing', () => {
    const db = schemaBeforeTarget();
    seedPhoto(db, 857, DROP_NAME);
    db.exec(migrationSql());
    const once = row(db, 857).rights_notes;
    db.exec(migrationSql());
    expect(row(db, 857).rights_notes).toBe(once);
  });

  it('runs cleanly when photo 857 is absent (a Development database)', () => {
    const db = schemaBeforeTarget();
    seedPhoto(db, 855, KEEP_NAME);
    expect(() => db.exec(migrationSql())).not.toThrow();
    expect(row(db, 855).publication_eligible).toBe(1);
  });

  it('never deletes or drops anything', () => {
    const sql = migrationSql().replace(/--.*$/gm, '').toUpperCase();
    expect(sql).not.toMatch(/\bDELETE\b/);
    expect(sql).not.toMatch(/\bDROP\b/);
    expect(sql).not.toMatch(/\bTRUNCATE\b/);
  });
});
