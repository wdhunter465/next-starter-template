/**
 * synthetic-signin-check.mjs (#4682, gap 2 of the launch monitoring review #4657)
 *
 * Signs in as a test member and a test admin on a site and confirms the pages and endpoints that depend on a
 * session load. It exists so a broken sign-in is noticed before a member notices it.
 *
 * What it checks, in order: the join page loads; the test member can sign in; the session is the member's;
 * the member-only Club Home data loads; the Fan Club page loads; the member is REFUSED by an admin endpoint
 * (the admin gate still holds); the test admin can sign in; the admin endpoint loads for the admin; the admin
 * page loads. Both sessions are signed out at the end, whatever happened.
 *
 * Safety rules, all tested:
 *   - It reads only. It creates no account and writes nothing except the two sessions it signs out.
 *   - One sign-in attempt per account per run and no retry. The login endpoint locks an address out after 3 failed
 *     attempts per hour, so a failed sign-in is reported, never repeated.
 *   - The account emails come from the environment and are never printed or put in the report. Sign-in is by
 *     email alone (docs/reference/design/auth-model.md), so for the admin account the address is as sensitive as a
 *     password.
 *   - It refuses to run against Production unless --allow-production and SYNTHETIC_PRODUCTION_ACK=yes are both set.
 *     Production test accounts do not exist yet: they wait for Product Authority to name where the credentials live.
 *
 * Usage:
 *   SYNTHETIC_BASE_URL=https://<development site> SYNTHETIC_MEMBER_EMAIL=... SYNTHETIC_ADMIN_EMAIL=... \
 *   node scripts/ops/synthetic-signin-check.mjs [--allow-production] [--out synthetic-signin-report.md]
 *
 * Exit code: 0 all checks passed; 1 a check failed; 2 not configured or refused (never a silent pass).
 */

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const COOKIE_NAME = 'lgfc_session';
export const PRODUCTION_HOSTS = ['lougehrigfanclub.com', 'www.lougehrigfanclub.com'];
export const EXIT = { PASS: 0, FAIL: 1, NOT_CONFIGURED: 2 };
const TIMEOUT_MS = 15_000;

export function parseConfig(env = {}, argv = []) {
  const options = { allowProduction: false, out: 'synthetic-signin-report.md' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--allow-production') options.allowProduction = true;
    else if (arg === '--out') options.out = argv[++i];
    else throw new Error(`Unknown argument: ${arg}`);
  }

  const problems = [];
  const rawBase = String(env.SYNTHETIC_BASE_URL ?? '').trim();
  const memberEmail = String(env.SYNTHETIC_MEMBER_EMAIL ?? '').trim();
  const adminEmail = String(env.SYNTHETIC_ADMIN_EMAIL ?? '').trim();
  if (!rawBase) problems.push('SYNTHETIC_BASE_URL is not set');
  if (!memberEmail) problems.push('SYNTHETIC_MEMBER_EMAIL is not set');
  if (!adminEmail) problems.push('SYNTHETIC_ADMIN_EMAIL is not set');

  let baseUrl = '';
  if (rawBase) {
    try {
      const url = new URL(rawBase);
      if (url.protocol !== 'https:') problems.push('SYNTHETIC_BASE_URL must be https');
      baseUrl = url.origin;
      const production = PRODUCTION_HOSTS.includes(url.hostname);
      if (production && !(options.allowProduction && env.SYNTHETIC_PRODUCTION_ACK === 'yes')) {
        problems.push('the base URL is Production; it needs --allow-production and SYNTHETIC_PRODUCTION_ACK=yes');
      }
    } catch {
      problems.push('SYNTHETIC_BASE_URL is not a valid URL');
    }
  }
  if (memberEmail && adminEmail && memberEmail.toLowerCase() === adminEmail.toLowerCase()) {
    problems.push('the member and admin test accounts must be different addresses');
  }
  return { ok: problems.length === 0, problems, baseUrl, memberEmail, adminEmail, options };
}

/** The session id from a Set-Cookie header, or null. */
export function sessionFromSetCookie(setCookie) {
  const text = Array.isArray(setCookie) ? setCookie.join(', ') : String(setCookie ?? '');
  const match = new RegExp(`${COOKIE_NAME}=([^;,\\s]+)`).exec(text);
  return match && match[1] ? decodeURIComponent(match[1]) : null;
}

async function request(fetchFn, url, { method = 'GET', cookie = null, json = null } = {}) {
  const headers = { Accept: method === 'GET' ? 'text/html,application/json' : 'application/json', 'User-Agent': 'lgfc-synthetic-signin-check' };
  if (cookie) headers.Cookie = `${COOKIE_NAME}=${encodeURIComponent(cookie)}`;
  let body;
  if (json) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(json);
  }
  const response = await fetchFn(url, { method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
  const text = await response.text().catch(() => '');
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  const setCookie = typeof response.headers?.getSetCookie === 'function' ? response.headers.getSetCookie() : response.headers?.get?.('set-cookie');
  return { status: response.status, text, data, setCookie, contentType: response.headers?.get?.('content-type') ?? '' };
}

const pass = (name, detail = '') => ({ name, status: 'pass', detail });
const fail = (name, detail) => ({ name, status: 'fail', detail });
const skip = (name, detail) => ({ name, status: 'skipped', detail });
const warn = (name, detail) => ({ name, status: 'warn', detail });

async function guarded(name, fn) {
  try {
    return await fn();
  } catch (error) {
    const reason = error?.name === 'TimeoutError' ? `no answer within ${TIMEOUT_MS / 1000} seconds` : (error instanceof Error ? error.message : String(error));
    return fail(name, `request failed: ${reason}`);
  }
}

export async function runChecks({ baseUrl, memberEmail, adminEmail, fetchFn = fetch }) {
  const results = [];
  const sessions = [];
  const at = (path) => `${baseUrl}${path}`;
  const page = (name, path) =>
    guarded(name, async () => {
      const r = await request(fetchFn, at(path));
      if (r.status !== 200) return fail(name, `${path} answered ${r.status}`);
      if (!/text\/html/i.test(r.contentType)) return fail(name, `${path} did not return a page`);
      return pass(name, `${path} loaded`);
    });

  async function signIn(label, email) {
    const name = `${label}_sign_in`;
    const result = await guarded(name, async () => {
      const r = await request(fetchFn, at('/api/login'), { method: 'POST', json: { email } });
      if (r.status !== 200 || r.data?.ok !== true) return fail(name, `sign-in answered ${r.status}${r.data?.code ? ` (${r.data.code})` : ''}`);
      const session = sessionFromSetCookie(r.setCookie);
      if (!session) return fail(name, 'sign-in succeeded but set no session cookie');
      return { ...pass(name, 'signed in, session cookie set'), session };
    });
    if (result.session) sessions.push(result.session);
    return result;
  }

  try {
    results.push(await page('join_page', '/join/'));

    const member = await signIn('member', memberEmail);
    results.push({ name: member.name, status: member.status, detail: member.detail });

    if (member.session) {
      results.push(
        await guarded('member_session', async () => {
          const r = await request(fetchFn, at('/api/session/me'), { cookie: member.session });
          if (r.status !== 200 || r.data?.ok !== true) return fail('member_session', `session lookup answered ${r.status}`);
          if (String(r.data.email ?? '').toLowerCase() !== memberEmail.toLowerCase()) return fail('member_session', 'the session belongs to a different account');
          if (r.data.role && r.data.role !== 'member') return fail('member_session', `the test member has role ${r.data.role}`);
          return pass('member_session', 'session is the test member');
        }),
      );
      results.push(
        await guarded('fanclub_data', async () => {
          const r = await request(fetchFn, at('/api/fanclub/home'), { cookie: member.session });
          if (r.status !== 200) return fail('fanclub_data', `/api/fanclub/home answered ${r.status}`);
          return pass('fanclub_data', 'member-only Club Home data loaded');
        }),
      );
      results.push(await page('fanclub_page', '/fanclub/'));
      results.push(
        await guarded('member_refused_by_admin', async () => {
          const r = await request(fetchFn, at('/api/admin/cms/list'), { cookie: member.session });
          if (r.status === 403 || r.status === 401) return pass('member_refused_by_admin', `admin endpoint refused the member (${r.status})`);
          return fail('member_refused_by_admin', `admin endpoint answered ${r.status} to a plain member; the admin gate may be open`);
        }),
      );
    } else {
      for (const name of ['member_session', 'fanclub_data', 'fanclub_page', 'member_refused_by_admin']) results.push(skip(name, 'member sign-in failed'));
    }

    const admin = await signIn('admin', adminEmail);
    results.push({ name: admin.name, status: admin.status, detail: admin.detail });

    if (admin.session) {
      results.push(
        await guarded('admin_endpoint', async () => {
          const r = await request(fetchFn, at('/api/admin/cms/list'), { cookie: admin.session });
          if (r.status !== 200) return fail('admin_endpoint', `/api/admin/cms/list answered ${r.status} to the test admin`);
          return pass('admin_endpoint', 'admin endpoint loaded for the test admin');
        }),
      );
      results.push(await page('admin_page', '/admin/cms/'));
    } else {
      for (const name of ['admin_endpoint', 'admin_page']) results.push(skip(name, 'admin sign-in failed'));
    }
  } finally {
    // Sign both sessions out whatever happened, so no 30-day session is left behind.
    const outcomes = [];
    for (const session of sessions) {
      outcomes.push(
        await guarded('sign_out', async () => {
          const r = await request(fetchFn, at('/api/logout'), { method: 'POST', cookie: session });
          return r.status === 200 ? pass('sign_out') : warn('sign_out', `logout answered ${r.status}`);
        }),
      );
    }
    if (sessions.length) {
      const bad = outcomes.filter((o) => o.status !== 'pass').length;
      results.push(
        bad
          ? warn('sign_out', `${bad} of ${sessions.length} sign-out(s) failed; those sessions stay valid for up to 30 days`)
          : pass('sign_out', `${sessions.length} session(s) signed out`),
      );
    }
  }
  return results;
}

export function overall(results) {
  return results.some((r) => r.status === 'fail') ? 'fail' : 'pass';
}

export function exitCodeFor(results) {
  return overall(results) === 'fail' ? EXIT.FAIL : EXIT.PASS;
}

export function renderReport(results, { baseUrl, when = new Date().toISOString() } = {}) {
  const mark = { pass: 'pass', fail: 'FAIL', skipped: 'skipped', warn: 'warning' };
  return [
    '## Synthetic sign-in check',
    '',
    `Site: ${baseUrl}. Run: ${when}. Result: **${overall(results) === 'pass' ? 'all checks passed' : 'a check failed'}**.`,
    '',
    '| Check | Result | Detail |',
    '| --- | --- | --- |',
    ...results.map((r) => `| ${r.name} | ${mark[r.status]} | ${r.detail ?? ''} |`),
    '',
    'The test account addresses are never printed.',
  ].join('\n');
}

export async function main(env = process.env, argv = process.argv.slice(2)) {
  const config = parseConfig(env, argv);
  if (!config.ok) {
    console.error(`Not configured, no check was run:\n- ${config.problems.join('\n- ')}`);
    return EXIT.NOT_CONFIGURED;
  }
  const results = await runChecks(config);
  const report = renderReport(results, { baseUrl: config.baseUrl });
  fs.writeFileSync(config.options.out, `${report}\n`);
  console.log(report);
  return exitCodeFor(results);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
