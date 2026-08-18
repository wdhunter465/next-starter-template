// POST /api/admin/content-pipeline/candidates/review
// Applies allowed review-state updates to a content pipeline candidate.

import {
  parseCandidateReviewRequest,
  serializeAdminMediaReferences,
  serializeCandidateForAdminReview,
} from '../../../../_lib/content-pipeline-candidate-admin';
import {
  getUploadedMediaReferenceForCandidate,
  updateCandidateReviewState,
} from '../../../../_lib/content-pipeline-candidate-repository';
import { requireContentPipelineAdminCandidateMediaTables } from '../../../../_lib/content-pipeline-media-reference';
import { requireAdmin } from '../../../../_lib/auth';
import { jsonResponse, requireD1 } from '../../../../_lib/d1';

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireContentPipelineAdminCandidateMediaTables(d1.db);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const body = await request.json().catch(() => null);
    const parsed = parseCandidateReviewRequest(body);
    if (!parsed.ok) {
      return jsonResponse({ ok: false, error: parsed.error }, 400);
    }

    const { candidate_id, actor, notes, ...update } = parsed.request;
    const updated = await updateCandidateReviewState(d1.db, candidate_id, update, { actor, notes });
    if (!updated) {
      return jsonResponse({ ok: false, error: 'Candidate not found.' }, 404);
    }

    const uploadedMediaReference = await getUploadedMediaReferenceForCandidate(d1.db, updated.id);
    return jsonResponse(
      {
        ok: true,
        candidate: serializeCandidateForAdminReview(
          updated as unknown as Record<string, unknown>,
          serializeAdminMediaReferences(updated as unknown as Record<string, unknown>, uploadedMediaReference),
        ),
      },
      200,
    );
  } catch (err: any) {
    console.error('admin content-pipeline candidate review error:', err);
    return jsonResponse({ ok: false, error: 'Candidate review update failed.' }, 500);
  }
};
