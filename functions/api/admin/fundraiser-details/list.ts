// GET /api/admin/fundraiser-details/list
// Lists every content_blocks row (draft and published) in the
// page='home', section='fundraiser-daily-details' feed, newest scheduled
// date first, so an admin can review what's queued before it goes live.
// Protected by an authenticated D1 admin member session (requireAdmin). #4253.

import { requireAdmin } from '../../../_lib/auth';

function json(res: any, status = 200): Response {
  return new Response(JSON.stringify(res, null, 2), { status, headers: { 'Content-Type': 'application/json' } });
}

const PAGE = 'home';
const SECTION = 'fundraiser-daily-details';

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  try {
    const rows = await env.DB.prepare(
      `SELECT key, title, body_md, social_caption, status, scheduled_publish_at, published_at, version, updated_at, updated_by
       FROM content_blocks
       WHERE page = ? AND section = ?
       ORDER BY COALESCE(scheduled_publish_at, published_at, updated_at) DESC`,
    )
      .bind(PAGE, SECTION)
      .all();

    return json({ ok: true, items: rows?.results || [] }, 200);
  } catch (err: any) {
    console.error('admin fundraiser-details list error:', err);
    return json({ ok: false, error: 'List failed.' }, 500);
  }
};
