import { requireD1, requireTables, jsonResponse } from "../../_lib/d1";
import { normalizePhotoUrl } from "../../_lib/photo-url";
import { rightsClearedClause } from "../../_lib/rights-hold";

export const onRequestGet = async (context: any): Promise<Response> => {
  const { env, request } = context;
  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  try {
    const tables = await requireTables(d1.db, ["milestones", "photos"]);
    if (!tables.ok) return jsonResponse(tables.body, tables.status);

    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get('limit') || '50')));

    const tableInfo = await d1.db.prepare(`PRAGMA table_info(milestones);`).all();
    const milestoneColumns = new Set(((tableInfo.results ?? []) as Array<{ name?: string }>).map((c) => c.name));

    const candidateDateColumns = ['milestone_date', 'date', 'event_date', 'date_iso', 'occurred_on', 'year'];
    const selectedDateColumn = candidateDateColumns.find((column) => milestoneColumns.has(column)) ?? 'year';

    const selectDateSql = selectedDateColumn === 'year'
      ? `NULL AS milestone_date`
      : `m.${selectedDateColumn} AS milestone_date`;

    const orderBySql = selectedDateColumn === 'year'
      ? `CASE WHEN m.year IS NULL THEN 1 ELSE 0 END ASC, m.year ASC, m.id ASC`
      : `CASE WHEN m.${selectedDateColumn} IS NULL OR trim(m.${selectedDateColumn}) = '' THEN 1 ELSE 0 END ASC,
         date(m.${selectedDateColumn}) ASC,
         m.${selectedDateColumn} ASC,
         m.id ASC`;

    const sql = `SELECT m.id,
                        m.year,
                        ${selectDateSql},
                        m.title,
                        m.description,
                        m.photo_id,
                        p.url as photo_url
                 FROM milestones m
                 LEFT JOIN photos p ON p.id = m.photo_id AND ${rightsClearedClause("p")}
                 WHERE m.status='posted'
                 ORDER BY ${orderBySql}
                 LIMIT ?;`;

    const rows = await d1.db.prepare(sql).bind(limit).all();
    const items = ((rows.results ?? []) as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      photo_url: normalizePhotoUrl({
        rawUrl: row.photo_url,
        request,
        publicB2BaseUrl: env.PUBLIC_B2_BASE_URL,
      }) || null,
    }));

    return new Response(JSON.stringify({ ok: true, items }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message ?? err) }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
