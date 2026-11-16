// #5303 (item 3 of #4767): the purge endpoint, the script, and the workflow gate. Real schema, every migration.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { onRequestPost } from '../functions/api/scheduled-content/auth-purge.ts';
import { main, parseArgs, renderReport } from '../scripts/ops/auth-purge.mjs';

const ROOT = process.cwd();
const TOKEN = 'purge-test-token';

function d1(db) {
  return {
    prepare(sql) {
      const stmt = db.prepare(sql);
      const make = (args) => ({
        first: async () => stmt.get(...args) ?? null,
        run: async () => ({ meta: { changes: Number(stmt.run(...args).changes) } }),
      });
      return { bind: (...args) => make(args), ...make([]) };
    },
  };
}

let db;
beforeEach(() => {
  db = new DatabaseSync(':memory:');
  for (const file of fs.readdirSync(path.join(ROOT, 'migrations')).filter((f) => f.endsWith('.sql')).sort()) {
    db.exec(fs.readFileSync(path.join(ROOT, 'migrations', file), 'utf8'));
  }
  db.prepare("INSERT INTO members (email, role) VALUES ('a@example.com','member')").run();
  const add = (id, exp) => db.prepare('INSERT INTO member_sessions (id, email, expires_at) VALUES (?, ?, ' + exp + ')').run(id, 'a@example.com');
  add('live', "datetime('now','+10 days')");
  add('just-expired', "datetime('now','-1 day')");
  add('old-expired', "datetime('now','-30 days')");
  add('older-expired', "datetime('now','-9 days')");
  const att = (ip, email, ok, ago) =>
    db.prepare(`INSERT INTO login_attempts (ip, email, ok, created_at) VALUES (?, ?, ?, datetime('now','${ago}'))`).run(ip, email, ok);
  att('1.1.1.1', 'x@example.com', 0, '-30 minutes');
  att('1.1.1.2', 'x@example.com', 0, '-3 days');
  att('1.1.1.3', 'throttle:join', 1, '-8 days');
  att('1.1.1.4', 'y@example.com', 1, '-40 days');
});

const env = (extra = {}) => ({ DB: d1(db), SCHEDULED_CONTENT_BRIDGE_TOKEN: TOKEN, ...extra });
const call = (body, token = TOKEN, e = env()) =>
  onRequestPost({
    env: e,
    request: new Request('https://www.lougehrigfanclub.com/api/scheduled-content/auth-purge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  });
const ids = () => db.prepare('SELECT id FROM member_sessions ORDER BY id').all().map((r) => r.id);
const attempts = () => db.prepare('SELECT COUNT(*) AS n FROM login_attempts').get().n;

describe('POST /api/scheduled-content/auth-purge', () => {
  it('refuses no token (401), a wrong token (401/403) and no configuration (503), and deletes nothing', async () => {
    expect((await call({ apply: true }, null)).status).toBe(401);
    expect([401, 403]).toContain((await call({ apply: true }, 'wrong')).status);
    expect((await call({ apply: true }, TOKEN, env({ SCHEDULED_CONTENT_BRIDGE_TOKEN: '' }))).status).toBe(503);
    expect((await call({ apply: true }, TOKEN, { SCHEDULED_CONTENT_BRIDGE_TOKEN: TOKEN })).status).toBe(503);
    expect(ids()).toHaveLength(4);
    expect(attempts()).toBe(4);
  });

  it('is a dry run by default and with apply not exactly true: counts, deletes nothing', async () => {
    for (const body of [undefined, {}, { apply: false }, { apply: 'true' }, { apply: 1 }]) {
      const res = await call(body);
      expect(await res.json()).toEqual({ ok: true, applied: false, sessions_due: 2, attempts_due: 2 });
    }
    expect(ids()).toHaveLength(4);
    expect(attempts()).toBe(4);
  });

  it('with apply true deletes only sessions 7+ days past expiry and attempts older than 7 days', async () => {
    const res = await call({ apply: true });
    expect(await res.json()).toEqual({ ok: true, applied: true, sessions_deleted: 2, attempts_deleted: 2, remaining: 0 });
    expect(ids()).toEqual(['just-expired', 'live']);
    expect(db.prepare('SELECT ip FROM login_attempts ORDER BY ip').all().map((r) => r.ip)).toEqual(['1.1.1.1', '1.1.1.2']);
  });

  it('is idempotent', async () => {
    await call({ apply: true });
    const again = await (await call({ apply: true })).json();
    expect(again).toMatchObject({ sessions_deleted: 0, attempts_deleted: 0, remaining: 0 });
  });

  it('exports only the POST handler and the constants', async () => {
    const mod = await import('../functions/api/scheduled-content/auth-purge.ts');
    expect(Object.keys(mod).sort()).toEqual(['ATTEMPT_RETENTION', 'PURGE_BATCH', 'SESSION_GRACE', 'onRequestPost']);
  });
});

describe('scripts/ops/auth-purge.mjs', () => {
  it('parses --apply and refuses anything else', () => {
    expect(parseArgs([])).toEqual({ apply: false });
    expect(parseArgs(['--apply'])).toEqual({ apply: true });
    expect(() => parseArgs(['--all'])).toThrow(/Unknown argument/);
  });

  it('sends only the apply flag with the bearer token and reports', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: true, applied: true, sessions_deleted: 2, attempts_deleted: 3, remaining: 0 }), { status: 200 }));
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const code = await main({ SCHEDULED_CONTENT_BRIDGE_TOKEN: TOKEN, BASE_URL: 'https://example.test' }, ['--apply'], fetchImpl);
    expect(code).toBe(0);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://example.test/api/scheduled-content/auth-purge');
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(JSON.parse(init.body)).toEqual({ apply: true });
    expect(log.mock.calls[0][0]).toMatch(/deleted 2 expired sessions and 3 old/);
    log.mockRestore();
  });

  it('returns 1 on a failed call and needs the token', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ ok: false, error: 'nope' }), { status: 500 }));
    expect(await main({ SCHEDULED_CONTENT_BRIDGE_TOKEN: TOKEN }, [], fetchImpl)).toBe(1);
    await expect(main({}, [], fetchImpl)).rejects.toThrow(/required/);
    err.mockRestore();
  });

  it('renders a dry run', () => {
    expect(renderReport({ applied: false, sessions_due: 4, attempts_due: 9 })).toMatch(/Dry run: 4 expired sessions and 9 old/);
  });
});

describe('workflow gate', () => {
  const wf = fs.readFileSync(path.join(ROOT, '.github/workflows/ops-auth-purge.yml'), 'utf8');

  it('scheduled runs apply only when AUTH_PURGE_APPLY is true; manual runs only with apply=true; pull requests never run it', () => {
    expect(wf).toMatch(/schedule' && vars\.AUTH_PURGE_APPLY == 'true' && 'true'/);
    expect(wf).toMatch(/workflow_dispatch' && inputs\.apply/);
    expect(wf).toMatch(/if: \$\{\{ github\.event_name != 'pull_request' \}\}/);
  });

  it('has read-only permissions and adds no secret beyond the bridge token', () => {
    expect(wf).toMatch(/permissions:\n  contents: read/);
    expect([...wf.matchAll(/secrets\.([A-Z_]+)/g)].map((m) => m[1])).toEqual(['SCHEDULED_CONTENT_BRIDGE_TOKEN']);
  });
});
