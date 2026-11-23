import { describe, expect, it } from 'vitest';

import { onRequestGet as adminPhotosList } from '../functions/api/admin/photos/list';
import { onRequestPost as adminPhotosBlock } from '../functions/api/admin/photos/block';
import { onRequestGet as publicPhotosList } from '../functions/api/photos';
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_EMAIL, withAdminSession } from './helpers/adminSession';

// #5471: admin takedown path for the all-B2-photos decision (#5467).

type Row = Record<string, any>;

function photo(id: number, rights_status: string): Row {
  return {
    id,
    photo_id: `p${id}`,
    url: `https://example.com/${id}.jpg`,
    title: `Photo ${id}`,
    is_memorabilia: 0,
    rights_status,
    rights_hold: 1,
    publication_eligible: 0,
    rights_notes: null,
    reviewed_by: null,
    reviewed_at: null,
  };
}

function makeDb(initial: Row[]) {
  const rows = initial.map((r) => ({ ...r }));
  const prepare = (sql: string) => {
    const exec = (kind: 'first' | 'all' | 'run', args: unknown[]) => {
      if (sql.includes('sqlite_master')) return { results: [{ name: 'photos' }] };
      if (kind === 'first' && sql.startsWith('SELECT id, rights_status')) {
        const r = rows.find((x) => x.id === Number(args[0]));
        return r ? { id: r.id, rights_status: r.rights_status } : null;
      }
      if (kind === 'first' && sql.includes('COUNT(1)')) {
        const n = sql.includes("rights_status IN ('blocked'")
          ? rows.filter((x) => ['blocked', 'copyright_restricted'].includes(x.rights_status)).length
          : rows.length;
        return { n };
      }
      if (kind === 'all' && sql.includes('FROM photos') && sql.includes('LIMIT ? OFFSET ?')) {
        const [limit, offset] = args as number[];
        let list = rows.slice();
        if (sql.includes("rights_status IN ('blocked'")) {
          list = list.filter((x) => ['blocked', 'copyright_restricted'].includes(x.rights_status));
        }
        // the public /api/photos query applies the shared gate; the admin list does not
        if (sql.includes("NOT IN ('blocked', 'copyright_restricted')")) {
          list = list.filter((x) => !['blocked', 'copyright_restricted'].includes(x.rights_status));
        }
        list.sort((a, b) => b.id - a.id);
        return { results: list.slice(offset, offset + limit) };
      }
      if (kind === 'all' && sql.includes('FROM photos')) {
        // public /api/photos: apply the shared gate
        let list = rows.slice();
        if (sql.includes("NOT IN ('blocked', 'copyright_restricted')")) {
          list = list.filter((x) => !['blocked', 'copyright_restricted'].includes(x.rights_status));
        }
        return { results: list };
      }
      if (kind === 'run' && sql.startsWith('UPDATE photos')) {
        const blocking = sql.includes("rights_status = 'blocked',");
        const [actor, at, note1, , id] = args as any[];
        const r = rows.find((x) => x.id === Number(id));
        if (!r) return { meta: { changes: 0 } };
        r.rights_status = blocking ? 'blocked' : 'unreviewed';
        if (blocking) {
          r.rights_hold = 1;
          r.publication_eligible = 0;
        }
        r.reviewed_by = actor;
        r.reviewed_at = at;
        r.rights_notes = r.rights_notes ? `${r.rights_notes} | ${note1}` : note1;
        return { meta: { changes: 1 } };
      }
      return kind === 'run' ? { meta: { changes: 0 } } : { results: [] };
    };
    return {
      bind: (...args: unknown[]) => ({
        first: async () => exec('first', args),
        all: async () => exec('all', args),
        run: async () => exec('run', args),
      }),
      first: async () => exec('first', []),
      all: async () => exec('all', []),
      run: async () => exec('run', []),
    };
  };
  return { db: { prepare }, rows };
}

const URL_BASE = 'https://x/api/admin/photos';
const admin = (path: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set('Cookie', ADMIN_SESSION_COOKIE);
  return new Request(`${URL_BASE}${path}`, { ...init, headers });
};
const post = (body: unknown) => admin('/block', { method: 'POST', body: JSON.stringify(body) });

describe('POST /api/admin/photos/block (#5471)', () => {
  it('denies anonymous requests', async () => {
    const { db } = makeDb([photo(1, 'unreviewed')]);
    const res = await adminPhotosBlock({
      request: new Request(`${URL_BASE}/block`, { method: 'POST', body: JSON.stringify({ id: 1, blocked: true, reason: 'x' }) }),
      env: { DB: withAdminSession(db) },
    });
    expect(res.status).toBe(401);
  });

  it('denies a non-admin member', async () => {
    const { db } = makeDb([photo(1, 'unreviewed')]);
    const res = await adminPhotosBlock({ request: post({ id: 1, blocked: true, reason: 'x' }), env: { DB: withAdminSession(db, 'member') } });
    expect(res.status).toBe(403);
  });

  it('requires a reason, a valid id and a boolean', async () => {
    const { db } = makeDb([photo(1, 'unreviewed')]);
    const env = { DB: withAdminSession(db) };
    expect((await adminPhotosBlock({ request: post({ id: 1, blocked: true, reason: '   ' }), env })).status).toBe(400);
    expect((await adminPhotosBlock({ request: post({ id: 'abc', blocked: true, reason: 'x' }), env })).status).toBe(400);
    expect((await adminPhotosBlock({ request: post({ id: 1, blocked: 'yes', reason: 'x' }), env })).status).toBe(400);
  });

  it('404s for an unknown photo', async () => {
    const { db } = makeDb([photo(1, 'unreviewed')]);
    const res = await adminPhotosBlock({ request: post({ id: 9, blocked: true, reason: 'x' }), env: { DB: withAdminSession(db) } });
    expect(res.status).toBe(404);
  });

  it('blocks a photo, records the actor, date and reason, and removes it from the public list', async () => {
    const { db, rows } = makeDb([photo(1, 'unreviewed'), photo(2, 'unreviewed')]);
    const env = { DB: withAdminSession(db) };

    const before = await (await publicPhotosList({ env, request: new Request('https://x/api/photos') })).json();
    expect(before.items.map((i: Row) => i.id).sort()).toEqual([1, 2]);

    const res = await adminPhotosBlock({ request: post({ id: 2, blocked: true, reason: 'Removal requested by rights holder' }), env });
    expect(res.status).toBe(200);
    expect((await res.json()).rights_status).toBe('blocked');

    const row = rows.find((r) => r.id === 2)!;
    expect(row.rights_status).toBe('blocked');
    expect(row.reviewed_by).toBe(ADMIN_SESSION_EMAIL);
    expect(row.rights_notes).toMatch(/^BLOCKED \d{4}-\d{2}-\d{2} by admin-test@example\.com: Removal requested by rights holder$/);

    const after = await (await publicPhotosList({ env, request: new Request('https://x/api/photos') })).json();
    expect(after.items.map((i: Row) => i.id)).toEqual([1]);
  });

  it('restores a blocked photo, keeping the earlier note', async () => {
    const { db, rows } = makeDb([photo(3, 'blocked')]);
    rows[0].rights_notes = 'BLOCKED 2026-11-23 by someone: first';
    const env = { DB: withAdminSession(db) };
    const res = await adminPhotosBlock({ request: post({ id: 3, blocked: false, reason: 'Request withdrawn' }), env });
    expect(res.status).toBe(200);
    expect(rows[0].rights_status).toBe('unreviewed');
    expect(rows[0].rights_notes).toContain('BLOCKED 2026-11-23 by someone: first | RESTORED');
  });

  it('refuses to restore a photo that is not blocked, and never lifts copyright_restricted', async () => {
    const { db, rows } = makeDb([photo(4, 'copyright_restricted'), photo(5, 'unreviewed')]);
    const env = { DB: withAdminSession(db) };
    const restricted = await adminPhotosBlock({ request: post({ id: 4, blocked: false, reason: 'try' }), env });
    expect(restricted.status).toBe(409);
    expect((await restricted.json()).error).toBe('not_blocked');
    expect(rows[0].rights_status).toBe('copyright_restricted');

    const open = await adminPhotosBlock({ request: post({ id: 5, blocked: false, reason: 'try' }), env });
    expect(open.status).toBe(409);

    const reblock = await adminPhotosBlock({ request: post({ id: 4, blocked: true, reason: 'again' }), env });
    expect(reblock.status).toBe(409);
    expect((await reblock.json()).error).toBe('already_restricted');
  });
});

describe('GET /api/admin/photos/list (#5471)', () => {
  it('denies anonymous requests', async () => {
    const { db } = makeDb([photo(1, 'unreviewed')]);
    const res = await adminPhotosList({ request: new Request(`${URL_BASE}/list`), env: { DB: withAdminSession(db) } });
    expect(res.status).toBe(401);
  });

  it('lists every photo, newest first, including blocked ones the public API hides', async () => {
    const { db } = makeDb([photo(1, 'unreviewed'), photo(2, 'blocked'), photo(3, 'copyright_restricted')]);
    const res = await adminPhotosList({ request: admin('/list'), env: { DB: withAdminSession(db) } });
    const body = await res.json();
    expect(body.total).toBe(3);
    expect(body.items.map((i: Row) => i.id)).toEqual([3, 2, 1]);
  });

  it('filters to blocked and restricted photos and paginates', async () => {
    const { db } = makeDb([photo(1, 'unreviewed'), photo(2, 'blocked'), photo(3, 'copyright_restricted')]);
    const env = { DB: withAdminSession(db) };
    const blocked = await (await adminPhotosList({ request: admin('/list?filter=blocked'), env })).json();
    expect(blocked.total).toBe(2);
    expect(blocked.items.map((i: Row) => i.id)).toEqual([3, 2]);
    const page = await (await adminPhotosList({ request: admin('/list?limit=1&offset=1'), env })).json();
    expect(page.items.map((i: Row) => i.id)).toEqual([2]);
  });
});
