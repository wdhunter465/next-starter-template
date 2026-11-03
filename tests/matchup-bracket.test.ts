// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import {
  attachMatchupToBracket,
  finalizeClosedMatchups,
  selectBracketPair,
} from '../functions/_lib/matchup-bracket';

const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations');

function migratedDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  for (const file of fs.readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith('.sql')).sort()) {
    db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
  }
  return db;
}

/** D1-shaped adapter over node:sqlite: prepare/bind/first/all/run and batch. */
function d1(db: DatabaseSync) {
  const make = (sql: string, params: unknown[]) => ({
    sql,
    params,
    first: async () => db.prepare(sql).get(...(params as any[])) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...(params as any[])) }),
    run: async () => {
      const info = db.prepare(sql).run(...(params as any[]));
      return { meta: { last_row_id: Number(info.lastInsertRowid), changes: Number(info.changes) } };
    },
  });
  return {
    prepare: (sql: string) => ({ ...make(sql, []), bind: (...params: unknown[]) => make(sql, params) }),
    batch: async (statements: Array<{ sql: string; params: unknown[] }>) => {
      db.exec('BEGIN');
      try {
        for (const s of statements) db.prepare(s.sql).run(...(s.params as any[]));
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}

/** Deterministic random numbers so a failure is reproducible. */
function seeded(seed = 7) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

let weekCounter = 0;

/** Play one week: pick a pair, record votes, close the week, then note the winner. */
async function playWeek(
  db: DatabaseSync,
  eligible: number[],
  votes: { a: number; b: number } | ((pair: [number, number]) => { a: number; b: number }),
  rng = seeded(),
) {
  const client = d1(db);
  await finalizeClosedMatchups(client);
  const pick = await selectBracketPair(client, eligible, rng);
  if (!pick) return null;

  weekCounter += 1;
  const weekStart = `2027-01-${String(weekCounter).padStart(2, '0')}`;
  const out = db
    .prepare("INSERT INTO weekly_matchups (week_start, photo_a_id, photo_b_id, status) VALUES (?, ?, ?, 'active')")
    .run(weekStart, pick.photoAId, pick.photoBId);
  const matchupId = Number(out.lastInsertRowid);
  await attachMatchupToBracket(client, matchupId, pick);

  const v = typeof votes === 'function' ? votes([pick.photoAId, pick.photoBId]) : votes;
  for (let i = 0; i < v.a; i += 1) {
    db.prepare("INSERT INTO weekly_votes (week_start, choice, source_hash) VALUES (?, 'a', ?)").run(weekStart, `a${i}`);
  }
  for (let i = 0; i < v.b; i += 1) {
    db.prepare("INSERT INTO weekly_votes (week_start, choice, source_hash) VALUES (?, 'b', ?)").run(weekStart, `b${i}`);
  }
  db.prepare("UPDATE weekly_matchups SET status = 'closed' WHERE id = ?").run(matchupId);
  return { pick, matchupId, weekStart };
}

const statusOf = (db: DatabaseSync, tournamentId: number) =>
  Object.fromEntries(
    (db.prepare('SELECT photo_id, status FROM matchup_entries WHERE tournament_id = ?').all(tournamentId) as any[]).map(
      (r) => [r.photo_id, r.status],
    ),
  );

describe('matchup bracket', () => {
  it('needs at least two eligible photos', async () => {
    const db = migratedDb();
    expect(await selectBracketPair(d1(db), [1])).toBeNull();
    expect(await selectBracketPair(d1(db), [])).toBeNull();
  });

  it('starts a tournament with every eligible photo and picks two distinct ones', async () => {
    const db = migratedDb();
    const eligible = [1, 2, 3, 4, 5, 6];
    const pick = await selectBracketPair(d1(db), eligible, seeded());
    expect(pick).not.toBeNull();
    expect(pick!.photoAId).not.toBe(pick!.photoBId);
    expect(eligible).toContain(pick!.photoAId);
    expect(eligible).toContain(pick!.photoBId);
    expect(pick!.round).toBe(1);
    const entries = statusOf(db, pick!.tournamentId);
    expect(Object.keys(entries)).toHaveLength(6);
    expect(entries[pick!.photoAId]).toBe('playing');
    expect(entries[pick!.photoBId]).toBe('playing');
  });

  it('notes the winner, advances it and eliminates the loser', async () => {
    const db = migratedDb();
    const week = await playWeek(db, [1, 2, 3, 4], { a: 5, b: 2 });
    await finalizeClosedMatchups(d1(db));

    const row = db.prepare('SELECT votes_a, votes_b, outcome, finalized_at FROM weekly_matchups WHERE id = ?').get(week!.matchupId) as any;
    expect(row).toMatchObject({ votes_a: 5, votes_b: 2, outcome: 'a' });
    expect(row.finalized_at).toBeTruthy();

    const entries = statusOf(db, week!.pick.tournamentId);
    expect(entries[week!.pick.photoAId]).toBe('advanced');
    expect(entries[week!.pick.photoBId]).toBe('eliminated');
  });

  it('on a tie, both photos win and advance', async () => {
    const db = migratedDb();
    const week = await playWeek(db, [1, 2, 3, 4], { a: 3, b: 3 });
    await finalizeClosedMatchups(d1(db));

    const row = db.prepare('SELECT outcome FROM weekly_matchups WHERE id = ?').get(week!.matchupId) as any;
    expect(row.outcome).toBe('tie');
    const entries = statusOf(db, week!.pick.tournamentId);
    expect(entries[week!.pick.photoAId]).toBe('advanced');
    expect(entries[week!.pick.photoBId]).toBe('advanced');
  });

  it('finalizes a week only once', async () => {
    const db = migratedDb();
    await playWeek(db, [1, 2, 3, 4], { a: 1, b: 0 });
    expect(await finalizeClosedMatchups(d1(db))).toBe(1);
    expect(await finalizeClosedMatchups(d1(db))).toBe(0);
  });

  it('plays every photo once, advances winners, and ends with a champion', async () => {
    const db = migratedDb();
    const eligible = [1, 2, 3, 4];
    const played: Array<[number, number]> = [];
    const winnerOf = ([a, b]: [number, number]) => (a < b ? { a: 4, b: 1 } : { a: 1, b: 4 }); // lower id wins

    // Round 1: two matchups cover all four photos exactly once.
    for (let i = 0; i < 2; i += 1) {
      const w = await playWeek(db, eligible, winnerOf);
      played.push([w!.pick.photoAId, w!.pick.photoBId]);
    }
    expect(played.flat().sort()).toEqual([1, 2, 3, 4]);

    // Round 2: only the two winners play each other. The lower id wins each game here.
    const expectedWinners = played.map(([a, b]) => Math.min(a, b)).sort();
    const final = await playWeek(db, eligible, winnerOf);
    expect(final!.pick.round).toBe(2);
    expect([final!.pick.photoAId, final!.pick.photoBId].sort()).toEqual(expectedWinners);

    // The next pick records the final's winner as champion and starts a new tournament.
    await finalizeClosedMatchups(d1(db));
    const next = await selectBracketPair(d1(db), eligible, seeded(3));
    const done = db.prepare("SELECT id, champion_photo_ids FROM matchup_tournaments WHERE status = 'complete'").get() as any;
    const champion = Math.min(...expectedWinners);
    expect(JSON.parse(done.champion_photo_ids)).toEqual([champion]);
    expect(statusOf(db, done.id)[champion]).toBe('champion');
    expect(next).not.toBeNull();
    expect(next!.tournamentId).not.toBe(done.id);
    expect(next!.round).toBe(1);
  });

  it('gives the odd photo out a bye', async () => {
    const db = migratedDb();
    const eligible = [1, 2, 3];
    const first = await playWeek(db, eligible, { a: 2, b: 1 });
    const bye = [1, 2, 3].find((id) => id !== first!.pick.photoAId && id !== first!.pick.photoBId)!;

    // Next pick: the bye photo advances automatically and plays the round-1 winner in round 2.
    const second = await playWeek(db, eligible, { a: 2, b: 1 });
    expect(second!.pick.round).toBe(2);
    expect([second!.pick.photoAId, second!.pick.photoBId].sort()).toEqual([first!.pick.photoAId, bye].sort());
  });

  it('adds a new photo to the current round', async () => {
    const db = migratedDb();
    const first = await playWeek(db, [1, 2, 3, 4], { a: 2, b: 1 });
    const t = first!.pick.tournamentId;

    await selectBracketPair(d1(db), [1, 2, 3, 4, 5], seeded(9));
    const entry = db.prepare('SELECT round, status FROM matchup_entries WHERE tournament_id = ? AND photo_id = 5').get(t) as any;
    expect(entry.round).toBe(1);
    expect(['waiting', 'playing']).toContain(entry.status);
  });

  it('drops a photo that is no longer eligible and never picks it', async () => {
    const db = migratedDb();
    const first = await selectBracketPair(d1(db), [1, 2, 3, 4], seeded(5));
    const retired = first!.photoAId;
    const rest = [1, 2, 3, 4].filter((id) => id !== retired);
    // The pair is replaced after `retired` is excluded.
    const again = await selectBracketPair(d1(db), rest, seeded(5));
    expect(again).not.toBeNull();
    expect([again!.photoAId, again!.photoBId]).not.toContain(retired);
    const entry = db.prepare('SELECT status FROM matchup_entries WHERE photo_id = ?').get(retired) as any;
    expect(entry.status).toBe('removed');
  });

  it('ends the tournament with co-champions when a round eliminates nobody', async () => {
    const db = migratedDb();
    const eligible = [1, 2];
    await playWeek(db, eligible, { a: 2, b: 2 }); // the only game ties
    await finalizeClosedMatchups(d1(db));
    const next = await selectBracketPair(d1(db), eligible, seeded(1)); // completes, then restarts
    const done = db.prepare("SELECT champion_photo_ids FROM matchup_tournaments WHERE status = 'complete'").get() as any;
    expect(JSON.parse(done.champion_photo_ids).sort()).toEqual([1, 2]);
    expect(next).not.toBeNull();
  });

  it('keeps a single active tournament', async () => {
    const db = migratedDb();
    await playWeek(db, [1, 2, 3, 4], { a: 2, b: 1 });
    await playWeek(db, [1, 2, 3, 4], { a: 2, b: 1 });
    const active = db.prepare("SELECT COUNT(*) AS n FROM matchup_tournaments WHERE status = 'active'").get() as any;
    expect(active.n).toBe(1);
  });

  it('migration backfills past results from stored votes and leaves cleared weeks blank', () => {
    const db = new DatabaseSync(':memory:');
    const files = fs.readdirSync(MIGRATIONS_DIR).filter((n) => n.endsWith('.sql')).sort();
    for (const f of files.filter((n) => n < '0089')) db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8'));
    db.exec(`
      INSERT INTO weekly_matchups (week_start, photo_a_id, photo_b_id, status) VALUES ('2026-10-12', 1, 2, 'closed');
      INSERT INTO weekly_matchups (week_start, photo_a_id, photo_b_id, status) VALUES ('2026-10-19', 3, 4, 'closed');
      INSERT INTO weekly_matchups (week_start, photo_a_id, photo_b_id, status) VALUES ('2026-10-26', 5, 6, 'closed');
      INSERT INTO weekly_votes (week_start, choice, source_hash) VALUES ('2026-10-12', 'a', 'x1');
      INSERT INTO weekly_votes (week_start, choice, source_hash) VALUES ('2026-10-12', 'a', 'x2');
      INSERT INTO weekly_votes (week_start, choice, source_hash) VALUES ('2026-10-12', 'b', 'x3');
      INSERT INTO weekly_votes (week_start, choice, source_hash) VALUES ('2026-10-26', 'a', 'y1');
      INSERT INTO weekly_votes (week_start, choice, source_hash) VALUES ('2026-10-26', 'b', 'y2');
    `);
    db.exec(fs.readFileSync(path.join(MIGRATIONS_DIR, files.find((n) => n.startsWith('0089'))!), 'utf8'));
    const rows = db.prepare('SELECT week_start, votes_a, votes_b, outcome, tournament_id FROM weekly_matchups ORDER BY week_start').all() as any[];
    expect(rows[0]).toMatchObject({ votes_a: 2, votes_b: 1, outcome: 'a', tournament_id: null });
    expect(rows[1].outcome).toBeNull(); // votes were cleared: no false tie
    expect(rows[2]).toMatchObject({ votes_a: 1, votes_b: 1, outcome: 'tie' });
  });
});
