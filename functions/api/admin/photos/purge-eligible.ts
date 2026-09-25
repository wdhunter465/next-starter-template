// GET /api/admin/photos/purge-eligible
// #4261: lists photos rows soft-retired by the B2/D1 deletion reconcile job
// (is_matchup_eligible = -1 with a PURGE_ELIGIBLE rights_notes marker) so an
// admin can review, before POSTing /api/admin/photos/purge, which rows are
// actually safe to hard-delete (unreferenced) versus still referenced
// elsewhere and therefore blocked.

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
    const rows = await d1.db
      .prepare(
        `SELECT id, url, photo_id, rights_notes
         FROM photos
         WHERE is_matchup_eligible = -1
           AND rights_notes LIKE '%PURGE_ELIGIBLE%'
         ORDER BY id ASC
         LIMIT 500;`,
      )
      .all();

    const candidates = (rows.results ?? []) as Array<Record<string, unknown>>;

    const haveTables = await d1.db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name IN ('content_inventory_media','weekly_matchups','milestones');`)
      .all();
    const present = new Set(((haveTables.results ?? []) as Array<{ name?: string }>).map((r) => r.name));

    const items = [];
    for (const row of candidates) {
      const id = Number(row.id);
      let mediaRefs = 0;
      let matchupRefs = 0;
      let milestoneRefs = 0;

      if (present.has('content_inventory_media')) {
        const r = await d1.db
          .prepare(`SELECT COUNT(*) AS n FROM content_inventory_media WHERE media_id = ?1`)
          .bind(id)
          .first();
        mediaRefs = Number((r as any)?.n ?? 0);
      }
      if (present.has('weekly_matchups')) {
        const r = await d1.db
          .prepare(`SELECT COUNT(*) AS n FROM weekly_matchups WHERE photo_a_id = ?1 OR photo_b_id = ?1`)
          .bind(id)
          .first();
        matchupRefs = Number((r as any)?.n ?? 0);
      }
      if (present.has('milestones')) {
        const r = await d1.db
          .prepare(`SELECT COUNT(*) AS n FROM milestones WHERE photo_id = ?1`)
          .bind(id)
          .first();
        milestoneRefs = Number((r as any)?.n ?? 0);
      }

      const referenced = mediaRefs > 0 || matchupRefs > 0 || milestoneRefs > 0;

      items.push({
        id,
        url: row.url ?? null,
        photo_id: row.photo_id ?? null,
        rights_notes: row.rights_notes ?? null,
        purgeable: !referenced,
        references: { content_inventory_media: mediaRefs, weekly_matchups: matchupRefs, milestones: milestoneRefs },
      });
    }

    return jsonResponse({ ok: true, items }, 200);
  } catch (err: any) {
    return jsonResponse({ ok: false, error: "server_error", detail: String(err?.message ?? err) }, 500);
  }
};
