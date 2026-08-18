// /api/admin/welcome-email
// Admin managed Welcome Email copy.
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
       FROM welcome_email_content
       ORDER BY CASE WHEN status = 'posted' THEN 0 ELSE 1 END, updated_at DESC, id DESC
       LIMIT 1`
    ).first();

    return json({ ok: true, ...((row as any) || null) });
  } catch (e: any) {
    console.error('admin welcome-email get error:', e);
    return json({ ok: false, error: 'Failed to read welcome email content.' }, 500);
  }
};

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;
  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  try {
    const body = await request.json();
    const title = String(body?.title || 'Welcome Email').trim();
    const body_md = String(body?.body_md || '').trim();

    if (!body_md) return json({ ok: false, error: 'body_md is required' }, 400);

    await env.DB.prepare(`UPDATE welcome_email_content SET status='hidden', updated_at=datetime('now') WHERE status='posted'`).run();
    await env.DB.prepare(
      `INSERT INTO welcome_email_content (title, body_md, status, updated_at)
       VALUES (?1, ?2, 'posted', datetime('now'))`
    ).bind(title, body_md).run();

    return json({ ok: true });
  } catch (e: any) {
    console.error('admin welcome-email post error:', e);
    return json({ ok: false, error: 'Failed to publish welcome email content.' }, 500);
  }
};
