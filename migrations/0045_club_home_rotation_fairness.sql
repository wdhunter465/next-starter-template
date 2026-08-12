-- 0045_club_home_rotation_fairness.sql
-- P1-03 (#3393): additive usage_count for Club Home / inventory rotation fairness.
-- Expand only: new column with default 0. No DROP/cleanup. Backfill is implicit via DEFAULT.
-- Contract: docs/explanation/website/content-strategy.md (hard cooldown + least-used / usage-count).

ALTER TABLE content_inventory ADD COLUMN usage_count INTEGER NOT NULL DEFAULT 0;
