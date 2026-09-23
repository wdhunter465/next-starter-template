export const CLUB_HOME_DAY_TZ = 'America/New_York';

export function clubHomeDayKey(now: Date = new Date(), timeZone = CLUB_HOME_DAY_TZ): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** Stable per calendar day; not sequential through career game_id order. */
export function dailyGameOffset(dayKey: string, count: number): number {
  if (count <= 0) return 0;
  let hash = 2166136261;
  for (let i = 0; i < dayKey.length; i += 1) {
    hash ^= dayKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % count;
}
