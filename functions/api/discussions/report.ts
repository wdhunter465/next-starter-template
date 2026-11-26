/**
 * POST /api/discussions/report  { id, reason }
 * A member reports a post (topic or reply). A reason is required. The reporter is recorded; no one but the
 * reporter and admins can see the report. Repeating a report on the same post does nothing. At most
 * REPORTS_PER_HOUR reports per member per hour. (#5553)
 */
import { requireMember } from '../../_lib/session';
import { REASON_MAX, REASON_MIN, REPORTS_PER_HOUR, cleanText, json } from '../../_lib/discussions';

export async function onRequestPost(ctx: any): Promise<Response> {
  const auth = await requireMember(ctx);
  if (!auth.ok) return json(auth.body, auth.status);

  try {
    const input = (await ctx.request.json().catch(() => null)) as any;
    const id = Number(input?.id);
    if (!Number.isInteger(id) || id <= 0) return json({ ok: false, error: 'invalid_id' }, 400);
    const reason = cleanText(input?.reason);
    if (reason.length < REASON_MIN) return json({ ok: false, error: 'reason_required' }, 400);
    if (reason.length > REASON_MAX) return json({ ok: false, error: 'reason_too_long' }, 400);

    const post = (await auth.db
      .prepare(`SELECT id, COALESCE(parent_id, id) AS topic_id FROM discussions WHERE id = ?1 AND status = 'posted'`)
      .bind(id)
      .first()) as { id: number; topic_id: number } | null;
    if (!post) return json({ ok: false, error: 'not_found' }, 404);

    const recent = (await auth.db
      .prepare(
        `SELECT COUNT(1) AS n FROM discussion_flags
          WHERE kind = 'report' AND lower(flagged_by) = lower(?1) AND datetime(created_at) > datetime('now', '-1 hour')`,
      )
      .bind(auth.email)
      .first()) as { n: number } | null;
    if (Number(recent?.n ?? 0) >= REPORTS_PER_HOUR) return json({ ok: false, error: 'too_many_reports' }, 429);

    const result = await auth.db
      .prepare(
        `INSERT OR IGNORE INTO discussion_flags (discussion_id, topic_id, kind, flagged_by, reason)
         VALUES (?1, ?2, 'report', ?3, ?4)`,
      )
      .bind(post.id, post.topic_id, auth.email, reason)
      .run();
    return json({ ok: true, already: !result?.meta?.changes });
  } catch (err) {
    console.error('discussion report error:', err);
    return json({ ok: false, error: 'report_failed' }, 500);
  }
}
