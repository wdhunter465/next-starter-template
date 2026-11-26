/**
 * POST /api/discussions/settings  { id, notify?: boolean, closed?: boolean }
 * The topic's original poster turns the reply email on or off and closes or reopens the thread.
 * Only the original poster may do this (403 for anyone else). (#5550)
 */
import { requireMember } from '../../_lib/session';
import { json } from '../../_lib/discussions';

export async function onRequestPost(ctx: any): Promise<Response> {
  const auth = await requireMember(ctx);
  if (!auth.ok) return json(auth.body, auth.status);

  try {
    const input = (await ctx.request.json().catch(() => null)) as any;
    const id = Number(input?.id);
    if (!Number.isInteger(id) || id <= 0) return json({ ok: false, error: 'invalid_id' }, 400);
    if (input?.notify !== undefined && typeof input.notify !== 'boolean') return json({ ok: false, error: 'invalid_notify' }, 400);
    if (input?.closed !== undefined && typeof input.closed !== 'boolean') return json({ ok: false, error: 'invalid_closed' }, 400);

    const topic = (await auth.db
      .prepare(`SELECT id, author_email FROM discussions WHERE id = ?1 AND status = 'posted' AND parent_id IS NULL`)
      .bind(id)
      .first()) as { id: number; author_email: string | null } | null;
    if (!topic) return json({ ok: false, error: 'not_found' }, 404);
    if (String(topic.author_email || '').toLowerCase() !== auth.email.toLowerCase()) {
      return json({ ok: false, error: 'not_author' }, 403);
    }

    if (input.notify !== undefined) {
      await auth.db.prepare(`UPDATE discussions SET notify_author = ?1 WHERE id = ?2`).bind(input.notify ? 1 : 0, id).run();
    }
    if (input.closed !== undefined) {
      await auth.db
        .prepare(`UPDATE discussions SET closed_at = CASE WHEN ?1 = 1 THEN COALESCE(closed_at, datetime('now')) ELSE NULL END WHERE id = ?2`)
        .bind(input.closed ? 1 : 0, id)
        .run();
    }
    const row = await auth.db.prepare(`SELECT notify_author, closed_at FROM discussions WHERE id = ?1`).bind(id).first();
    return json({ ok: true, ...(row as object) });
  } catch (err) {
    console.error('discussion settings error:', err);
    return json({ ok: false, error: 'settings_failed' }, 500);
  }
}
