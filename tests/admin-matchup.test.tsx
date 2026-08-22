import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminMatchupPage from '@/app/admin/matchup/page';
import { onRequestPost as matchupCloseActivePost } from '../functions/api/admin/matchup/close-active';
import { onRequestPost as matchupCreatePost } from '../functions/api/admin/matchup/create';
import { onRequestGet as matchupListGet } from '../functions/api/admin/matchup/list';
import { onRequestPost as matchupUpdatePost } from '../functions/api/admin/matchup/update';
import { onRequestGet as publicMatchupCurrentGet } from '../functions/api/matchup/current';
import { onRequestGet as publicMatchupResultsGet } from '../functions/api/matchup/results';
import { ADMIN_SESSION_COOKIE, withAdminSession } from './helpers/adminSession';

const mockUsePathname = vi.hoisted(() => vi.fn(() => '/admin/matchup'));

vi.mock('next/navigation', () => ({
  usePathname: mockUsePathname,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function adminGetRequest(path: string, cookie: string | null = ADMIN_SESSION_COOKIE): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  return new Request(`https://www.lougehrigfanclub.com${path}`, { headers });
}

function adminPostRequest(path: string, body: unknown = {}, cookie: string | null = ADMIN_SESSION_COOKIE): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  return new Request(`https://www.lougehrigfanclub.com${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function makeMatchupDb(matchups: Array<Record<string, unknown>> = [], votes: Record<string, { a: number; b: number }> = {}) {
  const makeRun = (sql: string, args: unknown[] = []) => async () => {
    if (sql.includes("SET status='closed' WHERE status='active'") && sql.includes('AND id !=')) {
      const keepId = Number(args[0]);
      matchups.forEach((row) => {
        if (row.status === 'active' && Number(row.id) !== keepId) {
          row.status = 'closed';
        }
      });
      return { meta: { changes: 1 } };
    }
    if (sql.includes("SET status='closed' WHERE status='active'")) {
      matchups.forEach((row) => {
        if (row.status === 'active') row.status = 'closed';
      });
      return { meta: { changes: 1 } };
    }
    if (sql.includes("SET status='active' WHERE id")) {
      const target = matchups.find((row) => Number(row.id) === Number(args[0]));
      if (target) target.status = 'active';
      return { meta: { changes: 1 } };
    }
    if (sql.includes('INSERT INTO weekly_matchups')) {
      const week_start = String(args[0]);
      if (matchups.some((row) => String(row.week_start) === week_start)) {
        throw new Error('UNIQUE constraint failed: weekly_matchups.week_start');
      }
      const id = matchups.length + 1;
      matchups.push({
        id,
        week_start,
        photo_a_id: args[1],
        photo_b_id: args[2],
        status: args[3],
        created_at: '2026-06-03T12:00:00Z',
      });
      return { meta: { last_row_id: id, changes: 1 } };
    }
    if (sql.includes('UPDATE weekly_matchups')) {
      const target = matchups.find((row) => Number(row.id) === Number(args[3]));
      if (target) {
        target.photo_a_id = args[0];
        target.photo_b_id = args[1];
        target.status = args[2];
      }
      return { meta: { changes: 1 } };
    }
    if (sql.includes('DELETE FROM weekly_votes WHERE week_start')) {
      const week = String(args[0]);
      const before = votes[week] || { a: 0, b: 0 };
      const removed = Number(before.a || 0) + Number(before.b || 0);
      delete votes[week];
      return { meta: { changes: removed } };
    }
    return { meta: { changes: 0 } };
  };

  const db = {
    prepare: vi.fn((sql: string) => ({
      bind: (...args: unknown[]) => ({
        all: async () => {
          if (sql.includes('sqlite_master')) {
            return { results: [{ name: 'weekly_matchups' }, { name: 'weekly_votes' }, { name: 'photos' }] };
          }
          if (sql.includes('LEFT JOIN weekly_votes')) {
            const limit = Number(args[0] ?? 50);
            return {
              results: matchups.slice(0, limit).map((row) => {
                const week = String(row.week_start);
                const totals = votes[week] || { a: 0, b: 0 };
                return {
                  ...row,
                  a: totals.a,
                  b: totals.b,
                };
              }),
            };
          }
          if (sql.includes('FROM weekly_matchups') && sql.includes('LIMIT')) {
            return { results: matchups };
          }
          return { results: [] };
        },
        first: async () => {
          if (sql.includes("status='active'") && sql.includes('LIMIT 1') && !sql.includes('UPDATE')) {
            return matchups.find((row) => row.status === 'active') ?? null;
          }
          if (sql.includes("status='closed'") && sql.includes('LIMIT 1') && sql.includes('FROM weekly_matchups')) {
            const closed = matchups
              .filter((row) => row.status === 'closed')
              .sort((a, b) => String(b.week_start).localeCompare(String(a.week_start)));
            return closed[0] ?? null;
          }
          if (sql.includes('FROM weekly_votes') && sql.includes('week_start')) {
            const week = String(args[0]);
            const totals = votes[week] || { a: 0, b: 0 };
            return { a: totals.a, b: totals.b };
          }
          if (sql.includes('FROM weekly_matchups WHERE id')) {
            return matchups.find((row) => Number(row.id) === Number(args[0])) ?? null;
          }
          if (sql.includes('FROM photos WHERE id')) {
            const id = Number(args[0]);
            return Number.isFinite(id) && id > 0 && id < 1000 ? { id } : null;
          }
          return null;
        },
        run: makeRun(sql, args),
      }),
      first: async () => {
        if (sql.includes("status='closed'") && sql.includes('LIMIT 1') && sql.includes('FROM weekly_matchups')) {
          const closed = matchups
            .filter((row) => row.status === 'closed')
            .sort((a, b) => String(b.week_start).localeCompare(String(a.week_start)));
          return closed[0] ?? null;
        }
        if (sql.includes("status='active'") && sql.includes('LIMIT 1') && sql.includes('FROM weekly_matchups')) {
          return matchups.find((row) => row.status === 'active') ?? null;
        }
        return matchups.find((row) => row.status === 'active') ?? null;
      },
      run: makeRun(sql),
    })),
    batch: vi.fn(async (statements: Array<{ run: () => Promise<unknown> }>) => {
      const results = [];
      for (const statement of statements) {
        results.push(await statement.run());
      }
      return results;
    }),
  };

  return { db, matchups };
}

describe('admin matchup page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUsePathname.mockReturnValue('/admin/matchup');
  });

  it('renders admin navigation and loads matchup inventory', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = String(input);

      if (path.startsWith('/api/admin/matchup/list')) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            active: {
              id: 2,
              week_start: '2026-06-01',
              photo_a_id: 10,
              photo_b_id: 11,
              status: 'active',
              created_at: '2026-06-01T12:00:00Z',
              votes: { a: 3, b: 5, total: 8, winner: 'b' },
            },
            items: [
              {
                id: 2,
                week_start: '2026-06-01',
                photo_a_id: 10,
                photo_b_id: 11,
                status: 'active',
                created_at: '2026-06-01T12:00:00Z',
                votes: { a: 3, b: 5, total: 8, winner: 'b' },
              },
            ],
          }),
        );
      }

      if (path === '/api/matchup/current') {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            week_start: '2026-06-01',
            matchup_id: 2,
            items: [
              { id: 10, url: '/photos/10.jpg' },
              { id: 11, url: '/photos/11.jpg' },
            ],
          }),
        );
      }

      if (path.startsWith('/api/matchup/results')) {
        return Promise.resolve(
          jsonResponse({ ok: true, week_start: '2026-06-01', totals: { a: 3, b: 5 }, last_week: null }),
        );
      }

      return Promise.reject(new Error(`Unexpected fetch: ${path}`));
    });

    render(<AdminMatchupPage />);

    expect(screen.getByRole('link', { name: 'Matchup' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Active matchup: week 2026-06-01/i)).toBeInTheDocument();
    });
  });

  it('announces list errors via AdminStatusText alert', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (String(input).startsWith('/api/admin/matchup/list')) {
        return Promise.resolve(jsonResponse({ ok: false, error: 'Database unavailable' }, 503));
      }
      return Promise.reject(new Error(`Unexpected fetch: ${String(input)}`));
    });

    render(<AdminMatchupPage />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Error: Database unavailable');
    });
  });

  it('shows fail-closed public preview when current matchup is unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = String(input);

      if (path.startsWith('/api/admin/matchup/list')) {
        return Promise.resolve(jsonResponse({ ok: true, active: null, items: [] }));
      }

      if (path === '/api/matchup/current') {
        return Promise.resolve(jsonResponse({ ok: true, week_start: null, items: [] }));
      }

      if (path.startsWith('/api/matchup/results')) {
        return Promise.resolve(
          jsonResponse({ ok: true, week_start: null, totals: { a: 0, b: 0 }, last_week: null }),
        );
      }

      return Promise.reject(new Error(`Unexpected fetch: ${path}`));
    });

    render(<AdminMatchupPage />);

    await waitFor(() => {
      expect(screen.getByText(/No active matchup in D1/i)).toBeInTheDocument();
    });
  });

  it('creates a matchup through the admin create API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const path = String(input);

      if (path.startsWith('/api/admin/matchup/list')) {
        return Promise.resolve(jsonResponse({ ok: true, active: null, items: [] }));
      }

      if (path === '/api/admin/matchup/create') {
        expect(init?.method).toBe('POST');
        const body = JSON.parse(String(init?.body));
        expect(body.week_start).toBe('2026-06-08');
        expect(body.photo_a_id).toBe(21);
        expect(body.photo_b_id).toBe(22);
        return Promise.resolve(jsonResponse({ ok: true, id: 9 }));
      }

      if (path === '/api/matchup/current') {
        return Promise.resolve(jsonResponse({ ok: true, week_start: null, items: [] }));
      }

      if (path.startsWith('/api/matchup/results')) {
        return Promise.resolve(
          jsonResponse({ ok: true, week_start: null, totals: { a: 0, b: 0 }, last_week: null }),
        );
      }

      return Promise.reject(new Error(`Unexpected fetch: ${path}`));
    });

    render(<AdminMatchupPage />);

    await waitFor(() => {
      expect(screen.getByText(/No matchup records found/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Week start/i), { target: { value: '2026-06-08' } });
    fireEvent.change(screen.getByLabelText('Photo A ID'), { target: { value: '21' } });
    fireEvent.change(screen.getByLabelText('Photo B ID'), { target: { value: '22' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create matchup' }));

    await waitFor(() => {
      expect(screen.getByText(/Matchup created/i)).toBeInTheDocument();
    });

    expect(fetchMock.mock.calls.some(([path]) => path === '/api/admin/matchup/create')).toBe(true);
  });
});

describe('admin matchup APIs', () => {
  it('rejects unauthenticated list requests', async () => {
    const { db } = makeMatchupDb();
    const response = await matchupListGet({
      request: adminGetRequest('/api/admin/matchup/list', ''),
      env: { DB: withAdminSession(db) },
    });

    expect(response.status).toBe(401);
  });

  it('returns active matchup and vote totals', async () => {
    const { db } = makeMatchupDb(
      [
        {
          id: 1,
          week_start: '2026-06-01',
          photo_a_id: 10,
          photo_b_id: 11,
          status: 'active',
          created_at: '2026-06-01T12:00:00Z',
        },
      ],
      { '2026-06-01': { a: 4, b: 2 } },
    );

    const response = await matchupListGet({
      request: adminGetRequest('/api/admin/matchup/list'),
      env: { DB: withAdminSession(db) },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      active: { week_start: '2026-06-01', votes: { a: 4, b: 2, winner: 'a' } },
    });
  });

  it('creates matchup rows and enforces unique week_start', async () => {
    const { db, matchups } = makeMatchupDb();

    const createResponse = await matchupCreatePost({
      request: adminPostRequest('/api/admin/matchup/create', {
        week_start: '2026-06-08',
        photo_a_id: 3,
        photo_b_id: 4,
        status: 'closed',
      }),
      env: { DB: withAdminSession(db) },
    });

    expect(createResponse.status).toBe(200);
    expect(matchups).toHaveLength(1);

    const duplicate = await matchupCreatePost({
      request: adminPostRequest('/api/admin/matchup/create', {
        week_start: '2026-06-08',
        photo_a_id: 5,
        photo_b_id: 6,
      }),
      env: { DB: withAdminSession(db) },
    });

    expect(duplicate.status).toBe(409);
  });

  it('rejects invalid status values and missing photo ids', async () => {
    const { db } = makeMatchupDb();

    const invalidStatus = await matchupCreatePost({
      request: adminPostRequest('/api/admin/matchup/create', {
        week_start: '2026-06-15',
        photo_a_id: 3,
        photo_b_id: 4,
        status: 'actve',
      }),
      env: { DB: withAdminSession(db) },
    });

    expect(invalidStatus.status).toBe(400);
    await expect(invalidStatus.json()).resolves.toMatchObject({ ok: false, error: 'invalid_status' });

    const missingPhoto = await matchupCreatePost({
      request: adminPostRequest('/api/admin/matchup/create', {
        week_start: '2026-06-15',
        photo_a_id: 99999,
        photo_b_id: 4,
      }),
      env: { DB: withAdminSession(db) },
    });

    expect(missingPhoto.status).toBe(400);
    await expect(missingPhoto.json()).resolves.toMatchObject({ ok: false, error: 'photo_a_not_found' });
  });

  it('activates one matchup and closes others', async () => {
    const { db, matchups } = makeMatchupDb([
      {
        id: 1,
        week_start: '2026-06-01',
        photo_a_id: 10,
        photo_b_id: 11,
        status: 'active',
        created_at: '2026-06-01T12:00:00Z',
      },
      {
        id: 2,
        week_start: '2026-06-08',
        photo_a_id: 20,
        photo_b_id: 21,
        status: 'closed',
        created_at: '2026-06-08T12:00:00Z',
      },
    ]);

    const response = await matchupUpdatePost({
      request: adminPostRequest('/api/admin/matchup/update', { id: 2, status: 'active' }),
      env: { DB: withAdminSession(db) },
    });

    expect(response.status).toBe(200);
    expect(matchups.find((row) => row.id === 1)?.status).toBe('closed');
    expect(matchups.find((row) => row.id === 2)?.status).toBe('active');
  });

  it('closes the active matchup for rotation', async () => {
    const { db, matchups } = makeMatchupDb([
      {
        id: 3,
        week_start: '2026-06-01',
        photo_a_id: 10,
        photo_b_id: 11,
        status: 'active',
        created_at: '2026-06-01T12:00:00Z',
      },
    ]);

    const response = await matchupCloseActivePost({
      request: adminPostRequest('/api/admin/matchup/close-active'),
      env: { DB: withAdminSession(db) },
    });

    expect(response.status).toBe(200);
    expect(matchups[0].status).toBe('closed');
  });
});

describe('public matchup read paths', () => {
  it('returns empty items when no active matchup photos resolve', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/api/photos/list') || url.includes('/api/photos/get')) {
        return Promise.resolve(jsonResponse({ ok: true, items: [], item: null }));
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: () => ({
          first: async () => null,
          all: async () => {
            if (sql.includes('sqlite_master')) {
              return { results: [{ name: 'weekly_matchups' }, { name: 'weekly_votes' }, { name: 'photos' }] };
            }
            return { results: [] };
          },
          run: async () => ({ meta: { changes: 0 } }),
        }),
        first: async () => {
          if (sql.includes("date('now'")) return { week_start: '2026-06-01' };
          return null;
        },
        all: async () => {
          if (sql.includes('sqlite_master')) {
            return { results: [{ name: 'weekly_matchups' }, { name: 'weekly_votes' }, { name: 'photos' }] };
          }
          return { results: [] };
        },
        run: async () => ({ meta: { changes: 0 } }),
      })),
    };

    const request = new Request('https://www.lougehrigfanclub.com/api/matchup/current');
    const response = await publicMatchupCurrentGet({ request, env: { DB: db } });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, items: [] });
  });

  it('returns zero totals when results week_start is missing', async () => {
    const db = {
      prepare: vi.fn(() => ({
        bind: () => ({
          first: async () => null,
        }),
        first: async () => null,
      })),
    };

    const response = await publicMatchupResultsGet({
      request: new Request('https://www.lougehrigfanclub.com/api/matchup/results'),
      env: { DB: db },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      week_start: null,
      totals: { a: 0, b: 0 },
    });
  });

  it('includes winner_photo for last closed week when winner A resolves', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/api/photos/get?id=10')) {
        return Promise.resolve(
          jsonResponse({ ok: true, item: { id: 10, url: 'https://cdn.example/photo-a.jpg', title: 'Photo A' } }),
        );
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    const { db } = makeMatchupDb(
      [
        {
          id: 1,
          week_start: '2026-05-25',
          photo_a_id: 10,
          photo_b_id: 11,
          status: 'closed',
          created_at: '2026-05-25T12:00:00Z',
        },
        {
          id: 2,
          week_start: '2026-06-01',
          photo_a_id: 20,
          photo_b_id: 21,
          status: 'active',
          created_at: '2026-06-01T12:00:00Z',
        },
      ],
      { '2026-05-25': { a: 5, b: 2 }, '2026-06-01': { a: 1, b: 0 } },
    );

    const response = await publicMatchupResultsGet({
      request: new Request('https://www.lougehrigfanclub.com/api/matchup/results?week_start=2026-06-01'),
      env: { DB: db },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      last_week: {
        week_start: '2026-05-25',
        winner: 'a',
        winner_photo: { id: 10, url: 'https://cdn.example/photo-a.jpg', alt: 'Photo A' },
      },
    });
  });

  it('includes winner_photo for last closed week when winner B resolves', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/api/photos/get?id=11')) {
        return Promise.resolve(
          jsonResponse({ ok: true, item: { id: 11, url: 'https://cdn.example/photo-b.jpg' } }),
        );
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    const { db } = makeMatchupDb(
      [
        {
          id: 1,
          week_start: '2026-05-25',
          photo_a_id: 10,
          photo_b_id: 11,
          status: 'closed',
          created_at: '2026-05-25T12:00:00Z',
        },
      ],
      { '2026-05-25': { a: 1, b: 4 } },
    );

    const response = await publicMatchupResultsGet({
      request: new Request('https://www.lougehrigfanclub.com/api/matchup/results?week_start=2026-06-01'),
      env: { DB: db },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      last_week: {
        winner: 'b',
        winner_photo: { id: 11, url: 'https://cdn.example/photo-b.jpg', alt: 'Last week winning photo' },
      },
    });
  });

  it('omits winner_photo for tie results', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    const { db } = makeMatchupDb(
      [
        {
          id: 1,
          week_start: '2026-05-25',
          photo_a_id: 10,
          photo_b_id: 11,
          status: 'closed',
          created_at: '2026-05-25T12:00:00Z',
        },
      ],
      { '2026-05-25': { a: 3, b: 3 } },
    );

    const response = await publicMatchupResultsGet({
      request: new Request('https://www.lougehrigfanclub.com/api/matchup/results?week_start=2026-06-01'),
      env: { DB: db },
    });

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.last_week).toMatchObject({ winner: 'tie' });
    expect(body.last_week.winner_photo).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails closed when winner photo cannot be resolved', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/api/photos/get?id=10')) {
        return Promise.resolve(jsonResponse({ ok: false, error: 'Not found' }, 404));
      }
      return Promise.reject(new Error(`Unexpected fetch: ${url}`));
    });

    const { db } = makeMatchupDb(
      [
        {
          id: 1,
          week_start: '2026-05-25',
          photo_a_id: 10,
          photo_b_id: 11,
          status: 'closed',
          created_at: '2026-05-25T12:00:00Z',
        },
      ],
      { '2026-05-25': { a: 6, b: 1 } },
    );

    const response = await publicMatchupResultsGet({
      request: new Request('https://www.lougehrigfanclub.com/api/matchup/results?week_start=2026-06-01'),
      env: { DB: db },
    });

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.last_week).toMatchObject({ winner: 'a', week_start: '2026-05-25' });
    expect(body.last_week.winner_photo).toBeUndefined();
  });
});
