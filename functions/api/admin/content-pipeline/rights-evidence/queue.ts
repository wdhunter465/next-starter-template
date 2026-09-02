// GET /api/admin/content-pipeline/rights-evidence/queue
// #3827: curator-facing hold queue -- content items whose most recent
// rights_evidence row is still usage_decision = 'hold'. Read-only; resolving
// an item goes through the existing POST /api/admin/content-pipeline/rights-evidence,
// which records a new append-only row rather than mutating the held one.
// Protected by an authenticated D1 admin member session (requireAdmin).

import { requireContentPipelineCandidateTables } from '../../../../_lib/content-pipeline-candidate-repository';
import { listHoldQueue, requireRightsEvidenceTables } from '../../../../_lib/rights-evidence-repository';
import { requireAdmin } from '../../../../_lib/auth';
import { jsonResponse, requireD1 } from '../../../../_lib/d1';

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const candidateTables = await requireContentPipelineCandidateTables(d1.db);
  if (!candidateTables.ok) return jsonResponse(candidateTables.body, candidateTables.status);
  const evidenceTables = await requireRightsEvidenceTables(d1.db);
  if (!evidenceTables.ok) return jsonResponse(evidenceTables.body, evidenceTables.status);

  try {
    const url = new URL(request.url);
    const limit = parsePositiveInt(url.searchParams.get('limit'), 50);
    const offset = parsePositiveInt(url.searchParams.get('offset'), 1) - 1;

    const items = await listHoldQueue(d1.db, { limit, offset: Math.max(offset, 0) });

    return jsonResponse({ ok: true, count: items.length, items }, 200);
  } catch (err: any) {
    console.error('admin rights-evidence hold queue error:', err);
    return jsonResponse({ ok: false, error: 'Hold queue query failed.' }, 500);
  }
};
