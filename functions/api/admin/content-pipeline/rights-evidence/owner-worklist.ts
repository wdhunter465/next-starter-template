// GET /api/admin/content-pipeline/rights-evidence/owner-worklist
// #4405: automation-first owner-outreach worklist -- discovered candidates
// that still need a human permission decision, grouped by the actual
// copyright owner/creator captured at discovery time, so a curator works
// down a short list of people/institutions to contact instead of reviewing
// hundreds of individual photos one at a time. Read-only; recording an
// owner's response still goes through the existing POST
// /api/admin/content-pipeline/rights-evidence, exactly like every other
// rights decision in this pipeline. Protected by an authenticated D1 admin
// member session (requireAdmin).

import { requireContentPipelineCandidateTables } from '../../../../_lib/content-pipeline-candidate-repository';
import { listOwnerContactWorklist, requireRightsEvidenceTables } from '../../../../_lib/rights-evidence-repository';
import { requireAdmin } from '../../../../_lib/auth';
import { jsonResponse, requireD1 } from '../../../../_lib/d1';

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseNonNegativeInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
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
    const offset = parseNonNegativeInt(url.searchParams.get('offset'), 0);

    const items = await listOwnerContactWorklist(d1.db, { limit, offset });

    return jsonResponse({ ok: true, count: items.length, items }, 200);
  } catch (err: any) {
    console.error('admin rights-evidence owner-worklist error:', err);
    return jsonResponse({ ok: false, error: 'Owner contact worklist query failed.' }, 500);
  }
};
