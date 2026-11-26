/**
 * POST /api/admin/discussions/hide  { id, hidden: boolean }
 * Admin only. Hides or restores a topic or a reply (status hidden / posted). Hiding a topic hides it from the
 * list and its thread; its replies stay in the table. (#5550)
 */
import { requireAdminMember } from '../../../_lib/session';
import { json } from '../../../_lib/discussions';

export async function onRequestPost(ctx: any): Promise<Response> {
  const auth = await requireAdminMember(ctx);
  if (!auth.ok) return json(auth.body, auth.status);

  const input = (await ctx.request.json().catch(() => null)) as any;
  const id = Number(input?.id);
  if (!Number.isInteger(id) || id <= 0) return json({ ok: false, error: 'invalid_id' }, 400);
  if (typeof input?.hidden !== 'boolean') return json({ ok: false, error: 'hidden_must_be_boolean' }, 400);

  const result = await auth.db
    .prepare(`UPDATE discussions SET status = ?1 WHERE id = ?2`)
    .bind(input.hidden ? 'hidden' : 'posted', id)
    .run();
  if (!result?.meta?.changes) return json({ ok: false, error: 'not_found' }, 404);
  return json({ ok: true, id, status: input.hidden ? 'hidden' : 'posted' });
}
