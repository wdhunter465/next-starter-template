// @vitest-environment node

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { onRequestGet } from '../../functions/api/fanclub/gehrig-box-score';

function applyRepoMigrations(db: DatabaseSync) {
  const migrationsDir = path.join(process.cwd(), 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }
}

function wrapSqliteAsD1(sqlite: DatabaseSync) {
  return {
    async exec(sql: string) {
      sqlite.exec(sql);
    },
    prepare(sql: string) {
      const stmt = sqlite.prepare(sql);
      const bound = (...args: SQLInputValue[]) => ({
        async first() {
          return stmt.get(...args) ?? null;
        },
        async all() {
          return { results: stmt.all(...args) };
        },
        async run() {
          stmt.run(...args);
          return { success: true };
        },
      });

      return {
        bind: bound,
        async first() {
          return stmt.get() ?? null;
        },
        async all() {
          return { results: stmt.all() };
        },
        async run() {
          stmt.run();
          return { success: true };
        },
      };
    },
  };
}

function seedMemberSession(sqlite: DatabaseSync, sessionId = 'session-4263', email = 'member@example.com') {
  sqlite.exec(`
    INSERT INTO members (email, role, created_at)
    VALUES ('${email}', 'member', datetime('now'));
    INSERT INTO member_sessions (id, email, expires_at, created_at, last_seen_at)
    VALUES ('${sessionId}', '${email}', datetime('now', '+30 days'), datetime('now'), datetime('now'));
  `);
}

function seedGehrigGame(sqlite: DatabaseSync) {
  sqlite.exec(`
    INSERT INTO retrosheet_gehrig_games (
      game_id, game_date, season_year, game_number, vis_team, home_team, vis_score, home_score,
      site, day_night, gehrig_team, gehrig_opponent, created_at, source
    ) VALUES (
      'NYA192706150', '1927-06-15', 1927, 0, 'BOS', 'NYA', 3, 7,
      'NYC16', 'D', 'NYA', 'BOS', datetime('now'), 'retrosheet'
    );
    INSERT INTO retrosheet_box_score_lines (
      game_id, team, stat_type, player_id, player_name, batting_order, line_json, created_at
    ) VALUES
      ('NYA192706150', 'NYA', 'batting', 'gehrl101', NULL, 4, '{"ab":4,"r":2,"h":3,"hr":1,"rbi":2}', datetime('now')),
      ('NYA192706150', 'NYA', 'batting', 'ruthb101', NULL, 3, '{"ab":4,"r":1,"h":1,"hr":1,"rbi":1}', datetime('now')),
      ('NYA192706150', 'BOS', 'batting', 'toddl101', NULL, 1, '{"ab":4,"r":1,"h":1,"hr":0,"rbi":0}', datetime('now')),
      ('NYA192706150', 'NYA', 'pitching', 'hoytw101', NULL, NULL, '{"ip":9}', datetime('now'));
    INSERT INTO retrosheet_al_standings_snapshots (
      game_id, team, wins, losses, ties, win_pct, games_back, league_rank, created_at
    ) VALUES
      ('NYA192706150', 'NYA', 40, 15, 0, 0.7273, 0, 1, datetime('now')),
      ('NYA192706150', 'BOS', 22, 33, 0, 0.4000, 18, 7, datetime('now'));
  `);
}

function getRequest(cookie: string | null): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  return new Request('https://www.lougehrigfanclub.com/api/fanclub/gehrig-box-score', { headers });
}

describe('GET /api/fanclub/gehrig-box-score (#4263)', () => {
  it('requires a member session', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const response = await onRequestGet({ env: { DB: wrapSqliteAsD1(sqlite) }, request: getRequest(null) });
    expect(response.status).toBe(401);
  });

  it('returns a null game when tables exist but are empty', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedMemberSession(sqlite);
    const response = await onRequestGet({
      env: { DB: wrapSqliteAsD1(sqlite) },
      request: getRequest('lgfc_session=session-4263'),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, game: null });
  });

  it('returns 503 when the Retrosheet tables are missing', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedMemberSession(sqlite);
    sqlite.exec(`
      DROP TABLE retrosheet_al_standings_snapshots;
      DROP TABLE retrosheet_box_score_lines;
      DROP TABLE retrosheet_gehrig_games;
    `);
    const response = await onRequestGet({
      env: { DB: wrapSqliteAsD1(sqlite) },
      request: getRequest('lgfc_session=session-4263'),
    });
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBe('Database schema incomplete');
  });

  it('returns one random game with batting lines and matching standings', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedMemberSession(sqlite);
    seedGehrigGame(sqlite);
    const response = await onRequestGet({
      env: { DB: wrapSqliteAsD1(sqlite) },
      request: getRequest('lgfc_session=session-4263'),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.game.game_id).toBe('NYA192706150');
    expect(body.game.batting.map((row: { player_id: string }) => row.player_id)).toEqual([
      'toddl101',
      'ruthb101',
      'gehrl101',
    ]);
    expect(body.game.batting.find((row: { is_gehrig: boolean }) => row.is_gehrig).player_label).toBe('Gehrig');
    expect(body.game.batting.find((row: { is_gehrig: boolean }) => row.is_gehrig)).toMatchObject({
      ab: 4,
      r: 2,
      h: 3,
      hr: 1,
      rbi: 2,
    });
    expect(body.game.standings[0]).toMatchObject({ team: 'NYA', is_yankees: true, league_rank: 1 });
    expect(body.game.source_credit).toMatch(/Retrosheet/);
  });

  it('reads Retrosheet batting.csv b_* keys from line_json', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    seedMemberSession(sqlite);
    sqlite.exec(`
      INSERT INTO retrosheet_gehrig_games (
        game_id, game_date, season_year, game_number, vis_team, home_team, vis_score, home_score,
        site, day_night, gehrig_team, gehrig_opponent, created_at, source
      ) VALUES (
        'NYA192706150', '1927-06-15', 1927, 0, 'BOS', 'NYA', 3, 7,
        'NYC16', 'D', 'NYA', 'BOS', datetime('now'), 'retrosheet'
      );
      INSERT INTO retrosheet_box_score_lines (
        game_id, team, stat_type, player_id, player_name, batting_order, line_json, created_at
      ) VALUES (
        'NYA192706150', 'NYA', 'batting', 'gehrl101', NULL, 4,
        '{"id":"gehrl101","team":"NYA","b_lp":4,"b_ab":4,"b_r":2,"b_h":3,"b_hr":1,"b_rbi":2}',
        datetime('now')
      );
      INSERT INTO retrosheet_al_standings_snapshots (
        game_id, team, wins, losses, ties, win_pct, games_back, league_rank, created_at
      ) VALUES (
        'NYA192706150', 'NYA', 40, 15, 0, 0.7273, 0, 1, datetime('now')
      );
    `);
    const response = await onRequestGet({
      env: { DB: wrapSqliteAsD1(sqlite) },
      request: getRequest('lgfc_session=session-4263'),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.game.batting[0]).toMatchObject({
      player_id: 'gehrl101',
      ab: 4,
      r: 2,
      h: 3,
      hr: 1,
      rbi: 2,
    });
  });
});
