import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

function migrationSql(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), 'migrations', file), 'utf8');
}

describe('#2859 migration 0073 — Lou Gehrig Day 2027 event seed', () => {
  function freshDb() {
    const db = new DatabaseSync(':memory:');
    db.exec(migrationSql('0014_events.sql'));
    return db;
  }

  it('inserts exactly one posted Lou Gehrig Day row', () => {
    const db = freshDb();
    db.exec(migrationSql('0073_seed_event_lou_gehrig_day_2027_2859.sql'));

    const rows = db.prepare('SELECT title, start_date, end_date, status FROM events').all();
    expect(rows).toEqual([
      { title: 'Lou Gehrig Day', start_date: '2027-06-02', end_date: '2027-06-02', status: 'posted' },
    ]);
  });

  it('is idempotent when applied twice', () => {
    const db = freshDb();
    const sql = migrationSql('0073_seed_event_lou_gehrig_day_2027_2859.sql');
    db.exec(sql);
    db.exec(sql);

    const rows = db.prepare('SELECT count(*) as n FROM events').all() as Array<{ n: number }>;
    expect(rows[0].n).toBe(1);
  });

  it('republishes the row if it already exists but was left hidden', () => {
    const db = freshDb();
    db.prepare(
      "INSERT INTO events (title, start_date, end_date, status) VALUES ('Lou Gehrig Day', '2027-06-02', '2027-06-02', 'hidden')",
    ).run();

    db.exec(migrationSql('0073_seed_event_lou_gehrig_day_2027_2859.sql'));

    const rows = db.prepare('SELECT status FROM events').all() as Array<{ status: string }>;
    expect(rows).toEqual([{ status: 'posted' }]);
  });

  it('is eligible for /api/events/next, using the same WHERE/ORDER BY/LIMIT shape as functions/api/events/next.ts', () => {
    const db = freshDb();
    db.exec(migrationSql('0073_seed_event_lou_gehrig_day_2027_2859.sql'));

    const rows = db
      .prepare(
        `SELECT id, title, start_date, end_date, location, host, fees, description, external_url
         FROM events
         WHERE status='posted' AND start_date >= ?
         ORDER BY start_date ASC, id ASC
         LIMIT ?;`,
      )
      .all('2026-09-03', 10);
    expect(rows).toHaveLength(1);
    expect((rows[0] as { title: string }).title).toBe('Lou Gehrig Day');
  });
});
