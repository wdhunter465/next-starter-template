// POST /api/admin/reports/close
// Body: { id: number, admin_note?: string }
// Admin-only. Protected by requireAdmin().

import { requireAdmin } from "../../_lib/auth";

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  try {
    const body = await request.json().catch(() => null);
    const id = Number(body?.id);

    if (!Number.isFinite(id) || id <= 0) {
      return Response.json({ ok: false, error: "Invalid id" }, { status: 400 });
    }

    const admin_note = String(body?.admin_note || "").trim();

    if (!env?.DB) {
      return Response.json({ ok: false, error: "missing_db_binding" }, { status: 500 });
    }

    const sql = `UPDATE reports
                 SET status='closed', admin_note=?, resolved_at=datetime('now')
                 WHERE id=?`;

    const out = await env.DB.prepare(sql).bind(admin_note || null, id).run();
    const changed = out?.meta?.changes || 0;
    if (!changed) {
      return Response.json({ ok: false, error: "report_not_found_or_closed" }, { status: 404 });
    }

    return Response.json({ ok: true, changed });
  } catch (err: any) {
    return Response.json({ ok: false, error: "server_error", detail: String(err?.message || err) }, { status: 500 });
  }
};
