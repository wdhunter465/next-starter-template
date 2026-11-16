// POST /api/admin/adam-wilson/save
// Body: { id?, kind, title, body_md?, status? (draft|reviewed), honoree_consent?, notes? }
// Creates or updates a private Adam Wilson award staging item (#4876, child of #2078). Admin session only.
// There is no publish path: status cannot be 'published' (validation and a table CHECK both refuse it).

import { requireAdmin } from '../../../_lib/auth';
import { validateAwardStagingInput, type AwardContext } from '../../../_lib/adam-wilson-staging';

function json(res: unknown, status = 200): Response {
  return new Response(JSON.stringify(res, null, 2), { status, headers: { 'Content-Type': 'application/json' } });
}

export const onRequestPost = async (context: AwardContext): Promise<Response> => {
  const { request, env } = context;
  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  try {
    const raw = await request.json().catch(() => ({}));
    const parsed = validateAwardStagingInput(raw);
    if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);
    const v = parsed.value;
    const createdBy = String((raw as { updated_by?: unknown })?.updated_by || 'admin').trim().slice(0, 100) || 'admin';

    if (v.id === null) {
      const result = await env.DB.prepare(
        `INSERT INTO award_staging_items (kind, title, body_md, status, honoree_consent, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
        .bind(v.kind, v.title, v.body_md, v.status, v.honoree_consent, v.notes, createdBy)
        .run();
      return json({ ok: true, id: result.meta?.last_row_id ?? null, created: true });
    }

    const result = await env.DB.prepare(
      `UPDATE award_staging_items
       SET kind = ?, title = ?, body_md = ?, status = ?, honoree_consent = ?, notes = ?,
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = ?`,
    )
      .bind(v.kind, v.title, v.body_md, v.status, v.honoree_consent, v.notes, v.id)
      .run();
    if ((result.meta?.changes ?? 0) === 0) return json({ ok: false, error: 'Item not found.' }, 404);
    return json({ ok: true, id: v.id, created: false });
  } catch (err) {
    console.error('admin adam-wilson save error:', err);
    return json({ ok: false, error: 'Save failed.' }, 500);
  }
};
