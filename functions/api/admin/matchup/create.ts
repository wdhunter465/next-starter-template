// POST /api/admin/matchup/create
// Admin-only. Creates a weekly matchup row.
//
// Body: { week_start, photo_a_id, photo_b_id, status? }

import { requireAdmin } from "../../../_lib/auth";
import { requireD1, requireTables, jsonResponse } from "../../../_lib/d1";
import { rightsClearedClause } from "../../../_lib/rights-hold";
import { isValidWeekStart } from "./list";

const STATUS_VALUES = new Set(["active", "closed"]);

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireTables(d1.db, ["weekly_matchups", "photos"]);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const body = await request.json().catch(() => null);
    const week_start = String(body?.week_start || "").trim();
    const photo_a_id = Number(body?.photo_a_id);
    const photo_b_id = Number(body?.photo_b_id);
    const statusRaw =
      body?.status === undefined || body?.status === null
        ? "closed"
        : String(body.status).trim().toLowerCase();

    if (
      body?.status !== undefined &&
      body?.status !== null &&
      String(body.status).trim() !== "" &&
      !STATUS_VALUES.has(statusRaw)
    ) {
      return jsonResponse({ ok: false, error: "invalid_status" }, 400);
    }

    const status = STATUS_VALUES.has(statusRaw) ? statusRaw : "closed";

    if (!isValidWeekStart(week_start)) {
      return jsonResponse({ ok: false, error: "invalid_week_start" }, 400);
    }
    if (!Number.isFinite(photo_a_id) || photo_a_id <= 0) {
      return jsonResponse({ ok: false, error: "invalid_photo_a_id" }, 400);
    }
    if (!Number.isFinite(photo_b_id) || photo_b_id <= 0) {
      return jsonResponse({ ok: false, error: "invalid_photo_b_id" }, 400);
    }
    if (photo_a_id === photo_b_id) {
      return jsonResponse({ ok: false, error: "photo_ids_must_differ" }, 400);
    }

    const photoA = await d1.db
      .prepare(`SELECT id FROM photos WHERE id = ? AND ${rightsClearedClause()}`)
      .bind(photo_a_id)
      .first();
    if (!photoA) {
      return jsonResponse({ ok: false, error: "photo_a_not_found" }, 400);
    }

    const photoB = await d1.db
      .prepare(`SELECT id FROM photos WHERE id = ? AND ${rightsClearedClause()}`)
      .bind(photo_b_id)
      .first();
    if (!photoB) {
      return jsonResponse({ ok: false, error: "photo_b_not_found" }, 400);
    }

    const out = await d1.db
      .prepare(
        `INSERT INTO weekly_matchups (week_start, photo_a_id, photo_b_id, status)
         VALUES (?, ?, ?, ?)`,
      )
      .bind(week_start, photo_a_id, photo_b_id, "closed")
      .run();

    const newId = Number(out?.meta?.last_row_id || 0);
    if (status === "active") {
      if (!Number.isFinite(newId) || newId <= 0) {
        return jsonResponse({ ok: false, error: "server_error", detail: "missing_insert_id" }, 500);
      }

      await d1.db.batch([
        d1.db
          .prepare("UPDATE weekly_matchups SET status='closed' WHERE status='active' AND id != ?")
          .bind(newId),
        d1.db.prepare("UPDATE weekly_matchups SET status='active' WHERE id = ?").bind(newId),
      ]);
    }

    return jsonResponse({ ok: true, id: newId || null }, 200);
  } catch (err: any) {
    const message = String(err?.message || err);
    if (message.includes("UNIQUE")) {
      return jsonResponse({ ok: false, error: "week_start_already_exists" }, 409);
    }
    console.error("admin matchup create error:", err);
    return jsonResponse({ ok: false, error: "server_error", detail: message }, 500);
  }
};
