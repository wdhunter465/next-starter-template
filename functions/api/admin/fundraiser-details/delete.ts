// POST /api/admin/fundraiser-details/delete
// Body: { key }  (e.g. "home.fundraiser-daily-details.2027-02-01")
// Permanently removes one Fundraiser Daily Details post -- draft or already
// published -- along with its content_revisions history. Unlike the rest of
// the content_blocks feature, this is a real delete rather than a status
// transition: it exists specifically so a pilot/test post can be created,
// confirmed to publish correctly, and then removed before real 2027 content
// is populated. Protected by an authenticated D1 admin member session
// (requireAdmin), same as every other /api/admin/** route. #4253.

import { requireAdmin } from '../../../_lib/auth';

function json(res: any, status = 200): Response {
  return new Response(JSON.stringify(res, null, 2), { status, headers: { 'Content-Type': 'application/json' } });
}

const PAGE = 'home';
const SECTION = 'fundraiser-daily-details';

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => ({}));
    const key = String(body?.key || '').trim();
    if (!key) return json({ ok: false, error: 'key is required.' }, 400);

    const existing = await env.DB.prepare('SELECT key, page, section FROM content_blocks WHERE key = ?')
      .bind(key)
      .first();

    if (!existing || (existing as any).page !== PAGE || (existing as any).section !== SECTION) {
      return json({ ok: false, error: 'No Fundraiser Daily Details post found with that key.' }, 404);
    }

    await env.DB.prepare('DELETE FROM content_revisions WHERE key = ?').bind(key).run();
    await env.DB.prepare('DELETE FROM content_blocks WHERE key = ?').bind(key).run();

    return json({ ok: true, deleted: key });
  } catch (err: any) {
    console.error('admin fundraiser-details delete error:', err);
    return json({ ok: false, error: 'Delete failed.' }, 500);
  }
};
