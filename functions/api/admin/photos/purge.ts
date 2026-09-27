// POST /api/admin/photos/purge
// #4261: the "governed admin cleanup (PURGE_ELIGIBLE)" step the deletion
// reconcile findings issue has always referenced but that never existed.
// Hard-deletes photos rows explicitly named by id, and only when every one
// of these holds:
//   - the row is already soft-retired (is_matchup_eligible = -1) with a
//     PURGE_ELIGIBLE rights_notes marker set by the reconcile job/live
//     matchup self-heal -- this endpoint never decides eligibility itself;
//   - the row is not referenced by content_inventory_media, weekly_matchups
//     (either slot), or milestones.photo_id -- a referenced row is reported
//     back as blocked rather than silently unlinked or cascade-deleted.
// Per-id, admin-only, explicit ids + a literal confirmation string: no
// "purge everything eligible" mode, so this can never run as an unattended
// bulk job.

import { requireAdmin } from "../../../_lib/auth";
import { requireD1, requireTables, jsonResponse } from "../../../_lib/d1";

const CONFIRM_TOKEN = "PURGE";

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
    const ids = Array.isArray(body?.ids)
      ? Array.from(new Set(body.ids.map((v: unknown) => Number(v)).filter((n: number) => Number.isInteger(n) && n > 0)))
      : [];

    if (body?.confirm !== CONFIRM_TOKEN) {
      return jsonResponse(
        { ok: false, error: "confirm_required", detail: `Body must include confirm: "${CONFIRM_TOKEN}".` },
        400,
      );
    }
    if (ids.length === 0) {
      return jsonResponse({ ok: false, error: "ids_required", detail: "Body must include a non-empty ids: number[]." }, 400);
    }

    const haveTables = await d1.db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name IN ('content_inventory_media','weekly_matchups','milestones');`)
      .all();
    const present = new Set(((haveTables.results ?? []) as Array<{ name?: string }>).map((r) => r.name));

    const results: Array<{ id: number; status: string; detail?: unknown }> = [];

    for (const id of ids as number[]) {
      const row = await d1.db
        .prepare(`SELECT id, is_matchup_eligible, rights_notes FROM photos WHERE id = ?1`)
        .bind(id)
        .first();

      if (!row) {
        results.push({ id, status: "not_found" });
        continue;
      }

      const eligible =
        Number((row as any).is_matchup_eligible) === -1 &&
        String((row as any).rights_notes || "").includes("PURGE_ELIGIBLE");
      if (!eligible) {
        results.push({ id, status: "not_purge_eligible" });
        continue;
      }

      const refs: Record<string, number> = {};
      if (present.has('content_inventory_media')) {
        const r = await d1.db.prepare(`SELECT COUNT(*) AS n FROM content_inventory_media WHERE media_id = ?1`).bind(id).first();
        refs.content_inventory_media = Number((r as any)?.n ?? 0);
      }
      if (present.has('weekly_matchups')) {
        const r = await d1.db
          .prepare(`SELECT COUNT(*) AS n FROM weekly_matchups WHERE photo_a_id = ?1 OR photo_b_id = ?1`)
          .bind(id)
          .first();
        refs.weekly_matchups = Number((r as any)?.n ?? 0);
      }
      if (present.has('milestones')) {
        const r = await d1.db.prepare(`SELECT COUNT(*) AS n FROM milestones WHERE photo_id = ?1`).bind(id).first();
        refs.milestones = Number((r as any)?.n ?? 0);
      }

      const referenced = Object.values(refs).some((n) => n > 0);
      if (referenced) {
        results.push({ id, status: "blocked_referenced", detail: refs });
        continue;
      }

      await d1.db.prepare(`DELETE FROM photos WHERE id = ?1`).bind(id).run();
      results.push({ id, status: "purged" });
    }

    return jsonResponse(
      { ok: true, results, purged: results.filter((r) => r.status === "purged").length },
      200,
    );
  } catch (err: any) {
    return jsonResponse({ ok: false, error: "server_error", detail: String(err?.message ?? err) }, 500);
  }
};
