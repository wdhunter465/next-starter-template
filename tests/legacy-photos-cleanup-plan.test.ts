import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { LEGACY_PHOTOS_CLEANUP_STATEMENTS } from '../functions/_lib/legacy-photos-cleanup-plan';

function applyRepoMigrations(db: DatabaseSync) {
  const migrationsDir = path.join(process.cwd(), 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }
}

function seedOnePhotoWithDependents(db: DatabaseSync) {
  db.exec("PRAGMA foreign_keys = ON;");
  db.prepare(
    "INSERT INTO photos (url, is_memorabilia, description, photo_id) VALUES ('https://example.com/a.jpg', 0, 'a', 'a')",
  ).run();
  const photo = db.prepare("SELECT id FROM photos WHERE photo_id = 'a'").get() as { id: number };

  db.prepare(
    "INSERT INTO content_inventory (tag, title, text, credit_line) VALUES ('t', 'Title', 'body', 'credit')",
  ).run();
  const story = db.prepare("SELECT id FROM content_inventory WHERE tag = 't'").get() as { id: number };

  db.prepare(
    'INSERT INTO content_inventory_media (story_id, media_id, media_role) VALUES (?, ?, ?)',
  ).run(story.id, photo.id, 'primary_image');

  db.prepare(
    "INSERT INTO weekly_matchups (week_start, photo_a_id, photo_b_id) VALUES ('2026-08-17', ?, ?)",
  ).run(photo.id, photo.id);

  db.prepare(
    "INSERT INTO weekly_votes (week_start, choice, source_hash) VALUES ('2026-08-17', 'a', 'hash1')",
  ).run();

  db.prepare("INSERT INTO milestones (photo_id, title) VALUES (?, 'Milestone')").run(photo.id);

  return photo.id;
}

describe('LEGACY_PHOTOS_CLEANUP_STATEMENTS (#3552)', () => {
  it('clears content_inventory_media before photos (required: hard FK with ON DELETE RESTRICT)', () => {
    const contentInventoryMediaIndex = LEGACY_PHOTOS_CLEANUP_STATEMENTS.findIndex((s) =>
      s.includes('content_inventory_media'),
    );
    const photosIndex = LEGACY_PHOTOS_CLEANUP_STATEMENTS.findIndex((s) => s === 'DELETE FROM photos');
    expect(contentInventoryMediaIndex).toBeGreaterThanOrEqual(0);
    expect(photosIndex).toBeGreaterThanOrEqual(0);
    expect(contentInventoryMediaIndex).toBeLessThan(photosIndex);
  });

  it('proves the FK actually blocks DELETE FROM photos while content_inventory_media has a referencing row', () => {
    const db = new DatabaseSync(':memory:');
    applyRepoMigrations(db);
    seedOnePhotoWithDependents(db);

    expect(() => db.exec('DELETE FROM photos')).toThrow();
  });

  it('running the statements in the declared order succeeds and leaves every dependent table empty', () => {
    const db = new DatabaseSync(':memory:');
    applyRepoMigrations(db);
    seedOnePhotoWithDependents(db);

    for (const statement of LEGACY_PHOTOS_CLEANUP_STATEMENTS) {
      expect(() => db.exec(statement)).not.toThrow();
    }

    const photos = db.prepare('SELECT COUNT(*) AS n FROM photos').get() as { n: number };
    const media = db.prepare('SELECT COUNT(*) AS n FROM content_inventory_media').get() as { n: number };
    const matchups = db.prepare('SELECT COUNT(*) AS n FROM weekly_matchups').get() as { n: number };
    const votes = db.prepare('SELECT COUNT(*) AS n FROM weekly_votes').get() as { n: number };
    const milestonesWithPhoto = db
      .prepare('SELECT COUNT(*) AS n FROM milestones WHERE photo_id IS NOT NULL')
      .get() as { n: number };

    expect(photos.n).toBe(0);
    expect(media.n).toBe(0);
    expect(matchups.n).toBe(0);
    expect(votes.n).toBe(0);
    expect(milestonesWithPhoto.n).toBe(0);

    const milestoneRow = db.prepare('SELECT COUNT(*) AS n FROM milestones').get() as { n: number };
    expect(milestoneRow.n).toBe(1);
  });
});
