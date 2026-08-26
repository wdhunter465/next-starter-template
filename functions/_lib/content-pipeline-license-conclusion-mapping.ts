// #3552: maps a Commons-asserted license template to the vocabulary
// rights_evidence.conclusion and content_items.rights_status actually use.
// This is pure classification logic given an already-human-approved license
// string -- it never decides *whether* to approve an item (that's always a
// human, recorded via reviewer/conclusion_rationale by the caller), only
// which of the fixed conclusion values a given, already-approved license
// template corresponds to. An unrecognized license template is refused
// rather than guessed at, per #3551's core safety rule.

import type { RightsEvidenceConclusion, RightsEvidenceUsageDecision } from './rights-evidence-repository';

export type CommonsLicenseNote = {
  license_short_name: string | null;
  usage_terms?: string | null;
  artist?: string | null;
  [key: string]: unknown;
};

export type CommonsProvenance = {
  evidenceText: string;
  rightsHolder: string | null;
};

// Raw source text only -- Commons' extmetadata UsageTerms field when
// present, otherwise the license template name itself (LicenseShortName).
// Both are the source's own words, not an LGFC-synthesized sentence; see
// docs/reference/content-pipeline-rights-data-dictionary.md's "Fix needed"
// note on evidence_text. Shared by the batch-approval writer and its
// one-time backfill counterpart so the two can never derive different
// values for the same license note.
export function deriveCommonsProvenance(licenseNote: CommonsLicenseNote): CommonsProvenance {
  const rawUsageTerms = typeof licenseNote.usage_terms === 'string' ? licenseNote.usage_terms.trim() : '';
  const evidenceText = rawUsageTerms || String(licenseNote.license_short_name ?? '').trim();
  const rightsHolder = licenseNote.artist?.trim() || null;
  return { evidenceText, rightsHolder };
}

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

// #3552 phase 5 (#3748): what a Commons "CC BY" family license actually
// requires of LGFC when it's used -- attribution to the named artist (per
// Commons' own extmetadata), or to Commons itself when Commons has no
// artist on record. Public-domain/CC0 items carry no such condition.
export function deriveTaggingRequirements(
  licenseShortName: string | null | undefined,
  artist: string | null | undefined,
): string | null {
  const normalized = String(licenseShortName ?? '').trim().toLowerCase();
  if (!normalized.startsWith('cc by')) {
    return null;
  }
  const trimmedArtist = artist?.trim();
  const creditedTo = trimmedArtist || 'Wikimedia Commons';
  return `Attribution required per ${licenseShortName}: credit ${creditedTo}.`;
}

export type CommonsUsageDecisionResult = {
  usageDecision: RightsEvidenceUsageDecision;
  conclusion: RightsEvidenceConclusion | null;
};

// #3552 phase 5 (#3748): the non-throwing counterpart to
// mapLicenseToConclusion, for callers (the batch-approval writer) that must
// keep processing the rest of a batch when one item's license text isn't
// recognized, rather than aborting on the first unmapped item. An
// unrecognized license becomes usage_decision='hold' with no conclusion
// recorded -- exactly the "queue it for review" behavior
// mapLicenseToConclusion's doc comment calls out as the alternative to
// throwing, and mapLicenseToConclusion itself is left unchanged (and still
// throws) for any caller that legitimately wants that stricter behavior.
export function resolveCommonsUsageDecision(
  licenseShortName: string | null | undefined,
): CommonsUsageDecisionResult {
  try {
    return { usageDecision: 'permit', conclusion: mapLicenseToConclusion(licenseShortName) };
  } catch {
    return { usageDecision: 'hold', conclusion: null };
  }
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
