// Cloudflare Pages Function for POST /api/login
// - Validates that the email exists in join_requests
// - Creates a cookie-backed session in member_sessions (30 days)
// - Rate limits: max 3 failed attempts per IP per hour

import { requireD1, requireTables, jsonResponse, type Env } from '../_lib/d1';
import { isMemberSoftDeleted, newSessionIdHex, setSessionCookie } from '../_lib/session';

function getIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For') ||
    request.headers.get('X-Real-IP') ||
    'unknown'
  );
}

async function countRecentFailedAttempts(db: any, ip: string): Promise<number> {
  const res = await db
    .prepare(
      `SELECT COUNT(1) AS n
       FROM login_attempts
       WHERE ip = ?1 AND ok = 0 AND datetime(created_at) >= datetime('now','-1 hour')`
    )
    .bind(ip)
    .first();
  const n = Number((res as any)?.n ?? 0);
  return Number.isFinite(n) ? n : 0;
}

async function logAttempt(db: any, ip: string, email: string, ok: boolean) {
  try {
    await db
      .prepare(
        `INSERT INTO login_attempts (ip, email, ok, created_at)
         VALUES (?1, ?2, ?3, datetime('now'))`
      )
      .bind(ip, email, ok ? 1 : 0)
      .run();
  } catch {
    // Never fail login just because logging failed.
  }
}

async function emailExists(db: any, email: string): Promise<boolean> {
  const row = await db
    .prepare(`SELECT 1 AS ok FROM join_requests WHERE lower(email) = lower(?1) LIMIT 1`)
    .bind(email)
    .first();
  return Boolean((row as any)?.ok);
}

export async function onRequestPost(context: { env: Env; request: Request }): Promise<Response> {
  const { request, env } = context;
  const ip = getIp(request);
  const requestId = `login_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Step 1: Check D1 binding exists
  const d1Check = requireD1(env);
  if (!d1Check.ok) {
    return jsonResponse(d1Check.body, d1Check.status);
  }

  const db = d1Check.db;

  // Step 2: Check required tables exist
  const tablesCheck = await requireTables(db, ['join_requests', 'login_attempts', 'members', 'member_sessions']);
  if (!tablesCheck.ok) {
    return jsonResponse(tablesCheck.body, tablesCheck.status);
  }

  try {
    const ct = (request.headers.get('content-type') || '').toLowerCase();

let body: any = {};
if (ct.includes('application/json')) {
  body = await request.json();
} else if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
  const fd = await request.formData();
  body = Object.fromEntries(fd.entries());
} else {
  // best-effort fallback
  try { body = await request.json(); } catch { body = {}; }
}

const emailRaw = (body?.email ?? '').toString();

    const email = emailRaw.trim().toLowerCase();

    if (!email || !email.includes('@')) {
      return jsonResponse({ ok: false, error: 'Email is required.', requestId }, 400);
    }

    const failed = await countRecentFailedAttempts(db, ip);
    if (failed >= 3) {
      return jsonResponse(
        { ok: false, error: 'Too many failed attempts. Please wait one hour and try again.', requestId },
        429
      );
    }

    const exists = await emailExists(db, email);
    const deleted = exists ? await isMemberSoftDeleted(db, email) : false;
    if (!exists || deleted) {
      await logAttempt(db, ip, email, false);
      return jsonResponse({ ok: false, error: 'Email not found.', requestId }, 404);
    }

    // Mark OK attempt
    await logAttempt(db, ip, email, true);

    // Ensure member exists (default role=member). Admins should be seeded separately.
    try {
      await db.prepare("INSERT OR IGNORE INTO members (email, role) VALUES (?1, 'member');")
        .bind(email).run();
    } catch {}

    // Create session (30 days)
    const sessionId = newSessionIdHex(24);
    const ua = (request.headers.get('User-Agent') || '').slice(0, 300);

    try {
      await db.prepare(
        "INSERT INTO member_sessions (id, email, expires_at, ip, ua) VALUES (?1, ?2, datetime('now','+30 days'), ?3, ?4)"
      ).bind(sessionId, email, ip, ua).run();
    } catch {
      return jsonResponse({ ok: false, error: 'Session create failed', requestId }, 500);
    }

    return new Response(JSON.stringify({ ok: true, status: 'ok', requestId }, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': setSessionCookie(sessionId),
      },
    });
  } catch {
    return jsonResponse({ ok: false, error: 'Server error', requestId }, 500);
  }
}
