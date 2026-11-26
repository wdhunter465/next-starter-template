/**
 * GET /api/discussions/thread?id=<topic id>
 * One topic and its replies in time order, with display names. Requires a member session. (#5550)
 */
import { requireMember } from '../../_lib/session';
import { AUTHOR_JOIN, DISPLAY_NAME_SQL, TOPIC_COLUMNS, json } from '../../_lib/discussions';

export const onRequestGet = async (context: any): Promise<Response> => {
  const auth = await requireMember(context);
  if (!auth.ok) return json(auth.body, auth.status);

  const id = Number(new URL(context.request.url).searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) return json({ ok: false, error: 'invalid_id' }, 400);

  try {
    const topic = await auth.db
      .prepare(
        `SELECT ${TOPIC_COLUMNS}
           FROM discussions d ${AUTHOR_JOIN}
          WHERE d.id = ?2 AND d.status = 'posted' AND d.parent_id IS NULL`,
      )
      .bind(auth.email, id)
      .first();
    if (!topic) return json({ ok: false, error: 'not_found' }, 404);

    const replies = await auth.db
      .prepare(
        `SELECT d.id, d.body, d.created_at,
                (lower(d.author_email) = lower(?1)) AS mine,
                ${DISPLAY_NAME_SQL} AS author_name
           FROM discussions d ${AUTHOR_JOIN}
          WHERE d.parent_id = ?2 AND d.status = 'posted'
          ORDER BY d.created_at ASC, d.id ASC
          LIMIT 500`,
      )
      .bind(auth.email, id)
      .all();
    return json({ ok: true, topic, replies: replies.results ?? [] });
  } catch (err: any) {
    console.error('discussions thread error:', err);
    return json({ ok: false, error: 'thread_failed' }, 500);
  }
};
