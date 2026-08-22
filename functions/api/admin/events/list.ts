// GET /api/admin/events/list?month=YYYY-MM&limit=100
// Returns events for admin review (includes hidden rows). Protected by an authenticated D1 admin member session (requireAdmin).

import { requireAdmin } from "../../../_lib/auth";
import { requireD1, requireTables, jsonResponse } from "../../../_lib/d1";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireTables(d1.db, ["events"]);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const url = new URL(request.url);
    const month = (url.searchParams.get("month") || "").trim();
    const limitRaw = Number(url.searchParams.get("limit") || "100");
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 500) : 100;

    if (month && !MONTH_RE.test(month)) {
      return jsonResponse({ ok: false, error: "invalid_month" }, 400);
    }

    const db = d1.db;

    if (month && MONTH_RE.test(month)) {
      const q = `
        SELECT id, title, start_date, end_date, location, host, fees, description, external_url, status, updated_at
        FROM events
        WHERE substr(start_date, 1, 7) = ?
        ORDER BY start_date ASC, id ASC
        LIMIT ?
      `;
      const r = await db.prepare(q).bind(month, limit).all();
      return jsonResponse({ ok: true, month, items: r?.results || [] }, 200);
    }

    const q = `
      SELECT id, title, start_date, end_date, location, host, fees, description, external_url, status, updated_at
      FROM events
      ORDER BY start_date DESC, id DESC
      LIMIT ?
    `;
    const r = await db.prepare(q).bind(limit).all();
    return jsonResponse({ ok: true, items: r?.results || [] }, 200);
  } catch (err: any) {
    console.error("admin events list error:", err);
    return jsonResponse({ ok: false, error: "Failed to list events." }, 500);
  }
};

export function isValidEventDate(value: string): boolean {
  return DATE_RE.test(value);
}

export function isSafeExternalUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
