// POST /api/fanclub/photos/upload
// #3552/#3553 Path C: an authenticated member uploads their own photo,
// attesting they own the rights to it. This endpoint captures that
// attestation and writes the file to B2 -- it never grants publish
// approval itself. The submission lands with member_submissions
// consent_status='pending' and media_assets.rights_hold left at its
// column default (held); an admin must separately review it (the same
// "read the evidence, then decide" review flow Path B already uses) before
// it can ever become visible on the live site. See
// functions/_lib/member-photo-submission-repository.ts for the core safety
// rule this preserves.

import { requireMember } from "../../../_lib/session";
import { jsonResponse } from "../../../_lib/d1";
import { requireB2, putB2Object } from "../../../_lib/b2";
import {
  validateIngestContentType,
  validateIngestMagicBytes,
  validateIngestSize,
  sha256Hex,
  INGEST_CONTENT_TYPE_EXTENSIONS,
} from "../../../_lib/b2-ingest-validation";
import { buildMemberUploadKey } from "../../../_lib/content-pipeline-media-key";
import {
  commitMemberPhotoSubmission,
  requireMemberPhotoSubmissionTables,
  type CreditPreference,
} from "../../../_lib/member-photo-submission-repository";

const CREDIT_PREFERENCES = new Set<CreditPreference>(["public_credit", "anonymous", "private", "custom"]);

function isCreditPreference(value: string): value is CreditPreference {
  return CREDIT_PREFERENCES.has(value as CreditPreference);
}

export const onRequestPost = async (context: any): Promise<Response> => {
  const auth = await requireMember(context);
  if (!auth.ok) {
    return jsonResponse(auth.body, auth.status);
  }

  const tables = await requireMemberPhotoSubmissionTables(auth.db);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  const b2 = requireB2(context.env);
  if (!b2.ok) return b2.response;

  let form: FormData;
  try {
    form = await context.request.formData();
  } catch {
    return jsonResponse({ ok: false, error: "Request must be multipart/form-data." }, 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonResponse({ ok: false, error: "A 'file' field with the image is required." }, 400);
  }

  // The attestation checkbox is the entire legal gate for this endpoint --
  // fail closed if it's missing, unchecked, or anything other than the
  // literal string a checked HTML checkbox sends.
  const attestOwnsRights = String(form.get("attest_owns_rights") ?? "").trim().toLowerCase();
  if (attestOwnsRights !== "true" && attestOwnsRights !== "on") {
    return jsonResponse(
      { ok: false, error: "You must attest that you own the rights to this photo before it can be submitted." },
      400,
    );
  }

  const ownershipStatement = String(form.get("ownership_statement") ?? "").trim();
  const permissionStatement = String(form.get("permission_statement") ?? "").trim();
  const creditPreferenceRaw = String(form.get("credit_preference") ?? "").trim();
  const caption = String(form.get("caption") ?? "").trim() || null;
  const customCreditLine = String(form.get("custom_credit_line") ?? "").trim() || null;
  const submitterName = String(form.get("submitter_name") ?? "").trim();

  if (!ownershipStatement || !permissionStatement || !creditPreferenceRaw || !submitterName) {
    return jsonResponse(
      {
        ok: false,
        error:
          "Fields 'submitter_name', 'ownership_statement', 'permission_statement', and 'credit_preference' are all required",
      },
      400,
    );
  }

  if (!isCreditPreference(creditPreferenceRaw)) {
    return jsonResponse(
      { ok: false, error: `credit_preference must be one of: ${[...CREDIT_PREFERENCES].join(", ")}` },
      400,
    );
  }

  const contentType = file.type;
  const contentTypeCheck = validateIngestContentType(contentType);
  if (!contentTypeCheck.ok) {
    return jsonResponse({ ok: false, error: contentTypeCheck.error }, 422);
  }
  const normalizedContentType = contentType.split(";")[0].trim().toLowerCase();

  const bodyBuffer = await file.arrayBuffer();
  const sizeCheck = validateIngestSize(bodyBuffer.byteLength);
  if (!sizeCheck.ok) {
    return jsonResponse({ ok: false, error: sizeCheck.error }, 422);
  }

  const bytes = new Uint8Array(bodyBuffer);
  const magicCheck = validateIngestMagicBytes(normalizedContentType, bytes);
  if (!magicCheck.ok) {
    return jsonResponse({ ok: false, error: magicCheck.error }, 422);
  }

  try {
    const checksum = await sha256Hex(bytes);
    const mediaUid = `sha256_member_${checksum.slice(0, 40)}`;
    const extension = INGEST_CONTENT_TYPE_EXTENSIONS[normalizedContentType] ?? "bin";
    const b2Key = buildMemberUploadKey(`${mediaUid}.${extension}`);

    let etag: string | null = null;
    const alreadyInB2 = await auth.db
      .prepare("SELECT media_uid FROM media_assets WHERE media_uid = ? LIMIT 1")
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

    const result = await commitMemberPhotoSubmission(auth.db, {
      submitterEmail: auth.email,
      submitterName,
      ownershipStatement,
      permissionStatement,
      creditPreference: creditPreferenceRaw,
      customCreditLine,
      caption,
      mediaUid,
      b2Key,
      size: bytes.byteLength,
      etag,
    });

    return jsonResponse(
      {
        ok: true,
        candidate_id: result.candidateId,
        media_uid: result.mediaUid,
        b2_key: result.b2Key,
        already_existed: result.alreadyExisted,
        message: "Photo submitted for rights review. It will not appear on the site until an admin approves it.",
      },
      200,
    );
  } catch (err: any) {
    console.error("fanclub photo upload error:", err);
    return jsonResponse({ ok: false, error: "Upload failed.", detail: String(err?.message || err) }, 500);
  }
};
