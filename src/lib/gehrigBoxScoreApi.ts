export const GEHRIG_PLAYER_ID = 'gehrl101';

export const AL_TEAM_LABELS: Record<string, string> = {
  NYA: 'New York',
  BOS: 'Boston',
  PHA: 'Philadelphia',
  WS1: 'Washington',
  CLE: 'Cleveland',
  DET: 'Detroit',
  CHA: 'Chicago',
  SLA: 'St. Louis',
};

export type GehrigBattingLine = {
  player_id: string;
  player_label: string;
  team: string;
  batting_order: number | null;
  is_gehrig: boolean;
  ab: number | null;
  r: number | null;
  h: number | null;
  hr: number | null;
  rbi: number | null;
};

export type GehrigStandingRow = {
  team: string;
  team_label: string;
  wins: number;
  losses: number;
  ties: number;
  win_pct: number;
  games_back: number;
  league_rank: number;
  is_yankees: boolean;
};

export type GehrigRandomGame = {
  game_id: string;
  game_date: string;
  vis_team: string;
  home_team: string;
  vis_score: number | null;
  home_score: number | null;
  site: string | null;
  batting: GehrigBattingLine[];
  standings: GehrigStandingRow[];
  source_credit: string;
};

export type GehrigBoxScoreApiResponse = {
  ok: boolean;
  game?: GehrigRandomGame | null;
  error?: string;
};

export function teamLabel(code: string): string {
  return AL_TEAM_LABELS[code] || code;
}

export async function fetchGehrigRandomGame(): Promise<GehrigBoxScoreApiResponse> {
  const res = await fetch('/api/fanclub/gehrig-box-score', { credentials: 'include', cache: 'no-store' });
  const data = (await res.json().catch(() => ({}))) as GehrigBoxScoreApiResponse;
  if (!res.ok || !data?.ok) {
    return { ok: false, game: null, error: data?.error || 'Unable to load Gehrig box score.' };
  }
  return data;
}
