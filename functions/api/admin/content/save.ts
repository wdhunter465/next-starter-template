// POST /api/admin/content/save
// Body: { slug, section, content?, asset_url? }
// Saves/updates a DRAFT row for that slug+section. Protected by an authenticated D1 admin member session (requireAdmin).

import { requireAdmin } from "../../../_lib/auth";

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  try {
    const body = await request.json();
    const slug = String(body?.slug || "").trim();
    const section = String(body?.section || "").trim();
    const content = body?.content === null || body?.content === undefined ? null : String(body.content);
    const asset_url = body?.asset_url === null || body?.asset_url === undefined ? null : String(body.asset_url);

    if (!slug || !section) {
      return new Response(JSON.stringify({ ok: false, error: "slug and section are required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const db = env.DB as any;

    await db
      .prepare(
        `INSERT INTO page_content (slug, section, status, content, asset_url, updated_at)
         VALUES (?, ?, 'draft', ?, ?, datetime('now'))
         ON CONFLICT(slug, section, status)
         DO UPDATE SET content=excluded.content, asset_url=excluded.asset_url, updated_at=datetime('now')`
      )
      .bind(slug, section, content, asset_url)
      .run();

    return new Response(JSON.stringify({ ok: true }, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("admin content save error:", err);
    return new Response(JSON.stringify({ ok: false, error: "Save failed." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
