export const WEEKLY_MATCHUP_HOLD = Object.freeze({
  // Operations break-glass hold; Product Authority must approve reactivation.
  // Reactivated 2026-08-18: Product Authority (Bill Hunter) approved lifting
  // the hold once the B2-audited legacy photos cleared rights review (#3552).
  active: false,
  reason: 'media_rights_review',
  message: 'Weekly Matchup is temporarily paused.',
});

export function isWeeklyMatchupHeld(): boolean {
  return WEEKLY_MATCHUP_HOLD.active;
}
