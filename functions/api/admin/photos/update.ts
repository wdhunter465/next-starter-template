// POST /api/admin/photos/update
// Admin-only. Updates a photo's `source` (credit line) field (#4166).
//
// Body: { id, source }
// `source` is trimmed; an empty/whitespace-only value clears the credit
// (stored as NULL) rather than persisting a blank string, matching the
// trimmed-presence check the public Weekly Matchup widget already applies.

import { requireAdmin } from "../../../_lib/auth";
import { requireD1, requireTables, jsonResponse } from "../../../_lib/d1";

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireTables(d1.db, ["photos"]);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const body = await request.json().catch(() => null);
    const id = Number(body?.id);
    if (!Number.isFinite(id) || id <= 0) {
      return jsonResponse({ ok: false, error: "invalid_id" }, 400);
    }

    const trimmed = String(body?.source ?? "").trim();
    const value = trimmed === "" ? null : trimmed;

    const existing = await d1.db.prepare("SELECT id FROM photos WHERE id = ? LIMIT 1;").bind(id).first();
    if (!existing) {
      return jsonResponse({ ok: false, error: "not_found" }, 404);
    }

    const result = await d1.db.prepare("UPDATE photos SET source = ? WHERE id = ?;").bind(value, id).run();

    return jsonResponse({ ok: true, id, source: value, changed: result?.meta?.changes || 0 }, 200);
  } catch (err: any) {
    console.error("admin photos update error:", err);
    return jsonResponse({ ok: false, error: "server_error", detail: String(err?.message || err) }, 500);
  }
};
