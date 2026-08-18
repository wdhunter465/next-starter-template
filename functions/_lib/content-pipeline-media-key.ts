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
