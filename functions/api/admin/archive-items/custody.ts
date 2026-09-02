// POST /api/admin/archive-items/custody
// #2073 Work Package item 4 (#4061): custody-state transitions.
// PMO/ops-operated per #4059 decision 2 -- requireAdmin gated, not
// self-service. Protected by an authenticated D1 admin member session.

import {
  InvalidCustodyTransitionError,
  requireArchiveItemsTables,
  serializeArchiveItemForAdmin,
  updateCustodyState,
} from '../../../_lib/archive-items-repository';
import { parseUpdateCustodyStateRequest } from '../../../_lib/archive-items-admin';
import { requireAdmin } from '../../../_lib/auth';
import { jsonResponse, requireD1 } from '../../../_lib/d1';

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireArchiveItemsTables(d1.db);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const body = await request.json().catch(() => null);
    const parsed = parseUpdateCustodyStateRequest(body);
    if (!parsed.ok) {
      return jsonResponse({ ok: false, error: parsed.error }, 400);
    }

    const item = await updateCustodyState(d1.db, {
      archiveItemId: parsed.request.archive_item_id,
      toState: parsed.request.to_state,
      actor: parsed.request.actor,
      note: parsed.request.note,
    });

    return jsonResponse({ ok: true, item: serializeArchiveItemForAdmin(item) }, 200);
  } catch (err: any) {
    if (err instanceof InvalidCustodyTransitionError) {
      return jsonResponse({ ok: false, error: err.message }, 400);
    }
    if (String(err?.message || '').includes('not found')) {
      return jsonResponse({ ok: false, error: 'Archive item not found.' }, 404);
    }
    console.error('admin archive-items custody error:', err);
    return jsonResponse({ ok: false, error: 'Custody state update failed.' }, 500);
  }
};
