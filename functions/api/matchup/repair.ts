import { requireD1, requireTables } from "../../_lib/d1";
import { repairBrokenActiveMatchupPhoto } from "./current";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * POST /api/matchup/repair
 * Body: { broken_photo_id: number }
 *
 * Public browser image-load failures call this for **audit logging only** (#3028).
 * Mid-week D1 pair mutation is locked; authorized changes require admin + source Issue
 * via POST /api/admin/matchup/repair (or admin matchup update with source_issue).
 */
export const onRequestPost = async (context: any): Promise<Response> => {
  const { env, request } = context;

  try {
    const d1Check = requireD1(env);
    if (!d1Check.ok) {
      return jsonResponse(d1Check.body, d1Check.status);
    }

    const tablesCheck = await requireTables(d1Check.db, ["weekly_matchups", "weekly_votes", "photos"]);
    if (!tablesCheck.ok) {
      return jsonResponse(tablesCheck.body, tablesCheck.status);
    }

    const body = await request.json().catch(() => null);
    const brokenPhotoId = Number(body?.broken_photo_id);

    return await repairBrokenActiveMatchupPhoto({
      db: d1Check.db,
      request,
      brokenPhotoId,
      allowMutation: false,
      trigger: "public_repair_post",
      // Public callers cannot authorize anything; never let a client-supplied
      // source_issue land in the audit trail as if it were an admin reference (#3030).
      sourceIssue: null,
    });
  } catch (err: any) {
    return jsonResponse({ ok: false, error: String(err?.message ?? err) }, 500);
  }
};
