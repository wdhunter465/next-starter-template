// GET /api/admin/content/list?slug=/about (optional)
// Returns live + draft content blocks. Protected by ADMIN_TOKEN.

import { requireAdmin } from "../../../_lib/auth";

type Row = {
  slug: string;
  section: string;
  status: "draft" | "live";
  content: string | null;
  asset_url: string | null;
  updated_at: string;
};

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  try {
    const db = env.DB as any;
    const url = new URL(request.url);
    const slug = (url.searchParams.get("slug") || "").trim();

    const where = slug ? "WHERE slug = ? " : "";
    const params = slug ? [slug] : [];

    const { results } = await db
      .prepare(
        `SELECT slug, section, status, content, asset_url, updated_at
         FROM page_content
         ${where}
         ORDER BY slug ASC, section ASC, status ASC`
      )
      .bind(...params)
      .all();

    const rows = (results || []) as Row[];

    const slugs = Array.from(new Set(rows.map((r) => r.slug)));

    // group into per-section objects
    const grouped: Record<string, Record<string, { live?: Row; draft?: Row }>> = {};
    for (const r of rows) {
      grouped[r.slug] = grouped[r.slug] || {};
      grouped[r.slug][r.section] = grouped[r.slug][r.section] || {};
      if (r.status === "live") grouped[r.slug][r.section].live = r;
      if (r.status === "draft") grouped[r.slug][r.section].draft = r;
    }

    return new Response(
      JSON.stringify({ ok: true, slugs, grouped }, null, 2),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("admin content list error:", err);
    return new Response(JSON.stringify({ ok: false, error: "List failed." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
