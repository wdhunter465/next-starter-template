// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MATCHUP_WEEK_START_SQL, onRequestGet } from '../functions/api/matchup/current';

// #4466 (gap rows 38, 39, 40): Weekly Matchup pairing against the REAL schema.
//
// tests/matchup-current-rotation.test.ts answers every query with a hand-written double, so the
// eligibility SQL (is_matchup_eligible + rights_hold + publication_eligible), the weekly
// UNIQUE index and the history queries were never executed. This builds an in-memory SQLite
// database from the repository's own migrations and runs the real GET /api/matchup/current.

const migrationsDir = path.join(process.cwd(), 'migrations');

function d1Adapter(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const statement = db.prepare(sql);
      const bind = (...args: unknown[]) => ({
        first: async () => (statement.get(...(args as never[])) as unknown) ?? null,
        all: async () => ({ results: statement.all(...(args as never[])) as unknown[] }),
        run: async () => {
          const out = statement.run(...(args as never[]));
          return { meta: { changes: Number(out.changes), last_row_id: Number(out.lastInsertRowid) } };
        },
        statement: () => ({ sql, args }),
      });
      return { bind, ...bind() };
    },
    async batch(items: Array<{ run?: () => Promise<unknown> }>) {
      for (const item of items) await item.run?.();
      return [];
    },
  };
}

function freshDb() {
  const db = new DatabaseSync(':memory:');
  for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }
  return db;
}

let sqlite: DatabaseSync;
let nextId = 100;

type PhotoOpts = { eligible?: number; hold?: number; published?: number; memorabilia?: number; url?: string | null };

/** Adds a photo that is fully approved unless overridden; returns its id. */
function addPhoto(opts: PhotoOpts = {}): number {
  const id = nextId++;
  const url = opts.url === undefined ? `https://img.test/p${id}.jpg` : opts.url;
  sqlite
    .prepare(
      'INSERT INTO photos (id, url, is_memorabilia, is_matchup_eligible, rights_hold, publication_eligible) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(id, url, opts.memorabilia ?? 0, opts.eligible ?? 1, opts.hold ?? 0, opts.published ?? 1);
  return id;
}

const currentWeek = () => (sqlite.prepare(MATCHUP_WEEK_START_SQL).get() as { week_start: string }).week_start;
const matchupRows = () =>
  sqlite.prepare('SELECT * FROM weekly_matchups ORDER BY week_start').all() as Array<{
    id: number;
    week_start: string;
    photo_a_id: number;
    photo_b_id: number;
    status: string;
  }>;

function pastWeek(daysAgo: number): string {
  return (sqlite.prepare("SELECT date('now', ?, 'weekday 1', '-7 days') AS d").get(`-${daysAgo} days`) as { d: string }).d;
}

async function getCurrent() {
  const response = await onRequestGet({
    env: { DB: d1Adapter(sqlite) },
    request: new Request('https://www.lougehrigfanclub.com/api/matchup/current'),
  });
  return { status: response.status, body: (await response.json()) as any };
}

beforeEach(() => {
  sqlite = freshDb();
  nextId = 100;
  // The handler reads photo details over HTTP and probes the image URL; answer both from the database.
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname === '/api/photos/get') {
        const row = sqlite.prepare('SELECT id, url FROM photos WHERE id = ?').get(Number(url.searchParams.get('id')));
        return new Response(JSON.stringify({ item: row ?? null }), { status: row ? 200 : 404 });
      }
      return new Response(null, { status: 200 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('insufficient eligible-image pool (row 38)', () => {
  it('returns no pair and writes no matchup when there are no photos', async () => {
    const { status, body } = await getCurrent();
    expect(status).toBe(200);
    expect(body).toMatchObject({ ok: true, matchup_id: null, items: [] });
    expect(matchupRows()).toHaveLength(0);
  });

  it('returns no pair when only one photo is eligible', async () => {
    addPhoto();
    const { body } = await getCurrent();
    expect(body.items).toEqual([]);
    expect(matchupRows()).toHaveLength(0);
  });

  it.each([
    ['unreviewed (0)', { eligible: 0 }],
    ['excluded (-1)', { eligible: -1 }],
    ['rights hold', { hold: 1 }],
    ['not publication eligible', { published: 0 }],
    ['blank url', { url: '   ' }],
  ] as Array<[string, PhotoOpts]>)('does not count a photo that is %s', async (_label, opts) => {
    addPhoto();
    addPhoto(opts);
    const { body } = await getCurrent();
    expect(body.items).toEqual([]);
    expect(matchupRows()).toHaveLength(0);
  });

  it('pairs once a second eligible photo exists', async () => {
    const a = addPhoto();
    const b = addPhoto();
    const { body } = await getCurrent();
    expect(body.items.map((i: any) => i.id).sort()).toEqual([a, b].sort());
    expect(matchupRows()).toHaveLength(1);
  });
});

describe('selection stays inside the eligible pool (row 39)', () => {
  it('never picks an ineligible photo, and never the same photo twice, over many draws', async () => {
    const eligible = [addPhoto(), addPhoto(), addPhoto(), addPhoto()];
    const ineligible = [
      addPhoto({ eligible: 0 }),
      addPhoto({ eligible: -1 }),
      addPhoto({ hold: 1 }),
      addPhoto({ published: 0 }),
    ];

    const seen = new Set<number>();
    for (let draw = 0; draw < 60; draw += 1) {
      sqlite.exec('DELETE FROM weekly_matchups');
      const { body } = await getCurrent();
      const [a, b] = body.items.map((i: any) => Number(i.id));
      expect(eligible, `draw ${draw}`).toContain(a);
      expect(eligible, `draw ${draw}`).toContain(b);
      expect(a).not.toBe(b);
      for (const id of ineligible) expect([a, b]).not.toContain(id);
      seen.add(a);
      seen.add(b);
    }
    // Random, not fixed: 60 draws from 4 photos reach every eligible photo.
    expect([...seen].sort()).toEqual([...eligible].sort());
  });

  it('prefers non-memorabilia photos while two are available', async () => {
    const plain = [addPhoto(), addPhoto()];
    addPhoto({ memorabilia: 1 });
    addPhoto({ memorabilia: 1 });
    for (let draw = 0; draw < 20; draw += 1) {
      sqlite.exec('DELETE FROM weekly_matchups');
      const { body } = await getCurrent();
      expect(body.items.map((i: any) => Number(i.id)).sort()).toEqual([...plain].sort());
    }
  });
});

describe('pairing, placement and edition history (row 40)', () => {
  it('records one active matchup for the current week and returns the same pair on repeat calls', async () => {
    for (let i = 0; i < 5; i += 1) addPhoto();
    const first = await getCurrent();
    const second = await getCurrent();
    const third = await getCurrent();

    expect(matchupRows()).toHaveLength(1);
    expect(matchupRows()[0]).toMatchObject({ week_start: currentWeek(), status: 'active' });
    expect(second.body.items).toEqual(first.body.items);
    expect(third.body.matchup_id).toBe(first.body.matchup_id);
  });

  it('closes a stale active edition and keeps it in history when a new week starts', async () => {
    const [a, b] = [addPhoto(), addPhoto()];
    addPhoto();
    addPhoto();
    const old = pastWeek(7);
    sqlite.prepare("INSERT INTO weekly_matchups (week_start, photo_a_id, photo_b_id, status) VALUES (?, ?, ?, 'active')").run(old, a, b);

    await getCurrent();

    const rows = matchupRows();
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.week_start === old)).toMatchObject({ status: 'closed', photo_a_id: a, photo_b_id: b });
    expect(rows.find((r) => r.week_start === currentWeek())).toMatchObject({ status: 'active' });
  });

  it('avoids photos used in recent editions when enough fresh ones exist', async () => {
    const used = [addPhoto(), addPhoto(), addPhoto(), addPhoto()];
    const fresh = [addPhoto(), addPhoto()];
    sqlite.prepare("INSERT INTO weekly_matchups (week_start, photo_a_id, photo_b_id, status) VALUES (?, ?, ?, 'closed')").run(pastWeek(14), used[0], used[1]);
    sqlite.prepare("INSERT INTO weekly_matchups (week_start, photo_a_id, photo_b_id, status) VALUES (?, ?, ?, 'closed')").run(pastWeek(21), used[2], used[3]);

    const { body } = await getCurrent();

    expect(body.items.map((i: any) => Number(i.id)).sort()).toEqual([...fresh].sort());
    expect(matchupRows()).toHaveLength(3);
  });

  it('reuses recent photos rather than showing nothing when the pool is exhausted', async () => {
    const pool = [addPhoto(), addPhoto()];
    sqlite.prepare("INSERT INTO weekly_matchups (week_start, photo_a_id, photo_b_id, status) VALUES (?, ?, ?, 'closed')").run(pastWeek(14), pool[0], pool[1]);

    const { body } = await getCurrent();

    expect(body.items.map((i: any) => Number(i.id)).sort()).toEqual([...pool].sort());
  });

  it('replaces a pair whose photo lost eligibility, and clears that week\'s votes', async () => {
    const [a, b] = [addPhoto(), addPhoto()];
    addPhoto();
    addPhoto();
    const week = currentWeek();
    sqlite.prepare("INSERT INTO weekly_matchups (week_start, photo_a_id, photo_b_id, status) VALUES (?, ?, ?, 'active')").run(week, a, b);
    sqlite.prepare("INSERT INTO weekly_votes (week_start, choice, source_hash) VALUES (?, 'a', 'h1')").run(week);
    sqlite.prepare('UPDATE photos SET rights_hold = 1 WHERE id = ?').run(a);

    const { body } = await getCurrent();

    const ids = body.items.map((i: any) => Number(i.id));
    expect(ids).not.toContain(a);
    expect(matchupRows()).toHaveLength(1);
    expect(matchupRows()[0]).toMatchObject({ week_start: week, status: 'active' });
    expect((sqlite.prepare('SELECT COUNT(*) AS n FROM weekly_votes WHERE week_start = ?').get(week) as { n: number }).n).toBe(0);
  });

  it('keeps votes when the pair is unchanged', async () => {
    const [a, b] = [addPhoto(), addPhoto()];
    const week = currentWeek();
    sqlite.prepare("INSERT INTO weekly_matchups (week_start, photo_a_id, photo_b_id, status) VALUES (?, ?, ?, 'active')").run(week, a, b);
    sqlite.prepare("INSERT INTO weekly_votes (week_start, choice, source_hash) VALUES (?, 'b', 'h2')").run(week);

    await getCurrent();

    expect((sqlite.prepare('SELECT COUNT(*) AS n FROM weekly_votes WHERE week_start = ?').get(week) as { n: number }).n).toBe(1);
  });
});
