import { jsonResponse, requireTables } from '../../_lib/d1';
import { requireMember } from '../../_lib/session';

const GEHRIG_PLAYER_ID = 'gehrl101';
const SOURCE_CREDIT =
  'The information used here was obtained free of charge from and is copyrighted by Retrosheet.';

const AL_TEAM_LABELS: Record<string, string> = {
  NYA: 'New York',
  BOS: 'Boston',
  PHA: 'Philadelphia',
  WS1: 'Washington',
  CLE: 'Cleveland',
  DET: 'Detroit',
  CHA: 'Chicago',
  SLA: 'St. Louis',
};

function teamLabel(code: string): string {
  return AL_TEAM_LABELS[code] || code;
}

function asInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function asFloat(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function pickStat(line: Record<string, unknown>, keys: string[]): number | null {
  const map = new Map(Object.keys(line).map((k) => [k.toLowerCase(), line[k]]));
  for (const key of keys) {
    if (map.has(key)) return asInt(map.get(key));
  }
  return null;
}

function playerLabel(playerId: string, storedName: unknown): string {
  const named = String(storedName || '').trim();
  if (named) return named;
  if (playerId === GEHRIG_PLAYER_ID) return 'Gehrig';
  return playerId;
}

function parseLineJson(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const auth = await requireMember(context);
  if (!auth.ok) {
    return jsonResponse(auth.body, auth.status);
  }

  try {
    const tables = await requireTables(auth.db, [
      'retrosheet_gehrig_games',
      'retrosheet_box_score_lines',
      'retrosheet_al_standings_snapshots',
    ]);
    if (!tables.ok) {
      return jsonResponse(tables.body, tables.status);
    }

    const game = await auth.db
      .prepare(
        `SELECT game_id, game_date, vis_team, home_team, vis_score, home_score, site
         FROM retrosheet_gehrig_games
         ORDER BY RANDOM()
         LIMIT 1`,
      )
      .first();

    if (!game) {
      return jsonResponse({ ok: true, game: null }, 200);
    }

    const gameId = String(game.game_id);
    const linesResult = await auth.db
      .prepare(
        `SELECT team, stat_type, player_id, player_name, batting_order, line_json
         FROM retrosheet_box_score_lines
         WHERE game_id = ?1 AND stat_type = 'batting'`,
      )
      .bind(gameId)
      .all();
    const standingsResult = await auth.db
      .prepare(
        `SELECT team, wins, losses, ties, win_pct, games_back, league_rank
         FROM retrosheet_al_standings_snapshots
         WHERE game_id = ?1
         ORDER BY league_rank ASC, team ASC`,
      )
      .bind(gameId)
      .all();

    const vis = String(game.vis_team);
    const home = String(game.home_team);
    const batting = (linesResult.results || [])
      .map((row: any) => {
        const line = parseLineJson(row.line_json);
        const battingOrder = asInt(row.batting_order);
        const playerId = String(row.player_id || '');
        const isGehrig = playerId === GEHRIG_PLAYER_ID;
        const starter = battingOrder !== null && battingOrder >= 1 && battingOrder <= 9;
        if (!isGehrig && !starter) return null;
        return {
          player_id: playerId,
          player_label: playerLabel(playerId, row.player_name),
          team: String(row.team || ''),
          batting_order: battingOrder,
          is_gehrig: isGehrig,
          ab: pickStat(line, ['ab']),
          r: pickStat(line, ['r']),
          h: pickStat(line, ['h']),
          hr: pickStat(line, ['hr']),
          rbi: pickStat(line, ['rbi']),
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => {
        const teamRank = (team: string) => (team === vis ? 0 : team === home ? 1 : 2);
        const teamDiff = teamRank(a.team) - teamRank(b.team);
        if (teamDiff !== 0) return teamDiff;
        return (a.batting_order ?? 99) - (b.batting_order ?? 99);
      });

    const standings = (standingsResult.results || []).map((row: any) => ({
      team: String(row.team || ''),
      team_label: teamLabel(String(row.team || '')),
      wins: asInt(row.wins) ?? 0,
      losses: asInt(row.losses) ?? 0,
      ties: asInt(row.ties) ?? 0,
      win_pct: asFloat(row.win_pct),
      games_back: asFloat(row.games_back),
      league_rank: asInt(row.league_rank) ?? 0,
      is_yankees: String(row.team || '') === 'NYA',
    }));

    return jsonResponse(
      {
        ok: true,
        game: {
          game_id: gameId,
          game_date: String(game.game_date || ''),
          vis_team: vis,
          home_team: home,
          vis_score: asInt(game.vis_score),
          home_score: asInt(game.home_score),
          site: game.site ? String(game.site) : null,
          batting,
          standings,
          source_credit: SOURCE_CREDIT,
        },
      },
      200,
    );
  } catch (err: any) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
};
