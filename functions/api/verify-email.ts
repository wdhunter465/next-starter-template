// Cloudflare Pages Function for POST /api/verify-email  (#5112)
// - Takes the single-use token from the emailed link, marks the member's address verified,
//   and signs the member in (30-day session cookie, same as /api/login).
// - A used, expired or unknown token is refused. The page offers to send a new link.

import { requireD1, requireTables, jsonResponse, type Env } from '../_lib/d1';
import { consumeVerificationToken, markEmailVerified } from '../_lib/email-verification';
import { isMemberSoftDeleted, newSessionIdHex, setSessionCookie } from '../_lib/session';

function getIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For') ||
    request.headers.get('X-Real-IP') ||
    'unknown'
  );
}

export async function onRequestPost(context: { env: Env; request: Request }): Promise<Response> {
  const { env, request } = context;
  const requestId = crypto.randomUUID();

  const d1Check = requireD1(env);
  if (!d1Check.ok) return jsonResponse(d1Check.body, d1Check.status);
  const db = d1Check.db;

  const tablesCheck = await requireTables(db, ['email_verification_tokens', 'members', 'member_sessions']);
  if (!tablesCheck.ok) return jsonResponse(tablesCheck.body, tablesCheck.status);

  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const email = await consumeVerificationToken(db, String(body?.token ?? ''));
    if (!email) {
      return jsonResponse(
        { ok: false, code: 'invalid_token', error: 'This verification link has expired or was already used.', requestId },
        400,
      );
    }

    if (await isMemberSoftDeleted(db, email)) {
      return jsonResponse({ ok: false, code: 'invalid_token', error: 'This verification link cannot be used.', requestId }, 403);
    }

    await markEmailVerified(db, email);

    const sessionId = newSessionIdHex(24);
    const ua = (request.headers.get('User-Agent') || '').slice(0, 300);
    try {
      await db
        .prepare("INSERT INTO member_sessions (id, email, expires_at, ip, ua) VALUES (?1, ?2, datetime('now','+30 days'), ?3, ?4)")
        .bind(sessionId, email, getIp(request), ua)
        .run();
    } catch {
      return jsonResponse({ ok: false, error: 'Session create failed', requestId }, 500);
    }

    return new Response(JSON.stringify({ ok: true, status: 'verified', requestId }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Set-Cookie': setSessionCookie(sessionId) },
    });
  } catch {
    return jsonResponse({ ok: false, error: 'Server error', requestId }, 500);
  }
}
