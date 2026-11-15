import { describe, expect, it, vi } from 'vitest';

import {
  EXIT,
  exitCodeFor,
  main,
  overall,
  parseConfig,
  renderReport,
  runChecks,
  sessionFromSetCookie,
} from '../scripts/ops/synthetic-signin-check.mjs';

const BASE = 'https://dev.example.pages.dev';
const MEMBER = 'synthetic.member@example.test';
const ADMIN = 'synthetic.admin@example.test';
const ENV = { SYNTHETIC_BASE_URL: BASE, SYNTHETIC_MEMBER_EMAIL: MEMBER, SYNTHETIC_ADMIN_EMAIL: ADMIN };

// A fake site. `over` replaces any route by "METHOD path"; cookies decide who is signed in.
function site(over = {}) {
  const calls = [];
  const logins = [];
  const fetchFn = vi.fn(async (url, init = {}) => {
    const u = new URL(url);
    const method = init.method ?? 'GET';
    const key = `${method} ${u.pathname}`;
    const cookie = init.headers?.Cookie ?? '';
    const who = cookie.includes('SID-ADMIN') ? 'admin' : cookie.includes('SID-MEMBER') ? 'member' : null;
    calls.push({ key, who, body: init.body });
    if (over[key]) return over[key]({ who, init });
    const html = () => new Response('<html></html>', { status: 200, headers: { 'Content-Type': 'text/html' } });
    const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } });
    switch (key) {
      case 'GET /join/':
      case 'GET /fanclub/':
      case 'GET /admin/cms/':
        return html();
      case 'POST /api/login': {
        const email = JSON.parse(init.body).email;
        logins.push(email);
        const sid = email === ADMIN ? 'SID-ADMIN' : 'SID-MEMBER';
        return json({ ok: true }, 200, { 'Set-Cookie': `lgfc_session=${sid}; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax` });
      }
      case 'GET /api/session/me':
        return who ? json({ ok: true, email: who === 'admin' ? ADMIN : MEMBER, role: who }) : json({ ok: false }, 401);
      case 'GET /api/fanclub/home':
        return who ? json({ ok: true }) : json({ ok: false }, 401);
      case 'GET /api/admin/cms/list':
        if (who === 'admin') return json({ ok: true, blocks: [] });
        return json({ ok: false, error: who ? 'Admin required' : 'unauthorized' }, who ? 403 : 401);
      case 'POST /api/logout':
        return json({ ok: true });
      default:
        return new Response('not found', { status: 404 });
    }
  });
  return { fetchFn, calls, logins };
}

const run = (over, config = {}) => {
  const s = site(over);
  return runChecks({ baseUrl: BASE, memberEmail: MEMBER, adminEmail: ADMIN, fetchFn: s.fetchFn, ...config }).then((results) => ({ results, ...s }));
};
const byName = (results, name) => results.filter((r) => r.name === name);

describe('synthetic sign-in check (#4682): the passing run', () => {
  it('passes every check against a healthy site, in order, and signs both sessions out', async () => {
    const { results, calls } = await run();
    expect(results.map((r) => `${r.name}:${r.status}`)).toEqual([
      'join_page:pass',
      'member_sign_in:pass',
      'member_session:pass',
      'fanclub_data:pass',
      'fanclub_page:pass',
      'member_refused_by_admin:pass',
      'admin_sign_in:pass',
      'admin_endpoint:pass',
      'admin_page:pass',
      'sign_out:pass',
    ]);
    expect(overall(results)).toBe('pass');
    expect(exitCodeFor(results)).toBe(EXIT.PASS);
    expect(calls.filter((c) => c.key === 'POST /api/logout')).toHaveLength(2);
  });

  it('signs in exactly once per account and never retries', async () => {
    const { logins } = await run();
    expect(logins).toEqual([MEMBER, ADMIN]);
  });

  it('only reads: apart from sign-in and sign-out it sends no POST, PUT, PATCH or DELETE', async () => {
    const { calls } = await run();
    const writes = calls.map((c) => c.key).filter((k) => !k.startsWith('GET ') && k !== 'POST /api/login' && k !== 'POST /api/logout');
    expect(writes).toEqual([]);
  });
});

describe('synthetic sign-in check (#4682): each failure path', () => {
  it('join page down', async () => {
    const { results } = await run({ 'GET /join/': () => new Response('x', { status: 500 }) });
    expect(byName(results, 'join_page')[0]).toMatchObject({ status: 'fail', detail: '/join/ answered 500' });
    expect(exitCodeFor(results)).toBe(EXIT.FAIL);
  });

  it('a page that answers 200 but is not a page', async () => {
    const { results } = await run({ 'GET /fanclub/': () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } }) });
    expect(byName(results, 'fanclub_page')[0].status).toBe('fail');
  });

  it('member sign-in refused: reports the code, skips what depends on it, and still checks the admin', async () => {
    const { results, calls } = await run({
      'POST /api/login': ({ init }) => (JSON.parse(init.body).email === MEMBER
        ? new Response(JSON.stringify({ ok: false, code: 'email_not_verified' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
        : new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'lgfc_session=SID-ADMIN; Path=/' } })),
    });
    expect(byName(results, 'member_sign_in')[0].detail).toBe('sign-in answered 403 (email_not_verified)');
    for (const n of ['member_session', 'fanclub_data', 'fanclub_page', 'member_refused_by_admin']) expect(byName(results, n)[0].status).toBe('skipped');
    expect(byName(results, 'admin_endpoint')[0].status).toBe('pass');
    expect(calls.filter((c) => c.key === 'POST /api/login')).toHaveLength(2);
    expect(exitCodeFor(results)).toBe(EXIT.FAIL);
  });

  it('sign-in works but sets no session cookie', async () => {
    const { results } = await run({ 'POST /api/login': () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }) });
    expect(byName(results, 'member_sign_in')[0]).toMatchObject({ status: 'fail', detail: 'sign-in succeeded but set no session cookie' });
    expect(byName(results, 'admin_sign_in')[0].status).toBe('fail');
  });

  it('the session belongs to a different account', async () => {
    const { results } = await run({ 'GET /api/session/me': () => new Response(JSON.stringify({ ok: true, email: 'someone.else@example.test', role: 'member' }), { status: 200, headers: { 'Content-Type': 'application/json' } }) });
    expect(byName(results, 'member_session')[0]).toMatchObject({ status: 'fail', detail: 'the session belongs to a different account' });
  });

  it('the test member has the admin role', async () => {
    const { results } = await run({ 'GET /api/session/me': ({ who }) => new Response(JSON.stringify({ ok: true, email: who === 'admin' ? ADMIN : MEMBER, role: 'admin' }), { status: 200, headers: { 'Content-Type': 'application/json' } }) });
    expect(byName(results, 'member_session')[0].detail).toMatch(/role admin/);
  });

  it('member-only data fails to load', async () => {
    const { results } = await run({ 'GET /api/fanclub/home': () => new Response('{}', { status: 500 }) });
    expect(byName(results, 'fanclub_data')[0]).toMatchObject({ status: 'fail', detail: '/api/fanclub/home answered 500' });
  });

  it('the admin gate is open to a plain member', async () => {
    const { results } = await run({ 'GET /api/admin/cms/list': () => new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } }) });
    expect(byName(results, 'member_refused_by_admin')[0].status).toBe('fail');
    expect(byName(results, 'member_refused_by_admin')[0].detail).toMatch(/admin gate may be open/);
  });

  it('admin sign-in refused', async () => {
    const { results } = await run({
      'POST /api/login': ({ init }) => (JSON.parse(init.body).email === ADMIN
        ? new Response(JSON.stringify({ ok: false }), { status: 404, headers: { 'Content-Type': 'application/json' } })
        : new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'lgfc_session=SID-MEMBER; Path=/' } })),
    });
    expect(byName(results, 'admin_sign_in')[0].status).toBe('fail');
    expect(byName(results, 'admin_endpoint')[0].status).toBe('skipped');
    expect(byName(results, 'admin_page')[0].status).toBe('skipped');
  });

  it('admin endpoint and admin page fail for the admin', async () => {
    const { results } = await run({
      'GET /api/admin/cms/list': ({ who }) => (who === 'admin' ? new Response('{}', { status: 500 }) : new Response('{}', { status: 403 })),
      'GET /admin/cms/': () => new Response('x', { status: 404 }),
    });
    expect(byName(results, 'admin_endpoint')[0].status).toBe('fail');
    expect(byName(results, 'admin_page')[0].status).toBe('fail');
  });

  it('a network error is a failure with a reason, not a crash', async () => {
    const { results } = await run({ 'GET /join/': () => { throw new Error('socket hang up'); } });
    expect(byName(results, 'join_page')[0]).toMatchObject({ status: 'fail', detail: 'request failed: socket hang up' });
  });

  it('a timeout is reported as no answer', async () => {
    const timeout = Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' });
    const { results } = await run({ 'GET /join/': () => { throw timeout; } });
    expect(byName(results, 'join_page')[0].detail).toMatch(/no answer within 15 seconds/);
  });

  it('a failed sign-out is a warning that does not fail the run, and says what it means', async () => {
    const { results } = await run({ 'POST /api/logout': () => new Response('{}', { status: 500 }) });
    const out = byName(results, 'sign_out')[0];
    expect(out.status).toBe('warn');
    expect(out.detail).toMatch(/30 days/);
    expect(overall(results)).toBe('pass');
  });

  it('still signs the sessions out when a check in the middle fails', async () => {
    const { calls } = await run({ 'GET /api/fanclub/home': () => new Response('{}', { status: 500 }) });
    expect(calls.filter((c) => c.key === 'POST /api/logout')).toHaveLength(2);
  });
});

describe('synthetic sign-in check (#4682): configuration and secrecy', () => {
  it('is not configured without the three settings, and says which', () => {
    const c = parseConfig({});
    expect(c.ok).toBe(false);
    expect(c.problems.join('|')).toMatch(/SYNTHETIC_BASE_URL.*SYNTHETIC_MEMBER_EMAIL.*SYNTHETIC_ADMIN_EMAIL/);
  });

  it('accepts a Development URL and normalizes it to its origin', () => {
    expect(parseConfig({ ...ENV, SYNTHETIC_BASE_URL: `${BASE}/some/path` })).toMatchObject({ ok: true, baseUrl: BASE });
  });

  it('rejects a non-https URL, a bad URL, and the same address for both accounts', () => {
    expect(parseConfig({ ...ENV, SYNTHETIC_BASE_URL: 'http://dev.example' }).problems.join()).toMatch(/https/);
    expect(parseConfig({ ...ENV, SYNTHETIC_BASE_URL: 'not a url' }).problems.join()).toMatch(/valid URL/);
    expect(parseConfig({ ...ENV, SYNTHETIC_ADMIN_EMAIL: MEMBER.toUpperCase() }).problems.join()).toMatch(/different addresses/);
  });

  it('refuses Production unless both the flag and the acknowledgement are given', () => {
    const prod = { ...ENV, SYNTHETIC_BASE_URL: 'https://www.lougehrigfanclub.com' };
    expect(parseConfig(prod).ok).toBe(false);
    expect(parseConfig(prod, ['--allow-production']).ok).toBe(false);
    expect(parseConfig({ ...prod, SYNTHETIC_PRODUCTION_ACK: 'yes' }).ok).toBe(false);
    expect(parseConfig({ ...prod, SYNTHETIC_PRODUCTION_ACK: 'yes' }, ['--allow-production']).ok).toBe(true);
    expect(parseConfig({ ...ENV, SYNTHETIC_BASE_URL: 'https://lougehrigfanclub.com' }).ok).toBe(false);
  });

  it('rejects unknown arguments', () => {
    expect(() => parseConfig(ENV, ['--force'])).toThrow(/Unknown argument/);
  });

  it('exits with the not-configured code, never a pass, and runs no check', async () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await main({}, [])).toBe(EXIT.NOT_CONFIGURED);
    errors.mockRestore();
  });

  it('never prints either account address in the report', async () => {
    const { results } = await run();
    const report = renderReport(results, { baseUrl: BASE, when: '2026-11-15T12:00:00Z' });
    expect(report).not.toContain(MEMBER);
    expect(report).not.toContain(ADMIN);
    expect(report).toContain('all checks passed');
    expect(report).toContain('The test account addresses are never printed.');
  });

  it('a failing report names the failure and says a check failed', async () => {
    const { results } = await run({ 'GET /join/': () => new Response('x', { status: 500 }) });
    const report = renderReport(results, { baseUrl: BASE });
    expect(report).toContain('a check failed');
    expect(report).toContain('| join_page | FAIL |');
  });

  it('reads the session id out of a Set-Cookie header, or finds none', () => {
    expect(sessionFromSetCookie('lgfc_session=abc123; Max-Age=2592000; Path=/; HttpOnly')).toBe('abc123');
    expect(sessionFromSetCookie(['other=1; Path=/', 'lgfc_session=xyz%2B1; Path=/'])).toBe('xyz+1');
    expect(sessionFromSetCookie('lgfc_session=; Max-Age=0')).toBeNull();
    expect(sessionFromSetCookie(undefined)).toBeNull();
  });
});
