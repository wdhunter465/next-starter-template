import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { requireAdmin } from '../functions/_lib/auth';
import { ADMIN_SESSION_COOKIE, withAdminSession } from './helpers/adminSession';

// #3633: consolidated anonymous/member/admin auth matrix for /api/admin/**.
// Per-endpoint tests already exercise individual admin routes, but nothing
// previously tested requireAdmin()/requireAdminMember() itself across all
// three access levels, and nothing verified every admin route actually
// wires the check. Both gaps are real: requireAdmin is the single shared
// decision point every admin route delegates to (functions/_lib/auth.ts),
// so a matrix test here covers every route without duplicating it 60+ times.

function fakeDb() {
  return {
    prepare() {
      return {
        bind: () => ({ first: async () => null }),
      };
    },
  };
}

function adminRequest(cookie: string | null): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  return new Request('https://www.lougehrigfanclub.com/api/admin/stats', { headers });
}

describe('requireAdmin anonymous/member/admin matrix (#3633)', () => {
  it('denies anonymous requests (no session cookie) with 401', async () => {
    const res = await requireAdmin(adminRequest(null), { DB: fakeDb() });

    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it('denies an authenticated non-admin member with 403', async () => {
    const db = withAdminSession(fakeDb(), 'member');
    const res = await requireAdmin(adminRequest(ADMIN_SESSION_COOKIE), { DB: db });

    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it('allows an authenticated admin member through (returns null)', async () => {
    const db = withAdminSession(fakeDb(), 'admin');
    const res = await requireAdmin(adminRequest(ADMIN_SESSION_COOKIE), { DB: db });

    expect(res).toBeNull();
  });

  it('fails closed with 503 when the D1 binding is missing', async () => {
    const res = await requireAdmin(adminRequest(ADMIN_SESSION_COOKIE), {});

    expect(res).not.toBeNull();
    expect(res!.status).toBe(503);
  });
});

describe('admin route auth coverage (#3633)', () => {
  const adminDir = path.join(process.cwd(), 'functions/api/admin');

  function listAdminHandlerFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        out.push(...listAdminHandlerFiles(full));
        continue;
      }
      if (entry.name.endsWith('.ts') && entry.name !== '_middleware.ts') {
        out.push(full);
      }
    }
    return out;
  }

  // A file either calls requireAdmin/requireAdminMember directly, or is a
  // thin `export { onRequestX } from '<relative path>'` re-export shim —
  // resolve those one level before checking, since the real guard lives at
  // the re-export target (e.g. functions/api/admin/reports/list.ts ->
  // functions/api/reports/list.ts).
  function resolvesToAdminGuard(filePath: string, seen = new Set<string>()): boolean {
    if (seen.has(filePath)) return false; // guard against re-export cycles
    seen.add(filePath);

    const source = fs.readFileSync(filePath, 'utf8');
    if (/requireAdmin(Member)?\s*\(/.test(source)) return true;

    const reExport = source.match(/export\s*\{[^}]*\}\s*from\s*['"](\.[^'"]+)['"]/);
    if (!reExport) return false;

    const target = path.join(path.dirname(filePath), `${reExport[1]}.ts`);
    if (!fs.existsSync(target)) return false;

    return resolvesToAdminGuard(target, seen);
  }

  it('every /api/admin/** route file (directly or via re-export) enforces requireAdmin/requireAdminMember', () => {
    const files = listAdminHandlerFiles(adminDir);
    expect(files.length).toBeGreaterThan(0);

    const unguarded = files.filter((file) => !resolvesToAdminGuard(file));

    expect(unguarded).toEqual([]);
  });
});
