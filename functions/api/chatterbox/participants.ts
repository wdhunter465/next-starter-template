// /api/chatterbox/participants — #3415 Chatterbox prototype.
// GET: list participants (optionally filtered by role_class).
// POST: register a participant. Chatterbox records role assignments; it
// does not invent the authority behind them (review point 9 / definition
// comment 5280229024) — assigned_by and source_authority are required so
// every assignment cites the repository-governance record that permits it.
// Protected by ADMIN_TOKEN.

import { requireAdmin } from '../../_lib/auth';
import { requireD1 } from '../../_lib/d1';
import { isValidRoleClass } from '../../_lib/chatterbox';

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { 'Content-Type': 'application/json' } });
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;
  const deny = requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return json(d1.body, d1.status);

  const url = new URL(request.url);
  const roleClass = String(url.searchParams.get('role_class') || '').trim();

  const rows = roleClass
    ? await d1.db
        .prepare('SELECT * FROM chatterbox_participants WHERE role_class = ? ORDER BY created_at ASC')
        .bind(roleClass)
        .all()
    : await d1.db.prepare('SELECT * FROM chatterbox_participants ORDER BY created_at ASC').bind().all();

  return json({ ok: true, participants: rows.results ?? [] });
};

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;
  const deny = requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return json(d1.body, d1.status);

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

  if (!participantKey || !displayName || !assignedBy || !sourceAuthority) {
    return json(
      { ok: false, error: 'participant_key, display_name, assigned_by, and source_authority are required' },
      400,
    );
  }
  if (!isValidRoleClass(roleClass)) {
    return json({ ok: false, error: `invalid role_class: ${roleClass}` }, 400);
  }

  try {
    await d1.db
      .prepare(
        `INSERT INTO chatterbox_participants
           (participant_key, display_name, role_class, capability_summary, assigned_by, source_authority)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(participantKey, displayName, roleClass, capabilitySummary, assignedBy, sourceAuthority)
      .run();
  } catch (error: any) {
    const message = String(error?.message ?? error);
    if (/unique|constraint/i.test(message)) {
      return json({ ok: false, error: `participant_key already registered: ${participantKey}` }, 409);
    }
    throw error;
  }

  const row = await d1.db
    .prepare('SELECT * FROM chatterbox_participants WHERE participant_key = ?')
    .bind(participantKey)
    .first();

  return json({ ok: true, participant: row }, 201);
};
