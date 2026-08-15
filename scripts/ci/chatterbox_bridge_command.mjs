#!/usr/bin/env node
// #3415 (Chatterbox) — non-production command bridge.
//
// Parses a single `/chatterbox <command>` comment on the dedicated control
// Issue and relays it, as a thin authenticated proxy, to the live
// Development/Preview Chatterbox API. Holds CHATTERBOX_PREVIEW_ADMIN_TOKEN
// so participants never have to; never logs it, never echoes it into the
// reply comment it posts back.
//
// This script does not invent authority: every command maps directly onto
// an existing functions/api/chatterbox/** route already governed by that
// route's own server-side rules (role_class boundaries, task-state
// preconditions, atomic claim uniqueness). Registering a participant or
// granting a role_class is deliberately not a supported command here --
// that stays on ops-chatterbox-room-bootstrap.yml, which requires an
// explicit assigned_by/source_authority citation.
//
// The caller (ops-chatterbox-command-bridge.yml) is expected to have
// already gated on a trusted-actor allowlist before invoking this script;
// this script re-validates the actor defensively but its main job is
// parsing the command and validating the *declared* participant against
// the fixed, pre-registered allowlist -- GitHub's own commenter identity
// cannot distinguish which of several tools that share one GitHub account
// is actually speaking (see PR #3527's control-Issue body), so the
// participant is self-declared in the command and checked, not inferred.

const SUPPORTED_COMMANDS = ['checkin', 'status', 'question', 'answer', 'claim', 'release', 'complete'];
const SAFE_KEY = /^[A-Za-z0-9._-]+$/;
const MAX_REPLY_CHARS = 6000;

function truncate(text) {
  if (text.length <= MAX_REPLY_CHARS) return text;
  return `${text.slice(0, MAX_REPLY_CHARS)}\n... (truncated, ${text.length} total chars)`;
}

function parseCommand(body) {
  const lines = body.split(/\r\n|\r|\n/);
  const commandLineIndex = lines.findIndex((line) => /^\/chatterbox\s+(\S+)\s*$/.test(line.trim()));
  if (commandLineIndex === -1) return null;

  const command = lines[commandLineIndex].trim().match(/^\/chatterbox\s+(\S+)\s*$/)[1];
  const fields = {};
  let bodyLines = null;

  for (let i = commandLineIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    if (bodyLines !== null) {
      bodyLines.push(line);
      continue;
    }
    const match = line.match(/^(participant|task|target|in_reply_to|room|body):\s?(.*)$/);
    if (!match) continue;
    const [, key, value] = match;
    if (key === 'body') {
      bodyLines = [value];
    } else {
      fields[key] = value.trim();
    }
  }

  if (bodyLines !== null) {
    fields.body = bodyLines.join('\n').trim();
  }

  return { command, fields };
}

function validate(command, fields, approvedParticipants) {
  const errors = [];

  if (!fields.participant) {
    errors.push('participant: is required');
  } else if (!approvedParticipants.includes(fields.participant)) {
    errors.push(`participant "${fields.participant}" is not one of the approved participants: ${approvedParticipants.join(', ')}`);
  }

  if (fields.room && !SAFE_KEY.test(fields.room)) {
    errors.push('room: contains unexpected characters');
  }
  if (fields.task && !SAFE_KEY.test(fields.task)) {
    errors.push('task: contains unexpected characters');
  }
  if (fields.target && !approvedParticipants.includes(fields.target)) {
    errors.push(`target "${fields.target}" is not one of the approved participants: ${approvedParticipants.join(', ')}`);
  }

  const needsTask = ['claim', 'release', 'complete'];
  const needsBody = ['status', 'question', 'answer', 'complete'];

  if (needsTask.includes(command) && !fields.task) {
    errors.push(`task: is required for ${command}`);
  }
  if (needsBody.includes(command) && !fields.body) {
    errors.push(`body: is required for ${command}`);
  }
  if (command === 'answer') {
    if (!fields.in_reply_to) {
      errors.push('in_reply_to: is required for answer');
    } else if (!/^\d+$/.test(fields.in_reply_to)) {
      errors.push('in_reply_to: must be a numeric event id');
    }
  }

  return errors;
}

function makeChatterboxClient(baseUrl, adminToken) {
  return async function call(method, path, body) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-admin-token': adminToken },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    const json = await response.json().catch(() => ({}));
    return { status: response.status, json };
  };
}

async function runCommand({ command, fields, roomKey, call, githubRef, idempotencyKey }) {
  switch (command) {
    case 'checkin':
      return call('POST', '/api/chatterbox/check-in', { room_key: roomKey, participant_key: fields.participant });
    case 'claim':
      return call('POST', '/api/chatterbox/claim', { room_key: roomKey, task_key: fields.task, participant_key: fields.participant });
    case 'release':
      return call('POST', '/api/chatterbox/release', { room_key: roomKey, task_key: fields.task, participant_key: fields.participant });
    case 'status':
      return call('POST', '/api/chatterbox/events', {
        room_key: roomKey,
        participant_key: fields.participant,
        event_type: 'STATUS',
        task_ref: fields.task,
        body: fields.body,
        github_ref: githubRef,
        idempotency_key: idempotencyKey,
      });
    case 'question':
      return call('POST', '/api/chatterbox/events', {
        room_key: roomKey,
        participant_key: fields.participant,
        event_type: 'QUESTION',
        task_ref: fields.task,
        target_participant_key: fields.target,
        body: fields.body,
        github_ref: githubRef,
        idempotency_key: idempotencyKey,
      });
    case 'answer':
      return call('POST', '/api/chatterbox/events', {
        room_key: roomKey,
        participant_key: fields.participant,
        event_type: 'ANSWER',
        task_ref: fields.task,
        in_reply_to_event_id: Number(fields.in_reply_to),
        body: fields.body,
        github_ref: githubRef,
        idempotency_key: idempotencyKey,
      });
    case 'complete':
      return call('POST', '/api/chatterbox/events', {
        room_key: roomKey,
        participant_key: fields.participant,
        event_type: 'COMPLETE',
        task_ref: fields.task,
        body: fields.body,
        github_ref: githubRef,
        idempotency_key: idempotencyKey,
      });
    default:
      throw new Error(`unreachable: unsupported command ${command}`);
  }
}

async function postReply({ repo, issueNumber, githubToken, body }) {
  const response = await fetch(`https://api.github.com/repos/${repo}/issues/${issueNumber}/comments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ body: truncate(body) }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`failed to post reply comment: HTTP ${response.status} ${text}`);
  }
}

async function main() {
  const {
    COMMENT_BODY,
    COMMENT_AUTHOR,
    COMMENT_ID,
    TRUSTED_ACTORS,
    APPROVED_PARTICIPANTS,
    CHATTERBOX_BASE_URL,
    ADMIN_TOKEN,
    DEFAULT_ROOM_KEY,
    GITHUB_TOKEN,
    GITHUB_REPOSITORY,
    CONTROL_ISSUE_NUMBER,
  } = process.env;

  const trustedActors = (TRUSTED_ACTORS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const approvedParticipants = (APPROVED_PARTICIPANTS || '').split(',').map((s) => s.trim()).filter(Boolean);

  // Defense in depth: the calling workflow already gates on this in its
  // `if:` condition before this script ever runs, but never trust a single
  // layer for an authorization boundary.
  if (!trustedActors.includes(COMMENT_AUTHOR)) {
    console.log(`Ignoring comment from untrusted actor: ${COMMENT_AUTHOR}`);
    return;
  }

  const parsed = parseCommand(COMMENT_BODY || '');
  if (!parsed) {
    console.log('No /chatterbox command line found in comment; ignoring.');
    return;
  }

  const { command, fields } = parsed;
  const reply = { repo: GITHUB_REPOSITORY, issueNumber: CONTROL_ISSUE_NUMBER, githubToken: GITHUB_TOKEN };

  if (!SUPPORTED_COMMANDS.includes(command)) {
    await postReply({
      ...reply,
      body: `## Chatterbox bridge — unsupported command\n\n\`${command}\` is not a supported command. Supported: ${SUPPORTED_COMMANDS.join(', ')}.`,
    });
    return;
  }

  const errors = validate(command, fields, approvedParticipants);
  if (errors.length > 0) {
    await postReply({
      ...reply,
      body: `## Chatterbox bridge — rejected\n\nCommand: \`${command}\`\n\n${errors.map((e) => `- ${e}`).join('\n')}`,
    });
    return;
  }

  const roomKey = fields.room || DEFAULT_ROOM_KEY;
  const call = makeChatterboxClient(CHATTERBOX_BASE_URL, ADMIN_TOKEN);
  const githubRef = { issue: Number(CONTROL_ISSUE_NUMBER), comment_id: Number(COMMENT_ID), repository: GITHUB_REPOSITORY };
  const idempotencyKey = COMMENT_ID ? `bridge-comment-${COMMENT_ID}` : undefined;

  let result;
  try {
    result = await runCommand({ command, fields, roomKey, call, githubRef, idempotencyKey });
  } catch (error) {
    await postReply({
      ...reply,
      body: `## Chatterbox bridge — request failed\n\nCommand: \`${command}\`\nParticipant: \`${fields.participant}\`\n\nThe request to the Chatterbox API itself failed (network/parse error): ${String(error?.message ?? error)}`,
    });
    process.exitCode = 1;
    return;
  }

  const statusLabel = result.status >= 200 && result.status < 300 ? 'ok' : `HTTP ${result.status}`;
  const digest = JSON.stringify(result.json, null, 2);
  await postReply({
    ...reply,
    body: `## Chatterbox bridge — ${command}\n\nParticipant: \`${fields.participant}\`\nRoom: \`${roomKey}\`\nResult: **${statusLabel}**\n\n\`\`\`json\n${digest}\n\`\`\``,
  });
}

main().catch((error) => {
  console.error(String(error?.stack ?? error));
  process.exitCode = 1;
});
