import { requireD1, jsonResponse } from '../_lib/d1';
import { getSessionEmail, getSessionId, clearSessionCookie, revokeMemberSessions } from '../_lib/session';

async function doLogout(context: any): Promise<Response> {
  const d1 = requireD1(context.env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);
  const db = d1.db;

  const sid = getSessionId(context.request);
  if (sid) {
    // "Sign out everywhere" (#5304): ?all=true ends every session of the signed-in member, found from this
    // request's own session, never from anything the caller names. Without it, only this session ends.
    const all = new URL(context.request.url).searchParams.get('all') === 'true';
    try {
      if (all) {
        const email = await getSessionEmail(db, sid);
        if (email) await revokeMemberSessions(db, email);
      }
    } catch {}
    try {
      await db.prepare('DELETE FROM member_sessions WHERE id=?1').bind(sid).run();
    } catch {}
  }

  return new Response(JSON.stringify({ ok: true }, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': clearSessionCookie(),
      'Cache-Control': 'no-store',
    },
  });
}

// POST only — GET logout is intentionally not supported.
export const onRequestPost = async (context: any): Promise<Response> => doLogout(context);
