// #3794 (Chatterbox self-hosted room-actor design) — per-participant
// credential authentication, fixing Jules's #3579 JULES-1 finding: every
// /api/chatterbox/* endpoint previously trusted a caller-asserted
// participant_key under one shared admin token, with no binding between the
// authenticated credential and the identity it acts as.
//
// main's own /api/admin/* gate (functions/_lib/auth.ts) is a website
// member-session gate — Chatterbox participants are agents, not logged-in
// members, so this module is a deliberately separate, narrower credential
// model rather than a reuse of that gate.
//
// Two distinct credential types:
// - A per-participant bearer token (its SHA-256 hash stored in
//   chatterbox_participants.credential_hash, migration 0063) authenticates
//   as exactly that participant. A caller holding this credential cannot
//   act as anyone else.
// - CHATTERBOX_BRIDGE_PROD_TOKEN (env secret) authenticates the GitHub-comment
//   bridge's existing, already-documented relay model: the participant a
//   command speaks as is self-declared in the request body, not inferred
//   from this credential. This is a deliberately narrower, separately-keyed
//   exception to the rule above — not a token every route trusts by
//   default — and is also the credential used for room/participant
//   management, which remains PMO/ops-operated rather than self-service.

import type { Db } from './chatterbox';

export type ChatterboxCaller = { kind: 'participant'; participant: any } | { kind: 'relay' };

export type ChatterboxAuthResult = { ok: true; caller: ChatterboxCaller } | { ok: false; response: Response };

function json(data: any, status: number): Response {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function hashCredential(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

export async function requireChatterboxCaller(request: Request, env: any, db: Db): Promise<ChatterboxAuthResult> {
  const token = extractBearerToken(request);
  if (!token) {
    return { ok: false, response: json({ ok: false, error: 'missing bearer token' }, 401) };
  }

  // .trim() matches extractBearerToken's own trim on the incoming token --
  // a trailing newline/space picked up when a secret value is pasted into
  // a dashboard input must not silently break this comparison on only one
  // side (#3845).
  const bridgeToken = typeof env?.CHATTERBOX_BRIDGE_PROD_TOKEN === 'string' ? env.CHATTERBOX_BRIDGE_PROD_TOKEN.trim() : '';
  if (bridgeToken && token === bridgeToken) {
    return { ok: true, caller: { kind: 'relay' } };
  }

  const credentialHash = await hashCredential(token);
  const participant = await db
    .prepare('SELECT * FROM chatterbox_participants WHERE credential_hash = ? AND revoked_at IS NULL')
    .bind(credentialHash)
    .first();

  if (!participant) {
    return { ok: false, response: json({ ok: false, error: 'invalid or unrecognized credential' }, 401) };
  }

  return { ok: true, caller: { kind: 'participant', participant } };
}

/**
 * Resolves the participant a request acts as. A relay caller must supply
 * participant_key explicitly (the existing self-declared trust model,
 * unchanged). An authenticated participant caller acts only as itself —
 * asserting a different participant_key in the body is rejected rather
 * than silently honored, which is the actual JULES-1 fix.
 */
export async function resolveActingParticipant(
  db: Db,
  caller: ChatterboxCaller,
  assertedParticipantKey: string | null,
): Promise<{ ok: true; participant: any } | { ok: false; response: Response }> {
  if (caller.kind === 'relay') {
    if (!assertedParticipantKey) {
      return {
        ok: false,
        response: json({ ok: false, error: 'participant_key is required for a relay-authenticated call' }, 400),
      };
    }
    const participant = await db
      .prepare('SELECT * FROM chatterbox_participants WHERE participant_key = ? AND revoked_at IS NULL')
      .bind(assertedParticipantKey)
      .first();
    if (!participant) {
      return { ok: false, response: json({ ok: false, error: 'participant not found or revoked' }, 404) };
    }
    return { ok: true, participant };
  }

  if (assertedParticipantKey && assertedParticipantKey !== caller.participant.participant_key) {
    return {
      ok: false,
      response: json({ ok: false, error: 'participant_key does not match the authenticated credential' }, 403),
    };
  }
  return { ok: true, participant: caller.participant };
}

/** Room/participant management stays PMO/ops-operated, not self-service. */
export function requireRelay(caller: ChatterboxCaller): Response | null {
  if (caller.kind !== 'relay') {
    return json({ ok: false, error: 'this operation requires the bridge/ops relay credential' }, 403);
  }
  return null;
}
