#!/usr/bin/env node
// #3415 (Chatterbox) work unit 6 — real, end-to-end proof against a live
// deployed Chatterbox API (Development/Preview D1 only), not a mock.
//
// This is the check that answers "does it actually work," per #3415's own
// stated prototype success criteria: PMO plus multiple independently
// operating participants in one room; leave/rejoin catch-up; simultaneous
// claims cannot create duplicate ownership; dependencies gate claims;
// questions persist and resolve; the system_clerk boundary holds for real,
// not just in a unit test. Every room/participant/task this script creates
// is namespaced under a per-run key so repeat runs never collide, and
// nothing here ever touches Production — the base URL is always the
// Chatterbox component branch's own Development deployment.
//
// Never performs a live GitHub write. Never touches Production D1 — the
// base URL is resolved (by the caller) from the component branch's own
// Cloudflare Pages Development deployment, which binds Development D1 only.

import { pathToFileURL } from 'node:url';

function makeClient({ baseUrl, adminToken, fetchFn = fetch }) {
  async function call(method, path, body) {
    const response = await fetchFn(`${baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-admin-token': adminToken,
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

export async function runChatterboxDevIntegrationCheck({ baseUrl, adminToken, fetchFn = fetch, runId = Date.now() }) {
  const client = makeClient({ baseUrl, adminToken, fetchFn });
  const passed = [];
  const roomKey = `dev-integration-check-${runId}`;
  const sourceIssueRef = 'wdhunter465/next-starter-template#3415';

  async function step(label, fn) {
    await fn();
    passed.push(label);
  }

  // 1. Room + 3 independently operating participants across distinct role classes.
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

  await step('register_participants', async () => {
    const registrations = [
      { participant_key: pmoKey, display_name: 'PMO', role_class: 'pmo' },
      { participant_key: agentAKey, display_name: 'Agent A', role_class: 'implementation_agent' },
      { participant_key: agentBKey, display_name: 'Agent B', role_class: 'implementation_agent' },
      { participant_key: clerkKey, display_name: 'GitHub Clerk', role_class: 'system_clerk' },
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

  // 2. Two tasks, one depending on the other — dependency-gated claims.
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

  // 3. Dependency gate: claiming taskB before taskA completes must fail closed.
  await step('dependency_gate_blocks_claim', async () => {
    const { status, json } = await client.post('/api/chatterbox/claim', {
      room_key: roomKey,
      task_key: taskB,
      participant_key: agentAKey,
    });
    assertCheck('dependency_gate_blocks_claim', status === 409, `expected 409, got ${status}`);
    assertCheck('dependency_gate_blocks_claim', json.error === 'unsatisfied_dependencies', `unexpected error: ${json.error}`);
  });

  // 4. Concurrency: two participants racing the same task must resolve to exactly one winner.
  // The actual winner is genuinely non-deterministic (that's the point of the
  // race) — captured here so step 5 can correctly test "the *other*
  // participant" instead of assuming which one it is.
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

    // The loser is correctly rejected either by the DB-level unique-index
    // constraint ("already_claimed", when both requests' precondition reads
    // race before either write) or by the precondition check itself
    // ("task_not_available:CLAIMED", when one request's read+write fully
    // completes before the other's read starts) — both are a correct
    // rejection of the loser; only a 201/201 double-win would be a bug.
    assertCheck(
      'concurrent_claim_exactly_one_winner',
      loser.json.error === 'already_claimed' || loser.json.error === 'task_not_available:CLAIMED',
      `loser error should be already_claimed or task_not_available:CLAIMED, got ${loser.json.error}`,
    );
  });

  // 5. Release is claimant-only — attempted here by the participant who
  // actually lost the race above, whichever one that turned out to be.
  await step('release_rejected_for_non_claimant', async () => {
    const { status } = await client.post('/api/chatterbox/release', {
      room_key: roomKey,
      task_key: taskA,
      participant_key: taskALoserKey,
    });
    assertCheck('release_rejected_for_non_claimant', status === 403 || status === 409, `expected 403/409, got ${status}`);
  });

  // 6. The actual winner can release cleanly, proving the claimant-success
  // path works too, not just the rejection path.
  await step('release_succeeds_for_actual_claimant', async () => {
    const { status } = await client.post('/api/chatterbox/release', {
      room_key: roomKey,
      task_key: taskA,
      participant_key: taskAWinnerKey,
    });
    assertCheck('release_succeeds_for_actual_claimant', status === 200, `expected 200, got ${status}`);
  });

  // 7. Idempotent event posting.
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

  // 8. Durable question/answer across a check-in boundary.
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

  // 9. Missed-wake recovery: a participant that checks in, then misses two
  // events entirely (no push adapter, nothing else touches their
  // checkpoint), still gets an exactly-accurate unreadCount on their next
  // check-in — not stale, not double-counted, not silently dropped.
  await step('missed_wake_recovery_accurate_unread_count', async () => {
    // Establish a checkpoint. Whatever this first check-in's own unreadCount
    // is (everything since this participant joined the room) is not the
    // interesting number here — what matters is that it resets the
    // checkpoint, so the *next* check-in's unreadCount reflects only what
    // happened after this one, not history plus history again.
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

  // 10. system_clerk structural boundary: rejected for real, not just in a unit test.
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
  const adminToken = readEnv('ADMIN_TOKEN');
  if (!baseUrl || !adminToken) return null;

  try {
    const result = await runChatterboxDevIntegrationCheck({ baseUrl, adminToken });
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
