// GET /api/admin/join-requests/list?limit=50
// Returns recent join_requests. Protected by ADMIN_TOKEN.

import { requireAdmin } from "../../../_lib/auth";

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  try {
    const url = new URL(request.url);
    const limitRaw = Number(url.searchParams.get("limit") || "50");
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;

    const db = env.DB as any;
    const q = `
      SELECT
        id, name, email, message, created_at,
        first_name, last_name, screen_name,
        email_opt_in, presence_status
      FROM join_requests
      ORDER BY id DESC
      LIMIT ?
    `;
    const r = await db.prepare(q).bind(limit).all();

    return new Response(JSON.stringify({ ok: true, items: r?.results || [] }, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("join-requests list error:", err);
    return new Response(JSON.stringify({ ok: false, error: "Failed to list join requests." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
