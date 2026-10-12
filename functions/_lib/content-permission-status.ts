// Permission layers and final status for collected content (#4523).
//
// Policy: docs/reference/website/lou-gehrig-rights-privacy-publication-review.md ("Rights
// layers and final status"). Data model: docs/reference/website/lou-gehrig-content-record-d1-design.md.
//
// A record is usable on the LGFC website only when its final status is `permitted`, which needs
// the origin layer `permitted` and every other layer `permitted` or `not_applicable`. Everything
// else is not usable: `for_admin_review` means a person must decide, and until then it is treated
// as not permitted. Pure functions so the same rule is tested here and enforced in D1 by the
// triggers in migrations/0084_content_permission_layers_4523.sql.

export const PERMISSION_LAYER_VALUES = ['permitted', 'not_permitted', 'not_applicable', 'for_admin_review'] as const;
export type PermissionLayer = (typeof PERMISSION_LAYER_VALUES)[number];

export const FINAL_STATUS_VALUES = ['permitted', 'not_permitted', 'for_admin_review'] as const;
export type FinalStatus = (typeof FINAL_STATUS_VALUES)[number];

export const OUTCOME_BASIS_VALUES = [
  'origin_statement',
  'email_permission',
  'email_denial',
  'no_response',
  'fee_required',
  'public_domain',
  'manual_lgfc_decision',
  'pending',
] as const;
export type OutcomeBasis = (typeof OUTCOME_BASIS_VALUES)[number];

export const USAGE_BASIS_VALUES = ['free_use', 'free_use_credit', 'free_use_permission', 'fee_required', 'unknown'] as const;
export type UsageBasis = (typeof USAGE_BASIS_VALUES)[number];

export interface PermissionLayers {
  origin: PermissionLayer;
  cmg: PermissionLayer;
  mlb: PermissionLayer;
  yankees: PermissionLayer;
  privacy: PermissionLayer;
}

/** Layers a new record starts with: not permitted by default, other parties awaiting confirmation. */
export const DEFAULT_PERMISSION_LAYERS: PermissionLayers = {
  origin: 'not_permitted',
  cmg: 'for_admin_review',
  mlb: 'for_admin_review',
  yankees: 'for_admin_review',
  privacy: 'for_admin_review',
};

const CLEARED_BY_OTHER_LAYER: ReadonlySet<PermissionLayer> = new Set(['permitted', 'not_applicable']);

/**
 * The final status implied by the layers.
 * - `permitted`: origin permitted, every other layer permitted or not_applicable, and not a fee-required outcome.
 * - `not_permitted`: any layer is not_permitted, or the outcome is fee-required.
 * - `for_admin_review`: nothing says no, but at least one layer still needs a person.
 */
export function computeFinalStatus(layers: PermissionLayers, outcomeBasis: OutcomeBasis = 'pending'): FinalStatus {
  const all = [layers.origin, layers.cmg, layers.mlb, layers.yankees, layers.privacy];
  if (outcomeBasis === 'fee_required' || all.includes('not_permitted')) return 'not_permitted';
  if (layers.origin === 'permitted' && [layers.cmg, layers.mlb, layers.yankees, layers.privacy].every((l) => CLEARED_BY_OTHER_LAYER.has(l))) {
    return 'permitted';
  }
  return 'for_admin_review';
}

/** The only status that allows a record to be selected or shown on the website. */
export function isUsableOnWebsite(finalStatus: FinalStatus | string | null | undefined): boolean {
  return finalStatus === 'permitted';
}

/** Maps the origin's usage basis to the evidence decision. A fee is never usable. */
export function usageDecisionForBasis(basis: UsageBasis): 'permit' | 'deny' | 'hold' {
  if (basis === 'fee_required') return 'deny';
  if (basis === 'free_use' || basis === 'free_use_credit' || basis === 'free_use_permission') return 'permit';
  return 'hold';
}
