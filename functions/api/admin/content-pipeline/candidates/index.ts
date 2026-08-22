// GET /api/admin/content-pipeline/candidates
// Lists or fetches LGFC content pipeline candidates. Protected by an authenticated D1 admin member session (requireAdmin).

import {
  isValidCandidateId,
  parseCandidateListQuery,
  serializeAdminMediaReferences,
  serializeCandidateForAdminReview,
  CANDIDATE_ID_VALIDATION_MESSAGE,
} from '../../../../_lib/content-pipeline-candidate-admin';
import {
  getCandidateByCandidateId,
  getUploadedMediaReferenceForCandidate,
  listCandidates,
} from '../../../../_lib/content-pipeline-candidate-repository';
import { requireContentPipelineAdminCandidateMediaTables } from '../../../../_lib/content-pipeline-media-reference';
import { requireAdmin } from '../../../../_lib/auth';
import { jsonResponse, requireD1 } from '../../../../_lib/d1';

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireContentPipelineAdminCandidateMediaTables(d1.db);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const url = new URL(request.url);
    const candidateId = url.searchParams.get('candidate_id')?.trim() || '';

    if (candidateId) {
      if (!isValidCandidateId(candidateId)) {
        return jsonResponse({ ok: false, error: CANDIDATE_ID_VALIDATION_MESSAGE }, 400);
      }

      const includeDeleted =
        url.searchParams.get('include_deleted') === '1' ||
        url.searchParams.get('include_deleted') === 'true';
      const candidate = await getCandidateByCandidateId(d1.db, candidateId, { includeDeleted });
      if (!candidate) {
        return jsonResponse({ ok: false, error: 'Candidate not found.' }, 404);
      }
      const uploadedMediaReference = await getUploadedMediaReferenceForCandidate(d1.db, candidate.id);
      return jsonResponse(
        {
          ok: true,
          candidate: serializeCandidateForAdminReview(
            candidate as unknown as Record<string, unknown>,
            serializeAdminMediaReferences(candidate as unknown as Record<string, unknown>, uploadedMediaReference),
          ),
        },
        200,
      );
    }

    const parsed = parseCandidateListQuery(url);
    if (!parsed.ok) {
      return jsonResponse({ ok: false, error: parsed.error }, 400);
    }

    const candidates = await listCandidates(d1.db, parsed.filter);
    return jsonResponse(
      {
        ok: true,
        count: candidates.length,
        candidates: candidates.map((candidate) =>
          serializeCandidateForAdminReview(
            candidate as unknown as Record<string, unknown>,
            serializeAdminMediaReferences(candidate as unknown as Record<string, unknown>),
          ),
        ),
      },
      200,
    );
  } catch (err: any) {
    console.error('admin content-pipeline candidates error:', err);
    return jsonResponse({ ok: false, error: 'Candidate query failed.' }, 500);
  }
};
