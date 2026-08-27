#!/usr/bin/env node
// #3794 (Chatterbox self-hosted room-actor design), Layer 4 — the GitHub
// cross-check half of the reconciliation sweep. For each chatterbox_pmo_actions
// row marked DONE with action_type CLOSE_ISSUE, verifies the referenced
// GitHub Issue (task_ref) is actually closed rather than trusting the
// self-report, and posts a SYSTEM event flagging any mismatch — this is
// what makes the dashboard trustworthy again (GitHub's Issue state is the
// verified ground truth, Chatterbox's queue is the workflow layer on top).
//
// Read-only against GitHub; only mutates Chatterbox's own D1 via its HTTP
// API. Posts as a registered system_clerk participant, same trust model
// chatterbox_github_ingest.mjs already established. Runs as a Node CI
// script with the standard Actions GITHUB_TOKEN, rather than binding a
// GitHub credential into the Cloudflare Pages environment — the internal
// half of Layer 4 (expiring stale PENDING actions) is a Pages Function
// (functions/api/chatterbox/reconcile.ts); this script is only the part
// that needs to talk to GitHub.

import { pathToFileURL } from 'node:url';
import { githubRepoRequest } from './github_issue_api.mjs';

function chatterboxRequest({ baseUrl, adminToken, path, method = 'GET', body, fetchFn = fetch }) {
  return fetchFn(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${adminToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  }).then(async (res) => {
    const text = await res.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { ok: false, error: 'invalid_json_response', raw: text };
    }
    if (!res.ok && !parsed?.ok) {
      throw new Error(`chatterbox ${method} ${path} failed: ${res.status} ${text}`);
    }
    return parsed;
  });
}

/** I/O: does a claimed-DONE CLOSE_ISSUE action actually match GitHub's Issue state? */
export async function checkDoneActionAgainstGitHub({ githubToken, repository, action, fetchFn = fetch }) {
  if (action.action_type !== 'CLOSE_ISSUE') {
    return { mismatch: false, reason: 'not_a_close_issue_action' };
  }
  const issueNumber = Number(action.task_ref);
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
    return { mismatch: false, reason: 'task_ref_not_an_issue_number' };
  }
  const issue = await githubRepoRequest({
    token: githubToken,
    repository,
    path: `/issues/${issueNumber}`,
    userAgent: 'lgfc-chatterbox-reconcile-github',
    fetchFn,
  });
  if (issue?.state !== 'closed') {
    return { mismatch: true, reason: `issue_state_is_${issue?.state}`, issueNumber };
  }
  return { mismatch: false, reason: 'issue_closed_as_claimed', issueNumber };
}

export async function run({
  chatterboxBaseUrl,
  chatterboxAdminToken,
  githubToken,
  repository,
  roomKey,
  clerkParticipantKey,
  fetchFn = fetch,
} = {}) {
  const list = await chatterboxRequest({
    baseUrl: chatterboxBaseUrl,
    adminToken: chatterboxAdminToken,
    path: `/api/chatterbox/pmo-actions?room=${encodeURIComponent(roomKey)}&status=DONE`,
    fetchFn,
  });

  const mismatches = [];
  for (const action of list.pmo_actions ?? []) {
    const result = await checkDoneActionAgainstGitHub({ githubToken, repository, action, fetchFn });
    if (!result.mismatch) continue;
    mismatches.push({ action, result });

    await chatterboxRequest({
      baseUrl: chatterboxBaseUrl,
      adminToken: chatterboxAdminToken,
      path: '/api/chatterbox/events',
      method: 'POST',
      body: {
        room_key: roomKey,
        participant_key: clerkParticipantKey,
        event_type: 'SYSTEM',
        task_ref: action.task_ref,
        body: `RECONCILIATION MISMATCH: PMO action #${action.id} claims task ${action.task_ref} is closed, but GitHub reports ${result.reason}.`,
        idempotency_key: `chatterbox-reconcile-mismatch-${action.id}`,
      },
      fetchFn,
    });
  }

  return { checked: (list.pmo_actions ?? []).length, mismatches };
}

async function main() {
  const {
    CHATTERBOX_BASE_URL,
    CHATTERBOX_ADMIN_TOKEN,
    GITHUB_TOKEN,
    GITHUB_REPOSITORY,
    CHATTERBOX_ROOM_KEY,
    CHATTERBOX_CLERK_PARTICIPANT_KEY,
  } = process.env;

  if (
    !CHATTERBOX_BASE_URL ||
    !CHATTERBOX_ADMIN_TOKEN ||
    !GITHUB_TOKEN ||
    !GITHUB_REPOSITORY ||
    !CHATTERBOX_ROOM_KEY ||
    !CHATTERBOX_CLERK_PARTICIPANT_KEY
  ) {
    console.error('chatterbox_reconcile_github: missing required environment variable(s)');
    process.exitCode = 1;
    return;
  }

  const result = await run({
    chatterboxBaseUrl: CHATTERBOX_BASE_URL,
    chatterboxAdminToken: CHATTERBOX_ADMIN_TOKEN,
    githubToken: GITHUB_TOKEN,
    repository: GITHUB_REPOSITORY,
    roomKey: CHATTERBOX_ROOM_KEY,
    clerkParticipantKey: CHATTERBOX_CLERK_PARTICIPANT_KEY,
  });

  console.log(`chatterbox_reconcile_github: checked ${result.checked} DONE action(s), ${result.mismatches.length} mismatch(es)`);
  for (const m of result.mismatches) {
    console.log(` - action #${m.action.id} task ${m.action.task_ref}: ${m.result.reason}`);
  }
}

const isMainModule = import.meta.url === pathToFileURL(process.argv[1] ?? '').href;
if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
