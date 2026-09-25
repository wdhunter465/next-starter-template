// #3161: full researched Gehrig life timeline for authenticated FanClub members.
// Public visitors get the headline-only subset from /api/milestones/list;
// this endpoint returns every milestone row (public + member visibility)
// with the extended detail_body/source_url narrative.

import { requireD1, requireTables, jsonResponse } from "../../_lib/d1";
import { requireMember } from "../../_lib/session";
import { normalizePhotoUrl } from "../../_lib/photo-url";
import { rightsClearedClause } from "../../_lib/rights-hold";

export const onRequestGet = async (context: any): Promise<Response> => {
  const auth = await requireMember(context);
  if (!auth.ok) return jsonResponse(auth.body, auth.status);

  const { env, request } = context;
  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  try {
    const tables = await requireTables(auth.db, ["milestones", "photos"]);
    if (!tables.ok) return jsonResponse(tables.body, tables.status);

    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || '100')));

    const sql = `SELECT m.id,
                        m.year,
                        m.event_date,
                        m.event_type,
                        m.title,
                        m.description,
                        m.detail_body,
                        m.source_url,
                        m.photo_id,
                        p.url as photo_url
                 FROM milestones m
                 LEFT JOIN photos p ON p.id = m.photo_id AND ${rightsClearedClause("p")}
                 WHERE m.status='posted'
                 ORDER BY CASE WHEN COALESCE(NULLIF(trim(m.event_date), ''), m.year) IS NULL THEN 1 ELSE 0 END ASC,
                          COALESCE(date(NULLIF(trim(m.event_date), '')), date(m.year || '-01-01')) ASC,
                          m.id ASC
                 LIMIT ?;`;

    const rows = await auth.db.prepare(sql).bind(limit).all();
    const items = ((rows.results ?? []) as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      photo_url: normalizePhotoUrl({
        rawUrl: row.photo_url,
        request,
        publicB2BaseUrl: env.PUBLIC_B2_BASE_URL,
      }) || null,
    }));

    return jsonResponse({ ok: true, items }, 200);
  } catch (err: any) {
    return jsonResponse({ ok: false, error: String(err?.message ?? err) }, 500);
  }
};
