import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  onRequestGet as publicMatchupCurrentGet,
  selectTwoPhotoIds,
  MATCHUP_WEEK_START_SQL,
  computeWeekStart,
} from '../functions/api/matchup/current';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

type MatchupRow = {
  id: number;
  week_start: string;
  photo_a_id: number;
  photo_b_id: number;
  status: string;
  created_at?: string;
};

type PhotoRow = {
  id: number;
  url: string;
  is_memorabilia: number;
  is_matchup_eligible: number;
  description?: string;
  title?: string;
  rights_hold?: number;
  publication_eligible?: number;
};

type PhotoInput = Omit<PhotoRow, 'is_matchup_eligible'> & { is_matchup_eligible?: number };

/** Mirrors SQLite date(ymd, '-6 days', 'weekday 1') for focused week-start tests. */
function weekStartFromCalendarDate(ymd: string): string {
  const addDays = (base: string, days: number): string => {
    const d = new Date(`${base}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const sqliteWeekday1 = (base: string): string => {
    const d = new Date(`${base}T12:00:00Z`);
    const dow = d.getUTCDay();
    if (dow === 1) return base;
    const daysUntil = dow === 0 ? 1 : 8 - dow;
    d.setUTCDate(d.getUTCDate() + daysUntil);
    return d.toISOString().slice(0, 10);
  };
  return sqliteWeekday1(addDays(ymd, -6));
}

function sqliteMasterResults() {
  return { results: [{ name: 'weekly_matchups' }, { name: 'weekly_votes' }, { name: 'photos' }] };
}

function makeWeekStartDb(nowYmd: string) {
  const expected = weekStartFromCalendarDate(nowYmd);
  const db = {
    prepare: vi.fn((sql: string) => ({
      bind: (...args: unknown[]) => ({
        first: async () => runFirst(sql, args),
        all: async () => runAll(sql, args),
      }),
      first: async () => runFirst(sql, []),
      all: async () => runAll(sql, []),
    })),
  };

  function runFirst(sql: string, _args: unknown[]) {
    if (sql === MATCHUP_WEEK_START_SQL || sql.includes("date('now'")) {
      return { week_start: expected };
    }
    if (sql.includes('sqlite_master')) {
      return null;
    }
    return null;
  }

  function runAll(sql: string, _args: unknown[]) {
    if (sql.includes('sqlite_master')) {
      return sqliteMasterResults();
    }
    return { results: [] };
  }

  return { db, expected };
}

function makeRotationDb(options: {
  weekStart?: string;
  matchups?: MatchupRow[];
  photos?: PhotoInput[];
  votes?: Array<{ week_start: string; choice: 'a' | 'b'; source_hash?: string }>;
  simulateInsertRace?: boolean;
}) {
  const weekStart = options.weekStart ?? '2026-06-30';
  const matchups = [...(options.matchups ?? [])];
  const photos: PhotoRow[] = [...(options.photos ?? [])].map((row) => ({
    ...row,
    is_matchup_eligible: row.is_matchup_eligible ?? 0,
  }));
  const votes = [...(options.votes ?? [])];

  const db = {
    prepare: vi.fn((sql: string) => ({
      bind: (...args: unknown[]) => ({
        first: async () => runFirst(sql, args),
        all: async () => runAll(sql, args),
        run: async () => runWrite(sql, args),
      }),
      first: async () => runFirst(sql, []),
      all: async () => runAll(sql, []),
      run: async () => runWrite(sql, []),
    })),
  };

  function runFirst(sql: string, args: unknown[]) {
    if (sql === MATCHUP_WEEK_START_SQL || sql.includes("date('now'")) {
      return { week_start: weekStart };
    }

    if (sql.includes('sqlite_master')) {
      return null;
    }

    if (sql.includes("status = 'active'") && sql.includes('week_start = ?')) {
      const targetWeek = String(args[0]);
      return matchups.find((row) => row.week_start === targetWeek && row.status === 'active') ?? null;
    }

    if (sql.includes('FROM photos WHERE id = ?') && sql.includes('is_matchup_eligible')) {
      const photo = photos.find((row) => Number(row.id) === Number(args[0]));
      return {
        is_matchup_eligible: photo?.is_matchup_eligible ?? 0,
        rights_hold: Number((photo as { rights_hold?: number } | undefined)?.rights_hold ?? 0),
        publication_eligible: Number(
          (photo as { publication_eligible?: number } | undefined)?.publication_eligible ?? 1,
        ),
      };
    }

    if (sql.includes('FROM weekly_matchups WHERE week_start = ?') && sql.includes('LIMIT 1')) {
      const targetWeek = String(args[0]);
      return matchups.find((row) => row.week_start === targetWeek) ?? null;
    }

    return null;
  }

  function runAll(sql: string, args: unknown[]) {
    if (sql.includes('sqlite_master')) {
      return sqliteMasterResults();
    }

    if (sql.includes('FROM weekly_matchups ORDER BY week_start DESC')) {
      const limit = Number(args[0] ?? 8);
      return {
        results: [...matchups]
          .sort((a, b) => b.week_start.localeCompare(a.week_start))
          .slice(0, limit)
          .map((row) => ({ photo_a_id: row.photo_a_id, photo_b_id: row.photo_b_id })),
      };
    }

    if (sql.includes('FROM photos WHERE url IS NOT NULL')) {
      return {
        results: photos.filter(
          (row) =>
            row.is_matchup_eligible >= 0 &&
            Number((row as { publication_eligible?: number }).publication_eligible ?? 1) === 1 &&
            Number((row as { rights_hold?: number }).rights_hold ?? 0) === 0,
        ),
      };
    }

    return { results: [] };
  }

  function runWrite(sql: string, args: unknown[]) {
    if (sql.includes("SET status='closed' WHERE status='active' AND week_start != ?")) {
      const keepWeek = String(args[0]);
      matchups.forEach((row) => {
        if (row.status === 'active' && row.week_start !== keepWeek) {
          row.status = 'closed';
        }
      });
      return { meta: { changes: 1 } };
    }

    if (sql.includes('UPDATE weekly_matchups SET photo_a_id')) {
      const target = matchups.find((row) => Number(row.id) === Number(args[2]));
      if (target) {
        target.photo_a_id = Number(args[0]);
        target.photo_b_id = Number(args[1]);
        target.status = 'active';
      }
      return { meta: { changes: 1 } };
    }

    if (sql.includes('UPDATE photos') && sql.includes('is_matchup_eligible')) {
      const target = photos.find((row) => Number(row.id) === Number(args[3]));
      if (target) {
        target.is_matchup_eligible = Number(args[0]);
      }
      return { meta: { changes: 1 } };
    }

    if (sql.includes('DELETE FROM weekly_votes WHERE week_start')) {
      const targetWeek = String(args[0]);
      let removed = 0;
      for (let i = votes.length - 1; i >= 0; i -= 1) {
        if (votes[i].week_start === targetWeek) {
          votes.splice(i, 1);
          removed += 1;
        }
      }
      return { meta: { changes: removed } };
    }

    if (sql.includes('INSERT INTO weekly_matchups')) {
      const nextWeek = String(args[0]);
      if (options.simulateInsertRace) {
        if (!matchups.some((row) => row.week_start === nextWeek)) {
          matchups.push({
            id: 99,
            week_start: nextWeek,
            photo_a_id: Number(args[1]),
            photo_b_id: Number(args[2]),
            status: 'active',
          });
        }
        throw new Error('UNIQUE constraint failed: weekly_matchups.week_start');
      }
      if (matchups.some((row) => row.week_start === nextWeek)) {
        throw new Error('UNIQUE constraint failed: weekly_matchups.week_start');
      }
      const id = matchups.length + 1;
      matchups.push({
        id,
        week_start: nextWeek,
        photo_a_id: Number(args[1]),
        photo_b_id: Number(args[2]),
        status: 'active',
        created_at: '2026-06-30T12:00:00Z',
      });
      return { meta: { last_row_id: id, changes: 1 } };
    }

    return { meta: { changes: 0 } };
  }

  return { db, matchups, photos, votes, weekStart };
}

function mockPhotoFetch(
  photoMap: Record<number, { url: string; description?: string; title?: string }>,
  options?: { missingUrls?: string[] },
) {
  const missing = new Set(options?.missingUrls ?? []);
  return vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
    const url = String(input);
    const method = String(init?.method || 'GET').toUpperCase();
    const getMatch = url.match(/\/api\/photos\/get\?id=(\d+)/);
    if (getMatch) {
      const id = Number(getMatch[1]);
      const photo = photoMap[id];
      if (!photo) {
        return Promise.resolve(jsonResponse({ ok: false, item: null }, 404));
      }
      return Promise.resolve(jsonResponse({ ok: true, item: { id, ...photo } }));
    }
    // Object-existence probes from GET /api/matchup/current (#2519).
    if (method === 'HEAD' || method === 'GET') {
      if ([...missing].some((path) => url.includes(path))) {
        return Promise.resolve(jsonResponse({}, 404));
      }
      const knownUrls = Object.values(photoMap).map((photo) => photo.url);
      if (knownUrls.some((known) => url === known || url.endsWith(known) || known.endsWith(url))) {
        return Promise.resolve(jsonResponse({}, 200));
      }
    }
    return Promise.reject(new Error(`Unexpected fetch: ${url}`));
  });
}

describe('computeWeekStart', () => {
  it('uses Monday-inclusive SQL (not previous-Monday on Monday)', () => {
    expect(MATCHUP_WEEK_START_SQL).toContain("-6 days','weekday 1");
    expect(MATCHUP_WEEK_START_SQL).not.toContain('-7 days');
  });

  it.each([
    ['Monday', '2026-07-06', '2026-07-06'],
    ['Tuesday', '2026-07-07', '2026-07-06'],
    ['Sunday', '2026-07-05', '2026-06-29'],
  ])('resolves %s (%s) to week_start %s', async (_label, nowYmd, expectedWeekStart) => {
    const { db, expected } = makeWeekStartDb(nowYmd);
    expect(expected).toBe(expectedWeekStart);
    await expect(computeWeekStart(db)).resolves.toBe(expectedWeekStart);
  });
});

describe('selectTwoPhotoIds', () => {
  it('excludes recent photo IDs when enough alternatives exist', () => {
    const photos: PhotoInput[] = [
      { id: 1, url: '/photos/1.jpg', is_memorabilia: 0 },
      { id: 2, url: '/photos/2.jpg', is_memorabilia: 0 },
      { id: 3, url: '/photos/3.jpg', is_memorabilia: 0 },
      { id: 4, url: '/photos/4.jpg', is_memorabilia: 0 },
    ];
    const recentIds = new Set([1, 2]);

    const picked = selectTwoPhotoIds(
      photos.map((row) => ({ ...row, is_matchup_eligible: row.is_matchup_eligible ?? 0 })),
      recentIds,
    );
    expect(picked).not.toBeNull();
    expect(recentIds.has(picked![0])).toBe(false);
    expect(recentIds.has(picked![1])).toBe(false);
  });

  it('retries without recent-use exclusion when exclusion leaves fewer than two photos', () => {
    const photos: PhotoInput[] = [
      { id: 10, url: '/photos/10.jpg', is_memorabilia: 0 },
      { id: 11, url: '/photos/11.jpg', is_memorabilia: 0 },
    ];
    const recentIds = new Set([10, 11]);

    const picked = selectTwoPhotoIds(
      photos.map((row) => ({ ...row, is_matchup_eligible: row.is_matchup_eligible ?? 0 })),
      recentIds,
    );
    expect(picked).toEqual(expect.arrayContaining([10, 11]));
    expect(picked).toHaveLength(2);
  });
});

describe('public matchup current rotation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the existing current-week active matchup when present', async () => {
    const currentWeek = '2026-06-30';
    const { db, weekStart } = makeRotationDb({
      weekStart: currentWeek,
      matchups: [
        {
          id: 7,
          week_start: currentWeek,
          photo_a_id: 101,
          photo_b_id: 102,
          status: 'active',
        },
      ],
    });

    mockPhotoFetch({
      101: { url: '/photos/101.jpg', title: 'Photo A' },
      102: { url: '/photos/102.jpg', title: 'Photo B' },
    });

    const response = await publicMatchupCurrentGet({
      request: new Request('https://www.lougehrigfanclub.com/api/matchup/current'),
      env: { DB: db },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      week_start: weekStart,
      matchup_id: 7,
      items: [
        { id: 101, url: '/photos/101.jpg' },
        { id: 102, url: '/photos/102.jpg' },
      ],
    });
  });

  it('probes object URLs but does not mutate the pair when Photo B is missing (#3028)', async () => {
    const currentWeek = '2026-06-30';
    const { db, matchups, photos, votes, weekStart } = makeRotationDb({
      weekStart: currentWeek,
      matchups: [
        {
          id: 8,
          week_start: currentWeek,
          photo_a_id: 201,
          photo_b_id: 202,
          status: 'active',
        },
      ],
      votes: [
        { week_start: currentWeek, choice: 'b', source_hash: 'hash-b' },
      ],
      photos: [
        { id: 201, url: '/photos/201.jpg', is_memorabilia: 0, is_matchup_eligible: 1 },
        { id: 202, url: '/photos/202-missing.jpg', is_memorabilia: 0, is_matchup_eligible: 1 },
        { id: 203, url: '/photos/203.jpg', is_memorabilia: 0, is_matchup_eligible: 1 },
        { id: 204, url: '/photos/204.jpg', is_memorabilia: 0, is_matchup_eligible: 1 },
      ],
    });

    vi.spyOn(Math, 'random').mockReturnValue(0);
    mockPhotoFetch(
      {
        201: { url: '/photos/201.jpg' },
        202: { url: '/photos/202-missing.jpg' },
        203: { url: '/photos/203.jpg' },
        204: { url: '/photos/204.jpg' },
      },
      { missingUrls: ['202-missing'] },
    );

    const response = await publicMatchupCurrentGet({
      request: new Request('https://www.lougehrigfanclub.com/api/matchup/current'),
      env: { DB: db },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.mutated).toBe(false);
    expect(body.mutation_blocked).toBe(true);
    expect(body.probe_warning).toBe(true);
    expect(body.probe_failed_photo_id).toBe(202);
    expect(body.week_start).toBe(weekStart);
    expect(body.items).toHaveLength(2);
    expect(body.items.map((item: { id: number }) => item.id)).toEqual([201, 202]);
    expect(photos.find((row) => row.id === 202)?.is_matchup_eligible).toBe(1);
    expect(matchups[0].photo_b_id).toBe(202);
    expect(votes).toHaveLength(1);
  });

  it('closes stale active matchups and creates a new current-week matchup', async () => {
    const { db, matchups, weekStart } = makeRotationDb({
      matchups: [
        {
          id: 1,
          week_start: '2026-06-23',
          photo_a_id: 1,
          photo_b_id: 2,
          status: 'active',
        },
      ],
      photos: [
        { id: 21, url: '/photos/21.jpg', is_memorabilia: 0 },
        { id: 22, url: '/photos/22.jpg', is_memorabilia: 0 },
        { id: 23, url: '/photos/23.jpg', is_memorabilia: 0 },
      ],
    });

    vi.spyOn(Math, 'random').mockReturnValue(0);
    mockPhotoFetch({
      21: { url: '/photos/21.jpg' },
      22: { url: '/photos/22.jpg' },
      23: { url: '/photos/23.jpg' },
    });

    const response = await publicMatchupCurrentGet({
      request: new Request('https://www.lougehrigfanclub.com/api/matchup/current'),
      env: { DB: db },
    });

    expect(response.status).toBe(200);
    expect(matchups.find((row) => row.id === 1)?.status).toBe('closed');
    expect(matchups.some((row) => row.week_start === weekStart && row.status === 'active')).toBe(true);

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.week_start).toBe(weekStart);
    expect(body.items).toHaveLength(2);
    expect(body.items.every((item: { url: string }) => item.url.startsWith('/photos/'))).toBe(true);
  });

  it('re-reads the existing matchup when a duplicate week_start insert race occurs', async () => {
    const { db, matchups, weekStart } = makeRotationDb({
      simulateInsertRace: true,
      photos: [
        { id: 31, url: '/photos/31.jpg', is_memorabilia: 0 },
        { id: 32, url: '/photos/32.jpg', is_memorabilia: 0 },
        { id: 33, url: '/photos/33.jpg', is_memorabilia: 0 },
      ],
    });

    vi.spyOn(Math, 'random').mockReturnValue(0);
    mockPhotoFetch({
      31: { url: '/photos/31.jpg' },
      32: { url: '/photos/32.jpg' },
      33: { url: '/photos/33.jpg' },
    });

    const response = await publicMatchupCurrentGet({
      request: new Request('https://www.lougehrigfanclub.com/api/matchup/current'),
      env: { DB: db },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    const raced = matchups.find((row) => row.id === 99);
    expect(body).toMatchObject({
      ok: true,
      week_start: weekStart,
      matchup_id: 99,
    });
    expect(body.items).toHaveLength(2);
    expect(body.items.map((item: { id: number }) => item.id).sort()).toEqual(
      [Number(raced?.photo_a_id), Number(raced?.photo_b_id)].sort(),
    );
  });

  it('returns ok:true with empty items when fewer than two eligible photos exist', async () => {
    const { db, weekStart } = makeRotationDb({
      photos: [{ id: 50, url: '/photos/50.jpg', is_memorabilia: 0 }],
    });

    mockPhotoFetch({
      50: { url: '/photos/50.jpg' },
    });

    const response = await publicMatchupCurrentGet({
      request: new Request('https://www.lougehrigfanclub.com/api/matchup/current'),
      env: { DB: db },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      week_start: weekStart,
      matchup_id: null,
      items: [],
    });
  });

  it('returns exactly two normalized photo URLs when a new matchup is created', async () => {
    const { db, weekStart } = makeRotationDb({
      photos: [
        { id: 61, url: '/photos/61.jpg', is_memorabilia: 0 },
        { id: 62, url: '/photos/62.jpg', is_memorabilia: 0 },
      ],
    });

    vi.spyOn(Math, 'random').mockReturnValue(0);
    mockPhotoFetch({
      61: { url: 'https://cdn.example.com/photos/61.jpg', title: 'A' },
      62: { url: 'https://cdn.example.com/photos/62.jpg', title: 'B' },
    });

    const response = await publicMatchupCurrentGet({
      request: new Request('https://www.lougehrigfanclub.com/api/matchup/current'),
      env: { DB: db },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.week_start).toBe(weekStart);
    expect(body.items).toHaveLength(2);
    expect(body.items[0].url).toMatch(/^https:\/\//);
    expect(body.items[1].url).toMatch(/^https:\/\//);
  });

  it('replaces an active matchup photo when it is flagged ineligible in D1', async () => {
    const currentWeek = '2026-06-29';
    const { db, matchups, votes, weekStart } = makeRotationDb({
      weekStart: currentWeek,
      matchups: [
        {
          id: 3,
          week_start: currentWeek,
          photo_a_id: 254,
          photo_b_id: 348,
          status: 'active',
        },
      ],
      votes: [
        { week_start: currentWeek, choice: 'a', source_hash: 'hash-a' },
        { week_start: currentWeek, choice: 'b', source_hash: 'hash-b' },
      ],
      photos: [
        { id: 254, url: '/photos/254.jpg', is_memorabilia: 0, is_matchup_eligible: 0 },
        { id: 348, url: '/photos/IMG_4026.jpeg', is_memorabilia: 0, is_matchup_eligible: -1 },
        { id: 347, url: '/photos/347.jpg', is_memorabilia: 0, is_matchup_eligible: 0 },
        { id: 346, url: '/photos/346.jpg', is_memorabilia: 0, is_matchup_eligible: 0 },
      ],
    });

    vi.spyOn(Math, 'random').mockReturnValue(0);
    mockPhotoFetch({
      254: { url: '/photos/254.jpg' },
      347: { url: '/photos/347.jpg' },
      346: { url: '/photos/346.jpg' },
      348: { url: '/photos/IMG_4026.jpeg' },
    });

    const response = await publicMatchupCurrentGet({
      request: new Request('https://www.lougehrigfanclub.com/api/matchup/current'),
      env: { DB: db },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.week_start).toBe(weekStart);
    expect(body.items).toHaveLength(2);
    expect(body.items.map((item: { id: number }) => item.id)).not.toContain(348);
    expect(matchups.find((row) => row.id === 3)?.photo_b_id).not.toBe(348);
    expect(votes.filter((row) => row.week_start === currentWeek)).toHaveLength(0);
  });

  it('returns structured 503 when D1 binding is missing', async () => {
    const response = await publicMatchupCurrentGet({
      request: new Request('https://www.lougehrigfanclub.com/api/matchup/current'),
      env: {},
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Database unavailable',
    });
  });

  it('fetches Photo A and Photo B in parallel', async () => {
    const currentWeek = '2026-06-30';
    const { db } = makeRotationDb({
      weekStart: currentWeek,
      matchups: [
        {
          id: 7,
          week_start: currentWeek,
          photo_a_id: 101,
          photo_b_id: 102,
          status: 'active',
        },
      ],
    });

    let inFlight = 0;
    let maxInFlight = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const url = String(input);
      const method = String(init?.method || 'GET').toUpperCase();
      const getMatch = url.match(/\/api\/photos\/get\?id=(\d+)/);
      if (getMatch) {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        const id = Number(getMatch[1]);
        return new Promise((resolve) => {
          setTimeout(() => {
            inFlight -= 1;
            resolve(
              jsonResponse({
                ok: true,
                item: { id, url: `/photos/${id}.jpg` },
              }),
            );
          }, 20);
        });
      }
      if ((method === 'HEAD' || method === 'GET') && url.includes('/photos/')) {
        return Promise.resolve(jsonResponse({}, 200));
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    const response = await publicMatchupCurrentGet({
      request: new Request('https://www.lougehrigfanclub.com/api/matchup/current'),
      env: { DB: db },
    });

    expect(response.status).toBe(200);
    expect(maxInFlight).toBe(2);
  });

  it('does not select photos that are not publication_eligible (#3553)', async () => {
    const currentWeek = '2026-06-30';
    const { db, matchups } = makeRotationDb({
      weekStart: currentWeek,
      matchups: [],
      photos: [
        {
          id: 501,
          url: '/photos/501.jpg',
          is_memorabilia: 0,
          is_matchup_eligible: 1,
          publication_eligible: 0,
          rights_hold: 1,
        },
        {
          id: 502,
          url: '/photos/502.jpg',
          is_memorabilia: 0,
          is_matchup_eligible: 1,
          publication_eligible: 0,
          rights_hold: 1,
        },
      ],
    });

    const response = await publicMatchupCurrentGet({
      request: new Request('https://www.lougehrigfanclub.com/api/matchup/current'),
      env: { DB: db },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      week_start: currentWeek,
      matchup_id: null,
      items: [],
    });
    expect(matchups).toEqual([]);
  });
});
