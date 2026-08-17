// POST /api/admin/content-pipeline/ingest
// #3551 steps 6-7: fetches an already rights-cleared candidate's approved
// original directly from its allowlisted source, validates it, writes it to
// B2 under the LGFC_ new-intake prefix, and commits the D1 media_assets/
// content_items link. Protected by ADMIN_TOKEN.
//
// Refuses to run unless the candidate already has a recorded rights_evidence
// conclusion (#3551's core safety rule: rights conclusions and publish
// approval may not be automated -- this endpoint only ever executes a
// conclusion a human already recorded through the rights-evidence API).

import { requireB2, putB2Object } from '../../../_lib/b2';
import {
  INGEST_CONTENT_TYPE_EXTENSIONS,
  sha256Hex,
  validateIngestContentType,
  validateIngestMagicBytes,
  validateIngestSize,
  validateIngestSourceUrl,
} from '../../../_lib/b2-ingest-validation';
import { buildNewIntakeKey } from '../../../_lib/content-pipeline-media-key';
import {
  getCandidateByCandidateId,
  requireContentPipelineCandidateTables,
} from '../../../_lib/content-pipeline-candidate-repository';
import { commitIngestedMedia } from '../../../_lib/media-ingest-repository';
import { getCurrentConclusionForCandidate, requireRightsEvidenceTables } from '../../../_lib/rights-evidence-repository';
import { requireAdmin } from '../../../_lib/auth';
import { jsonResponse, requireD1, requireTables } from '../../../_lib/d1';

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

async function loadApprovedSourceDomains(db: any): Promise<Set<string>> {
  const rows = await db
    .prepare(`SELECT source_domain FROM sources WHERE source_trust_status = 'trusted'`)
    .all();
  return new Set(
    ((rows.results ?? []) as Array<{ source_domain: string | null }>)
      .map((row) => (row.source_domain || '').trim().toLowerCase())
      .filter(Boolean),
  );
}

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const b2 = requireB2(env);
  if (!b2.ok) return b2.response;

  const candidateTables = await requireContentPipelineCandidateTables(d1.db);
  if (!candidateTables.ok) return jsonResponse(candidateTables.body, candidateTables.status);
  const evidenceTables = await requireRightsEvidenceTables(d1.db);
  if (!evidenceTables.ok) return jsonResponse(evidenceTables.body, evidenceTables.status);
  const mediaTables = await requireTables(d1.db, ['media_assets', 'sources']);
  if (!mediaTables.ok) return jsonResponse(mediaTables.body, mediaTables.status);

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return jsonResponse({ ok: false, error: 'Request body must be a JSON object.' }, 400);
    }
    const record = body as Record<string, unknown>;
    const candidateId = asTrimmedString(record.candidate_id);
    const sourceFetchUrl = asTrimmedString(record.source_fetch_url);
    if (!candidateId) {
      return jsonResponse({ ok: false, error: 'candidate_id is required.' }, 400);
    }
    if (!sourceFetchUrl) {
      return jsonResponse({ ok: false, error: 'source_fetch_url is required.' }, 400);
    }

    const candidate = await getCandidateByCandidateId(d1.db, candidateId);
    if (!candidate) {
      return jsonResponse({ ok: false, error: 'Candidate not found.' }, 404);
    }

    const conclusion = await getCurrentConclusionForCandidate(d1.db, candidate.id);
    if (!conclusion) {
      return jsonResponse(
        { ok: false, error: 'Candidate has no recorded rights_evidence conclusion. Record one before ingesting.' },
        409,
      );
    }

    const approvedDomains = await loadApprovedSourceDomains(d1.db);
    const urlCheck = validateIngestSourceUrl(sourceFetchUrl, approvedDomains);
    if (!urlCheck.ok) {
      return jsonResponse({ ok: false, error: urlCheck.error }, 400);
    }

    let sourceResponse: Response;
    try {
      sourceResponse = await fetch(sourceFetchUrl, {
        headers: { 'User-Agent': 'LGFC-Gehrig-Content-Ingest/1.0 (lougehrigfanclub.com; contact via site)' },
      });
    } catch (err: any) {
      return jsonResponse({ ok: false, error: `Failed to fetch source_fetch_url: ${String(err?.message || err)}` }, 502);
    }
    if (!sourceResponse.ok) {
      return jsonResponse({ ok: false, error: `source_fetch_url returned HTTP ${sourceResponse.status}.` }, 502);
    }

    // fetch() follows redirects by default, so a request that started on an
    // allowlisted host could have been redirected to an untrusted one --
    // re-check the URL actually served, not just the one requested.
    const finalUrlCheck = validateIngestSourceUrl(sourceResponse.url, approvedDomains);
    if (!finalUrlCheck.ok) {
      return jsonResponse(
        { ok: false, error: `source_fetch_url redirected off the allowlist: ${finalUrlCheck.error}` },
        400,
      );
    }

    const contentType = sourceResponse.headers.get('content-type');
    const contentTypeCheck = validateIngestContentType(contentType);
    if (!contentTypeCheck.ok) {
      return jsonResponse({ ok: false, error: contentTypeCheck.error }, 422);
    }
    const normalizedContentType = (contentType || '').split(';')[0].trim().toLowerCase();

    const bodyBuffer = await sourceResponse.arrayBuffer();
    const sizeCheck = validateIngestSize(bodyBuffer.byteLength);
    if (!sizeCheck.ok) {
      return jsonResponse({ ok: false, error: sizeCheck.error }, 422);
    }

    const bytes = new Uint8Array(bodyBuffer);
    const magicCheck = validateIngestMagicBytes(normalizedContentType, bytes);
    if (!magicCheck.ok) {
      return jsonResponse({ ok: false, error: magicCheck.error }, 422);
    }

    const checksum = await sha256Hex(bytes);
    const mediaUid = `sha256_${checksum.slice(0, 40)}`;
    const extension = INGEST_CONTENT_TYPE_EXTENSIONS[normalizedContentType] ?? 'bin';
    // Keyed by content checksum only (not candidate_id): two candidates that
    // happen to resolve to identical bytes must land on the same B2 object,
    // matching media_assets.media_uid's global uniqueness. Keying by
    // candidate_id as well would let a second candidate's ingest skip the B2
    // write (media_uid already exists) while still linking to a key that
    // was never actually written for it.
    const b2Key = buildNewIntakeKey(`${mediaUid}.${extension}`);

    let etag: string | null = null;
    const alreadyInB2 = await d1.db
      .prepare('SELECT media_uid FROM media_assets WHERE media_uid = ? LIMIT 1')
      .bind(mediaUid)
      .first();
    if (!alreadyInB2) {
      const putResult = await putB2Object(b2.cfg, {
        key: b2Key,
        body: bytes,
        contentType: normalizedContentType,
      });
      etag = putResult.etag;
    }

    const result = await commitIngestedMedia(d1.db, {
      candidateId: candidate.id,
      candidateExternalId: candidateId,
      mediaUid,
      b2Key,
      size: bytes.byteLength,
      etag,
      reviewer: conclusion.reviewer ?? 'unknown',
      conclusion: conclusion.conclusion ?? 'unknown',
    });

    return jsonResponse(
      {
        ok: true,
        candidate_id: candidateId,
        media_uid: result.mediaUid,
        b2_key: result.b2Key,
        content_type: normalizedContentType,
        size: bytes.byteLength,
        checksum_sha256: checksum,
        already_ingested: result.alreadyExisted,
        conclusion: conclusion.conclusion,
      },
      200,
    );
  } catch (err: any) {
    console.error('admin content-pipeline ingest error:', err);
    return jsonResponse({ ok: false, error: 'Ingestion failed.', detail: String(err?.message || err) }, 500);
  }
};
