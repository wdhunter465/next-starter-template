// Usage basis, fee flag and permission layers for collected content (#4568, child of #4523).
//
// Collectors capture the origin's own license or terms statement; this module turns that
// capture into the columns migration 0084 added. It never grants more than the source itself
// asserts: only an unambiguous public-domain or attribution-only license (already classified by
// the collector as a `conclusion`) makes the origin layer `permitted`, and the CMG, MLB, Yankees
// and privacy layers always start at `for_admin_review`, so nothing collected is usable on the
// website until a person clears those layers. Fee wording always wins and is recorded as a
// denial. Policy: docs/reference/website/lou-gehrig-rights-privacy-publication-review.md.

import {
  computeFinalStatus,
  DEFAULT_PERMISSION_LAYERS,
  USAGE_BASIS_VALUES,
  usageDecisionForBasis,
  type FinalStatus,
  type OutcomeBasis,
  type PermissionLayer,
  type PermissionLayers,
  type UsageBasis,
} from './content-permission-status';

export const USAGE_BASIS_SET: Set<string> = new Set(USAGE_BASIS_VALUES);

/**
 * Wording in an origin's terms that means use costs money. Deliberately narrow: a match records
 * the item as fee-required (never usable), so ordinary words such as "free" or "license" alone
 * must not trigger it.
 */
export const FEE_TERMS_PATTERN =
  /\b(licen[cs]e fees?|licen[cs]ing fees?|usage fees?|reproduction fees?|permission fees?|fees? (?:is |are )?required|for a fee|(?:purchase|buy) (?:a )?licen[cs]e|payment (?:is )?required|rights[- ]managed|royalt(?:y|ies) (?:is |are )?(?:due|required))\b/i;

export type DiscoveryEvidenceInput = {
  conclusion?: string | null;
  evidence_text?: string | null;
  usage_basis?: string | null;
  fee_required?: boolean | number | null;
};

export type DiscoveryPermissionFields = {
  usage_basis: UsageBasis;
  fee_required: 0 | 1;
  usage_decision: 'permit' | 'deny' | 'hold';
  /** The evidence conclusion to record: cleared to null for a fee-required item. */
  conclusion: 'public_domain_confirmed' | 'permission_granted' | null;
  layers: PermissionLayers;
  outcome_basis: OutcomeBasis;
  final_status: FinalStatus;
};

function isFeeRequired(evidence: DiscoveryEvidenceInput): boolean {
  if (evidence.usage_basis === 'fee_required') return true;
  if (evidence.fee_required === true || evidence.fee_required === 1) return true;
  return FEE_TERMS_PATTERN.test(evidence.evidence_text ?? '');
}

/**
 * The usage basis implied by what the source asserts. `free_use_permission` is never produced
 * here: it records a permission received by email (#4526), which discovery cannot have.
 */
export function usageBasisForDiscovery(evidence: DiscoveryEvidenceInput | null | undefined): UsageBasis {
  if (!evidence) return 'unknown';
  if (isFeeRequired(evidence)) return 'fee_required';
  if (evidence.conclusion === 'public_domain_confirmed') return 'free_use';
  if (evidence.conclusion === 'permission_granted') return 'free_use_credit';
  return 'unknown';
}

function originLayerFor(basis: UsageBasis): PermissionLayer {
  return basis === 'free_use' || basis === 'free_use_credit' || basis === 'free_use_permission'
    ? 'permitted'
    : 'not_permitted';
}

function outcomeBasisFor(basis: UsageBasis): OutcomeBasis {
  switch (basis) {
    case 'free_use':
      return 'public_domain';
    case 'free_use_credit':
      return 'origin_statement';
    case 'free_use_permission':
      return 'email_permission';
    case 'fee_required':
      return 'fee_required';
    default:
      return 'pending';
  }
}

/** Every permission column a newly collected record and its first evidence row start with. */
export function permissionFieldsForDiscovery(evidence: DiscoveryEvidenceInput | null | undefined): DiscoveryPermissionFields {
  const usage_basis = usageBasisForDiscovery(evidence);
  const layers: PermissionLayers = { ...DEFAULT_PERMISSION_LAYERS, origin: originLayerFor(usage_basis) };
  const outcome_basis = outcomeBasisFor(usage_basis);
  const conclusion =
    usage_basis === 'fee_required' ||
    (evidence?.conclusion !== 'public_domain_confirmed' && evidence?.conclusion !== 'permission_granted')
      ? null
      : evidence.conclusion;
  return {
    usage_basis,
    fee_required: usage_basis === 'fee_required' ? 1 : 0,
    usage_decision: usageDecisionForBasis(usage_basis),
    conclusion,
    layers,
    outcome_basis,
    final_status: computeFinalStatus(layers, outcome_basis),
  };
}
