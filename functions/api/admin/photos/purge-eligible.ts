// GET /api/admin/photos/purge-eligible
// #4261: lists photos rows soft-retired by the B2/D1 deletion reconcile job
// (is_matchup_eligible = -1 with a PURGE_ELIGIBLE rights_notes marker) so an
// admin can review, before POSTing /api/admin/photos/purge, which rows are
// actually safe to hard-delete (unreferenced) versus still referenced
// elsewhere and therefore blocked.

import { requireAdmin } from "../../../_lib/auth";
import { requireD1, requireTables, jsonResponse } from "../../../_lib/d1";

// One bulk GROUP BY query per (table, column) pair across the whole id set,
// unioned in SQL when a table can reference an id from more than one column
// (e.g. weekly_matchups.photo_a_id / photo_b_id) -- bounded query count
// regardless of how many candidate ids are being checked.
async function countRefsById(
  db: any,
  present: Set<string | undefined>,
  table: string,
  ids: number[],
  columns: Array<{ column: string }>,
): Promise<Map<number, number>> {
  const counts = new Map<number, number>();
  if (!present.has(table) || ids.length === 0) return counts;

  // Plain positional `?` (not numbered `?1`) -- each occurrence in the SQL
  // text consumes the next bind arg in order, so a UNION ALL of two
  // subqueries needs the id list bound once per subquery.
  const placeholders = ids.map(() => '?').join(',');
  const unioned = columns
    .map(({ column }) => `SELECT ${column} AS ref_id, COUNT(*) AS n FROM ${table} WHERE ${column} IN (${placeholders}) GROUP BY ${column}`)
    .join(' UNION ALL ');
  const sql = columns.length > 1
    ? `SELECT ref_id, SUM(n) AS n FROM (${unioned}) GROUP BY ref_id`
    : unioned;

  const bindArgs = columns.flatMap(() => ids);
  const rows = await db.prepare(sql).bind(...bindArgs).all();
  for (const row of (rows.results ?? []) as Array<{ ref_id?: unknown; n?: unknown }>) {
    counts.set(Number(row.ref_id), Number(row.n ?? 0));
  }
  return counts;
}

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
    const ids = candidates.map((row) => Number(row.id));

    const haveTables = await d1.db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name IN ('content_inventory_media','weekly_matchups','milestones');`)
      .all();
    const present = new Set(((haveTables.results ?? []) as Array<{ name?: string }>).map((r) => r.name));

    // #4261 review: avoid N+1 -- up to 3 COUNT queries *per candidate* could
    // mean 1500+ D1 queries for a full page. Bulk-aggregate each reference
    // table once across the whole id set instead.
    const mediaRefsById = await countRefsById(d1.db, present, 'content_inventory_media', ids, [
      { column: 'media_id' },
    ]);
    const matchupRefsById = await countRefsById(d1.db, present, 'weekly_matchups', ids, [
      { column: 'photo_a_id' },
      { column: 'photo_b_id' },
    ]);
    const milestoneRefsById = await countRefsById(d1.db, present, 'milestones', ids, [
      { column: 'photo_id' },
    ]);

    const items = candidates.map((row) => {
      const id = Number(row.id);
      const mediaRefs = mediaRefsById.get(id) ?? 0;
      const matchupRefs = matchupRefsById.get(id) ?? 0;
      const milestoneRefs = milestoneRefsById.get(id) ?? 0;
      const referenced = mediaRefs > 0 || matchupRefs > 0 || milestoneRefs > 0;

      return {
        id,
        url: row.url ?? null,
        photo_id: row.photo_id ?? null,
        rights_notes: row.rights_notes ?? null,
        purgeable: !referenced,
        references: { content_inventory_media: mediaRefs, weekly_matchups: matchupRefs, milestones: milestoneRefs },
      };
    });

    return jsonResponse({ ok: true, items }, 200);
  } catch (err: any) {
    return jsonResponse({ ok: false, error: "server_error", detail: String(err?.message ?? err) }, 500);
  }
};
