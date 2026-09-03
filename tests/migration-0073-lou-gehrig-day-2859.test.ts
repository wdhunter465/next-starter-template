import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('#2859 migration 0073 — Lou Gehrig Day 2027 event seed', () => {
  function freshDb() {
    const db = new DatabaseSync(':memory:');
    db.exec(readFileSync('migrations/0014_events.sql', 'utf8'));
    return db;
  }

  it('inserts exactly one posted Lou Gehrig Day row', () => {
    const db = freshDb();
    db.exec(readFileSync('migrations/0073_seed_event_lou_gehrig_day_2027_2859.sql', 'utf8'));

    const rows = db.prepare('SELECT title, start_date, end_date, status FROM events').all();
    expect(rows).toEqual([
      { title: 'Lou Gehrig Day', start_date: '2027-06-02', end_date: '2027-06-02', status: 'posted' },
    ]);
  });

  it('is idempotent when applied twice', () => {
    const db = freshDb();
    const sql = readFileSync('migrations/0073_seed_event_lou_gehrig_day_2027_2859.sql', 'utf8');
    db.exec(sql);
    db.exec(sql);

    const rows = db.prepare('SELECT count(*) as n FROM events').all() as Array<{ n: number }>;
    expect(rows[0].n).toBe(1);
  });

  it('is eligible for /api/events/next (posted, future start_date)', () => {
    const db = freshDb();
    db.exec(readFileSync('migrations/0073_seed_event_lou_gehrig_day_2027_2859.sql', 'utf8'));

    const rows = db
      .prepare("SELECT title FROM events WHERE status='posted' AND start_date >= ? ORDER BY start_date ASC")
      .all('2026-09-03');
    expect(rows).toEqual([{ title: 'Lou Gehrig Day' }]);
  });
});
