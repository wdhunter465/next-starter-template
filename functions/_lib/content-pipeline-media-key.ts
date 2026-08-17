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
