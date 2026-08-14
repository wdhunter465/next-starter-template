#!/usr/bin/env node
// #3415 (Chatterbox) work unit 5 — read-only GitHub Issue comment ingestion.
//
// Mirrors an Issue's comments into a Chatterbox room as SYSTEM events, each
// carrying an exact github_ref citation (issue, comment_id) rather than a
// bare URL. This never mutates GitHub — it only reads issue comments and
// writes into Chatterbox's own D1 tables. It does not decide anything: the
// posting participant must be registered with role_class 'system_clerk',
// and SYSTEM is one of the event types that role is structurally allowed to
// post (functions/_lib/chatterbox.ts, isSystemClerkEventAllowed).
//
// Idempotent by construction: each ingested comment's idempotency_key is
// `github-comment-${comment.id}`, deduped server-side by
// POST /api/chatterbox/events. Re-running this script against the same
// comments is always safe — already-ingested comments come back as
// idempotent_replay:true, not a duplicate event.

import { pathToFileURL } from 'node:url';
import { githubRepoRequest } from './github_issue_api.mjs';

function request(args) {
  return githubRepoRequest({ ...args, userAgent: 'lgfc-chatterbox-github-ingest' });
}

/** Pure: does this comment need ingesting, given comments already known to exist? */
export function shouldIngestComment(comment, alreadyIngestedIds = new Set()) {
  if (!comment || typeof comment.id !== 'number') return false;
  if (alreadyIngestedIds.has(comment.id)) return false;
  return true;
}

/** Pure: build the Chatterbox event payload for one GitHub issue comment. */
export function mapIssueCommentToChatterboxEvent(comment, { roomKey, participantKey, repository, issueNumber }) {
  const author = comment?.user?.login || 'unknown';
  const bodyPreview = String(comment?.body || '').trim().slice(0, 500);
  return {
    room_key: roomKey,
    participant_key: participantKey,
    event_type: 'SYSTEM',
    task_ref: String(issueNumber),
    body: `GitHub comment by @${author} on ${repository}#${issueNumber}: ${bodyPreview}`,
    github_ref: {
      issue: issueNumber,
      comment_id: comment.id,
      repository,
    },
    idempotency_key: `github-comment-${comment.id}`,
  };
}

/** I/O: fetch issue comments created at or after `since` (ISO 8601), newest-last per GitHub's default order. */
export async function fetchIssueCommentsSince({ token, repository, issueNumber, since, fetchFn = fetch }) {
  const [owner, repo] = repository.split('/');
  const params = new URLSearchParams({ per_page: '100' });
  if (since) params.set('since', since);
  return request({
    token,
    repository,
    path: `/issues/${issueNumber}/comments?${params.toString()}`,
    fetchFn,
  }).then((comments) => (Array.isArray(comments) ? comments : []));
}

/** I/O: POST one mapped event to the deployed Chatterbox API. Never throws on idempotent replay. */
export async function postChatterboxEvent({ baseUrl, adminToken, payload, fetchFn = fetch }) {
  const response = await fetchFn(`${baseUrl}/api/chatterbox/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': adminToken,
    },
    body: JSON.stringify(payload),
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`POST /api/chatterbox/events failed: ${response.status} ${JSON.stringify(json)}`);
  }
  return json;
}

export async function ingestIssueComments({
  token,
  repository,
  issueNumber,
  since,
  baseUrl,
  adminToken,
  roomKey,
  participantKey,
  fetchFn = fetch,
}) {
  const comments = await fetchIssueCommentsSince({ token, repository, issueNumber, since, fetchFn });
  const results = [];
  for (const comment of comments) {
    if (!shouldIngestComment(comment)) continue;
    const payload = mapIssueCommentToChatterboxEvent(comment, { roomKey, participantKey, repository, issueNumber });
    const result = await postChatterboxEvent({ baseUrl, adminToken, payload, fetchFn });
    results.push({ commentId: comment.id, idempotentReplay: Boolean(result.idempotent_replay) });
  }
  return { totalFetched: comments.length, ingested: results };
}

function readEnv(name, { required = true } = {}) {
  const value = process.env[name];
  if (required && !value) {
    console.error(`FAIL-CLOSED: missing required env var ${name}`);
    process.exitCode = 1;
    return null;
  }
  return value || '';
}

export async function main() {
  const token = readEnv('GITHUB_TOKEN');
  const repository = readEnv('CHATTERBOX_REPOSITORY');
  const issueNumber = readEnv('CHATTERBOX_ISSUE_NUMBER');
  const baseUrl = readEnv('CHATTERBOX_BASE_URL');
  const adminToken = readEnv('ADMIN_TOKEN');
  const roomKey = readEnv('CHATTERBOX_ROOM_KEY');
  const participantKey = readEnv('CHATTERBOX_CLERK_PARTICIPANT_KEY');
  const since = readEnv('CHATTERBOX_SINCE', { required: false });

  if (!token || !repository || !issueNumber || !baseUrl || !adminToken || !roomKey || !participantKey) {
    return null;
  }

  const result = await ingestIssueComments({
    token,
    repository,
    issueNumber,
    since: since || undefined,
    baseUrl,
    adminToken,
    roomKey,
    participantKey,
  });

  console.log(JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`FAIL-CLOSED: ${error.message}`);
    process.exitCode = 1;
  });
}
