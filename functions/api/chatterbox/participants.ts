// /api/chatterbox/participants — #3794 Chatterbox self-hosted room-actor
// design.
// GET: list participants (optionally filtered by role_class). Any
// authenticated caller (participant or relay) may list.
// POST: register a participant, optionally with a `credential` the caller
// controls (#3794 JULES-1) — its SHA-256 hash is stored, never the token
// itself. A participant registered without a credential has no direct
// credential yet and can only be acted for through the bridge relay path.
// Registration stays PMO/ops-operated: requires the relay credential.
//
// Chatterbox records role assignments; it does not invent the authority
// behind them (review point 9 / definition comment 5280229024) —
// assigned_by and source_authority are required so every assignment cites
// the repository-governance record that permits it.

import { requireD1 } from '../../_lib/d1';
import { isValidRoleClass } from '../../_lib/chatterbox';
import { hashCredential, requireChatterboxCaller, requireRelay } from '../../_lib/chatterbox-auth';

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { 'Content-Type': 'application/json' } });
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;
  const d1 = requireD1(env);
  if (!d1.ok) return json(d1.body, d1.status);

  const auth = await requireChatterboxCaller(request, env, d1.db);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const roleClass = String(url.searchParams.get('role_class') || '').trim();

  const rows = roleClass
    ? await d1.db
        .prepare(
          'SELECT id, participant_key, display_name, role_class, capability_summary, assigned_by, source_authority, effective_at, revoked_at, created_at, updated_at, (credential_hash IS NOT NULL) AS has_credential FROM chatterbox_participants WHERE role_class = ? ORDER BY created_at ASC',
        )
        .bind(roleClass)
        .all()
    : await d1.db
        .prepare(
          'SELECT id, participant_key, display_name, role_class, capability_summary, assigned_by, source_authority, effective_at, revoked_at, created_at, updated_at, (credential_hash IS NOT NULL) AS has_credential FROM chatterbox_participants ORDER BY created_at ASC',
        )
        .bind()
        .all();

  return json({ ok: true, participants: rows.results ?? [] });
};

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
    return json({ ok: false, error: 'invalid JSON body' }, 400);
  }

  const participantKey = String(body?.participant_key || '').trim();
  const displayName = String(body?.display_name || '').trim();
  const roleClass = String(body?.role_class || '').trim();
  const assignedBy = String(body?.assigned_by || '').trim();
  const sourceAuthority = String(body?.source_authority || '').trim();
  const capabilitySummary = body?.capability_summary != null ? String(body.capability_summary) : null;
  const credential = body?.credential != null ? String(body.credential) : null;

  if (!participantKey || !displayName || !assignedBy || !sourceAuthority) {
    return json(
      { ok: false, error: 'participant_key, display_name, assigned_by, and source_authority are required' },
      400,
    );
  }
  if (!isValidRoleClass(roleClass)) {
    return json({ ok: false, error: `invalid role_class: ${roleClass}` }, 400);
  }
  if (credential != null && credential.length < 16) {
    return json({ ok: false, error: 'credential must be at least 16 characters' }, 400);
  }

  const credentialHash = credential ? await hashCredential(credential) : null;

  try {
    await d1.db
      .prepare(
        `INSERT INTO chatterbox_participants
           (participant_key, display_name, role_class, capability_summary, assigned_by, source_authority, credential_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(participantKey, displayName, roleClass, capabilitySummary, assignedBy, sourceAuthority, credentialHash)
      .run();
  } catch (error: any) {
    const message = String(error?.message ?? error);
    if (/unique|constraint/i.test(message) && /participant_key/i.test(message)) {
      return json({ ok: false, error: `participant_key already registered: ${participantKey}` }, 409);
    }
    if (/unique|constraint/i.test(message)) {
      return json({ ok: false, error: 'credential already in use by another participant' }, 409);
    }
    throw error;
  }

  const row = await d1.db
    .prepare(
      'SELECT id, participant_key, display_name, role_class, capability_summary, assigned_by, source_authority, effective_at, revoked_at, created_at, updated_at, (credential_hash IS NOT NULL) AS has_credential FROM chatterbox_participants WHERE participant_key = ?',
    )
    .bind(participantKey)
    .first();

  return json({ ok: true, participant: row }, 201);
};
