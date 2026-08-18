// /api/admin/worklist
// Admin Team Worklist CRUD (minimal).
// - GET: list (optional q, status)
// - POST: add
// - PATCH: update status/owner/dates

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

  const url = new URL(request.url);
  const q = String(url.searchParams.get('q') || '').trim();
  const status = String(url.searchParams.get('status') || '').trim();

  try {
    let sql = `SELECT id, task, date_opened, needed_completion_date, owner, status, created_at, updated_at FROM admin_team_worklist`;
    const binds: any[] = [];
    const where: string[] = [];

    if (status) {
      where.push(`status = ?${binds.length + 1}`);
      binds.push(status);
    }
    if (q) {
      where.push(`(task LIKE ?${binds.length + 1} OR owner LIKE ?${binds.length + 2})`);
      binds.push(`%${q}%`, `%${q}%`);
    }

    if (where.length) sql += ` WHERE ` + where.join(' AND ');
    sql += ` ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, needed_completion_date ASC, id DESC LIMIT 250`;

    const res = await env.DB.prepare(sql).bind(...binds).all();
    return json({ ok: true, results: res?.results || [] });
  } catch (e: any) {
    console.error('admin worklist get error:', e);
    return json({ ok: false, error: 'Failed to list worklist.' }, 500);
  }
};

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;
  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  try {
    const body = await request.json();
    const task = String(body?.task || '').trim();
    const needed_completion_date = String(body?.needed_completion_date || '').trim();
    const owner = String(body?.owner || '').trim();

    if (!task) return json({ ok: false, error: 'task is required' }, 400);

    await env.DB.prepare(
      `INSERT INTO admin_team_worklist (task, needed_completion_date, owner, status, created_at, updated_at)
       VALUES (?1, ?2, ?3, 'open', datetime('now'), datetime('now'))`
    ).bind(task, needed_completion_date || null, owner || null).run();

    return json({ ok: true });
  } catch (e: any) {
    console.error('admin worklist post error:', e);
    return json({ ok: false, error: 'Failed to add worklist item.' }, 500);
  }
};

export const onRequestPatch = async (context: any): Promise<Response> => {
  const { request, env } = context;
  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  try {
    const body = await request.json();
    const id = Number(body?.id);
    const status = body?.status == null ? null : String(body.status).trim();
    const owner = body?.owner == null ? null : String(body.owner).trim();
    const needed_completion_date = body?.needed_completion_date == null ? null : String(body.needed_completion_date).trim();

    if (!id || !Number.isFinite(id)) return json({ ok: false, error: 'id is required' }, 400);

    const updates: string[] = [];
    const binds: any[] = [];

    if (status != null) {
      if (!['open','in_progress','completed'].includes(status)) return json({ ok: false, error: 'status must be open|in_progress|completed' }, 400);
      updates.push(`status = ?${binds.length + 1}`);
      binds.push(status);
    }
    if (owner != null) {
      updates.push(`owner = ?${binds.length + 1}`);
      binds.push(owner || null);
    }
    if (needed_completion_date != null) {
      updates.push(`needed_completion_date = ?${binds.length + 1}`);
      binds.push(needed_completion_date || null);
    }

    if (!updates.length) return json({ ok: false, error: 'No fields to update' }, 400);

    updates.push(`updated_at = datetime('now')`);

    const sql = `UPDATE admin_team_worklist SET ${updates.join(', ')} WHERE id = ?${binds.length + 1}`;
    binds.push(id);

    await env.DB.prepare(sql).bind(...binds).run();
    return json({ ok: true });
  } catch (e: any) {
    console.error('admin worklist patch error:', e);
    return json({ ok: false, error: 'Failed to update worklist item.' }, 500);
  }
};
