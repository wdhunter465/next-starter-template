// /api/chatterbox/events — #3794 Chatterbox self-hosted room-actor design.
// GET: raw events since a given event id (paginated, capped).
// POST: append an event (STATUS/QUESTION/ANSWER/COMPLETE/etc). Supports a
// client-supplied idempotency_key so a retried call from an agent with
// unreliable delivery cannot double-post (review point 10).
//
// A participant with role_class 'system_clerk' may only post the event
// types SYSTEM_CLERK_ALLOWED_EVENT_TYPES allow — it may execute an
// already-authorized transition, never decide a substantive PMO/Product one
// (review point 6).
//
// #3794 Layer 3: a COMPLETE event that targets a pmo-role participant
// creates a chatterbox_pmo_actions row (see pmo-actions.ts) — the queue is
// generated from completion events, not a separate creation API, matching
// the design doc's stated flow.
//
// The acting participant is resolved from the authenticated credential
// (#3794 JULES-1), not merely trusted from the request body.

import { requireD1 } from '../../_lib/d1';
import {
  isValidEventType,
  isSystemClerkEventAllowed,
  isValidPmoActionType,
  computeDefaultExpiry,
  type EventType,
} from '../../_lib/chatterbox';
import { requireChatterboxCaller, resolveActingParticipant } from '../../_lib/chatterbox-auth';

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
  const since = Math.max(0, Number(url.searchParams.get('since') || '0') || 0);
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get('limit') || '100') || 100));
  if (!roomKey) return json({ ok: false, error: 'room query param is required' }, 400);

  const room = await d1.db.prepare('SELECT id FROM chatterbox_rooms WHERE room_key = ?').bind(roomKey).first();
  if (!room) return json({ ok: false, error: 'room not found' }, 404);

  const rows = await d1.db
    .prepare('SELECT * FROM chatterbox_events WHERE room_id = ? AND id > ? ORDER BY id ASC LIMIT ?')
    .bind(room.id, since, limit)
    .all();

  return json({ ok: true, events: rows.results ?? [] });
};

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
  const eventType = String(body?.event_type || '').trim();
  const text = String(body?.body || '').trim();
  const taskRef = body?.task_ref != null ? String(body.task_ref) : null;
  const targetParticipantKey = body?.target_participant_key != null ? String(body.target_participant_key) : null;
  const githubRef = body?.github_ref != null ? JSON.stringify(body.github_ref) : null;
  const idempotencyKey = body?.idempotency_key != null ? String(body.idempotency_key) : null;
  const pmoActionTypeRaw = body?.pmo_action_type != null ? String(body.pmo_action_type) : null;

  if (!roomKey || !text) {
    return json({ ok: false, error: 'room_key and body are required' }, 400);
  }
  if (!isValidEventType(eventType)) {
    return json({ ok: false, error: `invalid event_type: ${eventType}` }, 400);
  }

  let inReplyToEventId: number | null = null;
  if (body?.in_reply_to_event_id != null) {
    const parsed = Number(body.in_reply_to_event_id);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return json({ ok: false, error: 'in_reply_to_event_id must be a positive integer' }, 400);
    }
    inReplyToEventId = parsed;
  }

  const room = await d1.db.prepare('SELECT id FROM chatterbox_rooms WHERE room_key = ?').bind(roomKey).first();
  if (!room) return json({ ok: false, error: 'room not found' }, 404);

  const acting = await resolveActingParticipant(d1.db, auth.caller, participantKeyBody);
  if (!acting.ok) return acting.response;
  const participant = acting.participant;

  if (participant.role_class === 'system_clerk' && !isSystemClerkEventAllowed(eventType as EventType)) {
    return json(
      { ok: false, error: `system_clerk may not post event_type ${eventType} (execute-only, not decide)` },
      403,
    );
  }

  let targetParticipant: any = null;
  if (targetParticipantKey) {
    targetParticipant = await d1.db
      .prepare('SELECT id, role_class FROM chatterbox_participants WHERE participant_key = ?')
      .bind(targetParticipantKey)
      .first();
    if (!targetParticipant) return json({ ok: false, error: `target_participant_key not found: ${targetParticipantKey}` }, 404);
  }
  const targetParticipantId: number | null = targetParticipant ? Number(targetParticipant.id) : null;

  if (idempotencyKey) {
    const existing = await d1.db
      .prepare('SELECT * FROM chatterbox_events WHERE participant_id = ? AND idempotency_key = ?')
      .bind(participant.id, idempotencyKey)
      .first();
    if (existing) {
      return json({ ok: true, event: existing, idempotent_replay: true });
    }
  }

  let insertedEventId: number | null = null;
  try {
    const result = await d1.db
      .prepare(
        `INSERT INTO chatterbox_events
           (room_id, participant_id, event_type, task_ref, target_participant_id, in_reply_to_event_id, body, github_ref, idempotency_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(room.id, participant.id, eventType, taskRef, targetParticipantId, inReplyToEventId, text, githubRef, idempotencyKey)
      .run();
    insertedEventId = Number(result?.meta?.last_row_id ?? result?.lastInsertRowid ?? 0) || null;
  } catch (error: any) {
    const message = String(error?.message ?? error);
    if (idempotencyKey && /unique|constraint/i.test(message)) {
      const existing = await d1.db
        .prepare('SELECT * FROM chatterbox_events WHERE participant_id = ? AND idempotency_key = ?')
        .bind(participant.id, idempotencyKey)
        .first();
      if (existing) return json({ ok: true, event: existing, idempotent_replay: true });
    }
    throw error;
  }

  const row = insertedEventId
    ? await d1.db.prepare('SELECT * FROM chatterbox_events WHERE id = ?').bind(insertedEventId).first()
    : idempotencyKey
      ? await d1.db
          .prepare('SELECT * FROM chatterbox_events WHERE participant_id = ? AND idempotency_key = ?')
          .bind(participant.id, idempotencyKey)
          .first()
      : await d1.db.prepare('SELECT * FROM chatterbox_events WHERE room_id = ? ORDER BY id DESC LIMIT 1').bind(room.id).first();

  // #3794 Layer 3: a COMPLETE event targeting a pmo-role participant with a
  // task_ref creates the follow-through record — cleared only by an
  // explicit completion callback (pmo-actions.ts), never by being read.
  let pmoAction: any = null;
  if (eventType === 'COMPLETE' && targetParticipant?.role_class === 'pmo' && taskRef && insertedEventId) {
    const actionType = isValidPmoActionType(pmoActionTypeRaw) ? pmoActionTypeRaw : 'OTHER';
    await d1.db
      .prepare(
        `INSERT INTO chatterbox_pmo_actions (room_id, source_event_id, task_ref, action_type, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .bind(room.id, insertedEventId, taskRef, actionType, computeDefaultExpiry())
      .run();
    pmoAction = await d1.db
      .prepare('SELECT * FROM chatterbox_pmo_actions WHERE source_event_id = ?')
      .bind(insertedEventId)
      .first();
  }

  return json({ ok: true, event: row, pmo_action: pmoAction }, 201);
};
