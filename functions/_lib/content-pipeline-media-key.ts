// #3552: media collected under the allowlisted Gehrig content-collection
// pipeline gets a distinct key/uid prefix so newly ingested, rights-cleared
// content is trivially distinguishable from the quarantined legacy library
// (see migration 0053_rights_hold_quarantine.sql) at a glance in B2 and D1.

export const NEW_INTAKE_KEY_PREFIX = "LGFC_";

export function isNewIntakeKey(key: string): boolean {
  return key.startsWith(NEW_INTAKE_KEY_PREFIX);
}

export function buildNewIntakeKey(suffix: string): string {
  const trimmed = suffix.trim().replace(/^\/+/, "");
  if (!trimmed) {
    throw new Error("buildNewIntakeKey requires a non-empty suffix");
  }
  return trimmed.startsWith(NEW_INTAKE_KEY_PREFIX) ? trimmed : `${NEW_INTAKE_KEY_PREFIX}${trimmed}`;
}

// #3716 phase 2a: strips a source filename down to characters safe in a B2
// object key, so buildReadableIntakeKey below produces a human-legible key
// straight from a bucket listing (e.g. `LGFC_42_GehrigCU.jpg`) instead of a
// bare content hash. Wikimedia Commons titles are prefixed "File:" -- that's
// not part of the actual filename, so it's stripped. Any existing extension
// is dropped too, since the caller supplies the validated content-type
// extension separately (avoids a double extension like ".jpg.jpg").
export function sanitizeSourceFilenameForKey(rawFilename: string): string {
  let name = String(rawFilename ?? "").trim();
  name = name.replace(/^file:/i, "");
  name = name.replace(/\.[A-Za-z0-9]{1,8}$/, "");
  name = name.replace(/[^A-Za-z0-9._-]+/g, "_");
  name = name.replace(/_+/g, "_").replace(/^[_.-]+|[_.-]+$/g, "");
  if (name.length > 80) {
    name = name.slice(0, 80).replace(/[_.-]+$/g, "");
  }
  return name || "file";
}

// #3716 phase 2a: the B2 key convention agreed with Product Authority --
// `LGFC_<content_items.id>_<sanitized-source-filename>.<ext>`. Uniqueness is
// guaranteed by content_items.id (a real D1 autoincrement), not by the
// discovery-run's ephemeral candidate_id sequence number (confirmed unsafe:
// the same number pointed to two different photos in two different search
// runs) or by content hash alone (still tracked separately as media_uid for
// dedup detection -- see media-ingest-repository.ts). content_items.id is
// always assigned before this is called: the content_items row is written
// (and gets its id) before any B2 upload happens.
export function buildReadableIntakeKey(
  contentItemId: number,
  sourceFilename: string,
  extension: string,
): string {
  if (!Number.isFinite(contentItemId) || contentItemId <= 0) {
    throw new Error("buildReadableIntakeKey requires a positive contentItemId");
  }
  const cleanExtension = String(extension ?? "").trim().replace(/^\.+/, "").toLowerCase() || "bin";
  const base = sanitizeSourceFilenameForKey(sourceFilename);
  return buildNewIntakeKey(`${contentItemId}_${base}.${cleanExtension}`);
}

// #3552 Path C: member-uploaded photos get their own distinct sub-prefix
// under the same new-intake namespace, so they're trivially distinguishable
// in B2/D1 from admin-curated Path B content at a glance -- both start
// unreviewed (rights_hold = 1), but only Path C content is a member's own
// self-attestation rather than a documented external license.
export const MEMBER_UPLOAD_KEY_PREFIX = `${NEW_INTAKE_KEY_PREFIX}MEMBER_`;

export function isMemberUploadKey(key: string): boolean {
  return key.startsWith(MEMBER_UPLOAD_KEY_PREFIX);
}

export function buildMemberUploadKey(suffix: string): string {
  const trimmed = suffix.trim().replace(/^\/+/, "");
  if (!trimmed) {
    throw new Error("buildMemberUploadKey requires a non-empty suffix");
  }
  return trimmed.startsWith(MEMBER_UPLOAD_KEY_PREFIX) ? trimmed : `${MEMBER_UPLOAD_KEY_PREFIX}${trimmed}`;
}
