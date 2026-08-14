// /api/chatterbox/events — #3415 Chatterbox prototype.
// GET: raw events since a given event id (paginated, capped).
// POST: append an event (STATUS/QUESTION/ANSWER/COMPLETE/etc). Supports a
// client-supplied idempotency_key so a retried call from an agent with
// unreliable delivery cannot double-post (review point 10).
// A participant with role_class 'system_clerk' may only post the event
// types SYSTEM_CLERK_ALLOWED_EVENT_TYPES allow — it may execute an
// already-authorized transition, never decide a substantive PMO/Product one
// (review point 6).
// Protected by ADMIN_TOKEN.

import { requireAdmin } from '../../_lib/auth';
import { requireD1 } from '../../_lib/d1';
import { isValidEventType, isSystemClerkEventAllowed, type EventType } from '../../_lib/chatterbox';

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
  const eventType = String(body?.event_type || '').trim();
  const text = String(body?.body || '').trim();
  const taskRef = body?.task_ref != null ? String(body.task_ref) : null;
  const targetParticipantKey = body?.target_participant_key != null ? String(body.target_participant_key) : null;
  const githubRef = body?.github_ref != null ? JSON.stringify(body.github_ref) : null;
  const idempotencyKey = body?.idempotency_key != null ? String(body.idempotency_key) : null;

  if (!roomKey || !participantKey || !text) {
    return json({ ok: false, error: 'room_key, participant_key, and body are required' }, 400);
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

  const participant = await d1.db
    .prepare('SELECT * FROM chatterbox_participants WHERE participant_key = ? AND revoked_at IS NULL')
    .bind(participantKey)
    .first();
  if (!participant) return json({ ok: false, error: 'participant not found or revoked' }, 404);

  if (participant.role_class === 'system_clerk' && !isSystemClerkEventAllowed(eventType as EventType)) {
    return json(
      { ok: false, error: `system_clerk may not post event_type ${eventType} (execute-only, not decide)` },
      403,
    );
  }

  let targetParticipantId: number | null = null;
  if (targetParticipantKey) {
    const target = await d1.db
      .prepare('SELECT id FROM chatterbox_participants WHERE participant_key = ?')
      .bind(targetParticipantKey)
      .first();
    if (!target) return json({ ok: false, error: `target_participant_key not found: ${targetParticipantKey}` }, 404);
    targetParticipantId = Number(target.id);
  }

  if (idempotencyKey) {
    const existing = await d1.db
      .prepare('SELECT * FROM chatterbox_events WHERE participant_id = ? AND idempotency_key = ?')
      .bind(participant.id, idempotencyKey)
      .first();
    if (existing) {
      return json({ ok: true, event: existing, idempotent_replay: true });
    }
  }

  try {
    await d1.db
      .prepare(
        `INSERT INTO chatterbox_events
           (room_id, participant_id, event_type, task_ref, target_participant_id, in_reply_to_event_id, body, github_ref, idempotency_key)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(room.id, participant.id, eventType, taskRef, targetParticipantId, inReplyToEventId, text, githubRef, idempotencyKey)
      .run();
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

  const row = idempotencyKey
    ? await d1.db
        .prepare('SELECT * FROM chatterbox_events WHERE participant_id = ? AND idempotency_key = ?')
        .bind(participant.id, idempotencyKey)
        .first()
    : await d1.db.prepare('SELECT * FROM chatterbox_events WHERE room_id = ? ORDER BY id DESC LIMIT 1').bind(room.id).first();

  return json({ ok: true, event: row }, 201);
};
