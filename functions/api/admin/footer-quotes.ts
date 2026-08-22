// /api/admin/footer-quotes
// Admin CRUD (minimal):
// - GET: list quotes (optional q=search, status=posted|hidden)
// - POST: add quote
// Protected by an authenticated D1 admin member session (requireAdmin).

import { requireAdmin } from "../../_lib/auth";

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;
  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const url = new URL(request.url);
  const q = String(url.searchParams.get("q") || "").trim();
  const status = String(url.searchParams.get("status") || "").trim();

  try {
    let sql = `SELECT id, quote, attribution, status, created_at, updated_at FROM footer_quotes`;
    const binds: any[] = [];
    const where: string[] = [];

    if (status) {
      where.push(`status = ?${binds.length + 1}`);
      binds.push(status);
    }
    if (q) {
      where.push(`(quote LIKE ?${binds.length + 1} OR attribution LIKE ?${binds.length + 2})`);
      binds.push(`%${q}%`, `%${q}%`);
    }

    if (where.length) sql += ` WHERE ` + where.join(" AND ");
    sql += ` ORDER BY status ASC, updated_at DESC, id DESC LIMIT 250`;

    const res = await env.DB.prepare(sql).bind(...binds).all();
    return json({ ok: true, results: res?.results || [] });
  } catch (e: any) {
    console.error("admin footer-quotes get error:", e);
    return json({ ok: false, error: "Failed to list footer quotes." }, 500);
  }
};

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;
  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  try {
    const body = await request.json();
    const quote = String(body?.quote || "").trim();
    const attribution = String(body?.attribution || "").trim();

    if (!quote) return json({ ok: false, error: "quote is required" }, 400);

    await env.DB.prepare(
      `INSERT INTO footer_quotes (quote, attribution, status, created_at, updated_at)
       VALUES (?1, ?2, 'posted', datetime('now'), datetime('now'))`
    )
      .bind(quote, attribution || null)
      .run();

    return json({ ok: true });
  } catch (e: any) {
    console.error("admin footer-quotes post error:", e);
    return json({ ok: false, error: "Failed to add footer quote." }, 500);
  }
};

export const onRequestPatch = async (context: any): Promise<Response> => {
  const { request, env } = context;
  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  try {
    const body = await request.json();
    const id = Number(body?.id);
    const status = String(body?.status || "").trim();

    if (!id || !Number.isFinite(id)) return json({ ok: false, error: "id is required" }, 400);
    if (!['posted','hidden'].includes(status)) return json({ ok: false, error: "status must be posted|hidden" }, 400);

    await env.DB.prepare(
      `UPDATE footer_quotes SET status = ?1, updated_at = datetime('now') WHERE id = ?2`
    ).bind(status, id).run();

    return json({ ok: true });
  } catch (e: any) {
    console.error("admin footer-quotes patch error:", e);
    return json({ ok: false, error: "Failed to update footer quote." }, 500);
  }
};
