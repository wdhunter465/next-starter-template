// #5112: email verification for new members. The real join, login, verify and resend handlers run
// against a real-schema in-memory SQLite database (every migration applied in order). Only the
// outgoing email is replaced, so the test can read the link that would have been mailed.

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const verificationMail = vi.fn().mockResolvedValue({ sent: true, provider: 'test' });

vi.mock('../functions/_lib/email', () => ({
  assertEmailEnvOrThrow: vi.fn(),
  sendWelcomeEmail: vi.fn().mockResolvedValue({ sent: false, provider: 'disabled' }),
  sendTransactionalJoinConfirmation: vi.fn().mockResolvedValue({ sent: false, provider: 'disabled' }),
  sendAdminJoinNotification: vi.fn().mockResolvedValue({ sent: false, provider: 'disabled' }),
  sendVerificationEmail: (...args: unknown[]) => verificationMail(...args),
  sendWelcomeVerificationEmail: (...args: unknown[]) => verificationMail(...args),
}));

const join = (await import('../functions/api/join')).onRequestPost;
const login = (await import('../functions/api/login')).onRequestPost;
const verify = (await import('../functions/api/verify-email')).onRequestPost;
const resend = (await import('../functions/api/verify-email-resend')).onRequestPost;
const { hashVerificationToken } = await import('../functions/_lib/email-verification');

const migrationsDir = path.join(process.cwd(), 'migrations');
const MIGRATION = '0096_email_verification_5112.sql';

function migrate(sqlite: DatabaseSync, options?: { stopBefore?: string }) {
  for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    if (options?.stopBefore && file >= options.stopBefore) break;
    sqlite.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }
}

function d1(sqlite: DatabaseSync) {
  return {
    prepare(sql: string) {
      const stmt = sqlite.prepare(sql);
      const bound = (...args: SQLInputValue[]) => ({
        async first() {
          return stmt.get(...args) ?? null;
        },
        async all() {
          return { results: stmt.all(...args) };
        },
        async run() {
          const info = stmt.run(...args);
          return { success: true, meta: { changes: Number(info.changes) } };
        },
      });
      return { bind: bound, ...bound() };
    },
  };
}

function post(url: string, body: unknown): Request {
  return new Request(`https://www.lougehrigfanclub.com${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '203.0.113.9' },
    body: JSON.stringify(body),
  });
}

function setup() {
  const sqlite = new DatabaseSync(':memory:');
  migrate(sqlite);
  const env = { DB: d1(sqlite), NEXT_PUBLIC_SITE_URL: 'https://www.lougehrigfanclub.com' };
  const call = (handler: (c: any) => Promise<Response>, url: string, body: unknown) => handler({ env, request: post(url, body) });
  return { sqlite, env, call };
}

function tokenFromLastMail(): string {
  const { link } = verificationMail.mock.calls.at(-1)![0] as { link: string };
  const token = new URL(link).searchParams.get('token');
  expect(link).toMatch(/^https:\/\/www\.lougehrigfanclub\.com\/join\/verified\/\?token=[0-9a-f]{64}$/);
  return token!;
}

const JANE = { first_name: 'Jane', last_name: 'Doe', screen_name: 'jd', email: 'Jane@Example.com' };

beforeEach(() => {
  verificationMail.mockClear();
});

describe('joining no longer signs the new member in (#5112)', () => {
  it('creates an unverified member, emails one link, and sets no session cookie', async () => {
    const { sqlite, call } = setup();
    const res = await call(join, '/api/join', JANE);
    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie')).toBeNull();
    const body = (await res.json()) as any;
    expect(body).toMatchObject({ ok: true, status: 'joined', verification_required: true });

    expect(sqlite.prepare(`SELECT email, email_verified_at FROM members WHERE email = 'jane@example.com'`).get()).toEqual({
      email: 'jane@example.com',
      email_verified_at: null,
    });
    // #5120: exactly one email to the member, and it is the one that carries the link.
    expect(verificationMail).toHaveBeenCalledTimes(1);
    expect((verificationMail.mock.calls[0][0] as any).toEmail).toBe('jane@example.com');
    expect((verificationMail.mock.calls[0][0] as any).emailOptIn).toBe(true);
    expect(sqlite.prepare(`SELECT COUNT(*) AS n FROM member_sessions`).get()).toEqual({ n: 0 });
  });

  it('stores only a hash of the token, never the token itself', async () => {
    const { sqlite, call } = setup();
    await call(join, '/api/join', JANE);
    const token = tokenFromLastMail();
    const rows = sqlite.prepare(`SELECT token_hash FROM email_verification_tokens`).all() as Array<{ token_hash: string }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].token_hash).toBe(await hashVerificationToken(token));
    expect(rows[0].token_hash).not.toBe(token);
    expect(JSON.stringify(sqlite.prepare(`SELECT * FROM email_verification_tokens`).all())).not.toContain(token);
  });

  it('keeps answering a repeat join with 409', async () => {
    const { call } = setup();
    await call(join, '/api/join', JANE);
    const again = await call(join, '/api/join', JANE);
    expect(again.status).toBe(409);
  });
});

describe('an unverified member cannot sign in (#5112)', () => {
  it('refuses /api/login with email_not_verified and creates no session', async () => {
    const { sqlite, call } = setup();
    await call(join, '/api/join', JANE);
    const res = await call(login, '/api/login', { email: 'jane@example.com' });
    expect(res.status).toBe(403);
    expect(res.headers.get('Set-Cookie')).toBeNull();
    expect(((await res.json()) as any).code).toBe('email_not_verified');
    expect(sqlite.prepare(`SELECT COUNT(*) AS n FROM member_sessions`).get()).toEqual({ n: 0 });
  });

  it('lets the member sign in after the link is used', async () => {
    const { call } = setup();
    await call(join, '/api/join', JANE);
    const token = tokenFromLastMail();
    expect((await call(verify, '/api/verify-email', { token })).status).toBe(200);
    const res = await call(login, '/api/login', { email: 'jane@example.com' });
    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie')).toContain('lgfc_session=');
  });
});

describe('POST /api/verify-email (#5112)', () => {
  it('verifies the address, signs the member in, and uses the token up', async () => {
    const { sqlite, call } = setup();
    await call(join, '/api/join', JANE);
    const token = tokenFromLastMail();

    const res = await call(verify, '/api/verify-email', { token });
    expect(res.status).toBe(200);
    expect(res.headers.get('Set-Cookie')).toMatch(/^lgfc_session=[0-9a-f]{48}; .*HttpOnly; Secure; SameSite=Lax/);
    expect(((await res.json()) as any).status).toBe('verified');

    expect((sqlite.prepare(`SELECT email_verified_at FROM members WHERE email = 'jane@example.com'`).get() as any).email_verified_at).not.toBeNull();
    expect(sqlite.prepare(`SELECT email FROM member_sessions`).all()).toEqual([{ email: 'jane@example.com' }]);

    const second = await call(verify, '/api/verify-email', { token });
    expect(second.status).toBe(400);
    expect(second.headers.get('Set-Cookie')).toBeNull();
    expect(((await second.json()) as any).code).toBe('invalid_token');
    expect(sqlite.prepare(`SELECT COUNT(*) AS n FROM member_sessions`).get()).toEqual({ n: 1 });
  });

  it('refuses an expired token', async () => {
    const { sqlite, call } = setup();
    await call(join, '/api/join', JANE);
    const token = tokenFromLastMail();
    sqlite.exec(`UPDATE email_verification_tokens SET expires_at = strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 minutes')`);
    const res = await call(verify, '/api/verify-email', { token });
    expect(res.status).toBe(400);
    expect(sqlite.prepare(`SELECT COUNT(*) AS n FROM member_sessions`).get()).toEqual({ n: 0 });
    expect((sqlite.prepare(`SELECT email_verified_at FROM members WHERE email = 'jane@example.com'`).get() as any).email_verified_at).toBeNull();
  });

  it('refuses unknown, malformed and missing tokens', async () => {
    const { call } = setup();
    for (const token of ['0'.repeat(64), 'abc', '', "x' OR '1'='1", null, 123]) {
      const res = await call(verify, '/api/verify-email', { token });
      expect(res.status, `token ${String(token)}`).toBe(400);
    }
    expect((await call(verify, '/api/verify-email', {})).status).toBe(400);
  });

  it('lets only one of two simultaneous clicks succeed', async () => {
    const { sqlite, call } = setup();
    await call(join, '/api/join', JANE);
    const token = tokenFromLastMail();
    const results = await Promise.all([call(verify, '/api/verify-email', { token }), call(verify, '/api/verify-email', { token })]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
    expect(sqlite.prepare(`SELECT COUNT(*) AS n FROM member_sessions`).get()).toEqual({ n: 1 });
  });

  it('does not sign in a member who was soft-deleted after joining', async () => {
    const { sqlite, call } = setup();
    await call(join, '/api/join', JANE);
    const token = tokenFromLastMail();
    sqlite.exec(`UPDATE members SET deleted_at = datetime('now') WHERE email = 'jane@example.com'`);
    const res = await call(verify, '/api/verify-email', { token });
    expect(res.status).toBe(403);
    expect(res.headers.get('Set-Cookie')).toBeNull();
    expect(sqlite.prepare(`SELECT COUNT(*) AS n FROM member_sessions`).get()).toEqual({ n: 0 });
  });
});

describe('POST /api/verify-email-resend (#5112)', () => {
  it('sends a new link to a pending member, but not twice within a minute', async () => {
    const { sqlite, call } = setup();
    await call(join, '/api/join', JANE);
    verificationMail.mockClear();

    const tooSoon = await call(resend, '/api/verify-email-resend', { email: 'jane@example.com' });
    expect(tooSoon.status).toBe(200);
    expect(verificationMail).not.toHaveBeenCalled();

    sqlite.exec(`UPDATE email_verification_tokens SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ','now','-2 minutes')`);
    const ok = await call(resend, '/api/verify-email-resend', { email: 'JANE@example.com' });
    expect(ok.status).toBe(200);
    expect(verificationMail).toHaveBeenCalledTimes(1);
    const token = tokenFromLastMail();
    expect((await call(verify, '/api/verify-email', { token })).status).toBe(200);
  });

  it('answers the same for a verified member and an unknown address, and sends nothing', async () => {
    const { call } = setup();
    await call(join, '/api/join', JANE);
    await call(verify, '/api/verify-email', { token: tokenFromLastMail() });
    verificationMail.mockClear();

    const verified = await call(resend, '/api/verify-email-resend', { email: 'jane@example.com' });
    const unknown = await call(resend, '/api/verify-email-resend', { email: 'nobody@example.com' });
    expect(verified.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(await verified.json()).toEqual(await unknown.json());
    expect(verificationMail).not.toHaveBeenCalled();
  });

  it('rejects a missing email', async () => {
    const { call } = setup();
    expect((await call(resend, '/api/verify-email-resend', {})).status).toBe(400);
  });
});

describe('migration 0096 keeps existing members signed in (#5112)', () => {
  it('marks every existing member, and every member created from a join request, as verified', async () => {
    const sqlite = new DatabaseSync(':memory:');
    migrate(sqlite, { stopBefore: MIGRATION });
    sqlite.exec(`
      INSERT INTO join_requests (name, email, first_name, last_name) VALUES ('Old Timer', 'Old@Example.com', 'Old', 'Timer');
      INSERT INTO members (email, role) VALUES ('member@example.com', 'member');
    `);
    sqlite.exec(fs.readFileSync(path.join(migrationsDir, MIGRATION), 'utf8'));

    const rows = sqlite.prepare(`SELECT email, email_verified_at FROM members ORDER BY email`).all() as Array<{ email: string; email_verified_at: string | null }>;
    expect(rows.length).toBeGreaterThanOrEqual(3);
    expect(rows.every((row) => row.email_verified_at !== null)).toBe(true);
    expect(rows.map((row) => row.email)).toContain('old@example.com');

    const env = { DB: d1(sqlite) };
    const res = await login({ env, request: post('/api/login', { email: 'old@example.com' }) } as any);
    expect(res.status).toBe(200);
  });

  it('lets login work before the migration is applied (deploy before migration)', async () => {
    const sqlite = new DatabaseSync(':memory:');
    migrate(sqlite, { stopBefore: MIGRATION });
    sqlite.exec(`INSERT INTO join_requests (name, email, first_name, last_name) VALUES ('Old Timer', 'old@example.com', 'Old', 'Timer');`);
    const res = await login({ env: { DB: d1(sqlite) }, request: post('/api/login', { email: 'old@example.com' }) } as any);
    expect(res.status).toBe(200);
  });
});
