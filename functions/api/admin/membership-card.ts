// /api/admin/membership-card
// Admin managed Membership Card content.
// - GET: returns latest posted row (or latest row)
// - POST: publish new content (hides previous posted rows)

import { requireAdmin } from "../../_lib/auth";

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;
  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  try {
    const row = await env.DB.prepare(
      `SELECT id, title, body_md, status, updated_at
       FROM membership_card_content
       ORDER BY CASE WHEN status = 'posted' THEN 0 ELSE 1 END, updated_at DESC, id DESC
       LIMIT 1`
    ).first();

    return json({ ok: true, ...((row as any) || null) });
  } catch (e: any) {
    console.error('admin membership-card get error:', e);
    return json({ ok: false, error: 'Failed to read membership card content.' }, 500);
  }
};

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;
  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  try {
    const body = await request.json();
    const title = String(body?.title || 'Membership Card').trim();
    const body_md = String(body?.body_md || '').trim();

    if (!body_md) return json({ ok: false, error: 'body_md is required' }, 400);

    // Hide any existing posted rows and insert a new posted row.
    await env.DB.prepare(`UPDATE membership_card_content SET status='hidden', updated_at=datetime('now') WHERE status='posted'`).run();
    await env.DB.prepare(
      `INSERT INTO membership_card_content (title, body_md, status, updated_at)
       VALUES (?1, ?2, 'posted', datetime('now'))`
    ).bind(title, body_md).run();

    return json({ ok: true });
  } catch (e: any) {
    console.error('admin membership-card post error:', e);
    return json({ ok: false, error: 'Failed to publish membership card content.' }, 500);
  }
};
