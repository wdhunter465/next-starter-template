/**
 * GET /api/admin/discussions/flags?status=open|resolved|all
 * Admin only. Questions for the admin and member reports on Member Chat posts, newest first, with who flagged
 * (display name and email), the reason, the post excerpt and the topic. (#5553)
 */
import { requireAdminMember } from '../../../_lib/session';
import { DISPLAY_NAME_SQL, json } from '../../../_lib/discussions';

export async function onRequestGet(ctx: any): Promise<Response> {
  const auth = await requireAdminMember(ctx);
  if (!auth.ok) return json(auth.body, auth.status);

  const status = new URL(ctx.request.url).searchParams.get('status') || 'open';
  if (!['open', 'resolved', 'all'].includes(status)) return json({ ok: false, error: 'invalid_status' }, 400);

  const rows = await auth.db
    .prepare(
      `SELECT f.id, f.kind, f.status, f.reason, f.admin_note, f.created_at, f.resolved_at, f.resolved_by,
              f.discussion_id, f.topic_id, f.flagged_by,
              (SELECT ${DISPLAY_NAME_SQL.replace(/\bj\./g, 'jf.')} FROM join_requests jf WHERE lower(jf.email) = lower(f.flagged_by) LIMIT 1) AS flagged_by_name,
              substr(p.body, 1, 300) AS post_excerpt,
              t.title AS topic_title
         FROM discussion_flags f
         JOIN discussions p ON p.id = f.discussion_id
         JOIN discussions t ON t.id = f.topic_id
        WHERE (?1 = 'all' OR f.status = ?1)
        ORDER BY f.created_at DESC, f.id DESC
        LIMIT 200`,
    )
    .bind(status)
    .all();
  return json({ ok: true, items: rows.results ?? [] });
}
