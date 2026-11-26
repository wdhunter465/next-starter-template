/**
 * POST /api/discussions/create
 * Create a topic { title, body, notify? } or a reply { parent_id, body }. Requires a member session. (#5550)
 *
 * A reply goes to a topic only (one level deep). A closed or hidden topic refuses replies (409).
 * The author's email comes from the session, never from the request.
 */
import { getMemberRole, requireMember } from '../../_lib/session';
import { BODY_MAX, BODY_MIN, TITLE_MAX, TITLE_MIN, cleanText, hasAdminMention, json } from '../../_lib/discussions';

/** A post that mentions @admin becomes an open question for the admin. One per post. */
async function flagQuestion(db: any, discussionId: number, topicId: number, email: string): Promise<void> {
  await db
    .prepare(`INSERT OR IGNORE INTO discussion_flags (discussion_id, topic_id, kind, flagged_by) VALUES (?1, ?2, 'question', ?3)`)
    .bind(discussionId, topicId, email)
    .run();
}

export async function onRequestPost(ctx: any): Promise<Response> {
  const auth = await requireMember(ctx);
  if (!auth.ok) return json(auth.body, auth.status);

  try {
    const input = (await ctx.request.json().catch(() => null)) as any;
    const postBody = cleanText(input?.body);
    if (postBody.length < BODY_MIN) return json({ ok: false, error: 'body_required' }, 400);
    if (postBody.length > BODY_MAX) return json({ ok: false, error: 'body_too_long' }, 400);

    if (input?.parent_id != null) {
      const parentId = Number(input.parent_id);
      if (!Number.isInteger(parentId) || parentId <= 0) return json({ ok: false, error: 'invalid_parent' }, 400);
      const topic = (await auth.db
        .prepare(`SELECT id, closed_at FROM discussions WHERE id = ?1 AND status = 'posted' AND parent_id IS NULL`)
        .bind(parentId)
        .first()) as { id: number; closed_at: string | null } | null;
      if (!topic) return json({ ok: false, error: 'not_found' }, 404);
      if (topic.closed_at) return json({ ok: false, error: 'thread_closed' }, 409);
      const reply = (await auth.db
        .prepare(
          `INSERT INTO discussions (title, body, author_email, status, created_at, parent_id)
           VALUES ('', ?1, ?2, 'posted', datetime('now'), ?3)
           RETURNING id, created_at`,
        )
        .bind(postBody, auth.email, parentId)
        .first()) as { id: number; created_at: string } | null;
      if (reply) {
        if (hasAdminMention(postBody)) await flagQuestion(auth.db, reply.id, parentId, auth.email);
        if ((await getMemberRole(auth.db, auth.email)) === 'admin') {
          // An admin reply answers the open questions that came before it in this topic.
          await auth.db
            .prepare(
              `UPDATE discussion_flags SET status = 'resolved', resolved_by = ?1, resolved_at = datetime('now')
                WHERE topic_id = ?2 AND kind = 'question' AND status = 'open' AND discussion_id < ?3`,
            )
            .bind(auth.email, parentId, reply.id)
            .run();
        }
      }
      return json({ ok: true, reply });
    }

    const title = cleanText(input?.title);
    if (title.length < TITLE_MIN) return json({ ok: false, error: 'title_required' }, 400);
    if (title.length > TITLE_MAX) return json({ ok: false, error: 'title_too_long' }, 400);
    const notify = input?.notify === false ? 0 : 1;
    const topic = await auth.db
      .prepare(
        `INSERT INTO discussions (title, body, author_email, status, created_at, notify_author)
         VALUES (?1, ?2, ?3, 'posted', datetime('now'), ?4)
         RETURNING id, title, body, created_at`,
      )
      .bind(title, postBody, auth.email, notify)
      .first();
    if (!topic) return json({ ok: false, error: 'create_failed' }, 500);
    if (hasAdminMention(postBody) || hasAdminMention(title)) await flagQuestion(auth.db, (topic as any).id, (topic as any).id, auth.email);
    return json({ ok: true, discussion: topic });
  } catch (err) {
    console.error('Error creating discussion:', err);
    return json({ ok: false, error: 'create_failed' }, 500);
  }
}
