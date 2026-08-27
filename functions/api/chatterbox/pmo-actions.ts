// /api/chatterbox/pmo-actions — #3794 Chatterbox self-hosted room-actor
// design, Layer 3: a first-class PMO action queue with acknowledge/expire
// semantics, generalizing Jules's #3579 JULES-2 finding from "decisions" to
// "required PMO follow-through" (close an Issue, update a tracker).
//
// Rows are created from POST /api/chatterbox/events (a COMPLETE event
// targeting a pmo-role participant), not from this file — this is
// deliberately the only place they are *read* by, so this endpoint is
// list/ack/complete only.
//
// GET: list actions for a room, optionally filtered by status, sorted by
// expires_at ascending (soonest first) so a scheduled-pull caller sees the
// most urgent item first regardless of how the response is paginated.
//
// POST: `{ op: 'ack' | 'complete', id, participant_key?, reconciliation_note? }`.
// Critically: reading a row via GET never changes its status — only this
// explicit callback does, and only a pmo/product_authority-role participant
// may call it. This is the actual fix for the historical failure this
// Issue targets: "PMO saw the completion" and "PMO acted on it" are now
// two different, separately-recorded events.

import { requireD1 } from '../../_lib/d1';
import { PMO_ACTION_STATUSES, type PmoActionStatus } from '../../_lib/chatterbox';
import { requireChatterboxCaller, resolveActingParticipant } from '../../_lib/chatterbox-auth';

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { 'Content-Type': 'application/json' } });
}

function isValidStatus(value: unknown): value is PmoActionStatus {
  return typeof value === 'string' && (PMO_ACTION_STATUSES as readonly string[]).includes(value);
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;
  const d1 = requireD1(env);
  if (!d1.ok) return json(d1.body, d1.status);

  const auth = await requireChatterboxCaller(request, env, d1.db);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const roomKey = String(url.searchParams.get('room') || '').trim();
  const statusFilter = String(url.searchParams.get('status') || '').trim();
  if (!roomKey) return json({ ok: false, error: 'room query param is required' }, 400);
  if (statusFilter && !isValidStatus(statusFilter)) {
    return json({ ok: false, error: `invalid status: ${statusFilter}` }, 400);
  }

  const room = await d1.db.prepare('SELECT id FROM chatterbox_rooms WHERE room_key = ?').bind(roomKey).first();
  if (!room) return json({ ok: false, error: 'room not found' }, 404);

  const rows = statusFilter
    ? await d1.db
        .prepare('SELECT * FROM chatterbox_pmo_actions WHERE room_id = ? AND status = ? ORDER BY expires_at ASC')
        .bind(room.id, statusFilter)
        .all()
    : await d1.db
        .prepare('SELECT * FROM chatterbox_pmo_actions WHERE room_id = ? ORDER BY expires_at ASC')
        .bind(room.id)
        .all();

  return json({ ok: true, pmo_actions: rows.results ?? [] });
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

  const op = String(body?.op || '').trim();
  const id = Number(body?.id);
  const participantKeyBody = body?.participant_key != null ? String(body.participant_key).trim() : null;
  const reconciliationNote = body?.reconciliation_note != null ? String(body.reconciliation_note) : null;

  if (op !== 'ack' && op !== 'complete') {
    return json({ ok: false, error: "op must be 'ack' or 'complete'" }, 400);
  }
  if (!Number.isInteger(id) || id <= 0) {
    return json({ ok: false, error: 'id must be a positive integer' }, 400);
  }

  const acting = await resolveActingParticipant(d1.db, auth.caller, participantKeyBody);
  if (!acting.ok) return acting.response;
  const participant = acting.participant;

  if (participant.role_class !== 'pmo' && participant.role_class !== 'product_authority') {
    return json({ ok: false, error: 'only pmo or product_authority participants may ack/complete a pmo action' }, 403);
  }

  const action = await d1.db.prepare('SELECT * FROM chatterbox_pmo_actions WHERE id = ?').bind(id).first();
  if (!action) return json({ ok: false, error: 'pmo action not found' }, 404);

  if (op === 'ack') {
    if (action.status !== 'PENDING') {
      return json({ ok: false, error: `cannot ack an action in status ${action.status}` }, 409);
    }
    await d1.db
      .prepare(`UPDATE chatterbox_pmo_actions SET status = 'ACKED', acked_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?`)
      .bind(id)
      .run();
  } else {
    if (action.status !== 'PENDING' && action.status !== 'ACKED') {
      return json({ ok: false, error: `cannot complete an action in status ${action.status}` }, 409);
    }
    await d1.db
      .prepare(
        `UPDATE chatterbox_pmo_actions
         SET status = 'DONE', completed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), completed_by_participant_id = ?, reconciliation_note = ?
         WHERE id = ?`,
      )
      .bind(participant.id, reconciliationNote, id)
      .run();
  }

  const row = await d1.db.prepare('SELECT * FROM chatterbox_pmo_actions WHERE id = ?').bind(id).first();
  return json({ ok: true, pmo_action: row });
};
