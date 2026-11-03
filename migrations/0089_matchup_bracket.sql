-- 0089_matchup_bracket.sql
-- Weekly Photo Matchup bracket: every eligible photo plays; winners advance round by round
-- until a champion is found; then a new tournament starts. Product Authority direction 2026-11-03.
--
-- Purely additive: two new tables and new columns on weekly_matchups. No existing column is
-- altered, no row is deleted, and the site works unchanged until the new code runs (the
-- matchup endpoint falls back to the old random pair if these tables are missing).
--
-- Rules the code applies:
--   * Two photos are picked at random each week from the round's unplayed photos.
--   * At the end of the week the winner is recorded here; the loser is eliminated.
--   * A tied week advances BOTH photos to the next round.
--   * When a round has no unplayed photos left, the winners become the next round.
--   * An odd photo out gets a bye and advances.
--   * When one photo is left, or a round eliminates nobody, the tournament is complete and the
--     survivors are champions; a new tournament then starts with every eligible photo.
--   * A photo added during a tournament joins the current round.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS matchup_tournaments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'complete')),
  current_round INTEGER NOT NULL DEFAULT 1 CHECK (current_round >= 1),
  champion_photo_ids TEXT,
  started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  completed_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_matchup_tournaments_one_active
  ON matchup_tournaments(status)
  WHERE status = 'active';

CREATE TABLE IF NOT EXISTS matchup_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL REFERENCES matchup_tournaments(id),
  photo_id INTEGER NOT NULL,
  round INTEGER NOT NULL CHECK (round >= 1),
  status TEXT NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'playing', 'advanced', 'eliminated', 'removed', 'champion')),
  matchup_id INTEGER,
  entered_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  decided_at TEXT,
  UNIQUE (tournament_id, photo_id)
);

CREATE INDEX IF NOT EXISTS idx_matchup_entries_pool
  ON matchup_entries(tournament_id, status, round);

-- The week's result, noted when the week closes.
ALTER TABLE weekly_matchups ADD COLUMN tournament_id INTEGER;
ALTER TABLE weekly_matchups ADD COLUMN round INTEGER;
ALTER TABLE weekly_matchups ADD COLUMN votes_a INTEGER;
ALTER TABLE weekly_matchups ADD COLUMN votes_b INTEGER;
ALTER TABLE weekly_matchups ADD COLUMN outcome TEXT
  CHECK (outcome IS NULL OR outcome IN ('a', 'b', 'tie'));
ALTER TABLE weekly_matchups ADD COLUMN finalized_at TEXT;

-- Backfill the result of past weeks whose votes still exist. These weeks belong to no
-- tournament (tournament_id stays NULL), so they do not affect the new bracket. Weeks whose
-- votes were cleared (no votes at all) keep a NULL result rather than a false tie.
UPDATE weekly_matchups
SET votes_a = (SELECT COALESCE(SUM(CASE WHEN v.choice = 'a' THEN 1 ELSE 0 END), 0)
               FROM weekly_votes v WHERE v.week_start = weekly_matchups.week_start),
    votes_b = (SELECT COALESCE(SUM(CASE WHEN v.choice = 'b' THEN 1 ELSE 0 END), 0)
               FROM weekly_votes v WHERE v.week_start = weekly_matchups.week_start)
WHERE status = 'closed';

UPDATE weekly_matchups
SET outcome = CASE
      WHEN votes_a > votes_b THEN 'a'
      WHEN votes_b > votes_a THEN 'b'
      ELSE 'tie'
    END
WHERE status = 'closed'
  AND COALESCE(votes_a, 0) + COALESCE(votes_b, 0) > 0;
