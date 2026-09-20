-- #4183 follow-up: random Lou Gehrig box score + AL standings-as-of-date
-- margins on Club Home. Forward-only. No drops. No Production apply claimed
-- by this child.
--
-- Data source: Retrosheet CSV master files (gameinfo.csv, teamstats.csv,
-- batting.csv, pitching.csv), filtered to Gehrig's Retrosheet player id
-- (gehrl101) across his full career (1923-06-15 through 1939-04-30) via
-- scripts/ingest-gehrig-retrosheet-data.mjs. AL standings are precomputed
-- per game at ingest time (8 fixed AL teams for the whole span: NYA, BOS,
-- PHA, WS1, CLE, DET, CHA, SLA -- no expansion/relocation 1923-1939) and
-- stored as a snapshot rather than derived live, so a random pick at
-- request time is a single indexed read, not a season-long aggregation.

CREATE TABLE IF NOT EXISTS retrosheet_gehrig_games (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL UNIQUE,
  game_date TEXT NOT NULL,
  season_year INTEGER NOT NULL,
  game_number INTEGER NOT NULL DEFAULT 0,
  vis_team TEXT NOT NULL,
  home_team TEXT NOT NULL,
  vis_score INTEGER,
  home_score INTEGER,
  site TEXT,
  day_night TEXT,
  gehrig_team TEXT NOT NULL,
  gehrig_opponent TEXT NOT NULL,
  created_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'retrosheet'
);

CREATE INDEX IF NOT EXISTS idx_retrosheet_gehrig_games_season_year
  ON retrosheet_gehrig_games (season_year);

CREATE TABLE IF NOT EXISTS retrosheet_box_score_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL REFERENCES retrosheet_gehrig_games(game_id) ON DELETE CASCADE,
  team TEXT NOT NULL,
  stat_type TEXT NOT NULL CHECK (stat_type IN ('batting', 'pitching')),
  player_id TEXT NOT NULL,
  player_name TEXT,
  batting_order INTEGER,
  line_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_retrosheet_box_score_lines_game_id
  ON retrosheet_box_score_lines (game_id);

CREATE TABLE IF NOT EXISTS retrosheet_al_standings_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id TEXT NOT NULL REFERENCES retrosheet_gehrig_games(game_id) ON DELETE CASCADE,
  team TEXT NOT NULL,
  wins INTEGER NOT NULL,
  losses INTEGER NOT NULL,
  ties INTEGER NOT NULL DEFAULT 0,
  win_pct REAL NOT NULL,
  games_back REAL NOT NULL DEFAULT 0,
  league_rank INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (game_id, team)
);

CREATE INDEX IF NOT EXISTS idx_retrosheet_al_standings_snapshots_game_id
  ON retrosheet_al_standings_snapshots (game_id);
