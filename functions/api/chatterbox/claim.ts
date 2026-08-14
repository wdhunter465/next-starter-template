// /api/chatterbox/claim — #3415 Chatterbox prototype.
// POST: atomically claim a task. Two simultaneous claims for the same task
// must resolve to exactly one winner — enforced by the partial unique index
// on chatterbox_claims(task_id) WHERE status='ACTIVE' (migration 0046), not
// by an application-level check-then-write race.
// Protected by ADMIN_TOKEN.

import { requireAdmin } from '../../_lib/auth';
import { requireD1 } from '../../_lib/d1';
import { atomicClaimTask, type TaskStateByKey } from '../../_lib/chatterbox';

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

  const allTasks = await d1.db.prepare('SELECT task_key, state FROM chatterbox_tasks WHERE room_id = ?').bind(room.id).all();
  const taskStatesByKey: TaskStateByKey = {};
  for (const row of allTasks.results ?? []) {
    taskStatesByKey[row.task_key] = row.state;
  }

  const result = await atomicClaimTask(d1.db, {
    taskId: Number(task.id),
    taskKey,
    participantId: Number(participant.id),
    roomId: Number(room.id),
    taskStatesByKey,
    task: { task_key: task.task_key, state: task.state, depends_on: task.depends_on },
  });

  if (!result.ok) {
    return json({ ok: false, error: result.reason }, 409);
  }

  await d1.db
    .prepare(
      `INSERT INTO chatterbox_events (room_id, participant_id, event_type, task_ref, body)
       VALUES (?, ?, 'CLAIM', ?, ?)`,
    )
    .bind(room.id, participant.id, taskKey, `CLAIM ${taskKey}`)
    .run();

  return json({ ok: true, claim_id: result.claimId }, 201);
};
