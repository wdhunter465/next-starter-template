// /api/chatterbox/room — #3794 Chatterbox self-hosted room-actor design.
// GET: fetch a room by room_key ("GET project" from #3415's candidate ops).
// POST: create a room. Rooms are never auto-created by other routes — an
// unknown room_key elsewhere in this API 404s.
//
// GET requires any authenticated caller (a participant's own credential or
// the relay). Room creation stays PMO/ops-operated: POST requires the
// bridge/ops relay credential (CHATTERBOX_BRIDGE_PROD_TOKEN) specifically, not
// an individual participant's own credential (#3794 JULES-1 auth model).

import { requireD1 } from '../../_lib/d1';
import { ensureRoom } from '../../_lib/chatterbox';
import { requireChatterboxCaller, requireRelay } from '../../_lib/chatterbox-auth';

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { 'Content-Type': 'application/json' } });
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;
  const d1 = requireD1(env);
  if (!d1.ok) return json(d1.body, d1.status);

  const auth = await requireChatterboxCaller(request, env, d1.db);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const roomKey = String(url.searchParams.get('room') || '').trim();
  if (!roomKey) return json({ ok: false, error: 'room query param is required' }, 400);

  const row = await d1.db.prepare('SELECT * FROM chatterbox_rooms WHERE room_key = ?').bind(roomKey).first();
  if (!row) return json({ ok: false, error: 'room not found' }, 404);

  return json({ ok: true, room: row });
};

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;
  const d1 = requireD1(env);
  if (!d1.ok) return json(d1.body, d1.status);

  const auth = await requireChatterboxCaller(request, env, d1.db);
  if (!auth.ok) return auth.response;
  const relayDeny = requireRelay(auth.caller);
  if (relayDeny) return relayDeny;

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
