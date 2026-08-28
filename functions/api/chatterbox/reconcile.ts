// /api/chatterbox/reconcile — #3794 Chatterbox self-hosted room-actor
// design, Layer 4: the self-hosted substitute for a Durable Object's Alarm
// API. Called on a fixed schedule by a GitHub Actions workflow
// (ops-chatterbox-reconciliation-sweep.yml), not by any individual
// participant — this is ops/CI-driven, so it requires the bridge/ops relay
// credential, same as room/participant management.
//
// This endpoint only performs the Chatterbox-internal half of Layer 4:
// expiring PENDING chatterbox_pmo_actions rows past their own expires_at
// and posting a visible SYSTEM escalation event. The GitHub cross-check
// half (verifying a claimed-DONE action's Issue is actually closed) is a
// separate Node CI script (scripts/ci/chatterbox_reconcile_github.mjs) that
// calls GitHub's API directly with the standard Actions GITHUB_TOKEN,
// rather than binding a GitHub credential into this Cloudflare Pages
// environment — consistent with how chatterbox_github_ingest.mjs already
// keeps GitHub-facing calls in CI scripts, not in Pages Functions.

import { requireD1 } from '../../_lib/d1';
import { isPmoActionOverdue } from '../../_lib/chatterbox';
import { requireChatterboxCaller, requireRelay } from '../../_lib/chatterbox-auth';

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { 'Content-Type': 'application/json' } });
}

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
    body = {};
  }
  const roomKey = String(body?.room_key || '').trim();
  const clerkParticipantKey = String(body?.participant_key || '').trim();
  if (!roomKey || !clerkParticipantKey) {
    return json({ ok: false, error: 'room_key and participant_key (a system_clerk participant) are required' }, 400);
  }

  const room = await d1.db.prepare('SELECT id FROM chatterbox_rooms WHERE room_key = ?').bind(roomKey).first();
  if (!room) return json({ ok: false, error: 'room not found' }, 404);

  // The sweep posts its escalation as a registered participant, same as any
  // other event — it does not get to write NULL-authored events. system_clerk
  // is the role that already exists exactly for this kind of automated,
  // execute-only administrative posting (isSystemClerkEventAllowed permits
  // SYSTEM for it).
  const clerk = await d1.db
    .prepare('SELECT id, role_class FROM chatterbox_participants WHERE participant_key = ? AND revoked_at IS NULL')
    .bind(clerkParticipantKey)
    .first();
  if (!clerk) return json({ ok: false, error: 'participant not found or revoked' }, 404);
  if (clerk.role_class !== 'system_clerk') {
    return json({ ok: false, error: 'the reconciliation sweep must post as a system_clerk participant' }, 403);
  }

  const pending = await d1.db
    .prepare(`SELECT * FROM chatterbox_pmo_actions WHERE room_id = ? AND status = 'PENDING'`)
    .bind(room.id)
    .all();

  const now = new Date();
  const escalated: any[] = [];

  for (const action of pending.results ?? []) {
    if (!isPmoActionOverdue(action, now)) continue;

    await d1.db
      .prepare(`UPDATE chatterbox_pmo_actions SET status = 'EXPIRED' WHERE id = ?`)
      .bind(action.id)
      .run();

    // Broadcast (no target_participant_id) — visible to every participant
    // on their next check-in/poll, not routed to one recipient.
    await d1.db
      .prepare(
        `INSERT INTO chatterbox_events (room_id, participant_id, event_type, task_ref, body)
         VALUES (?, ?, 'SYSTEM', ?, ?)`,
      )
      .bind(
        room.id,
        clerk.id,
        action.task_ref,
        `ESCALATION: PMO action #${action.id} (${action.action_type} on ${action.task_ref}) expired without acknowledgement.`,
      )
      .run();

    escalated.push({ id: action.id, task_ref: action.task_ref, action_type: action.action_type });
  }

  return json({ ok: true, room_key: roomKey, expired_count: escalated.length, escalated });
};
