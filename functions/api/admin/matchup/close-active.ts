// POST /api/admin/matchup/close-active
// Admin-only. Closes the current active weekly matchup (rotation control).

import { requireAdmin } from "../../../_lib/auth";
import { requireD1, requireTables, jsonResponse } from "../../../_lib/d1";

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireTables(d1.db, ["weekly_matchups"]);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const active = await d1.db
      .prepare(
        "SELECT id, week_start FROM weekly_matchups WHERE status='active' ORDER BY week_start DESC LIMIT 1",
      )
      .first();

    if (!active) {
      return jsonResponse({ ok: true, changed: 0, note: "No active matchup to close." }, 200);
    }

    const out = await d1.db
      .prepare("UPDATE weekly_matchups SET status='closed' WHERE status='active'")
      .run();

    return jsonResponse(
      {
        ok: true,
        changed: out?.meta?.changes || 0,
        closed_id: Number((active as any).id),
        closed_week_start: String((active as any).week_start || ""),
      },
      200,
    );
  } catch (err: any) {
    console.error("admin matchup close-active error:", err);
    return jsonResponse({ ok: false, error: "server_error", detail: String(err?.message || err) }, 500);
  }
};
