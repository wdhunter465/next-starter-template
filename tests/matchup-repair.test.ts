import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  onRequestGet as matchupCurrentGet,
  MATCHUP_WEEK_START_SQL,
  MATCHUP_EXCLUDED_ELIGIBILITY,
} from '../functions/api/matchup/current';
import { onRequestPost as matchupRepairPost } from '../functions/api/matchup/repair';
import { onRequestPost as adminMatchupRepairPost } from '../functions/api/admin/matchup/repair';

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
};

type PhotoRow = {
  id: number;
  url: string;
  is_memorabilia: number;
  is_matchup_eligible: number;
  rights_notes?: string | null;
};

function makeRepairDb(options: {
  weekStart: string;
  matchups: MatchupRow[];
  photos: PhotoRow[];
  votes?: Array<{ week_start: string }>;
}) {
  const matchups = [...options.matchups];
  const photos = [...options.photos];
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
    batch: async (statements: Array<{ run: () => Promise<unknown> }>) => {
      const results = [];
      for (const statement of statements) {
        results.push(await statement.run());
      }
      return results;
    },
  };

  function runFirst(sql: string, args: unknown[]) {
    if (sql === MATCHUP_WEEK_START_SQL || sql.includes("date('now'")) {
      return { week_start: options.weekStart };
    }
    if (sql.includes('sqlite_master')) return null;
    if (sql.includes("status = 'active'") && sql.includes('week_start = ?')) {
      return matchups.find((row) => row.week_start === String(args[0]) && row.status === 'active') ?? null;
    }
    if (sql.includes('FROM photos WHERE id = ?') && sql.includes('is_matchup_eligible')) {
      const photo = photos.find((row) => Number(row.id) === Number(args[0]));
      return photo ? { is_matchup_eligible: photo.is_matchup_eligible } : null;
    }
    if (sql.includes('FROM weekly_matchups WHERE week_start = ?') && sql.includes('LIMIT 1')) {
      return matchups.find((row) => row.week_start === String(args[0])) ?? null;
    }
    return null;
  }

  function runAll(sql: string, args: unknown[]) {
    if (sql.includes('sqlite_master')) {
      return { results: [{ name: 'weekly_matchups' }, { name: 'weekly_votes' }, { name: 'photos' }] };
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
      return { results: photos.filter((row) => row.is_matchup_eligible >= 0) };
    }
    return { results: [] };
  }

  function runWrite(sql: string, args: unknown[]) {
    if (sql.includes('UPDATE photos') && sql.includes('is_matchup_eligible')) {
      const target = photos.find((row) => Number(row.id) === Number(args[3]));
      if (target) {
        target.is_matchup_eligible = Number(args[0]);
        target.rights_notes = String(args[1]);
      }
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
    if (sql.includes('DELETE FROM weekly_votes WHERE week_start')) {
      const week = String(args[0]);
      let removed = 0;
      for (let i = votes.length - 1; i >= 0; i -= 1) {
        if (votes[i].week_start === week) {
          votes.splice(i, 1);
          removed += 1;
        }
      }
      return { meta: { changes: removed } };
    }
    return { meta: { changes: 0 } };
  }

  return { db, matchups, photos, votes };
}

describe('matchup broken-image repair', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('public repair (HTTP adapter) audits but does not mutate the pair or clear votes, and ignores a spoofed source_issue (#3028, #3030)', async () => {
    const weekStart = '2026-07-13';
    const { db, matchups, photos, votes } = makeRepairDb({
      weekStart,
      matchups: [
        { id: 5, week_start: weekStart, photo_a_id: 10, photo_b_id: 20, status: 'active' },
      ],
      votes: [{ week_start: weekStart }, { week_start: weekStart }],
      photos: [
        { id: 10, url: 'https://example.test/10.jpg', is_memorabilia: 0, is_matchup_eligible: 1 },
        { id: 20, url: 'https://example.test/20-missing.jpg', is_memorabilia: 0, is_matchup_eligible: 1 },
        { id: 30, url: 'https://example.test/30.jpg', is_memorabilia: 0, is_matchup_eligible: 1 },
        { id: 40, url: 'https://example.test/40.jpg', is_memorabilia: 0, is_matchup_eligible: 1 },
      ],
    });

    vi.spyOn(Math, 'random').mockReturnValue(0);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method || 'GET').toUpperCase();
      if (method === 'HEAD' || (method === 'GET' && url.includes('example.test'))) {
        if (url.includes('20-missing')) return jsonResponse({}, 404);
        return jsonResponse({}, 200);
      }
      const getMatch = url.match(/\/api\/photos\/get\?id=(\d+)/);
      if (getMatch) {
        const id = Number(getMatch[1]);
        const photo = photos.find((row) => row.id === id);
        if (!photo || photo.is_matchup_eligible < 0) return jsonResponse({ ok: false }, 404);
        return jsonResponse({ ok: true, item: { id: photo.id, url: photo.url } });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    // A public caller attempts to spoof an authorized-looking source_issue;
    // it must never reach the audit trail (#3030).
    const response = await matchupRepairPost({
      request: new Request('https://www.lougehrigfanclub.com/api/matchup/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broken_photo_id: 20, source_issue: '9999' }),
      }),
      env: { DB: db },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.repaired).toBe(false);
    expect(body.mutated).toBe(false);
    expect(body.mutation_blocked).toBe(true);
    expect(body.items).toHaveLength(2);
    expect(body.items.map((item: { id: number }) => item.id)).toEqual([10, 20]);
    expect(photos.find((row) => row.id === 20)?.is_matchup_eligible).toBe(1);
    expect(matchups[0].photo_b_id).toBe(20);
    expect(votes).toHaveLength(2);

    const auditLine = logSpy.mock.calls.map((call) => String(call[0])).find((line) => line.includes('matchup_repair_audit'));
    expect(auditLine).toBeTruthy();
    const audit = JSON.parse(auditLine!);
    expect(audit.trigger).toBe('public_repair_post');
    expect(audit.broken_photo_id).toBe(20);
    expect(audit.slot).toBe('b');
    expect(audit.mutated).toBe(false);
    expect(audit.mutation_blocked_reason).toBe('public_midweek_mutation_locked_requires_issue_pr');
    // Spoofed client source_issue must never land in the audit trail (#3030).
    expect(audit.source_issue).toBeNull();
  });

  it('admin repair (HTTP adapter) rejects an invalid/missing ADMIN_TOKEN before mutating anything', async () => {
    const weekStart = '2026-07-13';
    const { db, matchups, votes } = makeRepairDb({
      weekStart,
      matchups: [
        { id: 5, week_start: weekStart, photo_a_id: 10, photo_b_id: 20, status: 'active' },
      ],
      votes: [{ week_start: weekStart }, { week_start: weekStart }],
      photos: [
        { id: 10, url: 'https://example.test/10.jpg', is_memorabilia: 0, is_matchup_eligible: 1 },
        { id: 20, url: 'https://example.test/20-missing.jpg', is_memorabilia: 0, is_matchup_eligible: 1 },
      ],
    });

    const response = await adminMatchupRepairPost({
      request: new Request('https://www.lougehrigfanclub.com/api/admin/matchup/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': 'wrong-token' },
        body: JSON.stringify({ broken_photo_id: 20, source_issue: 3028 }),
      }),
      env: { ADMIN_TOKEN: 'secret', DB: db },
    });

    expect(response.status).toBe(401);
    expect(matchups[0].photo_b_id).toBe(20);
    expect(votes).toHaveLength(2);
  });

  it('admin repair (HTTP adapter) with source_issue replaces broken B and clears votes atomically', async () => {
    const weekStart = '2026-07-13';
    const { db, matchups, photos, votes } = makeRepairDb({
      weekStart,
      matchups: [
        { id: 5, week_start: weekStart, photo_a_id: 10, photo_b_id: 20, status: 'active' },
      ],
      votes: [{ week_start: weekStart }, { week_start: weekStart }],
      photos: [
        { id: 10, url: 'https://example.test/10.jpg', is_memorabilia: 0, is_matchup_eligible: 1 },
        { id: 20, url: 'https://example.test/20-missing.jpg', is_memorabilia: 0, is_matchup_eligible: 1 },
        { id: 30, url: 'https://example.test/30.jpg', is_memorabilia: 0, is_matchup_eligible: 1 },
        { id: 40, url: 'https://example.test/40.jpg', is_memorabilia: 0, is_matchup_eligible: 1 },
      ],
    });

    vi.spyOn(Math, 'random').mockReturnValue(0);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = String(init?.method || 'GET').toUpperCase();
      if (method === 'HEAD' || (method === 'GET' && url.includes('example.test'))) {
        if (url.includes('20-missing')) return jsonResponse({}, 404);
        return jsonResponse({}, 200);
      }
      const getMatch = url.match(/\/api\/photos\/get\?id=(\d+)/);
      if (getMatch) {
        const id = Number(getMatch[1]);
        const photo = photos.find((row) => row.id === id);
        if (!photo || photo.is_matchup_eligible < 0) return jsonResponse({ ok: false }, 404);
        return jsonResponse({ ok: true, item: { id: photo.id, url: photo.url } });
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    const response = await adminMatchupRepairPost({
      request: new Request('https://www.lougehrigfanclub.com/api/admin/matchup/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': 'secret' },
        body: JSON.stringify({ broken_photo_id: 20, source_issue: 3028 }),
      }),
      env: { ADMIN_TOKEN: 'secret', DB: db },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.repaired).toBe(true);
    expect(body.mutated).toBe(true);
    expect(body.vote_restore_possible).toBe(false);
    expect(body.source_issue).toBe('#3028');
    expect(body.items[0].id).toBe(10);
    expect(body.items.map((item: { id: number }) => item.id)).not.toContain(20);
    expect(photos.find((row) => row.id === 20)?.is_matchup_eligible).toBe(MATCHUP_EXCLUDED_ELIGIBILITY);
    expect(matchups[0].photo_b_id).not.toBe(20);
    expect(votes).toHaveLength(0);

    const auditLine = logSpy.mock.calls.map((call) => String(call[0])).find((line) => line.includes('matchup_repair_audit'));
    const audit = JSON.parse(auditLine!);
    expect(audit.trigger).toBe('admin_authorized');
    expect(audit.mutated).toBe(true);
    expect(audit.votes_cleared).toBe(true);
    expect(audit.source_issue).toBe('#3028');
  });

  it('admin repair (HTTP adapter) audits a rejected attempt with a missing source_issue and does not mutate', async () => {
    const weekStart = '2026-07-13';
    const { db, matchups, votes } = makeRepairDb({
      weekStart,
      matchups: [
        { id: 5, week_start: weekStart, photo_a_id: 10, photo_b_id: 20, status: 'active' },
      ],
      votes: [{ week_start: weekStart }, { week_start: weekStart }],
      photos: [
        { id: 10, url: 'https://example.test/10.jpg', is_memorabilia: 0, is_matchup_eligible: 1 },
        { id: 20, url: 'https://example.test/20-missing.jpg', is_memorabilia: 0, is_matchup_eligible: 1 },
      ],
    });

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const response = await adminMatchupRepairPost({
      request: new Request('https://www.lougehrigfanclub.com/api/admin/matchup/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': 'secret' },
        body: JSON.stringify({ broken_photo_id: 20 }),
      }),
      env: { ADMIN_TOKEN: 'secret', DB: db },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: 'source_issue_required' });
    expect(matchups[0].photo_b_id).toBe(20);
    expect(votes).toHaveLength(2);

    // #3030: rejected admin attempts must stay visible in the audit trail.
    const auditLine = logSpy.mock.calls.map((call) => String(call[0])).find((line) => line.includes('matchup_repair_audit'));
    expect(auditLine).toBeTruthy();
    const audit = JSON.parse(auditLine!);
    expect(audit.mutation_blocked_reason).toBe('missing_source_issue');
    expect(audit.broken_photo_id).toBe(20);
  });

  it('public GET /api/matchup/current self-heals and audits a pair replacement when an active photo is no longer eligible (#3030)', async () => {
    const weekStart = '2026-07-13';
    const { db, matchups, photos, votes } = makeRepairDb({
      weekStart,
      matchups: [
        { id: 5, week_start: weekStart, photo_a_id: 10, photo_b_id: 20, status: 'active' },
      ],
      votes: [{ week_start: weekStart }, { week_start: weekStart }],
      photos: [
        { id: 10, url: 'https://example.test/10.jpg', is_memorabilia: 0, is_matchup_eligible: 1 },
        // Photo 20 was retired (e.g. by the B2 deletion-reconcile job) after becoming the active pair.
        { id: 20, url: 'https://example.test/20.jpg', is_memorabilia: 0, is_matchup_eligible: -1 },
        { id: 30, url: 'https://example.test/30.jpg', is_memorabilia: 0, is_matchup_eligible: 1 },
        { id: 40, url: 'https://example.test/40.jpg', is_memorabilia: 0, is_matchup_eligible: 1 },
      ],
    });

    vi.spyOn(Math, 'random').mockReturnValue(0);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      const getMatch = url.match(/\/api\/photos\/get\?id=(\d+)/);
      if (getMatch) {
        const id = Number(getMatch[1]);
        const photo = photos.find((row) => row.id === id);
        if (!photo) return jsonResponse({ ok: false }, 404);
        return jsonResponse({ ok: true, item: { id: photo.id, url: photo.url } });
      }
      if (url.includes('example.test')) return jsonResponse({}, 200);
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    const response = await matchupCurrentGet({
      request: new Request('https://www.lougehrigfanclub.com/api/matchup/current'),
      env: { DB: db },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items.map((item: { id: number }) => item.id)).not.toContain(20);

    // This is existing, intentionally tested self-heal behavior (see
    // tests/matchup-current-rotation.test.ts) — a permanently-ineligible
    // photo gets replaced and votes reset. #3030 is that it previously had
    // zero audit trail; now it must be logged.
    expect(matchups[0].photo_b_id).not.toBe(20);
    expect(votes).toHaveLength(0);

    const auditLine = logSpy.mock.calls.map((call) => String(call[0])).find((line) => line.includes('matchup_repair_audit'));
    expect(auditLine).toBeTruthy();
    const audit = JSON.parse(auditLine!);
    expect(audit.trigger).toBe('current_get_eligibility');
    expect(audit.broken_photo_id).toBe(20);
    expect(audit.slot).toBe('b');
    expect(audit.before_photo_a_id).toBe(10);
    expect(audit.before_photo_b_id).toBe(20);
    expect(audit.mutated).toBe(true);
    expect(audit.votes_cleared).toBe(true);
    expect(audit.source_issue).toBeNull();
  });

  it('rejects invalid broken_photo_id through the HTTP adapter', async () => {
    const response = await matchupRepairPost({
      request: new Request('https://www.lougehrigfanclub.com/api/matchup/repair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ broken_photo_id: 'nope' }),
      }),
      env: {
        DB: {
          prepare: vi.fn((sql: string) => ({
            bind: (..._args: unknown[]) => ({
              first: async () => null,
              all: async () => {
                if (sql.includes('sqlite_master')) {
                  return {
                    results: [
                      { name: 'weekly_matchups' },
                      { name: 'weekly_votes' },
                      { name: 'photos' },
                    ],
                  };
                }
                return { results: [] };
              },
              run: async () => ({ meta: { changes: 0 } }),
            }),
            first: async () => null,
            all: async () => ({ results: [] }),
            run: async () => ({ meta: { changes: 0 } }),
          })),
        },
      },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: 'invalid_broken_photo_id' });
  });
});
