// POST /api/admin/content-pipeline/candidates/media-reference
// Updates review-safe media reference fields on pipeline candidates (#2319).

import {
  parseAdminMediaReferenceUpdate,
  requireContentPipelineMediaReferenceTables,
  serializeAdminMediaReferences,
  serializeCandidateForAdminReview,
} from '../../../../_lib/content-pipeline-media-reference';
import {
  getUploadedMediaReferenceForCandidate,
  isMemberSubmissionMediaReferenceMissingError,
  updateCandidateMediaReferences,
} from '../../../../_lib/content-pipeline-candidate-repository';
import { requireAdmin } from '../../../../_lib/auth';
import { jsonResponse, requireD1 } from '../../../../_lib/d1';

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireContentPipelineMediaReferenceTables(d1.db);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const body = await request.json().catch(() => null);
    const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
    const parsed = parseAdminMediaReferenceUpdate(body);
    if (!parsed.ok) {
      return jsonResponse({ ok: false, error: parsed.error }, 400);
    }

    const actor = typeof record.actor === 'string' ? record.actor.trim() : undefined;
    const notes = typeof record.notes === 'string' ? record.notes.trim() : undefined;

    const updated = await updateCandidateMediaReferences(
      d1.db,
      parsed.request.candidate_id,
      {
        media_asset_id: parsed.request.media_asset_id,
        uploaded_media_reference: parsed.request.uploaded_media_reference,
      },
      { actor, notes },
    );

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
  } catch (err: unknown) {
    if (isMemberSubmissionMediaReferenceMissingError(err)) {
      return jsonResponse({ ok: false, error: err.message }, 400);
    }
    console.error('admin content-pipeline media-reference error:', err);
    return jsonResponse({ ok: false, error: 'Media reference update failed.' }, 500);
  }
};
