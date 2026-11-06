// #5076 step 1: the activation log and the placement snapshots, against a real-schema in-memory
// SQLite database (every migration applied in order).

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  regenerateClubHomeEdition,
  rollbackClubHomeEdition,
} from '../functions/_lib/content-inventory-club-home';

const START_MS = Date.UTC(2026, 10, 10, 10, 0, 0);

function sqliteTime(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

function makeDb(options?: { skipMigrationFile?: string }) {
  const sqlite = new DatabaseSync(':memory:');
  const dir = path.join(process.cwd(), 'migrations');
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    if (file === options?.skipMigrationFile) continue;
    sqlite.exec(fs.readFileSync(path.join(dir, file), 'utf8'));
  }
  let nowMs = START_MS;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(nowMs);
  const withClock = (sql: string) => sql.replaceAll("datetime('now')", `'${sqliteTime(nowMs)}'`);
  const db = {
    prepare(rawSql: string) {
      const stmt = sqlite.prepare(withClock(rawSql));
      const bound = (...args: SQLInputValue[]) => ({
        async first() {
          return stmt.get(...args) ?? null;
        },
        async all() {
          return { results: stmt.all(...args) };
        },
        async run() {
          const info = stmt.run(...args);
          return { success: true, meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) } };
        },
      });
      return { bind: bound, ...bound() };
    },
  };
  return {
    db,
    sqlite,
    advance(ms: number) {
      nowMs += ms;
      vi.setSystemTime(nowMs);
    },
  };
}

function seedStories(sqlite: DatabaseSync, count: number) {
  const insert = sqlite.prepare(
    `INSERT INTO content_inventory
       (id, tag, title, text, story_type, allowed_sections, status, source_name, credit_line, canonical)
     VALUES (?, ?, ?, ?, ?, '["club_home","library"]', 'published', 'Archive Source', 'Archive Credit', 1)`,
  );
  for (let i = 1; i <= count; i += 1) {
    insert.run(i, `archive-${i}`, `Story ${i}`, `Body text ${i}`, i <= 2 ? 'primary' : 'secondary');
  }
}

afterEach(() => {
  vi.useRealTimers();
});

describe('Club Home edition archive (#5076 step 1)', () => {
  it('logs each activation with its reason, in order, in UTC', async () => {
    const sim = makeDb();
    seedStories(sim.sqlite, 8);

    const first = await regenerateClubHomeEdition(sim.db, { createdBy: 'tester' });
    expect(first.ok).toBe(true);
    if (!first.ok) throw new Error(first.error);
    sim.advance(3_600_000);
    const second = await regenerateClubHomeEdition(sim.db, { createdBy: 'tester' });
    expect(second.ok).toBe(true);
    if (!second.ok) throw new Error(second.error);
    sim.advance(3_600_000);
    const rolled = await rollbackClubHomeEdition(sim.db, first.edition_id, { activatedBy: 'tester' });
    expect(rolled.ok).toBe(true);

    const log = sim.sqlite
      .prepare(`SELECT edition_id, activated_at, activated_by, reason FROM club_home_edition_activations ORDER BY id`)
      .all() as Array<{ edition_id: number; activated_at: string; activated_by: string; reason: string }>;
    expect(log.map((row) => [row.edition_id, row.reason])).toEqual([
      [first.edition_id, 'regenerate'],
      [second.edition_id, 'regenerate'],
      [first.edition_id, 'rollback'],
    ]);
    expect(log.every((row) => row.activated_by === 'tester')).toBe(true);
    expect(new Set(log.map((row) => row.activated_at)).size).toBe(3);

    // Which edition was live at a moment: the latest activation at or before it.
    const liveAt = (at: string) =>
      (sim.sqlite
        .prepare(
          `SELECT edition_id FROM club_home_edition_activations WHERE activated_at <= ? ORDER BY activated_at DESC, id DESC LIMIT 1`,
        )
        .get(at) as { edition_id: number } | undefined)?.edition_id ?? null;
    expect(liveAt(log[0].activated_at)).toBe(first.edition_id);
    expect(liveAt(log[1].activated_at)).toBe(second.edition_id);
    expect(liveAt(log[2].activated_at)).toBe(first.edition_id);
    expect(liveAt('2000-01-01 00:00:00')).toBeNull();
  });

  it('snapshots the story each placement showed, and keeps it when the story changes later', async () => {
    const sim = makeDb();
    seedStories(sim.sqlite, 8);
    const result = await regenerateClubHomeEdition(sim.db, { createdBy: 'tester' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);

    const rows = sim.sqlite
      .prepare(
        `SELECT story_id, snapshot_taken_at, snapshot_title, snapshot_text_sha256, snapshot_credit_line, snapshot_source_name
           FROM content_inventory_club_home_edition_placements WHERE edition_id = ? AND story_id IS NOT NULL`,
      )
      .all(result.edition_id) as Array<Record<string, string | number | null>>;
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.snapshot_taken_at).not.toBeNull();
      expect(row.snapshot_title).toBe(`Story ${row.story_id}`);
      expect(String(row.snapshot_text_sha256)).toMatch(/^[0-9a-f]{64}$/);
      expect(row.snapshot_credit_line).toBe('Archive Credit');
      expect(row.snapshot_source_name).toBe('Archive Source');
    }

    const before = rows[0];
    sim.sqlite.prepare(`UPDATE content_inventory SET title = 'Changed later', text = 'New text' WHERE id = ?`).run(before.story_id as number);
    const after = sim.sqlite
      .prepare(
        `SELECT snapshot_title, snapshot_text_sha256 FROM content_inventory_club_home_edition_placements
          WHERE edition_id = ? AND story_id = ? LIMIT 1`,
      )
      .get(result.edition_id, before.story_id as number) as Record<string, string>;
    expect(after.snapshot_title).toBe(before.snapshot_title);
    expect(after.snapshot_text_sha256).toBe(before.snapshot_text_sha256);
  });

  it('refuses to change the log or a logged edition, and refuses to update any placement', async () => {
    const sim = makeDb();
    seedStories(sim.sqlite, 8);
    const result = await regenerateClubHomeEdition(sim.db, { createdBy: 'tester' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);

    expect(() => sim.sqlite.exec(`UPDATE club_home_edition_activations SET reason = 'manual'`)).toThrow(/append-only/);
    expect(() => sim.sqlite.exec(`DELETE FROM club_home_edition_activations`)).toThrow(/append-only/);
    expect(() => sim.sqlite.exec(`UPDATE content_inventory_club_home_edition_placements SET position = 9`)).toThrow(/not updated/);
    expect(() =>
      sim.sqlite.exec(`DELETE FROM content_inventory_club_home_edition_placements WHERE edition_id = ${result.edition_id}`),
    ).toThrow(/kept/);

    // An edition that was never activated through the log can still be rewritten (pilot seed script).
    sim.sqlite.exec(
      `INSERT INTO content_inventory_club_home_editions (id, status, created_at) VALUES (900, 'ready', '2026-11-10 10:00:00');
       INSERT INTO content_inventory_club_home_edition_placements (edition_id, zone_id, story_id, position, created_at)
         VALUES (900, 'lead-story', 1, 0, '2026-11-10 10:00:00');
       DELETE FROM content_inventory_club_home_edition_placements WHERE edition_id = 900;`,
    );
  });

  it('records the edition that is live at migration time as one log row', () => {
    const sim = makeDb({ skipMigrationFile: '0095_club_home_edition_archive_5076.sql' });
    sim.sqlite.exec(
      `INSERT INTO content_inventory_club_home_editions (id, status, created_at) VALUES (7, 'ready', '2026-10-22 09:00:00');
       INSERT INTO content_inventory_club_home_active_edition (singleton, edition_id, activated_at, activated_by)
         VALUES (1, 7, '2026-10-22 09:00:05', 'pilot');`,
    );
    sim.sqlite.exec(fs.readFileSync(path.join(process.cwd(), 'migrations', '0095_club_home_edition_archive_5076.sql'), 'utf8'));
    const rows = sim.sqlite.prepare(`SELECT edition_id, activated_at, activated_by, reason FROM club_home_edition_activations`).all();
    expect(rows).toEqual([{ edition_id: 7, activated_at: '2026-10-22 09:00:05', activated_by: 'pilot', reason: 'manual' }]);
  });

  it('still builds and activates an edition before migration 0095 is applied', async () => {
    const sim = makeDb({ skipMigrationFile: '0095_club_home_edition_archive_5076.sql' });
    seedStories(sim.sqlite, 8);
    const result = await regenerateClubHomeEdition(sim.db, { createdBy: 'tester' });
    if (!result.ok) throw new Error(result.error);
    expect(result.placements.length).toBeGreaterThan(0);
  });
});
