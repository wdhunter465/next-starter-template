// #4705: migration 0086 removes duplicate photo 857 from D1.
// It must touch photo 857 only, never fail on a story reference, and be safe to run twice.

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
  it('deletes photo 857 when no story uses it', () => {
    const db = schemaBeforeTarget();
    seedPhoto(db, 855, KEEP_NAME);
    seedPhoto(db, 857, DROP_NAME);
    db.exec(migrationSql());
    expect(row(db, 857)).toBeUndefined();
    expect(row(db, 855)).toBeTruthy();
  });

  it('hides photo 857 instead, without failing, when a story still uses it', () => {
    const db = schemaBeforeTarget();
    seedPhoto(db, 857, DROP_NAME);
    db.exec(
      `INSERT INTO content_inventory (id, tag, title, text, credit_line) VALUES (1, 'tag', 't', 'x', 'c')`,
    );
    db.exec(
      `INSERT INTO content_inventory_media (story_id, media_id, media_role) VALUES (1, 857, 'supporting_image')`,
    );
    expect(() => db.exec(migrationSql())).not.toThrow();
    const kept = row(db, 857);
    expect(kept.publication_eligible).toBe(0);
    expect(kept.is_matchup_eligible).toBe(-1);
    expect(kept.rights_notes).toContain('DUPLICATE_REMOVED');
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

  it('leaves weekly_matchups rows alone', () => {
    const db = schemaBeforeTarget();
    seedPhoto(db, 855, KEEP_NAME);
    seedPhoto(db, 857, DROP_NAME);
    db.exec(
      `INSERT INTO weekly_matchups (photo_a_id, photo_b_id, week_start, status) VALUES (856, 857, '2026-10-12', 'closed')`,
    );
    db.exec(migrationSql());
    expect((db.prepare('SELECT COUNT(*) AS n FROM weekly_matchups').get() as { n: number }).n).toBe(1);
  });

  it('does nothing to a row whose id matches but whose file name does not', () => {
    const db = schemaBeforeTarget();
    seedPhoto(db, 857, 'some-other-file.jpg');
    db.exec(migrationSql());
    const untouched = row(db, 857);
    expect(untouched).toBeTruthy();
    expect(untouched.publication_eligible).toBe(1);
    expect(untouched.is_matchup_eligible).toBe(1);
  });

  it('is safe to run twice: the second run changes nothing', () => {
    const db = schemaBeforeTarget();
    seedPhoto(db, 857, DROP_NAME);
    db.exec(migrationSql());
    db.exec(migrationSql());
    expect(() => db.exec(migrationSql())).not.toThrow();
    expect(row(db, 857)).toBeUndefined();
  });

  it('runs cleanly when photo 857 is absent (a Development database)', () => {
    const db = schemaBeforeTarget();
    seedPhoto(db, 855, KEEP_NAME);
    expect(() => db.exec(migrationSql())).not.toThrow();
    expect(row(db, 855).publication_eligible).toBe(1);
  });

  it('deletes only from photos, only photo 857, and drops nothing', () => {
    const sql = migrationSql().replace(/--.*$/gm, '').toUpperCase();
    expect(sql.match(/\bDELETE\s+FROM\s+\w+/g)).toEqual(['DELETE FROM PHOTOS']);
    expect(sql).toContain('ID = 857');
    expect(sql).not.toMatch(/\bDROP\b/);
    expect(sql).not.toMatch(/\bTRUNCATE\b/);
  });
});
