-- 0099_edition_plan_5075.sql
-- #5075 (slice of #5037): one table that maps every 2027 edition, website and social, to a story and a
-- picture. Product Authority, 2026-11-04: editions are text references, the B2 URL of a picture and a
-- D1 reference to a story. Go recorded on #5075, 2026-11-12.
--
--   edition_plan   one row per day, surface and platform. status moves planned -> queued -> posted
--                  (or failed, skipped). It holds no member, donor or visitor data.
--
-- Design note: the Issue proposed a NULL platform for the website surface. SQLite treats NULLs as
-- distinct in a UNIQUE constraint, so website rows would not be protected from duplicates. The website
-- surface therefore uses platform = 'website', and a CHECK keeps surface and platform consistent.
--
-- A row that is 'posted' can never be changed or deleted (triggers below). Re-writing the plan uses
-- INSERT ... ON CONFLICT DO UPDATE ... WHERE status = 'planned', so a re-run only refreshes planned rows.
--
-- Additive only. Reverse with:
--   DROP TRIGGER trg_edition_plan_posted_no_update;
--   DROP TRIGGER trg_edition_plan_posted_no_delete;
--   DROP TABLE edition_plan;

CREATE TABLE IF NOT EXISTS edition_plan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  edition_date TEXT NOT NULL
    CHECK (edition_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  surface TEXT NOT NULL CHECK (surface IN ('website', 'social')),
  platform TEXT NOT NULL
    CHECK (platform IN ('website', 'facebook_page', 'instagram', 'pinterest', 'x')),
  channel TEXT CHECK (channel IS NULL OR channel IN ('zapier', 'buffer')),
  content_item_id TEXT,
  story_ref TEXT,
  text TEXT,
  link TEXT,
  image_url TEXT,
  image_alt TEXT,
  skip INTEGER NOT NULL DEFAULT 0 CHECK (skip IN (0, 1)),
  skip_reason TEXT
    CHECK (skip_reason IS NULL OR skip_reason IN ('no_image', 'picture_shape', 'budget', 'empty_pool')),
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'queued', 'posted', 'failed', 'skipped')),
  external_id TEXT,
  posted_at TEXT,
  error TEXT,
  plan_version TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  UNIQUE (edition_date, surface, platform),
  CHECK (
    (surface = 'website' AND platform = 'website')
    OR (surface = 'social' AND platform <> 'website')
  )
);

CREATE INDEX IF NOT EXISTS idx_edition_plan_date ON edition_plan (edition_date);
CREATE INDEX IF NOT EXISTS idx_edition_plan_status_date ON edition_plan (status, edition_date);

CREATE TRIGGER IF NOT EXISTS trg_edition_plan_posted_no_update
BEFORE UPDATE ON edition_plan
WHEN OLD.status = 'posted'
BEGIN
  SELECT RAISE(ABORT, 'edition_plan: a posted row cannot be changed');
END;

CREATE TRIGGER IF NOT EXISTS trg_edition_plan_posted_no_delete
BEFORE DELETE ON edition_plan
WHEN OLD.status = 'posted'
BEGIN
  SELECT RAISE(ABORT, 'edition_plan: a posted row cannot be deleted');
END;
