// #3552: maps a Commons-asserted license template to the vocabulary
// rights_evidence.conclusion and content_items.rights_status actually use.
// This is pure classification logic given an already-human-approved license
// string -- it never decides *whether* to approve an item (that's always a
// human, recorded via reviewer/conclusion_rationale by the caller), only
// which of the fixed conclusion values a given, already-approved license
// template corresponds to. An unrecognized license template is refused
// rather than guessed at, per #3551's core safety rule.

import type { RightsEvidenceConclusion } from './rights-evidence-repository';

export function mapLicenseToConclusion(licenseShortName: string | null | undefined): RightsEvidenceConclusion {
  const normalized = String(licenseShortName ?? '').trim().toLowerCase();

  if (normalized === 'public domain' || normalized === 'cc0') {
    // CC0 is a public-domain dedication (no rights reserved), not a
    // conditioned license -- functionally equivalent to public domain here.
    return 'public_domain_confirmed';
  }

  if (normalized.startsWith('cc by')) {
    // Any other Creative Commons "BY" variant is a conditioned grant --
    // attribution is required as a term of use, so this is permission
    // granted (with a condition), not an unconditional public-domain claim.
    return 'permission_granted';
  }

  throw new Error(
    `mapLicenseToConclusion: unrecognized license template "${licenseShortName}" -- refusing to guess a rights conclusion. Add explicit handling once the correct mapping is confirmed by a human.`,
  );
}

// Best existing fit in content_items.rights_status's enum (migration 0042)
// for each rights_evidence.conclusion value. The two enums predate each
// other and don't share vocabulary 1:1 -- 'public_domain_candidate' is the
// closest available value to a confirmed public-domain conclusion.
//
// Migration 0059 (#3657) added 'lgfc_owned_confirmed' specifically to fix
// the one real mismatch here: 'lgfc_member_owned_item_photo' used to have
// to borrow 'permission_granted's meaning, which falsely implied a third
// party granted permission when in fact LGFC itself is the rights holder
// with no identified third-party claim. It no longer needs to borrow that
// meaning.
export function mapConclusionToRightsStatus(conclusion: RightsEvidenceConclusion): string {
  switch (conclusion) {
    case 'public_domain_confirmed':
      return 'public_domain_candidate';
    case 'permission_granted':
      return 'permission_granted';
    case 'lgfc_member_owned_item_photo':
      return 'lgfc_owned_confirmed';
    default: {
      const exhaustive: never = conclusion;
      throw new Error(`mapConclusionToRightsStatus: unhandled conclusion "${exhaustive}"`);
    }
  }
}
