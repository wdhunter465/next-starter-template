// POST /api/admin/content/publish
// Body: { slug, section? }  (if section omitted, publishes all draft sections for the slug)
// Promotes draft -> live, and writes prior live to history. Protected by an authenticated D1 admin member session (requireAdmin).

import { requireAdmin } from "../../../_lib/auth";

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  try {
    const body = await request.json();
    const slug = String(body?.slug || "").trim();
    const section = String(body?.section || "").trim(); // optional
    const changed_by = String(body?.changed_by || "admin").trim();

    if (!slug) {
      return new Response(JSON.stringify({ ok: false, error: "slug is required." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const db = env.DB as any;

    // write history of current live
    if (section) {
      await db.prepare(
        `INSERT INTO page_content_history (slug, section, status, content, asset_url, changed_by)
         SELECT slug, section, status, content, asset_url, ?
         FROM page_content
         WHERE slug=? AND section=? AND status='live'`
      ).bind(changed_by, slug, section).run();
    } else {
      await db.prepare(
        `INSERT INTO page_content_history (slug, section, status, content, asset_url, changed_by)
         SELECT slug, section, status, content, asset_url, ?
         FROM page_content
         WHERE slug=? AND status='live'`
      ).bind(changed_by, slug).run();
    }

    // copy draft -> live
    if (section) {
      const draft = await db.prepare(
        `SELECT content, asset_url FROM page_content WHERE slug=? AND section=? AND status='draft'`
      ).bind(slug, section).first();

      if (!draft) {
        return new Response(JSON.stringify({ ok: false, error: "No draft found." }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      await db.prepare(
        `INSERT INTO page_content (slug, section, status, content, asset_url, updated_at)
         VALUES (?, ?, 'live', ?, ?, datetime('now'))
         ON CONFLICT(slug, section, status)
         DO UPDATE SET content=excluded.content, asset_url=excluded.asset_url, updated_at=datetime('now')`
      ).bind(slug, section, draft.content ?? null, draft.asset_url ?? null).run();
    } else {
      // publish all draft sections for slug
      const { results } = await db.prepare(
        `SELECT section, content, asset_url FROM page_content WHERE slug=? AND status='draft'`
      ).bind(slug).all();

      const drafts = results || [];
      if (!drafts.length) {
        return new Response(JSON.stringify({ ok: false, error: "No drafts found." }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        });
      }

      for (const d of drafts) {
        await db.prepare(
          `INSERT INTO page_content (slug, section, status, content, asset_url, updated_at)
           VALUES (?, ?, 'live', ?, ?, datetime('now'))
           ON CONFLICT(slug, section, status)
           DO UPDATE SET content=excluded.content, asset_url=excluded.asset_url, updated_at=datetime('now')`
        ).bind(slug, d.section, d.content ?? null, d.asset_url ?? null).run();
      }
    }

    return new Response(JSON.stringify({ ok: true }, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("admin content publish error:", err);
    return new Response(JSON.stringify({ ok: false, error: "Publish failed." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
