// /api/chatterbox/release — #3794 Chatterbox self-hosted room-actor design.
// POST: release an active claim.
//
// The current claimant may always release their own claim (no reason
// required). #3794 JULES-5 fix: a participant whose role_class is 'pmo' or
// 'product_authority' may additionally force-release *any* active claim,
// but must supply a non-empty `reason` — the release is recorded as an
// auditable RELEASE event naming the forcing participant and the reason,
// targeted at the original claimant. This is a controlled override, not a
// blind reassignment (#3415's own caution: "a stale claim must be flagged
// for reconciliation rather than blindly reassigned" — this still requires
// an accountable PMO/Product-Authority actor and an explicit reason, it
// does not auto-reclaim on a timer).

import { requireD1 } from '../../_lib/d1';
import { canForceRelease } from '../../_lib/chatterbox';
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
  const reason = body?.reason != null ? String(body.reason).trim() : '';
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

  const activeClaim = await d1.db
    .prepare(`SELECT * FROM chatterbox_claims WHERE task_id = ? AND status = 'ACTIVE'`)
    .bind(task.id)
    .first();
  if (!activeClaim) return json({ ok: false, error: 'no active claim on this task' }, 409);

  const isOwner = Number(activeClaim.participant_id) === Number(participant.id);
  const isForceRelease = !isOwner && canForceRelease(String(participant.role_class));

  if (!isOwner && !isForceRelease) {
    return json({ ok: false, error: 'only the current claimant, or a pmo/product_authority force-release, may release this claim' }, 403);
  }
  if (isForceRelease && !reason) {
    return json({ ok: false, error: 'reason is required for a force-release' }, 400);
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

  const eventBody = isForceRelease
    ? `RELEASE ${taskKey} [FORCE-RELEASE by ${participant.display_name}] reason: ${reason}`
    : `RELEASE ${taskKey}`;

  await d1.db
    .prepare(
      `INSERT INTO chatterbox_events (room_id, participant_id, event_type, task_ref, target_participant_id, body)
       VALUES (?, ?, 'RELEASE', ?, ?, ?)`,
    )
    .bind(room.id, participant.id, taskKey, isForceRelease ? activeClaim.participant_id : null, eventBody)
    .run();

  return json({ ok: true, forced: isForceRelease });
};
