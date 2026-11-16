// GET /api/admin/adam-wilson/list
// Lists the private Adam Wilson award staging items (#4876, child of #2078). Admin session only (requireAdmin).
// Reads award_staging_items only. Nothing here is served on any public route.

import { requireAdmin } from '../../../_lib/auth';
import type { AwardContext } from '../../../_lib/adam-wilson-staging';

function json(res: unknown, status = 200): Response {
  return new Response(JSON.stringify(res, null, 2), { status, headers: { 'Content-Type': 'application/json' } });
}

export const onRequestGet = async (context: AwardContext): Promise<Response> => {
  const { request, env } = context;
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  try {
    const rows = await env.DB.prepare(
      `SELECT id, kind, title, body_md, status, honoree_consent, notes, created_by, created_at, updated_at
       FROM award_staging_items ORDER BY kind, updated_at DESC, id DESC`,
    ).all();
    return json({ ok: true, items: rows?.results || [] });
  } catch (err) {
    console.error('admin adam-wilson list error:', err);
    return json({ ok: false, error: 'List failed.' }, 500);
  }
};
