// /api/chatterbox/room — #3415 Chatterbox prototype.
// GET: fetch a room by room_key ("GET project" from #3415's candidate ops).
// POST: create a room (admin/PMO only). Rooms are never auto-created by
// other routes — an unknown room_key elsewhere in this API 404s.
// Protected by ADMIN_TOKEN, same pattern as functions/api/admin/*.

import { requireAdmin } from '../../_lib/auth';
import { requireD1 } from '../../_lib/d1';
import { ensureRoom } from '../../_lib/chatterbox';

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { 'Content-Type': 'application/json' } });
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;
  const deny = requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return json(d1.body, d1.status);

  const url = new URL(request.url);
  const roomKey = String(url.searchParams.get('room') || '').trim();
  if (!roomKey) return json({ ok: false, error: 'room query param is required' }, 400);

  const row = await d1.db.prepare('SELECT * FROM chatterbox_rooms WHERE room_key = ?').bind(roomKey).first();
  if (!row) return json({ ok: false, error: 'room not found' }, 404);

  return json({ ok: true, room: row });
};

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;
  const deny = requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return json(d1.body, d1.status);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid JSON body' }, 400);
  }

  const roomKey = String(body?.room_key || '').trim();
  const sourceIssueRef = String(body?.source_issue_ref || '').trim();
  const title = String(body?.title || '').trim();
  if (!roomKey || !sourceIssueRef || !title) {
    return json({ ok: false, error: 'room_key, source_issue_ref, and title are required' }, 400);
  }

  const room = await ensureRoom(d1.db, { roomKey, sourceIssueRef, title });
  return json({ ok: true, room_id: room.id }, 201);
};
