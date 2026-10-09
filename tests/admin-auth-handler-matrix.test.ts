import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { ADMIN_SESSION_COOKIE, withAdminSession } from './helpers/adminSession';

// #4466 (gap rows 8, 27, 29): executable anonymous/member matrix for /api/admin/**.
//
// tests/admin-auth-matrix.test.ts proves requireAdmin() itself denies correctly and that
// every admin route FILE mentions the guard. That static check cannot see a handler that
// calls requireAdmin() but ignores its result, or does work before calling it. This test
// calls every exported handler of every admin route file with no session and with a
// signed-in non-admin member, and requires a denial before any database access.

const adminDir = path.join(process.cwd(), 'functions/api/admin');

const HANDLER_METHOD: Record<string, string> = {
  onRequestGet: 'GET',
  onRequestPost: 'POST',
  onRequestPut: 'PUT',
  onRequestPatch: 'PATCH',
  onRequestDelete: 'DELETE',
  onRequest: 'GET',
};

// Handlers that intentionally answer without checking a session because they do nothing.
// Each entry must stay a constant "method not allowed" response (no data, no database).
const KNOWN_STATIC_RESPONSES: Record<string, number> = {
  'media-assets/sync-from-b2.ts#onRequestGet': 405, // GET stub; the POST handler in the same file is guarded
};

function listAdminRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listAdminRouteFiles(full));
    else if (entry.name.endsWith('.ts') && entry.name !== '_middleware.ts') out.push(full);
  }
  return out.sort();
}

type Level = 'anonymous' | 'member';

function touchTrackingDb(touched: string[], level: Level) {
  const db = {
    prepare(sql: string) {
      touched.push(sql.replace(/\s+/g, ' ').slice(0, 60));
      throw new Error(`database touched before the auth denial: ${sql.slice(0, 60)}`);
    },
  };
  // The member double answers only the two session/role lookups requireAdmin() makes.
  return level === 'member' ? withAdminSession(db as never, 'member') : db;
}

async function callHandler(handler: (ctx: unknown) => unknown, method: string, level: Level) {
  const touched: string[] = [];
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (level === 'member') headers.Cookie = ADMIN_SESSION_COOKIE;
  const request = new Request('https://www.lougehrigfanclub.com/api/admin/matrix-probe', {
    method,
    headers,
    body: method === 'GET' ? undefined : '{}',
  });
  let status: number | string;
  try {
    const res = await handler({
      request,
      env: { DB: touchTrackingDb(touched, level) },
      params: {},
      data: {},
      waitUntil() {},
      next: async () => new Response('next'),
    });
    status = res instanceof Response ? res.status : 'not-a-response';
  } catch (error) {
    status = `threw: ${error instanceof Error ? error.message : String(error)}`;
  }
  return { status, touched };
}

describe('admin handler anonymous/member matrix (#4466)', () => {
  it('every exported admin handler denies anonymous with 401 and a member with 403, before any database access', async () => {
    const violations: string[] = [];
    let handlersChecked = 0;
    const staticSeen = new Set<string>();

    for (const file of listAdminRouteFiles(adminDir)) {
      const relative = path.relative(adminDir, file);
      const mod = (await import(/* @vite-ignore */ file)) as Record<string, unknown>;
      const handlers = Object.keys(mod).filter(
        (name) => name in HANDLER_METHOD && typeof mod[name] === 'function',
      );
      if (handlers.length === 0) violations.push(`${relative}: exports no onRequest handler`);

      for (const name of handlers) {
        handlersChecked += 1;
        const key = `${relative}#${name}`;
        const method = HANDLER_METHOD[name];
        const known = KNOWN_STATIC_RESPONSES[key];
        if (known !== undefined) staticSeen.add(key);

        for (const level of ['anonymous', 'member'] as Level[]) {
          const expected = known ?? (level === 'anonymous' ? 401 : 403);
          const { status, touched } = await callHandler(mod[name] as never, method, level);
          if (status !== expected) violations.push(`${key} ${level}: expected ${expected}, got ${status}`);
          if (touched.length > 0) violations.push(`${key} ${level}: touched the database first (${touched[0]})`);
        }
      }
    }

    expect(violations).toEqual([]);
    // Guard against a vacuous pass if the route tree is moved or the glob stops matching.
    expect(handlersChecked).toBeGreaterThan(60);
    // A stale allowlist entry means the stub changed or moved; remove or update it.
    expect([...staticSeen].sort()).toEqual(Object.keys(KNOWN_STATIC_RESPONSES).sort());
  });
});
