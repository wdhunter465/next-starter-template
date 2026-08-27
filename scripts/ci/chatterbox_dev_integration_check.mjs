#!/usr/bin/env node
// #3794 (Chatterbox self-hosted room-actor design) — real, end-to-end proof
// against a live deployed Chatterbox API (Development D1 only), not a mock.
// Ported forward from the #3415 prototype's work unit 6
// (component/chatterbox-prototype), switched to the new Bearer/relay auth
// model (#3794 JULES-1), and extended with coverage for the PMO action
// queue (Layer 3), force-release (JULES-5), and the reconciliation sweep
// (Layer 4).
//
// This is the check that answers "does it actually work": PMO plus
// multiple independently operating participants in one room; leave/rejoin
// catch-up; simultaneous claims cannot create duplicate ownership;
// dependencies gate claims; questions persist and resolve; the
// system_clerk boundary holds for real; a per-participant credential
// cannot assert a different participant's identity; a COMPLETE targeting
// pmo creates a queued action that only an explicit callback clears; a
// pmo/product_authority participant can force-release with a reason. Every
// room/participant/task this script creates is namespaced under a per-run
// key so repeat runs never collide, and nothing here ever touches
// Production — the base URL is always this branch's own Development
// deployment.
//
// Uses the bridge/ops relay credential (CHATTERBOX_BRIDGE_TOKEN) for every
// call — this script asserts a different participant_key per call the same
// way the GitHub-comment bridge does, which is exactly the relay trust
// model's intended use, not a workaround.

import { pathToFileURL } from 'node:url';

function makeClient({ baseUrl, bridgeToken, fetchFn = fetch }) {
  async function call(method, path, body) {
    const response = await fetchFn(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${bridgeToken}`,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const json = await response.json().catch(() => ({}));
    return { status: response.status, json };
  }
  return {
    get: (path) => call('GET', path),
    post: (path, body) => call('POST', path, body),
  };
}

class CheckFailure extends Error {}

function assertCheck(label, condition, detail) {
  if (!condition) {
    throw new CheckFailure(`${label}: ${detail}`);
  }
}

export async function runChatterboxDevIntegrationCheck({ baseUrl, bridgeToken, fetchFn = fetch, runId = Date.now() }) {
  const client = makeClient({ baseUrl, bridgeToken, fetchFn });
  const passed = [];
  const roomKey = `dev-integration-check-${runId}`;
  const sourceIssueRef = 'wdhunter465/next-starter-template#3794';

  async function step(label, fn) {
    await fn();
    passed.push(label);
  }

  // 1. Room + independently operating participants across distinct role classes.
  await step('create_room', async () => {
    const { status } = await client.post('/api/chatterbox/room', {
      room_key: roomKey,
      source_issue_ref: sourceIssueRef,
      title: 'Chatterbox Dev integration check',
    });
    assertCheck('create_room', status === 201, `expected 201, got ${status}`);
  });

  const pmoKey = `${roomKey}-pmo`;
  const agentAKey = `${roomKey}-agent-a`;
  const agentBKey = `${roomKey}-agent-b`;
  const clerkKey = `${roomKey}-clerk`;
  const credentialedKey = `${roomKey}-credentialed`;
  const credentialedSecret = `dev-integration-check-credential-${runId}`;

  await step('register_participants', async () => {
    const registrations = [
      { participant_key: pmoKey, display_name: 'PMO', role_class: 'pmo' },
      { participant_key: agentAKey, display_name: 'Agent A', role_class: 'implementation_agent' },
      { participant_key: agentBKey, display_name: 'Agent B', role_class: 'implementation_agent' },
      { participant_key: clerkKey, display_name: 'GitHub Clerk', role_class: 'system_clerk' },
      { participant_key: credentialedKey, display_name: 'Credentialed Agent', role_class: 'implementation_agent', credential: credentialedSecret },
    ];
    for (const registration of registrations) {
      const { status } = await client.post('/api/chatterbox/participants', {
        ...registration,
        assigned_by: 'chatterbox_dev_integration_check',
        source_authority: sourceIssueRef,
      });
      assertCheck('register_participants', status === 201, `${registration.participant_key}: expected 201, got ${status}`);
    }
  });

  // 2. #3794 JULES-1: a per-participant credential authenticates as exactly
  // that participant and cannot be used to assert a different identity.
  await step('participant_credential_cannot_assert_a_different_identity', async () => {
    const credentialedClient = makeClient({ baseUrl, bridgeToken: credentialedSecret, fetchFn });

    const asSelf = await credentialedClient.post('/api/chatterbox/check-in', { room_key: roomKey });
    assertCheck('participant_credential_cannot_assert_a_different_identity', asSelf.status === 200, `own check-in expected 200, got ${asSelf.status}`);

    const asOther = await credentialedClient.post('/api/chatterbox/check-in', {
      room_key: roomKey,
      participant_key: pmoKey,
    });
    assertCheck(
      'participant_credential_cannot_assert_a_different_identity',
      asOther.status === 403,
      `asserting pmo's identity with the credentialed agent's own credential expected 403, got ${asOther.status}`,
    );
  });

  // 3. Two tasks, one depending on the other — dependency-gated claims.
  const taskA = 'task-a';
  const taskB = 'task-b';

  await step('create_task_graph', async () => {
    const a = await client.post('/api/chatterbox/tasks', {
      room_key: roomKey,
      task_key: taskA,
      title: 'First task, no dependencies',
      state: 'AVAILABLE',
    });
    assertCheck('create_task_graph', a.status === 201, `taskA: expected 201, got ${a.status}`);

    const b = await client.post('/api/chatterbox/tasks', {
      room_key: roomKey,
      task_key: taskB,
      title: 'Second task, depends on task-a',
      state: 'AVAILABLE',
      depends_on: [taskA],
    });
    assertCheck('create_task_graph', b.status === 201, `taskB: expected 201, got ${b.status}`);
  });

  // 4. Dependency gate: claiming taskB before taskA completes must fail closed.
  await step('dependency_gate_blocks_claim', async () => {
    const { status, json } = await client.post('/api/chatterbox/claim', {
      room_key: roomKey,
      task_key: taskB,
      participant_key: agentAKey,
    });
    assertCheck('dependency_gate_blocks_claim', status === 409, `expected 409, got ${status}`);
    assertCheck('dependency_gate_blocks_claim', json.error === 'unsatisfied_dependencies', `unexpected error: ${json.error}`);
  });

  // 5. Concurrency: two participants racing the same task must resolve to exactly one winner.
  let taskAWinnerKey;
  let taskALoserKey;
  await step('concurrent_claim_exactly_one_winner', async () => {
    const [resultA, resultB] = await Promise.all([
      client.post('/api/chatterbox/claim', { room_key: roomKey, task_key: taskA, participant_key: agentAKey }),
      client.post('/api/chatterbox/claim', { room_key: roomKey, task_key: taskA, participant_key: agentBKey }),
    ]);
    const statuses = [resultA.status, resultB.status].sort();
    assertCheck(
      'concurrent_claim_exactly_one_winner',
      statuses[0] === 201 && statuses[1] === 409,
      `expected exactly one 201 and one 409, got [${resultA.status}, ${resultB.status}]`,
    );

    const aWon = resultA.status === 201;
    taskAWinnerKey = aWon ? agentAKey : agentBKey;
    taskALoserKey = aWon ? agentBKey : agentAKey;
    const loser = aWon ? resultB : resultA;

    assertCheck(
      'concurrent_claim_exactly_one_winner',
      loser.json.error === 'already_claimed' || loser.json.error === 'task_not_available:CLAIMED',
      `loser error should be already_claimed or task_not_available:CLAIMED, got ${loser.json.error}`,
    );
  });

  // 6. Release is claimant-only for a non-PMO/product_authority participant.
  await step('release_rejected_for_non_claimant', async () => {
    const { status } = await client.post('/api/chatterbox/release', {
      room_key: roomKey,
      task_key: taskA,
      participant_key: taskALoserKey,
    });
    assertCheck('release_rejected_for_non_claimant', status === 403 || status === 409, `expected 403/409, got ${status}`);
  });

  // 7. #3794 JULES-5: a pmo participant may force-release the other
  // participant's claim, but only with a reason.
  await step('force_release_requires_a_reason', async () => {
    const withoutReason = await client.post('/api/chatterbox/release', {
      room_key: roomKey,
      task_key: taskA,
      participant_key: pmoKey,
    });
    assertCheck('force_release_requires_a_reason', withoutReason.status === 400, `expected 400, got ${withoutReason.status}`);

    const withReason = await client.post('/api/chatterbox/release', {
      room_key: roomKey,
      task_key: taskA,
      participant_key: pmoKey,
      reason: 'dev integration check exercising force-release',
    });
    assertCheck('force_release_requires_a_reason', withReason.status === 200, `expected 200, got ${withReason.status}`);
    assertCheck('force_release_requires_a_reason', withReason.json.forced === true, 'response should report forced:true');
  });

  // 8. The task is available again after force-release; the winner reclaims
  // it so later steps have a stable, known claimant.
  await step('winner_reclaims_after_force_release', async () => {
    const { status } = await client.post('/api/chatterbox/claim', { room_key: roomKey, task_key: taskA, participant_key: taskAWinnerKey });
    assertCheck('winner_reclaims_after_force_release', status === 201, `expected 201, got ${status}`);
  });

  await step('release_succeeds_for_actual_claimant', async () => {
    const { status } = await client.post('/api/chatterbox/release', {
      room_key: roomKey,
      task_key: taskA,
      participant_key: taskAWinnerKey,
    });
    assertCheck('release_succeeds_for_actual_claimant', status === 200, `expected 200, got ${status}`);
  });

  // 9. Idempotent event posting.
  await step('idempotent_event_posting', async () => {
    const idempotencyKey = `${roomKey}-status-1`;
    const first = await client.post('/api/chatterbox/events', {
      room_key: roomKey,
      participant_key: pmoKey,
      event_type: 'STATUS',
      body: 'PMO status update',
      idempotency_key: idempotencyKey,
    });
    const second = await client.post('/api/chatterbox/events', {
      room_key: roomKey,
      participant_key: pmoKey,
      event_type: 'STATUS',
      body: 'PMO status update (retried)',
      idempotency_key: idempotencyKey,
    });
    assertCheck('idempotent_event_posting', first.status === 201, `first post expected 201, got ${first.status}`);
    assertCheck('idempotent_event_posting', second.json.idempotent_replay === true, 'retried post should report idempotent_replay:true');
    assertCheck(
      'idempotent_event_posting',
      second.json.event.id === first.json.event.id,
      'retried post should return the same event id, not a new one',
    );
  });

  // 10. Durable question/answer across a check-in boundary.
  let questionEventId;
  await step('question_visible_to_targeted_participant', async () => {
    const { status, json } = await client.post('/api/chatterbox/events', {
      room_key: roomKey,
      participant_key: pmoKey,
      event_type: 'QUESTION',
      target_participant_key: agentBKey,
      body: 'Does task-b depend on the schema in task-a?',
    });
    assertCheck('question_visible_to_targeted_participant', status === 201, `expected 201, got ${status}`);
    questionEventId = json.event.id;

    const checkIn = await client.post('/api/chatterbox/check-in', { room_key: roomKey, participant_key: agentBKey });
    const openQuestionIds = checkIn.json.catch_up.openQuestions.map((event) => event.id);
    assertCheck(
      'question_visible_to_targeted_participant',
      openQuestionIds.includes(questionEventId),
      'targeted question should appear in openQuestions before it is answered',
    );
  });

  await step('question_resolves_after_answer', async () => {
    const answer = await client.post('/api/chatterbox/events', {
      room_key: roomKey,
      participant_key: agentBKey,
      event_type: 'ANSWER',
      in_reply_to_event_id: questionEventId,
      body: 'Yes, confirmed.',
    });
    assertCheck('question_resolves_after_answer', answer.status === 201, `expected 201, got ${answer.status}`);

    const checkIn = await client.post('/api/chatterbox/check-in', { room_key: roomKey, participant_key: agentBKey });
    const openQuestionIds = checkIn.json.catch_up.openQuestions.map((event) => event.id);
    assertCheck(
      'question_resolves_after_answer',
      !openQuestionIds.includes(questionEventId),
      'answered question should no longer appear in openQuestions',
    );
  });

  // 11. Missed-wake recovery: exactly-accurate unreadCount, not stale/double-counted/dropped.
  await step('missed_wake_recovery_accurate_unread_count', async () => {
    await client.post('/api/chatterbox/check-in', { room_key: roomKey, participant_key: clerkKey });

    await client.post('/api/chatterbox/events', {
      room_key: roomKey,
      participant_key: pmoKey,
      event_type: 'STATUS',
      body: 'Event posted while the clerk participant was away.',
    });
    await client.post('/api/chatterbox/events', {
      room_key: roomKey,
      participant_key: pmoKey,
      event_type: 'STATUS',
      body: 'A second event posted while the clerk participant was away.',
    });

    const after = await client.post('/api/chatterbox/check-in', { room_key: roomKey, participant_key: clerkKey });
    assertCheck(
      'missed_wake_recovery_accurate_unread_count',
      after.json.catch_up.unreadCount === 2,
      `expected exactly 2 unread events since the last checkpoint, got ${after.json.catch_up.unreadCount}`,
    );
  });

  // 12. system_clerk structural boundary: rejected for real, not just in a unit test.
  await step('system_clerk_cannot_post_substantive_transition', async () => {
    const { status, json } = await client.post('/api/chatterbox/events', {
      room_key: roomKey,
      participant_key: clerkKey,
      event_type: 'COMPLETE',
      body: 'A clerk should never be able to post this.',
    });
    assertCheck('system_clerk_cannot_post_substantive_transition', status === 403, `expected 403, got ${status}`);
    assertCheck(
      'system_clerk_cannot_post_substantive_transition',
      /system_clerk/.test(String(json.error || '')),
      `error should explain the system_clerk boundary, got: ${json.error}`,
    );
  });

  // 13. #3794 Layer 3: a COMPLETE targeting pmo creates a queued action;
  // reading it never clears it; only an explicit ack/complete callback does.
  let pmoActionId;
  await step('complete_targeting_pmo_creates_queued_action', async () => {
    const { status, json } = await client.post('/api/chatterbox/events', {
      room_key: roomKey,
      participant_key: agentAKey,
      event_type: 'COMPLETE',
      task_ref: taskA,
      target_participant_key: pmoKey,
      body: `COMPLETE ${taskA} — implementation done, PR merged.`,
      pmo_action_type: 'CLOSE_ISSUE',
    });
    assertCheck('complete_targeting_pmo_creates_queued_action', status === 201, `expected 201, got ${status}`);
    assertCheck('complete_targeting_pmo_creates_queued_action', json.pmo_action?.status === 'PENDING', 'expected a PENDING pmo_action to be created');
    pmoActionId = json.pmo_action.id;

    const listed = await client.get(`/api/chatterbox/pmo-actions?room=${encodeURIComponent(roomKey)}&status=PENDING`);
    const ids = (listed.json.pmo_actions ?? []).map((row) => row.id);
    assertCheck('complete_targeting_pmo_creates_queued_action', ids.includes(pmoActionId), 'listing PENDING actions should include the new action — reading never clears it');
  });

  await step('pmo_action_ack_then_complete', async () => {
    const ack = await client.post('/api/chatterbox/pmo-actions', { op: 'ack', id: pmoActionId, participant_key: pmoKey });
    assertCheck('pmo_action_ack_then_complete', ack.status === 200, `ack expected 200, got ${ack.status}`);
    assertCheck('pmo_action_ack_then_complete', ack.json.pmo_action.status === 'ACKED', 'expected status ACKED after ack');

    const complete = await client.post('/api/chatterbox/pmo-actions', {
      op: 'complete',
      id: pmoActionId,
      participant_key: pmoKey,
      reconciliation_note: 'Issue closed and tracker updated by dev integration check.',
    });
    assertCheck('pmo_action_ack_then_complete', complete.status === 200, `complete expected 200, got ${complete.status}`);
    assertCheck('pmo_action_ack_then_complete', complete.json.pmo_action.status === 'DONE', 'expected status DONE after complete');
  });

  await step('pmo_action_ack_rejected_for_non_pmo_role', async () => {
    // A fresh action to attempt the (rejected) ack against.
    const created = await client.post('/api/chatterbox/events', {
      room_key: roomKey,
      participant_key: agentBKey,
      event_type: 'COMPLETE',
      task_ref: taskB,
      target_participant_key: pmoKey,
      body: `COMPLETE ${taskB}`,
    });
    const otherActionId = created.json.pmo_action.id;

    const { status } = await client.post('/api/chatterbox/pmo-actions', { op: 'ack', id: otherActionId, participant_key: agentAKey });
    assertCheck('pmo_action_ack_rejected_for_non_pmo_role', status === 403, `expected 403, got ${status}`);
  });

  // 14. #3794 Layer 4: the reconciliation sweep runs cleanly against a room
  // with no overdue actions (the fresh PENDING action from step 13's second
  // COMPLETE has not had time to expire — expiry logic itself is unit
  // tested with mocked dates in tests/chatterbox-pmo-actions.test.ts; this
  // proves the live wiring, not the 24h timer).
  await step('reconciliation_sweep_runs_cleanly', async () => {
    const { status, json } = await client.post('/api/chatterbox/reconcile', { room_key: roomKey, participant_key: clerkKey });
    assertCheck('reconciliation_sweep_runs_cleanly', status === 200, `expected 200, got ${status}`);
    assertCheck('reconciliation_sweep_runs_cleanly', json.ok === true, 'expected ok:true');
  });

  return {
    ok: true,
    roomKey,
    baseUrl,
    checksRun: passed.length,
    checksPassed: passed,
  };
}

function readEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`FAIL-CLOSED: missing required env var ${name}`);
    process.exitCode = 1;
    return null;
  }
  return value;
}

export async function main() {
  const baseUrl = readEnv('CHATTERBOX_BASE_URL');
  const bridgeToken = readEnv('CHATTERBOX_BRIDGE_TOKEN');
  if (!baseUrl || !bridgeToken) return null;

  try {
    const result = await runChatterboxDevIntegrationCheck({ baseUrl, bridgeToken });
    console.log(JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: error instanceof CheckFailure ? error.message : `unexpected error: ${error.message}`,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
    return null;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
