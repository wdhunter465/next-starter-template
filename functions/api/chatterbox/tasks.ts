// /api/chatterbox/tasks — #3794 Chatterbox self-hosted room-actor design.
// GET: list a room's task graph. Any authenticated caller may read.
// POST: create or update a task. Chatterbox ingests the PMO-authored task
// graph; it does not invent scope. collision_domain and depends_on mirror
// what the governing GitHub Issue already declares (review point 3) rather
// than a second, parallel metadata format. Task-graph authorship stays
// PMO/ops-operated: requires the relay credential.

import { requireD1 } from '../../_lib/d1';
import { isValidTaskState } from '../../_lib/chatterbox';
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

  const room = await d1.db.prepare('SELECT id FROM chatterbox_rooms WHERE room_key = ?').bind(roomKey).first();
  if (!room) return json({ ok: false, error: 'room not found' }, 404);

  const rows = await d1.db
    .prepare('SELECT * FROM chatterbox_tasks WHERE room_id = ? ORDER BY id ASC')
    .bind(room.id)
    .all();

  return json({ ok: true, tasks: rows.results ?? [] });
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
  const taskKey = String(body?.task_key || '').trim();
  const title = String(body?.title || '').trim();
  const state = String(body?.state || 'PLANNED').trim();
  const collisionDomain = Array.isArray(body?.collision_domain) ? JSON.stringify(body.collision_domain) : '[]';
  const dependsOn = Array.isArray(body?.depends_on) ? JSON.stringify(body.depends_on) : '[]';

  if (!roomKey || !taskKey || !title) {
    return json({ ok: false, error: 'room_key, task_key, and title are required' }, 400);
  }
  if (!isValidTaskState(state)) {
    return json({ ok: false, error: `invalid state: ${state}` }, 400);
  }

  const room = await d1.db.prepare('SELECT id FROM chatterbox_rooms WHERE room_key = ?').bind(roomKey).first();
  if (!room) return json({ ok: false, error: 'room not found; create it via POST /api/chatterbox/room first' }, 404);

  const existing = await d1.db
    .prepare('SELECT id FROM chatterbox_tasks WHERE room_id = ? AND task_key = ?')
    .bind(room.id, taskKey)
    .first();

  if (existing) {
    await d1.db
      .prepare(
        `UPDATE chatterbox_tasks
         SET title = ?, state = ?, collision_domain = ?, depends_on = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE id = ?`,
      )
      .bind(title, state, collisionDomain, dependsOn, existing.id)
      .run();
  } else {
    await d1.db
      .prepare(
        `INSERT INTO chatterbox_tasks (room_id, task_key, title, state, collision_domain, depends_on)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(room.id, taskKey, title, state, collisionDomain, dependsOn)
      .run();
  }

  const row = await d1.db
    .prepare('SELECT * FROM chatterbox_tasks WHERE room_id = ? AND task_key = ?')
    .bind(room.id, taskKey)
    .first();

  return json({ ok: true, task: row }, existing ? 200 : 201);
};
