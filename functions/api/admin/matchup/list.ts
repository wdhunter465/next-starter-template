// GET /api/admin/matchup/list?limit=50
// Returns weekly matchups with vote totals for admin review.

import { requireAdmin } from "../../../_lib/auth";
import { requireD1, requireTables, jsonResponse } from "../../../_lib/d1";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireTables(d1.db, ["weekly_matchups", "weekly_votes"]);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const url = new URL(request.url);
    const limitRaw = Number(url.searchParams.get("limit") || "50");
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;

    const rows = await d1.db
      .prepare(
        `SELECT
           m.id,
           m.week_start,
           m.photo_a_id,
           m.photo_b_id,
           m.status,
           m.created_at,
           COALESCE(SUM(CASE WHEN v.choice = 'a' THEN 1 ELSE 0 END), 0) AS a,
           COALESCE(SUM(CASE WHEN v.choice = 'b' THEN 1 ELSE 0 END), 0) AS b
         FROM weekly_matchups m
         LEFT JOIN weekly_votes v ON v.week_start = m.week_start
         GROUP BY m.id
         ORDER BY m.week_start DESC, m.id DESC
         LIMIT ?`,
      )
      .bind(limit)
      .all();

    const items = (rows?.results || []).map((row: any) => {
      const a = Number(row.a || 0);
      const b = Number(row.b || 0);
      const winner = a === b ? 'tie' : a > b ? 'a' : 'b';

      return {
        id: Number(row.id),
        week_start: String(row.week_start || ''),
        photo_a_id: Number(row.photo_a_id),
        photo_b_id: Number(row.photo_b_id),
        status: String(row.status || ''),
        created_at: String(row.created_at || ''),
        votes: { a, b, total: a + b, winner },
      };
    });

    const active = items.find((item: { status: string }) => item.status === "active") || null;

    return jsonResponse({ ok: true, active, items }, 200);
  } catch (err: any) {
    console.error("admin matchup list error:", err);
    return jsonResponse({ ok: false, error: "Failed to list matchups." }, 500);
  }
};

export function isValidWeekStart(value: string): boolean {
  if (!DATE_RE.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return false;
  }

  return parsed.getUTCDay() === 1;
}
