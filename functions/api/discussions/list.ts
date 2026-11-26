/**
 * GET /api/discussions/list?limit=20
 * Topics (not replies), most recently active first, with the author's display name, reply count and last
 * activity. Author email addresses never leave the server. Requires a member session. (#5550)
 */
import { requireMember } from '../../_lib/session';
import { AUTHOR_JOIN, TOPIC_COLUMNS, json } from '../../_lib/discussions';

export const onRequestGet = async (context: any): Promise<Response> => {
  const auth = await requireMember(context);
  if (!auth.ok) return json(auth.body, auth.status);

  try {
    const url = new URL(context.request.url);
    const limit = Math.max(1, Math.min(50, Number(url.searchParams.get('limit') || '20') || 20));
    const rows = await auth.db
      .prepare(
        `SELECT ${TOPIC_COLUMNS}
           FROM discussions d ${AUTHOR_JOIN}
          WHERE d.status = 'posted' AND d.parent_id IS NULL
          ORDER BY last_activity DESC, d.id DESC
          LIMIT ?2`,
      )
      .bind(auth.email, limit)
      .all();
    return json({ ok: true, items: rows.results ?? [] });
  } catch (err: any) {
    console.error('discussions list error:', err);
    return json({ ok: false, error: 'list_failed' }, 500);
  }
};
