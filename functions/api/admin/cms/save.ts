// POST /api/admin/cms/save
// Body: { key, page, section, title, body_md, updated_by? }
// Upserts a CMS content_block, sets status='draft', increments version, writes a revision. Protected by ADMIN_TOKEN.

import { requireAdmin } from "../../../_lib/auth";

function json(res: any, status = 200) {
  return new Response(JSON.stringify(res, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => ({}));
    const key = String(body?.key || "").trim();
    const page = String(body?.page || "").trim();
    const section = String(body?.section || "").trim();
    const title = String(body?.title || "").trim();
    const body_md = String(body?.body_md ?? "").trim();
    const updated_by = String(body?.updated_by || "admin").trim() || "admin";

    if (!key || !page || !section || !title) {
      return json({ ok: false, error: "Missing required fields: key, page, section, title." }, 400);
    }
    if (!body_md) {
      return json({ ok: false, error: "body_md cannot be empty." }, 400);
    }

    const nowStmt = env.DB.prepare("SELECT datetime('now') as now");
    const nowRow = await nowStmt.first();
    const now = String((nowRow as any)?.now || "");

    const existing = await env.DB.prepare(
      "SELECT key, version FROM content_blocks WHERE key = ?"
    ).bind(key).first();

    if (!existing) {
      // Insert new block
      await env.DB.prepare(
        `INSERT INTO content_blocks (key, page, section, title, body_md, status, published_body_md, version, updated_at, published_at, updated_by)
         VALUES (?, ?, ?, ?, ?, 'draft', NULL, 1, ?, NULL, ?)`
      ).bind(key, page, section, title, body_md, now, updated_by).run();

      await env.DB.prepare(
        `INSERT INTO content_revisions (key, version, body_md, status, updated_at, updated_by)
         VALUES (?, 1, ?, 'draft', ?, ?)`
      ).bind(key, body_md, now, updated_by).run();

      return json({ ok: true, created: true, key, version: 1 });
    }

    const currentVersion = Number((existing as any)?.version || 1);
    const nextVersion = currentVersion + 1;

    // Update current block
    await env.DB.prepare(
      `UPDATE content_blocks
       SET page = ?, section = ?, title = ?, body_md = ?, status = 'draft',
           version = ?, updated_at = ?, updated_by = ?
       WHERE key = ?`
    ).bind(page, section, title, body_md, nextVersion, now, updated_by, key).run();

    // Add revision record
    await env.DB.prepare(
      `INSERT INTO content_revisions (key, version, body_md, status, updated_at, updated_by)
       VALUES (?, ?, ?, 'draft', ?, ?)`
    ).bind(key, nextVersion, body_md, now, updated_by).run();

    return json({ ok: true, created: false, key, version: nextVersion });
  } catch (err: any) {
    console.error("admin cms save error:", err);
    return json({ ok: false, error: "Save failed." }, 500);
  }
};
