import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminEventsPage from '@/app/admin/events/page';
import { onRequestPost as eventsCreatePost } from '../functions/api/admin/events/create';
import { onRequestGet as eventsListGet } from '../functions/api/admin/events/list';
import { onRequestPost as eventsSeedPost } from '../functions/api/admin/events/seed-next10';
import { onRequestPost as eventsUpdatePost } from '../functions/api/admin/events/update';
import { onRequestGet as publicEventsMonthGet } from '../functions/api/events/month';
import { onRequestGet as publicEventsNextGet } from '../functions/api/events/next';
import { ADMIN_SESSION_COOKIE, withAdminSession } from './helpers/adminSession';

const mockUsePathname = vi.hoisted(() => vi.fn(() => '/admin/events'));

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

function makeEventsDb(rows: Array<Record<string, unknown>> = []) {
  let boundLimit = 0;
  let boundMonth = '';
  let lastInsert: Record<string, unknown> | null = null;
  let lastUpdate: Record<string, unknown> | null = null;

  const upcomingPostedCount = () =>
    rows.filter((row) => row.status === 'posted').length;

  const db = {
    prepare: vi.fn((sql: string) => {
      const countFirst = async () => ({ n: upcomingPostedCount() });

      return {
        first: sql.includes('COUNT(*)') ? countFirst : async () => null,
        bind: (...args: unknown[]) => ({
          all: async () => {
            if (sql.includes('sqlite_master')) {
              return { results: [{ name: 'events' }] };
            }

            if (sql.includes('substr(start_date')) {
              boundMonth = String(args[0]);
              boundLimit = Number(args[1]);
              return { results: rows.filter((row) => String(row.start_date).startsWith(boundMonth)) };
            }

            if (sql.includes('FROM events') && sql.includes('ORDER BY start_date DESC')) {
              boundLimit = Number(args[0]);
              return { results: rows };
            }

            if (sql.includes("status='posted'") && sql.includes('COUNT(*)')) {
              return { results: [{ n: upcomingPostedCount() }] };
            }

            return { results: [] };
          },
          run: async () => {
            if (sql.includes('INSERT INTO events')) {
              lastInsert = {
                title: args[0],
                start_date: args[1],
                end_date: args[2],
                location: args[3],
                host: args[4],
                fees: args[5],
                description: args[6],
                external_url: args[7],
                status: args[8],
              };
              return { meta: { last_row_id: 42, changes: 1 } };
            }

            if (sql.includes('UPDATE events')) {
              lastUpdate = {
                title: args[0],
                start_date: args[1],
                end_date: args[2],
                location: args[3],
                host: args[4],
                fees: args[5],
                description: args[6],
                external_url: args[7],
                status: args[8],
                id: args[9],
              };
              return { meta: { changes: 1 } };
            }

            if (sql.includes('LGFC Placeholder Event 01')) {
              return { meta: { changes: 10 } };
            }

            return { meta: { changes: 0 } };
          },
          first: countFirst,
        }),
      };
    }),
  };

  return {
    db,
    getBoundLimit: () => boundLimit,
    getBoundMonth: () => boundMonth,
    getLastInsert: () => lastInsert,
    getLastUpdate: () => lastUpdate,
  };
}

describe('admin events page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUsePathname.mockReturnValue('/admin/events');
  });

  it('renders admin navigation', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ ok: true, items: [] }));

    render(<AdminEventsPage />);

    expect(screen.getByRole('link', { name: 'Events' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/No events found for/i)).toBeInTheDocument();
    });
  });

  it('announces list errors via AdminStatusText alert', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (String(input).startsWith('/api/admin/events/list')) {
        return Promise.resolve(jsonResponse({ ok: false, error: 'Database unavailable' }, 503));
      }
      return Promise.reject(new Error(`Unexpected fetch: ${String(input)}`));
    });

    render(<AdminEventsPage />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Error: Database unavailable');
    });
  });

  it('loads events on mount for a signed-in admin', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      expect(String(input)).toMatch(/^\/api\/admin\/events\/list\?month=/);

      return Promise.resolve(
        jsonResponse({
          ok: true,
          items: [
            {
              id: 1,
              title: 'Fan Club Meetup',
              start_date: '2026-06-15',
              end_date: '2026-06-15',
              location: 'LGFC',
              host: 'Fan Club',
              fees: 'Free',
              description: 'Monthly meetup',
              external_url: 'https://www.lougehrigfanclub.com',
              status: 'posted',
            },
          ],
        }),
      );
    });

    render(<AdminEventsPage />);

    await waitFor(() => {
      expect(screen.getByText('Fan Club Meetup')).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('creates an event through the admin create API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const path = String(input);

      if (path.startsWith('/api/admin/events/list')) {
        return Promise.resolve(jsonResponse({ ok: true, items: [] }));
      }

      if (path === '/api/admin/events/create') {
        expect(init?.method).toBe('POST');
        const body = JSON.parse(String(init?.body));
        expect(body.title).toBe('New Event Title');
        expect(body.start_date).toBe('2026-06-20');
        return Promise.resolve(jsonResponse({ ok: true, id: 9 }));
      }

      return Promise.reject(new Error(`Unexpected fetch: ${path}`));
    });

    render(<AdminEventsPage />);

    await waitFor(() => {
      expect(screen.getByText(/No events found for/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'New Event Title' } });
    fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-06-20' } });
    fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-06-20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));

    await waitFor(() => {
      expect(screen.getByText('Event created.')).toBeInTheDocument();
    });

    expect(fetchMock.mock.calls.some(([path]) => path === '/api/admin/events/create')).toBe(true);
  });

  it('updates a selected event through the admin update API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const path = String(input);

      if (path.startsWith('/api/admin/events/list')) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            items: [
              {
                id: 5,
                title: 'Old Title',
                start_date: '2026-06-10',
                end_date: '2026-06-10',
                location: 'LGFC',
                host: 'Fan Club',
                fees: 'Free',
                description: 'Old description',
                external_url: '',
                status: 'posted',
              },
            ],
          }),
        );
      }

      if (path === '/api/admin/events/update') {
        const body = JSON.parse(String(init?.body));
        expect(body.id).toBe(5);
        expect(body.title).toBe('Updated Title');
        return Promise.resolve(jsonResponse({ ok: true, changed: 1 }));
      }

      return Promise.reject(new Error(`Unexpected fetch: ${path}`));
    });

    render(<AdminEventsPage />);

    await waitFor(() => {
      expect(screen.getByText('Old Title')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit event #5' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Updated Title' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(screen.getByText('Event 5 updated.')).toBeInTheDocument();
    });

    expect(fetchMock.mock.calls.some(([path]) => path === '/api/admin/events/update')).toBe(true);
  });

  it('shows seed feedback when placeholder seeding fails closed', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = String(input);

      if (path.startsWith('/api/admin/events/list')) {
        return Promise.resolve(jsonResponse({ ok: true, items: [] }));
      }

      if (path === '/api/admin/events/seed-next10') {
        return Promise.resolve(jsonResponse({ ok: false, error: 'Database unavailable' }, 503));
      }

      return Promise.reject(new Error(`Unexpected fetch: ${path}`));
    });

    render(<AdminEventsPage />);

    await waitFor(() => {
      expect(screen.getByText(/No events found for/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Seed next 10 placeholders' }));

    await waitFor(() => {
      expect(screen.getByText('Seed error: Database unavailable')).toBeInTheDocument();
    });
  });
});

describe('admin events APIs', () => {
  it('rejects unauthenticated list requests', async () => {
    const response = await eventsListGet({
      request: adminGetRequest('/api/admin/events/list', ''),
      env: { DB: withAdminSession(makeEventsDb().db) },
    });

    expect(response.status).toBe(401);
  });

  it('fails closed when D1 is unavailable for list requests', async () => {
    const response = await eventsListGet({
      request: adminGetRequest('/api/admin/events/list'),
      env: {},
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Database unavailable',
    });
  });

  it('returns month-scoped events for admin review', async () => {
    const { db, getBoundMonth } = makeEventsDb([
      {
        id: 1,
        title: 'June Event',
        start_date: '2026-06-12',
        end_date: '2026-06-12',
        status: 'posted',
      },
    ]);

    const response = await eventsListGet({
      request: adminGetRequest('/api/admin/events/list?month=2026-06'),
      env: { DB: withAdminSession(db) },
    });

    expect(response.status).toBe(200);
    expect(getBoundMonth()).toBe('2026-06');
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      month: '2026-06',
      items: [{ title: 'June Event' }],
    });
  });

  it('creates events with the canonical D1 schema', async () => {
    const { db, getLastInsert } = makeEventsDb();

    const response = await eventsCreatePost({
      request: adminPostRequest('/api/admin/events/create', {
        title: 'Created Event',
        start_date: '2026-06-18',
        end_date: '2026-06-18',
        location: 'LGFC',
        host: 'Fan Club',
        fees: 'Free',
        description: 'Created through admin API',
        external_url: 'https://www.lougehrigfanclub.com',
        status: 'posted',
      }),
      env: { DB: withAdminSession(db) },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, id: 42 });
    expect(getLastInsert()).toMatchObject({
      title: 'Created Event',
      start_date: '2026-06-18',
      status: 'posted',
    });
  });

  it('updates events with the canonical D1 schema', async () => {
    const { db, getLastUpdate } = makeEventsDb();

    const response = await eventsUpdatePost({
      request: adminPostRequest('/api/admin/events/update', {
        id: 7,
        title: 'Updated Event',
        start_date: '2026-06-19',
        end_date: '2026-06-19',
        location: 'LGFC',
        host: 'Fan Club',
        fees: 'Free',
        description: 'Updated through admin API',
        external_url: '',
        status: 'hidden',
      }),
      env: { DB: withAdminSession(db) },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, changed: 1 });
    expect(getLastUpdate()).toMatchObject({
      id: 7,
      title: 'Updated Event',
      status: 'hidden',
    });
  });

  it('fails closed when seeding without D1', async () => {
    const response = await eventsSeedPost({
      request: adminPostRequest('/api/admin/events/seed-next10'),
      env: {},
    });

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Database unavailable',
    });
  });

  it('rejects invalid month filters instead of returning unrelated rows', async () => {
    const { db } = makeEventsDb([
      {
        id: 1,
        title: 'June Event',
        start_date: '2026-06-12',
        end_date: '2026-06-12',
        status: 'posted',
      },
    ]);

    const response = await eventsListGet({
      request: adminGetRequest('/api/admin/events/list?month=not-a-month'),
      env: { DB: withAdminSession(db) },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'invalid_month',
    });
  });

  it('rejects unsafe external_url values on create', async () => {
    const { db } = makeEventsDb();

    const response = await eventsCreatePost({
      request: adminPostRequest('/api/admin/events/create', {
        title: 'Unsafe Link Event',
        start_date: '2026-06-18',
        external_url: 'javascript:alert(1)',
      }),
      env: { DB: withAdminSession(db) },
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'invalid_external_url',
    });
  });

  it('skips duplicate placeholder seeding when upcoming posted events already exist', async () => {
    const { db } = makeEventsDb([
      {
        id: 1,
        title: 'Existing Event',
        start_date: '2026-06-18',
        end_date: '2026-06-18',
        status: 'posted',
      },
    ]);

    const response = await eventsSeedPost({
      request: adminPostRequest('/api/admin/events/seed-next10'),
      env: { DB: withAdminSession(db) },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      inserted: 0,
      upcoming_posted: 1,
    });
  });
});

describe('public events read paths', () => {
  it('returns only posted upcoming events from /api/events/next', async () => {
    const db = {
      prepare: vi.fn(() => ({
        bind: (...args: unknown[]) => ({
          all: async () => ({
            results: [
              {
                id: 1,
                title: 'Public Event',
                start_date: args[0],
                end_date: args[0],
                location: 'LGFC',
                host: 'Fan Club',
                fees: 'Free',
                description: 'Visible on public calendar',
                external_url: 'https://www.lougehrigfanclub.com',
                status: 'posted',
              },
            ],
          }),
        }),
      })),
    };

    const response = await publicEventsNextGet({
      request: new Request('https://www.lougehrigfanclub.com/api/events/next?limit=10'),
      env: { DB: db },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      items: [{ title: 'Public Event' }],
    });
  });

  it('returns month-scoped posted events from /api/events/month', async () => {
    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: (...args: unknown[]) => ({
          all: async () => {
            expect(sql).toContain("status='posted'");
            expect(args[0]).toBe('2026-06');
            return {
              results: [
                {
                  id: 2,
                  title: 'Month Event',
                  start_date: '2026-06-05',
                  end_date: '2026-06-05',
                  location: 'LGFC',
                  host: 'Fan Club',
                  fees: 'Free',
                  description: 'Visible in month view',
                  external_url: '',
                },
              ],
            };
          },
        }),
      })),
    };

    const response = await publicEventsMonthGet({
      request: new Request('https://www.lougehrigfanclub.com/api/events/month?month=2026-06'),
      env: { DB: db },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      month: '2026-06',
      items: [{ title: 'Month Event' }],
    });
  });
});
