export const WEEKLY_MATCHUP_HOLD = Object.freeze({
  // Operations break-glass hold; Product Authority must approve reactivation.
  active: true,
  reason: 'media_rights_review',
  message: 'Weekly Matchup is temporarily paused.',
});

export function isWeeklyMatchupHeld(): boolean {
  return WEEKLY_MATCHUP_HOLD.active;
}
