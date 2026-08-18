// POST /api/admin/content-pipeline/search-runs/complete
// Marks a running #3552 search run with a terminal state and result counts.
// Protected by ADMIN_TOKEN.

import { parseCompleteSearchRunRequest } from '../../../../_lib/content-search-run-admin';
import {
  completeSearchRun,
  getSearchRunByUid,
  requireContentSearchRunTables,
} from '../../../../_lib/content-search-run-repository';
import { requireAdmin } from '../../../../_lib/auth';
import { jsonResponse, requireD1 } from '../../../../_lib/d1';

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireContentSearchRunTables(d1.db);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const body = await request.json().catch(() => null);
    const parsed = parseCompleteSearchRunRequest(body);
    if (!parsed.ok) {
      return jsonResponse({ ok: false, error: parsed.error }, 400);
    }

    const existing = await getSearchRunByUid(d1.db, parsed.request.run_uid);
    if (!existing) {
      return jsonResponse({ ok: false, error: 'Search run not found.' }, 404);
    }
    if (existing.status !== 'running') {
      return jsonResponse(
        { ok: false, error: `Search run is already terminal (status: ${existing.status}).` },
        409,
      );
    }

    const { run_uid, ...completeInput } = parsed.request;
    const run = await completeSearchRun(d1.db, run_uid, completeInput);
    return jsonResponse({ ok: true, run }, 200);
  } catch (err: any) {
    console.error('admin search-runs complete error:', err);
    return jsonResponse({ ok: false, error: 'Search run complete failed.' }, 500);
  }
};
