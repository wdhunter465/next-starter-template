-- #4183 follow-up: make retrosheet_box_score_lines inserts idempotent.
-- The ingestion script (scripts/ingest-gehrig-retrosheet-data.mjs) is a
-- plain INSERT per box score line with no natural-key constraint, so
-- re-running --apply after a partial failure (or simply re-running it)
-- would duplicate every line already written. A player has at most one
-- batting line and one pitching line per game per team in Retrosheet's
-- source CSVs, so (game_id, team, stat_type, player_id) is a true natural
-- key -- add it as a UNIQUE index so the ingestion script can upsert on it.
-- Forward-only. No drops.

CREATE UNIQUE INDEX IF NOT EXISTS idx_retrosheet_box_score_lines_natural_key
  ON retrosheet_box_score_lines (game_id, team, stat_type, player_id);
