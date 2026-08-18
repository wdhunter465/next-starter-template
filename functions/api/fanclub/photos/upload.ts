// POST /api/fanclub/photos/upload
// #3552/#3553 Path C: an authenticated member uploads their own photo and
// picks exactly one of two rights choices -- member_owns_full_grant (clears
// rights immediately, no separate admin step, per explicit product
// direction) or external_source_needs_evaluation (queues it for the same
// copyright-evaluation review Path B's externally-sourced candidates get).
// See functions/_lib/member-photo-submission-repository.ts for the rights
// derivation and the safety rationale.

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
  PHOTO_RIGHTS_CHOICES,
  type CreditPreference,
  type PhotoRightsChoice,
} from "../../../_lib/member-photo-submission-repository";

const CREDIT_PREFERENCES = new Set<CreditPreference>(["public_credit", "anonymous", "private", "custom"]);
const RIGHTS_CHOICE_SET = new Set<string>(PHOTO_RIGHTS_CHOICES);

function isCreditPreference(value: string): value is CreditPreference {
  return CREDIT_PREFERENCES.has(value as CreditPreference);
}

function parseTagList(value: FormDataEntryValue | null): string[] {
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
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

  const rightsChoiceRaw = String(form.get("rights_choice") ?? "").trim();
  const sourceUrl = String(form.get("source_url") ?? "").trim();
  const creditPreferenceRaw = String(form.get("credit_preference") ?? "").trim();
  const caption = String(form.get("caption") ?? "").trim() || null;
  const customCreditLine = String(form.get("custom_credit_line") ?? "").trim() || null;
  const submitterName = String(form.get("submitter_name") ?? "").trim();

  if (!submitterName || !creditPreferenceRaw) {
    return jsonResponse(
      { ok: false, error: "Fields 'submitter_name' and 'credit_preference' are required." },
      400,
    );
  }

  // rights_choice is the entire legal gate for this endpoint -- fail closed
  // if it's missing, invalid, or (for the external-source choice) missing
  // its required source_url, before ever touching the file or B2.
  if (!rightsChoiceRaw || !RIGHTS_CHOICE_SET.has(rightsChoiceRaw)) {
    return jsonResponse(
      { ok: false, error: `rights_choice is required and must be one of: ${[...RIGHTS_CHOICE_SET].join(", ")}` },
      400,
    );
  }
  if (rightsChoiceRaw === "external_source_needs_evaluation" && !sourceUrl) {
    return jsonResponse(
      { ok: false, error: "source_url is required when rights_choice is external_source_needs_evaluation." },
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
      rightsChoice: rightsChoiceRaw as PhotoRightsChoice,
      sourceUrl: sourceUrl || null,
      creditPreference: creditPreferenceRaw,
      customCreditLine,
      caption,
      mediaUid,
      b2Key,
      size: bytes.byteLength,
      etag,
      peopleTags: parseTagList(form.get("people_tags")),
      topicTags: parseTagList(form.get("topic_tags")),
      locationTags: parseTagList(form.get("location_tags")),
    });

    return jsonResponse(
      {
        ok: true,
        candidate_id: result.candidateId,
        media_uid: result.mediaUid,
        b2_key: result.b2Key,
        already_existed: result.alreadyExisted,
        rights_hold: result.rightsHold,
        message:
          result.rightsHold === 0
            ? "Photo submitted. Rights fully granted -- it will sync to the site on the next daily update."
            : "Photo submitted and queued for copyright evaluation. It will not appear on the site until an admin approves it.",
      },
      200,
    );
  } catch (err: any) {
    console.error("fanclub photo upload error:", err);
    return jsonResponse({ ok: false, error: "Upload failed.", detail: String(err?.message || err) }, 500);
  }
};
