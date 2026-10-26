// #4900: Club Home rotation cycle proof. Regenerates editions against a real-schema in-memory SQLite
// database with an advancing clock and checks that content keeps changing without repeating.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import {
  getActiveClubHomeEdition,
  listClubHomeEditionPlacements,
  regenerateClubHomeEdition,
} from '../functions/_lib/content-inventory-club-home';

const DAY_MS = 86_400_000;
const START_MS = Date.UTC(2026, 10, 1, 10, 0, 0);

type Story = { id: number; storyType: 'primary' | 'secondary' };

function sqliteTime(ms: number): string {
  return new Date(ms).toISOString().replace('T', ' ').slice(0, 19);
}

/** D1-shaped wrapper over node:sqlite. `datetime('now')` is pinned to the simulated clock. */
function makeSimulationDb() {
  const sqlite = new DatabaseSync(':memory:');
  const migrationsDir = path.join(process.cwd(), 'migrations');
  for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    sqlite.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }

  let nowMs = START_MS;
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
    advanceDays(days: number) {
      nowMs += days * DAY_MS;
    },
    now: () => new Date(nowMs),
  };
}

function seedStories(sqlite: DatabaseSync, stories: Story[]) {
  const insert = sqlite.prepare(
    `INSERT INTO content_inventory
       (id, tag, title, text, story_type, allowed_sections, status, source_name, credit_line, canonical)
     VALUES (?, ?, ?, ?, ?, '["club_home","library"]', 'published', 'Simulation Source', 'Simulation Credit', 1)`,
  );
  for (const story of stories) {
    insert.run(story.id, `simulation-${story.id}`, `Story ${story.id}`, `Body ${story.id}`, story.storyType);
  }
}

function makePool(primaries: number, secondaries: number): Story[] {
  const stories: Story[] = [];
  for (let i = 1; i <= primaries; i += 1) stories.push({ id: i, storyType: 'primary' });
  for (let i = 1; i <= secondaries; i += 1) stories.push({ id: 100 + i, storyType: 'secondary' });
  return stories;
}

async function runEditions(
  sim: ReturnType<typeof makeSimulationDb>,
  count: number,
  daysBetween: number,
): Promise<Array<{ editionId: number; zones: Record<string, number[]> }>> {
  const editions: Array<{ editionId: number; zones: Record<string, number[]> }> = [];
  for (let i = 0; i < count; i += 1) {
    const result = await regenerateClubHomeEdition(sim.db, { createdBy: 'simulation' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error);
    const placements = await listClubHomeEditionPlacements(sim.db, result.edition_id);
    const zones: Record<string, number[]> = {};
    for (const placement of placements) {
      if (placement.story_id == null) continue;
      (zones[placement.zone_id] ??= []).push(placement.story_id);
    }
    editions.push({ editionId: result.edition_id, zones });
    sim.advanceDays(daysBetween);
  }
  return editions;
}

function storiesIn(edition: { zones: Record<string, number[]> }): number[] {
  return Object.values(edition.zones).flat();
}

const POOLS = [
  { label: '8 stories', primaries: 2, secondaries: 6 },
  { label: '12 stories', primaries: 3, secondaries: 9 },
  { label: '16 stories', primaries: 4, secondaries: 12 },
];

describe('Club Home rotation cycle simulation (#4900)', () => {
  for (const pool of POOLS) {
    describe(`pool of ${pool.label}`, () => {
      it('shows no story twice inside one edition', async () => {
        const sim = makeSimulationDb();
        seedStories(sim.sqlite, makePool(pool.primaries, pool.secondaries));
        const editions = await runEditions(sim, 12, 1);
        for (const edition of editions) {
          const ids = storiesIn(edition);
          expect(new Set(ids).size, `edition ${edition.editionId}: ${JSON.stringify(edition.zones)}`).toBe(ids.length);
        }
      });

      it('changes the active edition and its content on every regeneration', async () => {
        const sim = makeSimulationDb();
        seedStories(sim.sqlite, makePool(pool.primaries, pool.secondaries));
        const editions = await runEditions(sim, 8, 1);
        const active = await getActiveClubHomeEdition(sim.db);
        expect(active?.edition.id).toBe(editions[editions.length - 1].editionId);
        for (let i = 1; i < editions.length; i += 1) {
          const before = JSON.stringify(editions[i - 1].zones);
          const after = JSON.stringify(editions[i].zones);
          expect(after, `edition ${i + 1} repeats edition ${i}`).not.toBe(before);
        }
      });

      it('gives every primary story the lead within a few editions and never repeats one lead three times running', async () => {
        const sim = makeSimulationDb();
        const primaryIds = makePool(pool.primaries, pool.secondaries)
          .filter((story) => story.storyType === 'primary')
          .map((story) => story.id);
        seedStories(sim.sqlite, makePool(pool.primaries, pool.secondaries));
        const editions = await runEditions(sim, pool.primaries * 4, 1);
        const leads = editions.map((edition) => edition.zones['lead-story']?.[0]);

        const earlyLeads = new Set(leads.slice(0, pool.primaries * 2));
        for (const id of primaryIds) {
          expect(earlyLeads.has(id), `story ${id} never led in the first ${pool.primaries * 2} editions: ${leads.join(',')}`).toBe(true);
        }
        for (let i = 2; i < leads.length; i += 1) {
          const threeInARow = leads[i] === leads[i - 1] && leads[i] === leads[i - 2];
          expect(threeInARow, `lead ${leads[i]} three editions running: ${leads.join(',')}`).toBe(false);
        }
      });

      it('shows every eligible story within a few editions and keeps usage balanced', async () => {
        const sim = makeSimulationDb();
        const stories = makePool(pool.primaries, pool.secondaries);
        seedStories(sim.sqlite, stories);
        const editions = await runEditions(sim, 3 * stories.length, 1);

        const shown = new Set(editions.slice(0, stories.length).flatMap(storiesIn));
        expect([...shown].sort((a, b) => a - b)).toEqual(stories.map((s) => s.id).sort((a, b) => a - b));

        const counts = new Map<number, number>(stories.map((s) => [s.id, 0]));
        for (const edition of editions) for (const id of new Set(storiesIn(edition))) counts.set(id, (counts.get(id) ?? 0) + 1);
        for (const type of ['primary', 'secondary'] as const) {
          const values = stories.filter((s) => s.storyType === type).map((s) => counts.get(s.id) ?? 0);
          expect(Math.max(...values) - Math.min(...values), `${type} appearances: ${values.join(',')}`).toBeLessThanOrEqual(2);
        }
      });
    });
  }

  it('records last_featured and usage_count for each story placed in an edition', async () => {
    const sim = makeSimulationDb();
    seedStories(sim.sqlite, makePool(3, 9));
    const [edition] = await runEditions(sim, 1, 1);
    const placed = [...new Set(storiesIn(edition))];
    const rows = sim.sqlite
      .prepare(`SELECT id, usage_count, last_featured FROM content_inventory WHERE usage_count > 0 OR last_featured IS NOT NULL`)
      .all() as Array<{ id: number; usage_count: number; last_featured: string | null }>;
    expect(rows.map((row) => row.id).sort((a, b) => a - b)).toEqual(placed.sort((a, b) => a - b));
    for (const row of rows) {
      expect(row.usage_count).toBe(1);
      expect(row.last_featured).not.toBeNull();
    }
  });

  it('a pool smaller than the zones need still renders, repeating stories only because it must', async () => {
    const sim = makeSimulationDb();
    seedStories(sim.sqlite, makePool(2, 2));
    const editions = await runEditions(sim, 4, 1);
    for (const edition of editions) {
      expect(edition.zones['lead-story']).toHaveLength(1);
      expect(storiesIn(edition).length).toBeGreaterThan(0);
    }
  });
});
