// GET /api/admin/photos/get?id=123
// Admin-only. Fetches a photo row for the admin credit/source editor (#4166).
//
// Deliberately does NOT apply rightsClearedClause() the way the public
// /api/photos/get does -- an admin editing a photo's source needs to see it
// regardless of rights_hold/publication_eligible, unlike a public visitor.

import { requireAdmin } from "../../../_lib/auth";
import { requireD1, requireTables, jsonResponse } from "../../../_lib/d1";

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireTables(d1.db, ["photos"]);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));
    if (!Number.isFinite(id) || id <= 0) {
      return jsonResponse({ ok: false, error: "invalid_id" }, 400);
    }

    const row = await d1.db
      .prepare(
        `SELECT id, url, title, description, source, is_memorabilia,
                is_matchup_eligible, rights_status, publication_eligible, created_at
         FROM photos WHERE id = ? LIMIT 1;`,
      )
      .bind(id)
      .first();

    if (!row) {
      return jsonResponse({ ok: false, error: "not_found" }, 404);
    }

    return jsonResponse({ ok: true, item: row }, 200);
  } catch (err: any) {
    console.error("admin photos get error:", err);
    return jsonResponse({ ok: false, error: "server_error", detail: String(err?.message || err) }, 500);
  }
};
