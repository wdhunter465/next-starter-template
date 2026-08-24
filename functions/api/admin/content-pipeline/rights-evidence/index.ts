// GET/POST /api/admin/content-pipeline/rights-evidence
// Lists or records rights evidence for a #3552 content pipeline candidate.
// Protected by an authenticated D1 admin member session (requireAdmin). Recording a conclusion here is the only way a
// candidate's rights determination advances -- nothing does this automatically.

import { isValidCandidateId, parseRecordRightsEvidenceRequest } from '../../../../_lib/rights-evidence-admin';
import { getCandidateByCandidateId } from '../../../../_lib/content-pipeline-candidate-repository';
import { requireContentPipelineCandidateTables } from '../../../../_lib/content-pipeline-candidate-repository';
import {
  RIGHTS_EVIDENCE_CHANNELS,
  getCurrentConclusionForCandidate,
  getCurrentConclusionForCandidateChannel,
  listRightsEvidenceForCandidate,
  recordRightsEvidence,
  requireRightsEvidenceTables,
  type RightsEvidenceChannel,
  type StoredRightsEvidence,
} from '../../../../_lib/rights-evidence-repository';
import { requireAdmin } from '../../../../_lib/auth';
import { jsonResponse, requireD1 } from '../../../../_lib/d1';
import { CANDIDATE_ID_VALIDATION_MESSAGE } from '../../../../_lib/rights-evidence-admin';

async function resolveCurrentConclusionByChannel(
  db: any,
  contentItemId: number,
): Promise<Record<RightsEvidenceChannel, StoredRightsEvidence | null>> {
  const entries = await Promise.all(
    RIGHTS_EVIDENCE_CHANNELS.map(async (channel) => {
      const conclusion = await getCurrentConclusionForCandidateChannel(db, contentItemId, channel);
      return [channel, conclusion] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<RightsEvidenceChannel, StoredRightsEvidence | null>;
}

async function resolveSourceId(db: any, sourceDomain: string | undefined): Promise<number | null> {
  if (!sourceDomain) return null;
  const row = await db
    .prepare('SELECT id FROM sources WHERE source_domain = ? LIMIT 1')
    .bind(sourceDomain)
    .first();
  return row ? Number((row as { id: number }).id) : null;
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
    const candidateId = url.searchParams.get('candidate_id')?.trim() || '';
    if (!candidateId || !isValidCandidateId(candidateId)) {
      return jsonResponse({ ok: false, error: CANDIDATE_ID_VALIDATION_MESSAGE }, 400);
    }

    const candidate = await getCandidateByCandidateId(d1.db, candidateId, { includeDeleted: true });
    if (!candidate) {
      return jsonResponse({ ok: false, error: 'Candidate not found.' }, 404);
    }

    const [evidence, currentConclusion, currentConclusionByChannel] = await Promise.all([
      listRightsEvidenceForCandidate(d1.db, candidate.id),
      getCurrentConclusionForCandidate(d1.db, candidate.id),
      resolveCurrentConclusionByChannel(d1.db, candidate.id),
    ]);

    return jsonResponse(
      {
        ok: true,
        candidate_id: candidateId,
        // Informational/overview only -- do not gate on this. See
        // current_conclusion_by_channel for the authoritative per-channel
        // status (#3551's 2026-08-18 channel-scoping directive).
        current_conclusion: currentConclusion,
        current_conclusion_by_channel: currentConclusionByChannel,
        evidence,
      },
      200,
    );
  } catch (err: any) {
    console.error('admin rights-evidence list error:', err);
    return jsonResponse({ ok: false, error: 'Rights evidence query failed.' }, 500);
  }
};

export const onRequestPost = async (context: any): Promise<Response> => {
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
    const body = await request.json().catch(() => null);
    const parsed = parseRecordRightsEvidenceRequest(body);
    if (!parsed.ok) {
      return jsonResponse({ ok: false, error: parsed.error }, 400);
    }

    const { candidate_id, source_domain, ...evidenceInput } = parsed.request;
    const candidate = await getCandidateByCandidateId(d1.db, candidate_id, { includeDeleted: true });
    if (!candidate) {
      return jsonResponse({ ok: false, error: 'Candidate not found.' }, 404);
    }

    const sourceId = await resolveSourceId(d1.db, source_domain);
    if (source_domain && sourceId === null) {
      return jsonResponse({ ok: false, error: `Unknown source_domain: ${source_domain}` }, 400);
    }

    const stored = await recordRightsEvidence(d1.db, {
      ...evidenceInput,
      content_item_id: candidate.id,
      source_id: sourceId,
    });

    return jsonResponse({ ok: true, candidate_id, evidence: stored }, 201);
  } catch (err: any) {
    console.error('admin rights-evidence record error:', err);
    return jsonResponse({ ok: false, error: 'Rights evidence record failed.' }, 500);
  }
};
