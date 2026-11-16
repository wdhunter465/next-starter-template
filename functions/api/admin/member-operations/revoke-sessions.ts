// POST /api/admin/member-operations/revoke-sessions   Body: { email }
// Signs one member out everywhere: deletes every session of that member (#5304, item 4 of #4767). Admin session
// only. It changes nothing else: no role, no member record, no join request. Returns how many sessions ended.

import { requireAdmin } from "../../../_lib/auth";
import { jsonResponse, requireD1, requireTables } from "../../../_lib/d1";
import { countMemberSessions, revokeMemberSessions } from "../../../_lib/session";

export const onRequestPost = async (context: { request: Request; env: unknown }): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env as never);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireTables(d1.db, ["members", "member_sessions"]);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const body = (await request.json().catch(() => null)) as { email?: unknown } | null;
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!email || !email.includes("@")) return jsonResponse({ ok: false, error: "email is required." }, 400);

    const member = await d1.db.prepare("SELECT 1 AS ok FROM members WHERE lower(email) = ?").bind(email).first();
    if (!member) return jsonResponse({ ok: false, error: "Member not found." }, 404);

    const before = await countMemberSessions(d1.db, email);
    await revokeMemberSessions(d1.db, email);
    return jsonResponse({ ok: true, email, sessions_revoked: before }, 200);
  } catch (err) {
    console.error("admin revoke-sessions error:", err);
    return jsonResponse({ ok: false, error: "Revoking sessions failed." }, 500);
  }
};
