// GET /api/admin/content-pipeline/publication-prep
// Admin-safe publication preparation views for reviewed candidates. Protected by an authenticated D1 admin member session (requireAdmin).

import {
  CANDIDATE_ID_VALIDATION_MESSAGE,
  getPublicationPrepViewByCandidateId,
  isValidPublicationPrepCandidateId,
  listPublicationPrepViews,
  parsePublicationPrepListQuery,
  requireContentPipelinePublicationPrepTables,
} from '../../../../_lib/content-pipeline-publication-prep';
import { requireAdmin } from '../../../../_lib/auth';
import { jsonResponse, requireD1 } from '../../../../_lib/d1';

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireContentPipelinePublicationPrepTables(d1.db);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const url = new URL(request.url);
    const candidateId = url.searchParams.get('candidate_id')?.trim() || '';

    if (candidateId) {
      if (!isValidPublicationPrepCandidateId(candidateId)) {
        return jsonResponse({ ok: false, error: CANDIDATE_ID_VALIDATION_MESSAGE }, 400);
      }

      const view = await getPublicationPrepViewByCandidateId(d1.db, candidateId);
      if (!view) {
        return jsonResponse({ ok: false, error: 'Candidate not found.' }, 404);
      }

      return jsonResponse({ ok: true, publication_prep: view }, 200);
    }

    const parsed = parsePublicationPrepListQuery(url);
    if (!parsed.ok) {
      return jsonResponse({ ok: false, error: parsed.error }, 400);
    }

    const views = await listPublicationPrepViews(d1.db, parsed.filter);
    return jsonResponse(
      {
        ok: true,
        count: views.length,
        publication_prep: views,
      },
      200,
    );
  } catch (err: any) {
    console.error('admin content-pipeline publication-prep error:', err);
    return jsonResponse({ ok: false, error: 'Publication prep query failed.' }, 500);
  }
};
