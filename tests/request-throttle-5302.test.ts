// @vitest-environment node
// #5302 (item 1 of #4767): per-address sign-in limit and a per-IP throttle on join and ask, on the real schema.
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { beforeEach, describe, expect, it } from 'vitest';

import { onRequestPost as askPost } from '../functions/api/ask';
import { onRequestPost as joinPost } from '../functions/api/join';
import { onRequestPost as loginPost } from '../functions/api/login';
import {
  ASK_PER_IP_PER_HOUR,
  JOIN_PER_IP_PER_HOUR,
  LOGIN_FAILED_PER_ADDRESS_PER_HOUR,
  overIpThrottle,
} from '../functions/_lib/request-throttle';

const migrationsDir = path.join(process.cwd(), 'migrations');

function d1Adapter(db: DatabaseSync) {
  return {
    prepare(sql: string) {
      const statement = db.prepare(sql);
      const bind = (...args: unknown[]) => ({
        first: async () => (statement.get(...(args as never[])) as unknown) ?? null,
        all: async () => ({ results: statement.all(...(args as never[])) as unknown[] }),
        run: async () => ({ meta: { changes: Number(statement.run(...(args as never[])).changes) } }),
      });
      return { bind, ...bind() };
    },
  };
}

let sqlite: DatabaseSync;
beforeEach(() => {
  sqlite = new DatabaseSync(':memory:');
  for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    sqlite.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }
});

const env = () => ({ DB: d1Adapter(sqlite) }) as never;
const post = (url: string, body: unknown, ip: string) =>
  new Request(`https://www.lougehrigfanclub.com${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(body),
  });
const login = (email: string, ip: string) => loginPost({ env: env(), request: post('/api/login', { email }, ip) });

describe('per-address sign-in limit', () => {
  it('refuses the 6th failure for one unknown address from different IPs, with the same message as the per-IP limit', async () => {
    for (let i = 0; i < LOGIN_FAILED_PER_ADDRESS_PER_HOUR; i += 1) {
      const res = await login('nobody@example.com', `198.51.100.${i + 1}`);
      expect(res.status).toBe(404);
    }
    const blocked = await login('nobody@example.com', '198.51.100.99');
    expect(blocked.status).toBe(429);
    expect(((await blocked.json()) as { error: string }).error).toMatch(/Too many failed attempts/);
    // another address from a fresh IP is unaffected
    expect((await login('someone@example.com', '198.51.100.200')).status).toBe(404);
  });

  it('is case-insensitive on the address', async () => {
    for (let i = 0; i < LOGIN_FAILED_PER_ADDRESS_PER_HOUR; i += 1) await login('Nobody@Example.com', `192.0.2.${i + 1}`);
    expect((await login('NOBODY@example.com', '192.0.2.99')).status).toBe(429);
  });

  it('does not touch a real member signing in, and does not count successes', async () => {
    sqlite.prepare("INSERT INTO join_requests (name, email, first_name, last_name) VALUES ('T','real@example.com','T','T')").run();
    for (let i = 0; i < 8; i += 1) expect((await login('real@example.com', '203.0.113.5')).status).toBe(200);
    expect((sqlite.prepare("SELECT COUNT(*) AS n FROM login_attempts WHERE ok = 0").get() as { n: number }).n).toBe(0);
  });

  it('ignores failures older than an hour', async () => {
    for (let i = 0; i < 6; i += 1) {
      sqlite.prepare("INSERT INTO login_attempts (ip, email, ok, created_at) VALUES (?, 'old@example.com', 0, datetime('now','-2 hours'))").run(`10.0.0.${i}`);
    }
    expect((await login('old@example.com', '10.9.9.9')).status).toBe(404);
  });
});

describe('join and ask throttle', () => {
  it('throttles ask after the limit per IP, not another IP', async () => {
    const ask = (ip: string) =>
      askPost({ env: env(), request: post('/api/ask', { first_name: '', last_name: '', email: 'x@example.com', question: 'q' }, ip) });
    for (let i = 0; i < ASK_PER_IP_PER_HOUR; i += 1) expect((await ask('203.0.113.50')).status).not.toBe(429);
    expect((await ask('203.0.113.50')).status).toBe(429);
    expect((await ask('203.0.113.51')).status).not.toBe(429);
  });

  it('throttles join after the limit per IP, not another IP', async () => {
    const join = (ip: string) => joinPost({ env: env(), request: post('/api/join', {}, ip) });
    for (let i = 0; i < JOIN_PER_IP_PER_HOUR; i += 1) expect((await join('203.0.113.60')).status).not.toBe(429);
    expect((await join('203.0.113.60')).status).toBe(429);
    expect((await join('203.0.113.61')).status).not.toBe(429);
  });

  it('keeps the join and ask buckets separate, and never affects the sign-in failure count', async () => {
    for (let i = 0; i < 10; i += 1) expect(await overIpThrottle(d1Adapter(sqlite) as never, '1.2.3.4', 'join', 10)).toBe(false);
    expect(await overIpThrottle(d1Adapter(sqlite) as never, '1.2.3.4', 'join', 10)).toBe(true);
    expect(await overIpThrottle(d1Adapter(sqlite) as never, '1.2.3.4', 'ask', 10)).toBe(false);
    expect((await login('nobody@example.com', '1.2.3.4')).status).toBe(404);
  });

  it('fails open when the database cannot answer', async () => {
    const broken = { prepare() { throw new Error('db down'); } };
    expect(await overIpThrottle(broken as never, '1.2.3.4', 'join', 1)).toBe(false);
  });
});
