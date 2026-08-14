// /api/chatterbox/check-in — #3415 Chatterbox prototype.
// POST: record a participant's check-in (upserts the checkpoint) and return
// a bounded "since you were gone" catch-up digest — open questions, recent
// PMO instructions, and a capped raw tail, not a full replay (review point
// 2). This is the baseline pull path; it works with zero push/notification
// adapters configured.
// Protected by ADMIN_TOKEN.

import { requireAdmin } from '../../_lib/auth';
import { requireD1 } from '../../_lib/d1';
import { buildCatchUpDigest, type ChatterboxEventRow } from '../../_lib/chatterbox';

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
  const participantKey = String(body?.participant_key || '').trim();
  if (!roomKey || !participantKey) {
    return json({ ok: false, error: 'room_key and participant_key are required' }, 400);
  }

  const room = await d1.db.prepare('SELECT id FROM chatterbox_rooms WHERE room_key = ?').bind(roomKey).first();
  if (!room) return json({ ok: false, error: 'room not found' }, 404);

  const participant = await d1.db
    .prepare('SELECT * FROM chatterbox_participants WHERE participant_key = ? AND revoked_at IS NULL')
    .bind(participantKey)
    .first();
  if (!participant) return json({ ok: false, error: 'participant not found or revoked' }, 404);

  const checkpoint = await d1.db
    .prepare('SELECT * FROM chatterbox_checkpoints WHERE room_id = ? AND participant_id = ?')
    .bind(room.id, participant.id)
    .first();
  const lastSeenEventId = checkpoint ? Number(checkpoint.last_seen_event_id) : 0;

  // The digest reflects conversation prior to this call, so it's built from
  // events read before this check-in's own CHECK_IN event is inserted.
  const priorEvents = await d1.db
    .prepare('SELECT * FROM chatterbox_events WHERE room_id = ? ORDER BY id ASC')
    .bind(room.id)
    .all();
  const events = (priorEvents.results ?? []) as ChatterboxEventRow[];

  const digest = buildCatchUpDigest({
    events,
    participantId: Number(participant.id),
    lastSeenEventId,
  });

  // The checkpoint cursor, however, must advance past this call's own
  // CHECK_IN event — otherwise the participant would see their own prior
  // check-in as unread on the next one.
  const checkInResult = await d1.db
    .prepare(
      `INSERT INTO chatterbox_events (room_id, participant_id, event_type, body)
       VALUES (?, ?, 'CHECK_IN', ?)`,
    )
    .bind(room.id, participant.id, `CHECK-IN — ${participant.display_name}`)
    .run();
  const checkInEventId = Number(checkInResult?.meta?.last_row_id ?? checkInResult?.lastInsertRowid ?? 0);
  const newLastSeenEventId = checkInEventId || (events.length > 0 ? events[events.length - 1].id : lastSeenEventId);

  if (checkpoint) {
    await d1.db
      .prepare(
        `UPDATE chatterbox_checkpoints
         SET last_seen_event_id = ?, checked_in_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), checked_out_at = NULL
         WHERE id = ?`,
      )
      .bind(newLastSeenEventId, checkpoint.id)
      .run();
  } else {
    await d1.db
      .prepare(
        `INSERT INTO chatterbox_checkpoints (room_id, participant_id, last_seen_event_id)
         VALUES (?, ?, ?)`,
      )
      .bind(room.id, participant.id, newLastSeenEventId)
      .run();
  }

  const myClaims = await d1.db
    .prepare(
      `SELECT t.task_key, t.title, t.state
       FROM chatterbox_claims c
       JOIN chatterbox_tasks t ON t.id = c.task_id
       WHERE c.participant_id = ? AND c.status = 'ACTIVE' AND t.room_id = ?`,
    )
    .bind(participant.id, room.id)
    .all();

  return json({
    ok: true,
    last_seen_event_id: newLastSeenEventId,
    catch_up: digest,
    my_active_claims: myClaims.results ?? [],
  });
};
