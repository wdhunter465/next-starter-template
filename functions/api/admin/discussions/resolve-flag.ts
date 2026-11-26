/**
 * POST /api/admin/discussions/resolve-flag  { id, note? }
 * Admin only. Marks a Member Chat flag resolved, with an optional note. The admin is recorded. (#5553)
 */
import { requireAdminMember } from '../../../_lib/session';
import { cleanText, json } from '../../../_lib/discussions';

export async function onRequestPost(ctx: any): Promise<Response> {
  const auth = await requireAdminMember(ctx);
  if (!auth.ok) return json(auth.body, auth.status);

  const input = (await ctx.request.json().catch(() => null)) as any;
  const id = Number(input?.id);
  if (!Number.isInteger(id) || id <= 0) return json({ ok: false, error: 'invalid_id' }, 400);
  const note = cleanText(input?.note).slice(0, 500) || null;

  const result = await auth.db
    .prepare(
      `UPDATE discussion_flags SET status = 'resolved', admin_note = ?1, resolved_by = ?2, resolved_at = datetime('now')
        WHERE id = ?3 AND status = 'open'`,
    )
    .bind(note, auth.email, id)
    .run();
  if (!result?.meta?.changes) return json({ ok: false, error: 'not_found_or_resolved' }, 404);
  return json({ ok: true, id });
}
