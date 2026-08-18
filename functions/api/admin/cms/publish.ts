// POST /api/admin/cms/publish
// Body: { key, updated_by? }
// Publishes a CMS content_block (copies body_md -> published_body_md), increments version, writes a revision.
// Protected by ADMIN_TOKEN.

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
    const updated_by = String(body?.updated_by || "admin").trim() || "admin";

    if (!key) return json({ ok: false, error: "Missing key." }, 400);

    const nowRow = await env.DB.prepare("SELECT datetime('now') as now").first();
    const now = String((nowRow as any)?.now || "");

    const existing = await env.DB.prepare(
      "SELECT key, version, body_md FROM content_blocks WHERE key = ?"
    ).bind(key).first();

    if (!existing) return json({ ok: false, error: "Block not found." }, 404);

    const currentVersion = Number((existing as any)?.version || 1);
    const nextVersion = currentVersion + 1;
    const body_md = String((existing as any)?.body_md || "");

    if (!body_md) return json({ ok: false, error: "Block body_md is empty." }, 400);

    await env.DB.prepare(
      `UPDATE content_blocks
       SET status = 'published',
           published_body_md = body_md,
           published_at = ?,
           version = ?,
           updated_at = ?,
           updated_by = ?
       WHERE key = ?`
    ).bind(now, nextVersion, now, updated_by, key).run();

    await env.DB.prepare(
      `INSERT INTO content_revisions (key, version, body_md, status, updated_at, updated_by)
       VALUES (?, ?, ?, 'published', ?, ?)`
    ).bind(key, nextVersion, body_md, now, updated_by).run();

    return json({ ok: true, key, version: nextVersion, published_at: now });
  } catch (err: any) {
    console.error("admin cms publish error:", err);
    return json({ ok: false, error: "Publish failed." }, 500);
  }
};
