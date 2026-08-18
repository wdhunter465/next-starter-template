// POST /api/admin/events/update
// Admin-only. Updates an event row.
//
// Body: { id, title, start_date, end_date?, location?, host?, fees?, description?, external_url?, status? }

import { requireAdmin } from "../../../_lib/auth";
import { requireD1, requireTables, jsonResponse } from "../../../_lib/d1";
import { isSafeExternalUrl, isValidEventDate } from "./list";

const STATUS_VALUES = new Set(["posted", "hidden"]);

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireTables(d1.db, ["events"]);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const body = await request.json().catch(() => null);

    const id = Number(body?.id);
    const title = String(body?.title || "").trim();
    const start_date = String(body?.start_date || body?.date || "").trim();
    const end_date = String(body?.end_date || start_date || "").trim();
    const location = String(body?.location || "").trim();
    const host = String(body?.host || "").trim();
    const fees = String(body?.fees || "").trim();
    const description = String(body?.description || "").trim();
    const external_url = String(body?.external_url || "").trim();
    const statusRaw = String(body?.status || "posted").trim().toLowerCase();
    if (!STATUS_VALUES.has(statusRaw)) {
      return jsonResponse({ ok: false, error: "invalid_status" }, 400);
    }
    const status = statusRaw;

    if (!Number.isFinite(id) || id <= 0) {
      return jsonResponse({ ok: false, error: "invalid_id" }, 400);
    }
    if (!title || title.length < 3) {
      return jsonResponse({ ok: false, error: "title_required" }, 400);
    }
    if (!isValidEventDate(start_date)) {
      return jsonResponse({ ok: false, error: "invalid_start_date" }, 400);
    }
    if (end_date && !isValidEventDate(end_date)) {
      return jsonResponse({ ok: false, error: "invalid_end_date" }, 400);
    }
    if (!isSafeExternalUrl(external_url)) {
      return jsonResponse({ ok: false, error: "invalid_external_url" }, 400);
    }

    const sql = `UPDATE events
                 SET title=?, start_date=?, end_date=?, location=?, host=?, fees=?, description=?, external_url=?, status=?, updated_at=datetime('now')
                 WHERE id=?`;

    const out = await d1.db
      .prepare(sql)
      .bind(title, start_date, end_date || start_date, location, host, fees, description, external_url, status, id)
      .run();

    return jsonResponse({ ok: true, changed: out?.meta?.changes || 0 }, 200);
  } catch (err: any) {
    console.error("admin events update error:", err);
    return jsonResponse({ ok: false, error: "server_error", detail: String(err?.message || err) }, 500);
  }
};
