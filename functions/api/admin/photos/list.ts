// GET /api/admin/photos/list?filter=all|blocked&limit=60&offset=0
// Admin-only. Lists photos with their rights state for the block/restore page (#5471).
//
// Deliberately does NOT apply rightsClearedClause(): the public API hides blocked photos,
// and the admin needs to see them to restore one.

import { requireAdmin } from "../../../_lib/auth";
import { requireD1, requireTables, jsonResponse } from "../../../_lib/d1";

const MAX_LIMIT = 100;

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
    const filter = url.searchParams.get("filter") === "blocked" ? "blocked" : "all";
    const limit = Math.min(Math.max(Math.trunc(Number(url.searchParams.get("limit")) || 60), 1), MAX_LIMIT);
    const offset = Math.max(Math.trunc(Number(url.searchParams.get("offset")) || 0), 0);

    const where =
      filter === "blocked" ? "WHERE rights_status IN ('blocked', 'copyright_restricted')" : "";

    const rows = await d1.db
      .prepare(
        `SELECT id, url, title, description, source, is_memorabilia, rights_status,
                publication_eligible, reviewed_by, reviewed_at, rights_notes, created_at
         FROM photos ${where}
         ORDER BY id DESC
         LIMIT ? OFFSET ?;`,
      )
      .bind(limit, offset)
      .all();

    const count = (await d1.db
      .prepare(`SELECT COUNT(1) AS n FROM photos ${where};`)
      .first()) as { n: number } | null;

    return jsonResponse(
      { ok: true, filter, limit, offset, total: Number(count?.n ?? 0), items: rows?.results ?? [] },
      200,
    );
  } catch (err: any) {
    console.error("admin photos list error:", err);
    return jsonResponse({ ok: false, error: "server_error", detail: String(err?.message || err) }, 500);
  }
};
