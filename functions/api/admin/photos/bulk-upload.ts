// POST /api/admin/photos/bulk-upload (#4709 slice 1)
// One file per request. Admin session only. Lands unpublished (rights hold).
// No page, no migration. Production B2/D1 only when the environment provides them;
// tests use fakes and never call Production.
//
// photos schema (no new columns): photo_id holds the content SHA (exact dedup);
// url is the B2 object URL; batch id / credit / flags / phash live in tags + rights_notes.

import { requireAdmin } from '../../../_lib/auth';
import { requireB2, putB2Object, type B2Bindings } from '../../../_lib/b2';
import {
  BULK_PHOTO_LGFC_CREDIT,
  classifyBulkScreenshot,
  decideBulkPhotoRights,
  flagFlatCopyLookAlike,
  isHeicFileName,
  isValidBulkBatchId,
} from '../../../_lib/bulk-photo-upload-checks';
import { requireD1, requireTables, jsonResponse } from '../../../_lib/d1';
import { computePerceptualHash } from '../../../_lib/perceptual-hash';
import { validatePhotoUpload } from '../../../_lib/photo-upload-validation';
import { sha256Hex } from '../../../_lib/b2-ingest-validation';

const HEIC_MESSAGE =
  'HEIC/HEIF uploads are not accepted. Convert to JPEG or PNG and try again.';

function asTrimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** Same path-style URL shape as putB2Object uses (b2ObjectUrl is not exported). */
function bulkB2ObjectUrl(cfg: B2Bindings, key: string): string {
  const pathBucket = cfg.B2_BUCKET.split('/').map(encodeURIComponent).join('/');
  const pathKey = key.split('/').map(encodeURIComponent).join('/');
  return `${cfg.B2_ENDPOINT}/${pathBucket}/${pathKey}`;
}

function buildTags(input: {
  batchId: string;
  perceptualHash: string | null;
  screenshotVerdict: string;
  flatCopyFlagged: boolean;
}): string {
  const parts = [
    `bulk_batch:${input.batchId}`,
    input.perceptualHash ? `phash:${input.perceptualHash}` : null,
    `screenshot:${input.screenshotVerdict}`,
    input.flatCopyFlagged ? 'flat_copy_review' : null,
  ].filter(Boolean);
  return parts.join(',');
}

function buildRightsNotes(input: {
  batchId: string;
  b2Key: string;
  rightsClass: string;
  rightsHolder: string | null;
  creditLine: string | null;
  screenshotVerdict: string;
  screenshotReasons: string[];
  flatCopyFlagged: boolean;
  flatCopyReasons: string[];
  identicalPhashPhotoId: number | null;
}): string {
  return JSON.stringify({
    bulk_batch_id: input.batchId,
    b2_key: input.b2Key,
    rights_class: input.rightsClass,
    rights_holder: input.rightsHolder,
    credit_line: input.creditLine,
    screenshot: input.screenshotVerdict,
    screenshot_reasons: input.screenshotReasons,
    flat_copy_flagged: input.flatCopyFlagged,
    flat_copy_reasons: input.flatCopyReasons,
    // Identical phash only in slice 1; Hamming-threshold site-wide match is slice 3 (#4707).
    identical_phash_photo_id: input.identicalPhashPhotoId,
    unpublished: true,
  });
}

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireTables(d1.db, ['photos']);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  const b2 = requireB2(env);
  if (!b2.ok) return b2.response;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonResponse({ ok: false, error: 'multipart_form_required' }, 400);
  }

  const file = form.get('file');
  const batchId = asTrimmed(form.get('batch_id'));
  const rightsClass = form.get('rights_class');
  const source = form.get('source');

  if (!batchId) {
    return jsonResponse({ ok: false, error: 'batch_id is required.' }, 400);
  }
  if (!isValidBulkBatchId(batchId)) {
    return jsonResponse({
      ok: false,
      error: 'batch_id must be 1–64 characters of A–Z, a–z, 0–9, ".", "_", or "-".',
      code: 'invalid_batch_id',
    }, 400);
  }
  if (!(file instanceof File)) {
    return jsonResponse({ ok: false, error: 'file is required.' }, 400);
  }

  const fileName = file.name || 'upload.bin';
  if (isHeicFileName(fileName)) {
    return jsonResponse({ ok: false, error: HEIC_MESSAGE, code: 'heic_refused' }, 400);
  }

  const rights = decideBulkPhotoRights({ rightsClass, source });
  if ('ok' in rights && rights.ok === false) {
    return jsonResponse({ ok: false, error: rights.error }, 400);
  }
  const rightsDecision = rights as Exclude<typeof rights, { ok: false }>;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const validated = validatePhotoUpload({ bytes, declaredMimeType: file.type });
  if (!validated.ok) {
    return jsonResponse({ ok: false, error: validated.error, code: validated.code }, 400);
  }

  const screenshot = classifyBulkScreenshot({
    fileName,
    format: validated.format,
    dimensions: validated.dimensions,
    bytes,
  });
  if (screenshot.verdict === 'deny') {
    return jsonResponse({
      ok: false,
      error: 'Strong screenshot clues rejected this file.',
      code: 'screenshot_denied',
      reasons: screenshot.reasons,
    }, 400);
  }

  const flatCopy = flagFlatCopyLookAlike(fileName);
  const contentSha = await sha256Hex(bytes);

  const exact = await d1.db
    .prepare('SELECT id FROM photos WHERE photo_id = ? LIMIT 1')
    .bind(contentSha)
    .first()
    .catch(() => null);
  if (exact?.id) {
    return jsonResponse({
      ok: true,
      status: 'exact_duplicate_skipped',
      existing_id: exact.id,
      batch_id: batchId,
    }, 200);
  }

  let perceptualHash: string | null = null;
  try {
    perceptualHash = await computePerceptualHash(bytes);
  } catch {
    perceptualHash = null;
  }

  // Slice 1: identical phash only (exact tag match). Site-wide Hamming threshold is #4707.
  let identicalPhashPhotoId: number | null = null;
  if (perceptualHash) {
    const sameHash = await d1.db
      .prepare(
        `SELECT id FROM photos WHERE tags LIKE ? LIMIT 1`,
      )
      .bind(`%phash:${perceptualHash}%`)
      .first()
      .catch(() => null);
    if (sameHash?.id) {
      identicalPhashPhotoId = Number(sameHash.id);
    }
  }

  const ext = validated.format === 'jpeg' ? 'jpg' : validated.format;
  const key = `bulk/${batchId}/${contentSha.slice(0, 16)}.${ext}`;
  try {
    await putB2Object(b2.cfg, { key, body: bytes, contentType: validated.mimeType });
  } catch (err: unknown) {
    console.error('bulk-upload B2 put failed', err);
    return jsonResponse({
      ok: false,
      error: 'b2_put_failed',
      detail: err instanceof Error ? err.message : String(err),
    }, 502);
  }

  const url = bulkB2ObjectUrl(b2.cfg, key);
  const sourceValue =
    rightsDecision.rightsClass === 'lgfc_collection'
      ? rightsDecision.creditLine ?? BULK_PHOTO_LGFC_CREDIT
      : rightsDecision.source;
  const tags = buildTags({
    batchId,
    perceptualHash,
    screenshotVerdict: screenshot.verdict,
    flatCopyFlagged: flatCopy.flagged,
  });
  const rightsNotes = buildRightsNotes({
    batchId,
    b2Key: key,
    rightsClass: rightsDecision.rightsClass,
    rightsHolder: rightsDecision.rightsHolder,
    creditLine: rightsDecision.creditLine,
    screenshotVerdict: screenshot.verdict,
    screenshotReasons: screenshot.reasons,
    flatCopyFlagged: flatCopy.flagged,
    flatCopyReasons: flatCopy.reasons,
    identicalPhashPhotoId,
  });

  const insert = await d1.db
    .prepare(
      `INSERT INTO photos (
        photo_id, url, source, description, tags, rights_notes,
        rights_hold, rights_hold_reason, publication_eligible, rights_status,
        is_memorabilia, is_matchup_eligible
      ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, 0, 'unreviewed', 0, 0)`,
    )
    .bind(
      contentSha,
      url,
      sourceValue,
      fileName,
      tags,
      rightsNotes,
      'bulk_upload_unpublished',
    )
    .run();

  const id = Number((insert as { meta?: { last_row_id?: number } })?.meta?.last_row_id ?? 0);

  return jsonResponse({
    ok: true,
    status: 'stored_unpublished',
    id: id || null,
    batch_id: batchId,
    b2_key: key,
    photo_id: contentSha,
    screenshot: screenshot.verdict,
    screenshot_reasons: screenshot.reasons,
    flat_copy_flagged: flatCopy.flagged,
    flat_copy_reasons: flatCopy.reasons,
    identical_phash_photo_id: identicalPhashPhotoId,
    rights_class: rightsDecision.rightsClass,
    credit_line: rightsDecision.creditLine,
    rights_hold: true,
    publication_eligible: false,
  }, 201);
};
