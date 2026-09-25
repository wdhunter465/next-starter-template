// @vitest-environment node
// #3161: the public milestones endpoint must only ever return
// visibility='public' rows, never the member-only detailed timeline entries
// (and never leak detail_body/source_url, which it doesn't select at all).

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { onRequestGet } from '../../functions/api/milestones/list';

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

function wrapSqliteAsD1(sqlite: DatabaseSync) {
  return {
    async exec(sql: string) {
      sqlite.exec(sql);
    },
    prepare(sql: string) {
      const stmt = sqlite.prepare(sql);
      const bound = (...args: SQLInputValue[]) => ({
        async first() {
          return stmt.get(...args) ?? null;
        },
        async all() {
          return { results: stmt.all(...args) };
        },
        async run() {
          stmt.run(...args);
          return { success: true };
        },
      });

      return {
        bind: bound,
        async first() {
          return stmt.get() ?? null;
        },
        async all() {
          return { results: stmt.all() };
        },
        async run() {
          stmt.run();
          return { success: true };
        },
      };
    },
  };
}

function getRequest(): Request {
  return new Request('https://www.lougehrigfanclub.com/api/milestones/list?limit=100');
}

describe('GET /api/milestones/list visibility filtering (#3161)', () => {
  it('excludes member-only milestones seeded by migration 0078', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);

    const response = await onRequestGet({
      env: { DB: wrapSqliteAsD1(sqlite) },
      request: getRequest(),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);

    const titles = body.items.map((row: { title: string }) => row.title);
    expect(titles).toContain('Born in New York City');
    expect(titles).toContain('Dies in Riverdale, New York, at age 37');

    // Member-only rows must never appear on the public endpoint.
    expect(titles).not.toContain('Marries Eleanor Grace Twitchell');
    expect(titles).not.toContain('Graduates Commerce High School, enrolls at Columbia University');
    expect(titles).not.toContain('Diagnosed with ALS at the Mayo Clinic');

    // The public payload never carries the member-only narrative fields.
    for (const row of body.items) {
      expect(row).not.toHaveProperty('detail_body');
      expect(row).not.toHaveProperty('source_url');
    }
  });

  it('interleaves year-only rows chronologically instead of sorting them after every dated row', async () => {
    // Regression for a Copilot review finding on #4375: migration 0078 seeds
    // two public rows with no event_date (1927 AL MVP, 1934 Triple Crown).
    // Those must sort between their neighboring dated rows (1925, 1939), not
    // all the way to the end of the list.
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);

    const response = await onRequestGet({
      env: { DB: wrapSqliteAsD1(sqlite) },
      request: getRequest(),
    });
    const body = await response.json();

    const titles: string[] = body.items.map((row: { title: string }) => row.title);
    const streakIndex = titles.indexOf('Begins the historic consecutive-games streak'); // 1925-06-01
    const mvpIndex = titles.indexOf('AL MVP, anchors the "Murderers\' Row" Yankees'); // 1927, no event_date
    const tripleCrownIndex = titles.indexOf('Wins the Triple Crown'); // 1934, no event_date
    const streakEndsIndex = titles.indexOf('Voluntarily ends the 2,130-game streak'); // 1939-05-02

    expect(streakIndex).toBeGreaterThanOrEqual(0);
    expect(mvpIndex).toBeGreaterThanOrEqual(0);
    expect(tripleCrownIndex).toBeGreaterThanOrEqual(0);
    expect(streakEndsIndex).toBeGreaterThanOrEqual(0);
    expect(streakIndex).toBeLessThan(mvpIndex);
    expect(mvpIndex).toBeLessThan(tripleCrownIndex);
    expect(tripleCrownIndex).toBeLessThan(streakEndsIndex);
  });
});
