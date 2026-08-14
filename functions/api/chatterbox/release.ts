// /api/chatterbox/release — #3415 Chatterbox prototype.
// POST: release an active claim. Never silently reassigns a stale claim —
// in this slice, only the current claimant may release. A PMO override path
// (releasing on another participant's behalf) is deliberately not
// implemented yet; matching the design's caution that partial work/branches
// may already exist under a claim, that requires its own reviewed decision
// rather than a quiet default.
// Protected by ADMIN_TOKEN.

import { requireAdmin } from '../../_lib/auth';
import { requireD1 } from '../../_lib/d1';

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { 'Content-Type': 'application/json' } });
}

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
  const taskKey = String(body?.task_key || '').trim();
  const participantKey = String(body?.participant_key || '').trim();
  if (!roomKey || !taskKey || !participantKey) {
    return json({ ok: false, error: 'room_key, task_key, and participant_key are required' }, 400);
  }

  const room = await d1.db.prepare('SELECT id FROM chatterbox_rooms WHERE room_key = ?').bind(roomKey).first();
  if (!room) return json({ ok: false, error: 'room not found' }, 404);

  const participant = await d1.db
    .prepare('SELECT id FROM chatterbox_participants WHERE participant_key = ? AND revoked_at IS NULL')
    .bind(participantKey)
    .first();
  if (!participant) return json({ ok: false, error: 'participant not found or revoked' }, 404);

  const task = await d1.db
    .prepare('SELECT * FROM chatterbox_tasks WHERE room_id = ? AND task_key = ?')
    .bind(room.id, taskKey)
    .first();
  if (!task) return json({ ok: false, error: 'task not found' }, 404);

  const activeClaim = await d1.db
    .prepare(`SELECT * FROM chatterbox_claims WHERE task_id = ? AND status = 'ACTIVE'`)
    .bind(task.id)
    .first();
  if (!activeClaim) return json({ ok: false, error: 'no active claim on this task' }, 409);
  if (Number(activeClaim.participant_id) !== Number(participant.id)) {
    return json({ ok: false, error: 'only the current claimant may release; no PMO override exists in this slice' }, 403);
  }

  await d1.db
    .prepare(
      `UPDATE chatterbox_claims SET status = 'RELEASED', released_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`,
    )
    .bind(activeClaim.id)
    .run();

  await d1.db
    .prepare(`UPDATE chatterbox_tasks SET state = 'AVAILABLE', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
    .bind(task.id)
    .run();

  await d1.db
    .prepare(
      `INSERT INTO chatterbox_events (room_id, participant_id, event_type, task_ref, body)
       VALUES (?, ?, 'RELEASE', ?, ?)`,
    )
    .bind(room.id, participant.id, taskKey, `RELEASE ${taskKey}`)
    .run();

  return json({ ok: true });
};
