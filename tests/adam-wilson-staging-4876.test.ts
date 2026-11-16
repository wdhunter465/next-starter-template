// @vitest-environment node
// #4876 (child of #2078): admin-only Adam Wilson award staging. Proves access, validation, the private table,
// and that nothing reaches a public route, the sitemap, or the fundraiser/Club staging code (and the reverse).
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { onRequestGet as list } from '../functions/api/admin/adam-wilson/list';
import { onRequestPost as save } from '../functions/api/admin/adam-wilson/save';
import { onRequestPost as remove } from '../functions/api/admin/adam-wilson/delete';
import { validateAwardStagingInput } from '../functions/_lib/adam-wilson-staging';
import sitemap from '../src/app/sitemap';
import { ADMIN_SESSION_COOKIE, withAdminSession } from './helpers/adminSession';

const ROOT = process.cwd();
const MIGRATION = '0101_award_staging_items_4876.sql';

function migratedDb(): DatabaseSync {
  const db = new DatabaseSync(':memory:');
  for (const file of fs.readdirSync(path.join(ROOT, 'migrations')).filter((f) => f.endsWith('.sql')).sort()) {
    db.exec(fs.readFileSync(path.join(ROOT, 'migrations', file), 'utf8'));
  }
  return db;
}

function d1(db: DatabaseSync, role: 'admin' | 'member' = 'admin') {
  const wrapped = {
    prepare(sql: string) {
      const stmt = db.prepare(sql);
      const make = (values: unknown[]) => ({
        all: async () => ({ results: stmt.all(...(values as never[])) }),
        first: async () => stmt.get(...(values as never[])) ?? null,
        run: async () => {
          const r = stmt.run(...(values as never[]));
          return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
        },
      });
      return { bind: (...values: unknown[]) => make(values), ...make([]) };
    },
  };
  return withAdminSession(wrapped, role);
}

function req(method: string, url: string, body?: unknown, cookie: string | null = ADMIN_SESSION_COOKIE) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  return new Request(`https://www.lougehrigfanclub.com${url}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}

const draft = { kind: 'purpose', title: 'Purpose draft', body_md: 'Why the award exists.' };

describe('access', () => {
  it('refuses no session (401) and a plain member session (403) on every handler', async () => {
    const db = migratedDb();
    for (const [handler, method, url] of [
      [list, 'GET', '/api/admin/adam-wilson/list'],
      [save, 'POST', '/api/admin/adam-wilson/save'],
      [remove, 'POST', '/api/admin/adam-wilson/delete'],
    ] as const) {
      const body = method === 'POST' ? draft : undefined;
      expect((await handler({ request: req(method, url, body, null), env: { DB: d1(db) } } as never)).status).toBe(401);
      expect((await handler({ request: req(method, url, body), env: { DB: d1(db, 'member') } } as never)).status).toBe(403);
    }
    expect((db.prepare('SELECT COUNT(*) AS n FROM award_staging_items').get() as { n: number }).n).toBe(0);
  });
});

describe('create, review, update, delete', () => {
  it('creates a draft, lists it, reviews it, and deletes it', async () => {
    const db = migratedDb();
    const env = { DB: d1(db) };
    const created = await (await save({ request: req('POST', '/api/admin/adam-wilson/save', draft), env } as never)).json();
    expect(created).toMatchObject({ ok: true, created: true });
    const listed = await (await list({ request: req('GET', '/api/admin/adam-wilson/list'), env } as never)).json();
    expect(listed.items).toHaveLength(1);
    expect(listed.items[0]).toMatchObject({ kind: 'purpose', status: 'draft', honoree_consent: 'unknown' });

    const updated = await (
      await save({ request: req('POST', '/api/admin/adam-wilson/save', { ...draft, id: created.id, status: 'reviewed', honoree_consent: 'requested' }), env } as never)
    ).json();
    expect(updated).toMatchObject({ ok: true, created: false });
    expect(db.prepare('SELECT status, honoree_consent FROM award_staging_items').get()).toMatchObject({ status: 'reviewed', honoree_consent: 'requested' });

    expect((await save({ request: req('POST', '/api/admin/adam-wilson/save', { ...draft, id: 999 }), env } as never)).status).toBe(404);
    expect((await remove({ request: req('POST', '/api/admin/adam-wilson/delete', { id: created.id }), env } as never)).status).toBe(200);
    expect((await remove({ request: req('POST', '/api/admin/adam-wilson/delete', { id: created.id }), env } as never)).status).toBe(404);
    expect((await remove({ request: req('POST', '/api/admin/adam-wilson/delete', { id: 'x' }), env } as never)).status).toBe(400);
  });
});

describe('no publish path', () => {
  it('refuses published (or any other) status in validation and in the table', async () => {
    for (const status of ['published', 'live', 'scheduled', '']) {
      const r = validateAwardStagingInput({ ...draft, status: status || 'x' });
      expect(r.ok).toBe(false);
    }
    const db = migratedDb();
    const env = { DB: d1(db) };
    const res = await save({ request: req('POST', '/api/admin/adam-wilson/save', { ...draft, status: 'published' }), env } as never);
    expect(res.status).toBe(400);
    expect(() => db.prepare("INSERT INTO award_staging_items (kind, title, status) VALUES ('draft','t','published')").run()).toThrow();
    expect(() => db.prepare("INSERT INTO award_staging_items (kind, title, honoree_consent) VALUES ('draft','t','public')").run()).toThrow();
  });

  it('rejects bad kind, title, consent and id', () => {
    expect(validateAwardStagingInput({ ...draft, kind: 'press' }).ok).toBe(false);
    expect(validateAwardStagingInput({ ...draft, title: '  ' }).ok).toBe(false);
    expect(validateAwardStagingInput({ ...draft, honoree_consent: 'maybe' }).ok).toBe(false);
    expect(validateAwardStagingInput({ ...draft, id: -1 }).ok).toBe(false);
    expect(validateAwardStagingInput({ ...draft, body_md: 'x'.repeat(20001) }).ok).toBe(false);
  });

  it('the migration is additive and applies twice', () => {
    const db = migratedDb();
    db.exec(fs.readFileSync(path.join(ROOT, 'migrations', MIGRATION), 'utf8'));
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'award_staging_items'").get()).toBeTruthy();
  });
});

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|mjs|js|json)$/.test(entry.name)) out.push(full);
  }
  return out;
}
const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join('/');
const NEW_CODE = [
  ...walk(path.join(ROOT, 'src/app/admin/adam-wilson-staging')),
  ...walk(path.join(ROOT, 'functions/api/admin/adam-wilson')),
  path.join(ROOT, 'functions/_lib/adam-wilson-staging.ts'),
];
const NEEDLE = /award_staging_items|adam-wilson|adam_wilson|adamwilson|AdamWilson/i;

describe('no public exposure', () => {
  it('the sitemap contains no Adam Wilson entry', () => {
    const urls = sitemap().map((e) => e.url).join('\n');
    expect(urls).not.toMatch(/adam|wilson|award/i);
  });

  it('no code outside the admin area references the new table, route or components', () => {
    const allowed = (f: string) =>
      NEW_CODE.includes(f) ||
      rel(f) === 'src/components/admin/AdminNav.tsx' ||
      rel(f).startsWith('tests/');
    const files = [
      ...walk(path.join(ROOT, 'src')),
      ...walk(path.join(ROOT, 'functions')),
      ...walk(path.join(ROOT, 'public')),
    ];
    const offenders = files.filter((f) => !allowed(f) && NEEDLE.test(fs.readFileSync(f, 'utf8'))).map(rel);
    expect(offenders).toEqual([]);
  });

  it('the only place outside the new files that names the page is the admin nav', () => {
    const nav = fs.readFileSync(path.join(ROOT, 'src/components/admin/AdminNav.tsx'), 'utf8');
    expect(nav).toContain('/admin/adam-wilson-staging');
  });

  it('there is no route outside /admin or /api/admin containing the name', () => {
    const routes = [...walk(path.join(ROOT, 'src/app')), ...walk(path.join(ROOT, 'functions/api'))].map(rel);
    const bad = routes.filter((f) => /adam|wilson/i.test(f) && !f.startsWith('src/app/admin/') && !f.startsWith('functions/api/admin/'));
    expect(bad).toEqual([]);
  });

  it('robots keeps /admin/ and /api/ disallowed', () => {
    const robots = fs.readFileSync(path.join(ROOT, 'src/app/robots.ts'), 'utf8');
    expect(robots).toContain('/admin/');
    expect(robots).toContain('/api/');
  });
});

describe('separation from the fundraiser and Club staging pages', () => {
  it('the new code never touches content_blocks, content_items or those pages', () => {
    for (const file of NEW_CODE) {
      const text = fs.readFileSync(file, 'utf8');
      expect(text, rel(file)).not.toMatch(/content_blocks|content_items|content_revisions|fundraiser-preview|fundraiser-details|clubstaging|ClubStaging/);
    }
  });

  it('the fundraiser and Club staging code never references the new table or folder', () => {
    const files = [
      ...walk(path.join(ROOT, 'src/app/admin/fundraiser-preview')),
      ...walk(path.join(ROOT, 'src/app/admin/clubstaging')),
      ...walk(path.join(ROOT, 'functions/api/admin/fundraiser-details')),
    ];
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) expect(fs.readFileSync(file, 'utf8'), rel(file)).not.toMatch(NEEDLE);
  });

  it('the new handlers write only award_staging_items', () => {
    for (const file of walk(path.join(ROOT, 'functions/api/admin/adam-wilson'))) {
      const text = fs.readFileSync(file, 'utf8');
      const tables = [...text.matchAll(/(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|FROM)\s+([a-z_]+)/g)].map((m) => m[1]);
      for (const table of tables) expect(table, rel(file)).toBe('award_staging_items');
    }
  });
});
