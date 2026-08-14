// Local integration test for chatterbox_dev_integration_check.mjs's own
// orchestration logic (step sequencing, assertions, error propagation) —
// NOT a substitute for the real Development-D1-backed run this script is
// designed for. The fake server below reuses the same pure business-logic
// functions already unit-tested in chatterbox-core.test.ts
// (canClaim/buildCatchUpDigest/isSystemClerkEventAllowed), backed by a
// plain in-memory store instead of D1, so a script-level bug is caught
// before spending a live dispatch cycle — while the D1-level guarantees
// (the partial unique index, real SQLite semantics) remain proven only by
// the real dispatch, not by this fake.
import { describe, expect, it } from 'vitest';

import { runChatterboxDevIntegrationCheck } from '../scripts/ci/chatterbox_dev_integration_check.mjs';
import {
  canClaim,
  isSystemClerkEventAllowed,
  buildCatchUpDigest,
} from '../functions/_lib/chatterbox';

function createFakeChatterboxServer() {
  const state = {
    rooms: new Map(), // room_key -> { id }
    participants: new Map(), // participant_key -> { id, role_class }
    tasks: new Map(), // `${room_key}:${task_key}` -> { id, state, depends_on }
    claims: new Map(), // task composite key -> { participant_key } | undefined
    events: [], // { id, room_key, participant_key, event_type, target_participant_key, in_reply_to_event_id, ... }
    checkpoints: new Map(), // `${room_key}:${participant_key}` -> last_seen_event_id
  };
  let nextEventId = 1;

  function taskKeyFor(roomKey, taskKey) {
    return `${roomKey}:${taskKey}`;
  }

  function taskStatesByKey(roomKey) {
    const out = {};
    for (const [key, task] of state.tasks) {
      if (key.startsWith(`${roomKey}:`)) out[task.task_key] = task.state;
    }
    return out;
  }

  async function fetchFn(url, options) {
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    const body = options.body ? JSON.parse(options.body) : {};
    const json = (data, status = 200) => ({ ok: status < 400, status, json: async () => data });

    if (path === '/api/chatterbox/room' && options.method === 'POST') {
      state.rooms.set(body.room_key, { id: state.rooms.size + 1 });
      return json({ ok: true, room_id: state.rooms.get(body.room_key).id }, 201);
    }

    if (path === '/api/chatterbox/participants' && options.method === 'POST') {
      state.participants.set(body.participant_key, {
        id: state.participants.size + 1,
        role_class: body.role_class,
      });
      return json({ ok: true, participant: { id: state.participants.get(body.participant_key).id } }, 201);
    }

    if (path === '/api/chatterbox/tasks' && options.method === 'POST') {
      const key = taskKeyFor(body.room_key, body.task_key);
      const existing = state.tasks.get(key);
      state.tasks.set(key, {
        id: existing?.id ?? state.tasks.size + 1,
        task_key: body.task_key,
        state: body.state || 'PLANNED',
        depends_on: body.depends_on || [],
      });
      return json({ ok: true, task: state.tasks.get(key) }, existing ? 200 : 201);
    }

    if (path === '/api/chatterbox/claim' && options.method === 'POST') {
      const key = taskKeyFor(body.room_key, body.task_key);
      const task = state.tasks.get(key);
      if (!task) return json({ ok: false, error: 'task not found' }, 404);

      const precheck = canClaim(
        { task_key: task.task_key, state: task.state, depends_on: JSON.stringify(task.depends_on) },
        taskStatesByKey(body.room_key),
      );
      if (!precheck.ok) return json({ ok: false, error: precheck.reason }, 409);

      if (state.claims.get(key)) {
        return json({ ok: false, error: 'already_claimed' }, 409);
      }
      state.claims.set(key, { participant_key: body.participant_key });
      task.state = 'CLAIMED';
      return json({ ok: true, claim_id: 1 }, 201);
    }

    if (path === '/api/chatterbox/release' && options.method === 'POST') {
      const key = taskKeyFor(body.room_key, body.task_key);
      const claim = state.claims.get(key);
      if (!claim) return json({ ok: false, error: 'no active claim on this task' }, 409);
      if (claim.participant_key !== body.participant_key) {
        return json({ ok: false, error: 'only the current claimant may release' }, 403);
      }
      state.claims.delete(key);
      state.tasks.get(key).state = 'AVAILABLE';
      return json({ ok: true });
    }

    if (path === '/api/chatterbox/events' && options.method === 'POST') {
      const participant = state.participants.get(body.participant_key);
      if (!participant) return json({ ok: false, error: 'participant not found' }, 404);

      if (participant.role_class === 'system_clerk' && !isSystemClerkEventAllowed(body.event_type)) {
        return json({ ok: false, error: `system_clerk may not post event_type ${body.event_type}` }, 403);
      }

      if (body.idempotency_key) {
        const existing = state.events.find(
          (event) => event.participant_key === body.participant_key && event.idempotency_key === body.idempotency_key,
        );
        if (existing) return json({ ok: true, event: existing, idempotent_replay: true });
      }

      const targetParticipant = body.target_participant_key ? state.participants.get(body.target_participant_key) : null;
      const event = {
        id: nextEventId++,
        room_key: body.room_key,
        participant_id: participant.id,
        participant_key: body.participant_key,
        event_type: body.event_type,
        target_participant_id: targetParticipant ? state.participants.get(body.target_participant_key).id : null,
        in_reply_to_event_id: body.in_reply_to_event_id || null,
        body: body.body,
        idempotency_key: body.idempotency_key || null,
      };
      state.events.push(event);
      return json({ ok: true, event }, 201);
    }

    if (path === '/api/chatterbox/check-in' && options.method === 'POST') {
      const participant = state.participants.get(body.participant_key);
      const checkpointKey = `${body.room_key}:${body.participant_key}`;
      const lastSeenEventId = state.checkpoints.get(checkpointKey) || 0;
      const roomEvents = state.events.filter((event) => event.room_key === body.room_key);

      const digest = buildCatchUpDigest({
        events: roomEvents.map((event) => ({ ...event, target_participant_id: event.target_participant_id })),
        participantId: participant.id,
        lastSeenEventId,
      });

      const checkInEvent = {
        id: nextEventId++,
        room_key: body.room_key,
        participant_id: participant.id,
        event_type: 'CHECK_IN',
        target_participant_id: null,
        in_reply_to_event_id: null,
        body: 'CHECK-IN',
      };
      state.events.push(checkInEvent);
      state.checkpoints.set(checkpointKey, checkInEvent.id);

      return json({ ok: true, last_seen_event_id: checkInEvent.id, catch_up: digest, my_active_claims: [] });
    }

    return json({ ok: false, error: `unhandled path in fake server: ${path}` }, 404);
  }

  return fetchFn;
}

describe('chatterbox_dev_integration_check orchestration (fake HTTP layer)', () => {
  it('runs every check successfully against a well-behaved fake server', async () => {
    const fetchFn = createFakeChatterboxServer();
    const result = await runChatterboxDevIntegrationCheck({
      baseUrl: 'https://fake.example',
      adminToken: 'test-token',
      fetchFn,
      runId: 'unit-test',
    });

    expect(result.ok).toBe(true);
    expect(result.checksPassed).toEqual([
      'create_room',
      'register_participants',
      'create_task_graph',
      'dependency_gate_blocks_claim',
      'concurrent_claim_exactly_one_winner',
      'release_rejected_for_non_claimant',
      'release_succeeds_for_actual_claimant',
      'idempotent_event_posting',
      'question_visible_to_targeted_participant',
      'question_resolves_after_answer',
      'missed_wake_recovery_accurate_unread_count',
      'system_clerk_cannot_post_substantive_transition',
    ]);
  });

  it('surfaces a clear failure if the concurrency guarantee is broken', async () => {
    const fetchFn = createFakeChatterboxServer();
    // Wrap fetchFn so both concurrent claim calls race past the "already claimed"
    // check before either writes — simulating a server WITHOUT the DB-level
    // unique-index guarantee, to prove this script would actually catch that.
    let taskAClaimCallCount = 0;
    const brokenFetchFn = async (url, options) => {
      const body = options.body ? JSON.parse(options.body) : {};
      if (url.endsWith('/api/chatterbox/claim') && body.task_key === 'task-a') {
        taskAClaimCallCount += 1;
        if (taskAClaimCallCount <= 2) {
          // Both calls "succeed" — the bug this check exists to catch.
          // (task-b's claim call, used by the earlier dependency-gate step,
          // is untouched — this only breaks task-a's concurrency guarantee.)
          return { ok: true, status: 201, json: async () => ({ ok: true, claim_id: taskAClaimCallCount }) };
        }
      }
      return fetchFn(url, options);
    };

    await expect(
      runChatterboxDevIntegrationCheck({
        baseUrl: 'https://fake.example',
        adminToken: 'test-token',
        fetchFn: brokenFetchFn,
        runId: 'unit-test-broken',
      }),
    ).rejects.toThrow(/concurrent_claim_exactly_one_winner/);
  });
});
