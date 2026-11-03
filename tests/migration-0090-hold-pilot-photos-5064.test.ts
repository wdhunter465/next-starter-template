// #5064: migration 0090 holds the four Club Home pilot photos (9401-9404) and nothing else.
// It must be safe to run twice, and the pilot seed pack must not re-publish them.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

const migrationsDir = path.join(process.cwd(), 'migrations');
const TARGET_FILE = '0090_hold_pilot_photos_5064.sql';

const PILOT: Array<[number, string]> = [
  [9401, 'lgfc-clubhome-pilot-gehrig-1925'],
  [9402, 'lgfc-clubhome-pilot-gehrig-1923-new-yankee'],
  [9403, 'lgfc-clubhome-pilot-gehrig-1934-goudey'],
  [9404, 'lgfc-clubhome-pilot-gehrig-columbia'],
];

function schemaBeforeTarget(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();
  for (const file of files) {
    if (file === TARGET_FILE) break;
    db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }
  return db;
}

function seedCleared(db: DatabaseSync, id: number, photoId: string) {
  db.prepare(
    `INSERT INTO photos (id, url, photo_id, rights_hold, rights_hold_reason, publication_eligible, rights_status)
     VALUES (?, ?, ?, 0, 'seeded', 1, 'public_domain_candidate')`,
  ).run(id, `https://b2.test/${photoId}`, photoId);
}

type PhotoRow = {
  id: number;
  rights_hold: number;
  rights_hold_reason: string | null;
  rights_hold_set_at: string | null;
  publication_eligible: number;
  rights_status: string;
  rights_notes: string | null;
};

const row = (db: DatabaseSync, id: number) =>
  db
    .prepare(
      'SELECT id, rights_hold, rights_hold_reason, rights_hold_set_at, publication_eligible, rights_status, rights_notes FROM photos WHERE id = ?',
    )
    .get(id) as PhotoRow | undefined;

const migrationSql = () => fs.readFileSync(path.join(migrationsDir, TARGET_FILE), 'utf8');

// The same predicate the site uses (functions/_lib/rights-hold.ts rightsClearedClause).
const servedIds = (db: DatabaseSync) =>
  (db.prepare('SELECT id FROM photos WHERE rights_hold = 0 AND publication_eligible = 1 ORDER BY id').all() as Array<{ id: number }>).map(
    (r) => r.id,
  );

describe('migration 0090 holds the four pilot photos', () => {
  it('holds 9401-9404, records why, keeps the rows and their rights status', () => {
    const db = schemaBeforeTarget();
    for (const [id, photoId] of PILOT) seedCleared(db, id, photoId);
    db.exec(migrationSql());
    for (const [id] of PILOT) {
      const photo = row(db, id)!;
      expect(photo.rights_hold).toBe(1);
      expect(photo.rights_hold_reason).toBe('pilot_photos_held_pending_rights_review_2026_11_03');
      expect(photo.rights_hold_set_at).toBeTruthy();
      expect(photo.rights_status).toBe('public_domain_candidate');
      expect(photo.rights_notes).toContain('#5064');
    }
  });

  it('removes them from what the site serves', () => {
    const db = schemaBeforeTarget();
    for (const [id, photoId] of PILOT) seedCleared(db, id, photoId);
    expect(servedIds(db)).toEqual([9401, 9402, 9403, 9404]);
    db.exec(migrationSql());
    expect(servedIds(db)).toEqual([]);
  });

  it('leaves every other photo untouched, including cleared matchup photos', () => {
    const db = schemaBeforeTarget();
    for (const [id, photoId] of PILOT) seedCleared(db, id, photoId);
    seedCleared(db, 855, 'LGFC_sha256_1366508701ac474296341b1ca8d8aa92bb1be135.jpg');
    seedCleared(db, 859, 'LGFC_sha256_c45b3d44ca254e3b33d3b59f850ab1ba9b6cdde3.jpg');
    seedCleared(db, 9405, 'some-other-photo');
    const before = [855, 859, 9405].map((id) => row(db, id));
    db.exec(migrationSql());
    expect([855, 859, 9405].map((id) => row(db, id))).toEqual(before);
    expect(servedIds(db)).toEqual([855, 859, 9405]);
  });

  it('does not touch a row that has the pilot id but a different photo_id', () => {
    const db = schemaBeforeTarget();
    seedCleared(db, 9401, 'a-different-photo');
    db.exec(migrationSql());
    expect(row(db, 9401)!.rights_hold).toBe(0);
  });

  it('is safe to run twice and does not overwrite a different hold', () => {
    const db = schemaBeforeTarget();
    for (const [id, photoId] of PILOT) seedCleared(db, id, photoId);
    db.prepare("UPDATE photos SET rights_hold = 1, rights_hold_reason = 'held_by_someone_else' WHERE id = 9402").run();
    db.exec(migrationSql());
    const afterFirst = PILOT.map(([id]) => row(db, id));
    expect(row(db, 9402)!.rights_hold_reason).toBe('held_by_someone_else');
    db.exec(migrationSql());
    expect(PILOT.map(([id]) => row(db, id))).toEqual(afterFirst);
  });

  it('succeeds when the pilot photos are absent', () => {
    const db = schemaBeforeTarget();
    expect(() => db.exec(migrationSql())).not.toThrow();
  });
});

describe('pilot seed pack', () => {
  it('seeds 9401-9404 as held so a re-run cannot re-publish them', () => {
    const pack = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'seed/content/club-home-pilot-pack.json'), 'utf8'));
    const photos = pack.photos as Array<{ id: number; photo_id: string; rights_hold: number; rights_status: string }>;
    expect(photos.map((p) => p.id).sort()).toEqual([9401, 9402, 9403, 9404]);
    for (const photo of photos) {
      expect(photo.rights_hold).toBe(1);
      expect(photo.rights_status).toBe('public_domain_candidate');
    }
    // The migration's photo_id guards match the seed pack exactly.
    expect(photos.map((p) => [p.id, p.photo_id]).sort()).toEqual([...PILOT].sort());
  });
});
