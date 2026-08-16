export const WEEKLY_MATCHUP_HOLD = Object.freeze({
  active: true,
  reason: 'media_rights_review',
  message: 'Weekly Matchup is temporarily paused.',
});

export function isWeeklyMatchupHeld(): boolean {
  return WEEKLY_MATCHUP_HOLD.active;
}

