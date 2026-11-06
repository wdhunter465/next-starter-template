-- 0097_social_wall_events_5116.sql
-- #5116: log each time the homepage social wall falls back, with Elfsight's stated reason, so Product
-- Authority can decide from data when a paid Elfsight plan is justified (#5114).
--
--   social_wall_events   one row per visitor page load that showed the fallback panel. It holds the
--                        time, Elfsight's reason and the widget id. It holds nothing about the
--                        visitor: no address, user agent or cookie.
--   social_wall_monthly  read-only summary by month and reason: how many fallbacks, and the first and
--                        last time each happened. The first row of a month with
--                        APP_VIEWS_LIMIT_REACHED is the day the limit was reached.
--
-- reason is Elfsight's own value (APP_VIEWS_LIMIT_REACHED, WIDGET_DISABLED, ...) or one of ours:
--   ELFSIGHT_UNREACHABLE   Elfsight did not answer in time
--   CLIENT_RENDER_FAILED   Elfsight says the widget is fine but the page did not render it
--                          (for example an ad blocker)
--
-- Additive only. Reverse with: DROP VIEW social_wall_monthly; DROP TABLE social_wall_events;

CREATE TABLE IF NOT EXISTS social_wall_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  reason TEXT NOT NULL,
  widget_id TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_social_wall_events_occurred_at
  ON social_wall_events (occurred_at);

CREATE VIEW IF NOT EXISTS social_wall_monthly AS
SELECT substr(occurred_at, 1, 7) AS month,
       reason,
       COUNT(*) AS events,
       MIN(occurred_at) AS first_at,
       MAX(occurred_at) AS last_at
  FROM social_wall_events
 GROUP BY substr(occurred_at, 1, 7), reason;
