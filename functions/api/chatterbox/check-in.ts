// /api/chatterbox/check-in — #3794 Chatterbox self-hosted room-actor design.
// POST: record a participant's check-in (upserts the checkpoint) and return
// a bounded "since you were gone" catch-up digest — open questions, recent
// PMO instructions, and a capped raw tail, not a full replay (review point
// 2). This is the baseline pull path; it works with zero push/notification
// adapters configured, and is also the poll endpoint a scheduled-pull
// participant (e.g. a ~12-minute Watcher cadence) calls directly.
//
// #3794 Layer 1 / Jules #3579 JULES-3 fix: the checkpoint advances to the
// high-watermark captured from the events read *before* this call's own
// CHECK_IN event is inserted — never to that CHECK_IN event's own id. See
// computeCheckInHighWatermark in functions/_lib/chatterbox.ts for why this
// closes the race (a concurrent write between the read and this call's own
// insert always receives an id greater than the captured watermark, so it
// is correctly left unread for the *next* check-in rather than skipped).

import { requireD1 } from '../../_lib/d1';
import { buildCatchUpDigest, computeCheckInHighWatermark, type ChatterboxEventRow } from '../../_lib/chatterbox';
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
  const participantKeyBody = body?.participant_key != null ? String(body.participant_key).trim() : null;
  if (!roomKey) {
    return json({ ok: false, error: 'room_key is required' }, 400);
  }

  const room = await d1.db.prepare('SELECT id FROM chatterbox_rooms WHERE room_key = ?').bind(roomKey).first();
  if (!room) return json({ ok: false, error: 'room not found' }, 404);

  const acting = await resolveActingParticipant(d1.db, auth.caller, participantKeyBody);
  if (!acting.ok) return acting.response;
  const participant = acting.participant;

  const checkpoint = await d1.db
    .prepare('SELECT * FROM chatterbox_checkpoints WHERE room_id = ? AND participant_id = ?')
    .bind(room.id, participant.id)
    .first();
  const lastSeenEventId = checkpoint ? Number(checkpoint.last_seen_event_id) : 0;

  // Read prior to this call's own CHECK_IN insert — this is the snapshot
  // the high-watermark and digest are both derived from.
  const priorEvents = await d1.db
    .prepare('SELECT * FROM chatterbox_events WHERE room_id = ? ORDER BY id ASC')
    .bind(room.id)
    .all();
  const events = (priorEvents.results ?? []) as ChatterboxEventRow[];

  const highWatermark = computeCheckInHighWatermark(events, lastSeenEventId);

  const digest = buildCatchUpDigest({
    events,
    participantId: Number(participant.id),
    lastSeenEventId,
  });

  await d1.db
    .prepare(
      `INSERT INTO chatterbox_events (room_id, participant_id, event_type, body)
       VALUES (?, ?, 'CHECK_IN', ?)`,
    )
    .bind(room.id, participant.id, `CHECK-IN — ${participant.display_name}`)
    .run();

  // The checkpoint advances to the captured high-watermark, not to this
  // call's own newly-inserted CHECK_IN event id — see module comment.
  if (checkpoint) {
    await d1.db
      .prepare(
        `UPDATE chatterbox_checkpoints
         SET last_seen_event_id = ?, checked_in_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), checked_out_at = NULL
         WHERE id = ?`,
      )
      .bind(highWatermark, checkpoint.id)
      .run();
  } else {
    await d1.db
      .prepare(
        `INSERT INTO chatterbox_checkpoints (room_id, participant_id, last_seen_event_id)
         VALUES (?, ?, ?)`,
      )
      .bind(room.id, participant.id, highWatermark)
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
    last_seen_event_id: highWatermark,
    catch_up: digest,
    my_active_claims: myClaims.results ?? [],
  });
};
