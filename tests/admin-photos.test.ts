import { describe, expect, it } from 'vitest';

import { onRequestGet as adminPhotoGet } from '../functions/api/admin/photos/get';
import { onRequestPost as adminPhotoUpdate } from '../functions/api/admin/photos/update';
import { ADMIN_SESSION_COOKIE, withAdminSession } from './helpers/adminSession';

// #4166: admin-only photo credit/source editor, so Bill doesn't need direct
// D1 access to record attribution for Weekly Matchup photos.

const HELD_PHOTO = {
  id: 7,
  url: 'https://example.com/held.jpg',
  title: 'Held photo',
  description: 'Unverified rights',
  source: null,
  is_memorabilia: 0,
  is_matchup_eligible: 0,
  rights_status: 'unreviewed',
  publication_eligible: 0,
  created_at: '2026-08-01T00:00:00Z',
};

function makeDb(photos: Array<Record<string, unknown>>) {
  const rows = photos.map((p) => ({ ...p }));

  return {
    prepare(sql: string) {
      return {
        bind: (...args: unknown[]) => ({
          first: async () => {
            if (sql.includes('SELECT id, url, title')) {
              const id = Number(args[0]);
              return rows.find((r) => Number(r.id) === id) ?? null;
            }
            if (sql.includes('SELECT id FROM photos')) {
              const id = Number(args[0]);
              return rows.find((r) => Number(r.id) === id) ? { id } : null;
            }
            return null;
          },
          run: async () => {
            if (sql.includes('UPDATE photos SET source')) {
              const [value, id] = args;
              const row = rows.find((r) => Number(r.id) === Number(id));
              if (!row) return { meta: { changes: 0 } };
              row.source = value;
              return { meta: { changes: 1 } };
            }
            return { meta: { changes: 0 } };
          },
          all: async () => {
            // requireTables()'s sqlite_master existence check.
            if (sql.includes('sqlite_master')) {
              return { results: [{ name: 'photos' }] };
            }
            return { results: [] };
          },
        }),
      };
    },
  };
}

function adminReq(url: string, init: RequestInit = {}): Request {
  const headers = new Headers(init.headers);
  headers.set('Cookie', ADMIN_SESSION_COOKIE);
  return new Request(url, { ...init, headers });
}

function anonReq(url: string, init: RequestInit = {}): Request {
  return new Request(url, init);
}

describe('GET /api/admin/photos/get (#4166)', () => {
  it('denies anonymous requests with 401', async () => {
    const env = { DB: withAdminSession(makeDb([HELD_PHOTO])) };
    const res = await adminPhotoGet({ request: anonReq('https://x/api/admin/photos/get?id=7'), env });
    expect(res.status).toBe(401);
  });

  it('returns a held/unreviewed photo for an admin -- no public rights filter applied', async () => {
    const env = { DB: withAdminSession(makeDb([HELD_PHOTO])) };
    const res = await adminPhotoGet({ request: adminReq('https://x/api/admin/photos/get?id=7'), env });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.item.id).toBe(7);
    expect(body.item.publication_eligible).toBe(0);
  });

  it('404s for an unknown id', async () => {
    const env = { DB: withAdminSession(makeDb([HELD_PHOTO])) };
    const res = await adminPhotoGet({ request: adminReq('https://x/api/admin/photos/get?id=999'), env });
    expect(res.status).toBe(404);
  });

  it('400s for an invalid id', async () => {
    const env = { DB: withAdminSession(makeDb([HELD_PHOTO])) };
    const res = await adminPhotoGet({ request: adminReq('https://x/api/admin/photos/get?id=abc'), env });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/admin/photos/update (#4166)', () => {
  it('denies anonymous requests with 401', async () => {
    const env = { DB: withAdminSession(makeDb([HELD_PHOTO])) };
    const res = await adminPhotoUpdate({
      request: anonReq('https://x/api/admin/photos/update', {
        method: 'POST',
        body: JSON.stringify({ id: 7, source: 'LGFC Archive' }),
      }),
      env,
    });
    expect(res.status).toBe(401);
  });

  it('sets a trimmed credit value', async () => {
    const env = { DB: withAdminSession(makeDb([HELD_PHOTO])) };
    const res = await adminPhotoUpdate({
      request: adminReq('https://x/api/admin/photos/update', {
        method: 'POST',
        body: JSON.stringify({ id: 7, source: '  LGFC Archive  ' }),
      }),
      env,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.source).toBe('LGFC Archive');
  });

  it('clears the credit to NULL when source is whitespace-only', async () => {
    const env = { DB: withAdminSession(makeDb([{ ...HELD_PHOTO, source: 'Old Credit' }])) };
    const res = await adminPhotoUpdate({
      request: adminReq('https://x/api/admin/photos/update', {
        method: 'POST',
        body: JSON.stringify({ id: 7, source: '   ' }),
      }),
      env,
    });
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.source).toBeNull();
  });

  it('404s for an unknown id', async () => {
    const env = { DB: withAdminSession(makeDb([HELD_PHOTO])) };
    const res = await adminPhotoUpdate({
      request: adminReq('https://x/api/admin/photos/update', {
        method: 'POST',
        body: JSON.stringify({ id: 999, source: 'x' }),
      }),
      env,
    });
    expect(res.status).toBe(404);
  });

  it('400s for an invalid id', async () => {
    const env = { DB: withAdminSession(makeDb([HELD_PHOTO])) };
    const res = await adminPhotoUpdate({
      request: adminReq('https://x/api/admin/photos/update', {
        method: 'POST',
        body: JSON.stringify({ id: 'nope', source: 'x' }),
      }),
      env,
    });
    expect(res.status).toBe(400);
  });
});
