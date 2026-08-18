// GET /api/admin/reports/list?status=open&limit=100
// Admin-only. Protected by requireAdmin().

import { requireAdmin } from "../../_lib/auth";

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  try {
    const url = new URL(request.url);
    const status = String(url.searchParams.get("status") || "open").toLowerCase();
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") || "100")));

    if (!env?.DB) {
      return Response.json({ ok: false, error: "missing_db_binding" }, { status: 500 });
    }

    const where = status === "closed" ? "status='closed'" : "status='open'";
    const sql = `SELECT id, kind, target_id, reporter_email, reason, status, admin_note, created_at, resolved_at
                 FROM reports
                 WHERE ${where}
                 ORDER BY created_at DESC
                 LIMIT ?`;

    const res = await env.DB.prepare(sql).bind(limit).all();
    return Response.json({ ok: true, items: res.results || [] });
  } catch (err: any) {
    return Response.json({ ok: false, error: "server_error", detail: String(err?.message || err) }, { status: 500 });
  }
};
