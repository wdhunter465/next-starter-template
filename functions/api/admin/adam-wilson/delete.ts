// POST /api/admin/adam-wilson/delete   Body: { id }
// Deletes one private Adam Wilson award staging item (#4876, child of #2078), for example a declined honoree
// entry. Admin session only.

import { requireAdmin } from '../../../_lib/auth';
import type { AwardContext } from '../../../_lib/adam-wilson-staging';

function json(res: unknown, status = 200): Response {
  return new Response(JSON.stringify(res, null, 2), { status, headers: { 'Content-Type': 'application/json' } });
}

export const onRequestPost = async (context: AwardContext): Promise<Response> => {
  const { request, env } = context;
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  try {
    const body = (await request.json().catch(() => ({}))) as { id?: unknown };
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id <= 0) return json({ ok: false, error: 'id must be a positive integer.' }, 400);
    const result = await env.DB.prepare('DELETE FROM award_staging_items WHERE id = ?').bind(id).run();
    if ((result.meta?.changes ?? 0) === 0) return json({ ok: false, error: 'Item not found.' }, 404);
    return json({ ok: true, id });
  } catch (err) {
    console.error('admin adam-wilson delete error:', err);
    return json({ ok: false, error: 'Delete failed.' }, 500);
  }
};
