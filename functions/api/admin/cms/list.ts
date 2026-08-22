// GET /api/admin/cms/list?page=home (optional)
// Returns CMS content_blocks (draft + published). Protected by an authenticated D1 admin member session (requireAdmin).

import { requireAdmin } from "../../../_lib/auth";

type Block = {
  key: string;
  page: string;
  section: string;
  title: string;
  body_md: string;
  status: "draft" | "published";
  published_body_md: string | null;
  version: number;
  updated_at: string;
  published_at: string | null;
  updated_by: string;
};

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  const url = new URL(request.url);
  const page = (url.searchParams.get("page") || "").trim();

  try {
    const stmt = env.DB.prepare(
      page
        ? `SELECT key, page, section, title, body_md, status, published_body_md, version, updated_at, published_at, updated_by
           FROM content_blocks
           WHERE page = ?
           ORDER BY page, section, key`
        : `SELECT key, page, section, title, body_md, status, published_body_md, version, updated_at, published_at, updated_by
           FROM content_blocks
           ORDER BY page, section, key`
    );

    const rows = page ? await stmt.bind(page).all() : await stmt.all();
    const blocks = (rows?.results || []) as Block[];

    const pages = Array.from(new Set(blocks.map(b => b.page))).sort();

    return new Response(JSON.stringify({ ok: true, page: page || null, pages, blocks }, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("admin cms list error:", err);
    return new Response(JSON.stringify({ ok: false, error: "List failed." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
