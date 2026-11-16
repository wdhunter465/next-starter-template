// POST /api/scheduled-content/auth-purge  { "apply": false }
// Housekeeping for sign-in tables (#5303, item 3 of #4767): removes expired member sessions (7 days past expiry)
// and sign-in attempt rows older than 7 days (which includes the join and ask throttle markers of #5302).
// Authenticated by the scheduled-content bridge token, like the social ledger. It can delete nothing else.
//
// Dry run by default: without "apply": true it only counts what it would delete. A valid session (not yet
// expired) and any attempt row from the last 7 days (the sign-in limits look back only 1 hour) are never touched.
// At most PURGE_BATCH rows of each kind are deleted per call; "remaining" tells the caller to run again.

import { requireScheduledContentBridge } from "../../_lib/scheduled-content-auth";

type D1Like = {
  prepare(sql: string): {
    bind(...values: unknown[]): { first(): Promise<unknown>; run(): Promise<{ meta?: { changes?: number } }> };
    first(): Promise<unknown>;
    run(): Promise<{ meta?: { changes?: number } }>;
  };
};
type Context = { request: Request; env: { DB?: D1Like; SCHEDULED_CONTENT_BRIDGE_TOKEN?: string } };

export const PURGE_BATCH = 5000;
export const SESSION_GRACE = "-7 days";
export const ATTEMPT_RETENTION = "-7 days";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { "Content-Type": "application/json" } });
}

const EXPIRED_SESSIONS = `FROM member_sessions WHERE datetime(expires_at) < datetime('now', '${SESSION_GRACE}')`;
const OLD_ATTEMPTS = `FROM login_attempts WHERE datetime(created_at) < datetime('now', '${ATTEMPT_RETENTION}')`;

async function count(db: D1Like, fromWhere: string): Promise<number> {
  const row = (await db.prepare(`SELECT COUNT(1) AS n ${fromWhere}`).first()) as { n?: unknown } | null;
  const n = Number(row?.n ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export const onRequestPost = async (context: Context): Promise<Response> => {
  const { request, env } = context;
  const auth = requireScheduledContentBridge(request, env);
  if (!auth.ok) return auth.response;
  if (!env?.DB) return json({ ok: false, error: "DB binding unavailable" }, 503);

  let body: { apply?: unknown } = {};
  try {
    body = ((await request.json()) as { apply?: unknown }) ?? {};
  } catch {
    body = {};
  }
  const apply = body?.apply === true;

  try {
    const sessionsDue = await count(env.DB, EXPIRED_SESSIONS);
    const attemptsDue = await count(env.DB, OLD_ATTEMPTS);
    if (!apply) {
      return json({ ok: true, applied: false, sessions_due: sessionsDue, attempts_due: attemptsDue });
    }

    const sessions = await env.DB.prepare(
      `DELETE FROM member_sessions WHERE rowid IN (SELECT rowid ${EXPIRED_SESSIONS} LIMIT ${PURGE_BATCH})`,
    ).run();
    const attempts = await env.DB.prepare(
      `DELETE FROM login_attempts WHERE rowid IN (SELECT rowid ${OLD_ATTEMPTS} LIMIT ${PURGE_BATCH})`,
    ).run();
    const sessionsDeleted = Number(sessions?.meta?.changes ?? 0);
    const attemptsDeleted = Number(attempts?.meta?.changes ?? 0);
    return json({
      ok: true,
      applied: true,
      sessions_deleted: sessionsDeleted,
      attempts_deleted: attemptsDeleted,
      remaining: Math.max(0, sessionsDue - sessionsDeleted) + Math.max(0, attemptsDue - attemptsDeleted),
    });
  } catch (err) {
    console.error("auth purge error:", err);
    return json({ ok: false, error: "Purge failed." }, 500);
  }
};
