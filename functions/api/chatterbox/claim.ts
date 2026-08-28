// /api/chatterbox/claim — #3794 Chatterbox self-hosted room-actor design.
// POST: atomically claim a task. Two simultaneous claims for the same task
// must resolve to exactly one winner — enforced by the partial unique index
// on chatterbox_claims(task_id) WHERE status='ACTIVE' (migration 0050), not
// by an application-level check-then-write race.
//
// The acting participant is resolved from the authenticated credential
// (#3794 JULES-1), not merely trusted from the request body — a
// participant credential can only claim as itself; the relay credential
// must still name a participant_key explicitly (unchanged self-declared
// bridge model).

import { requireD1 } from '../../_lib/d1';
import { atomicClaimTask, type TaskStateByKey } from '../../_lib/chatterbox';
import { requireChatterboxCaller, resolveActingParticipant } from '../../_lib/chatterbox-auth';

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { 'Content-Type': 'application/json' } });
}

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;
  const d1 = requireD1(env);
  if (!d1.ok) return json(d1.body, d1.status);

  const auth = await requireChatterboxCaller(request, env, d1.db);
  if (!auth.ok) return auth.response;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid JSON body' }, 400);
  }

  const roomKey = String(body?.room_key || '').trim();
  const taskKey = String(body?.task_key || '').trim();
  const participantKeyBody = body?.participant_key != null ? String(body.participant_key).trim() : null;
  if (!roomKey || !taskKey) {
    return json({ ok: false, error: 'room_key and task_key are required' }, 400);
  }

  const acting = await resolveActingParticipant(d1.db, auth.caller, participantKeyBody);
  if (!acting.ok) return acting.response;
  const participant = acting.participant;

  const room = await d1.db.prepare('SELECT id FROM chatterbox_rooms WHERE room_key = ?').bind(roomKey).first();
  if (!room) return json({ ok: false, error: 'room not found' }, 404);

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
