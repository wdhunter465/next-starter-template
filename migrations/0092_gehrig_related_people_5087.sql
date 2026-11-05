-- #5087 (child of #5086): the reference list of people related to Lou Gehrig's story.
--
-- Product Authority direction (2026-11-05): no hand-made list of names and years. The list is
-- derived, first from Retrosheet's season roster files for 1923 to 1939 (every player on every team
-- for every season), later from the collected stories (family, school mates, friends, managers).
-- The subject gate keeps a record about another person only when the person is on this list, the
-- record's date falls inside the person's season window, and the record names Gehrig.
--
-- people:   one row per person. `permission_status` is the person-level answer used to block
--           everything linked to a person who has denied the Fan Club (default: none known, so
--           nobody is blocked until a denial is recorded). Nothing reads it yet.
-- seasons:  one row per person, season and team (a player traded mid-season has two rows).
--           `relation` is derived from the team: the Yankees are teammates, the other seven
--           American League clubs are opponents, National League clubs are `other_league`
--           (they met Gehrig only in a World Series or an All-Star game).
--
-- Reverse this migration with:
--   DROP TABLE gehrig_related_person_seasons;
--   DROP TABLE gehrig_related_people;

CREATE TABLE IF NOT EXISTS gehrig_related_people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  retrosheet_id TEXT UNIQUE,
  display_name TEXT NOT NULL,
  relation TEXT NOT NULL DEFAULT 'other'
    CHECK (relation IN ('teammate', 'opponent', 'other_league', 'family', 'school', 'friend', 'manager', 'other')),
  year_from INTEGER,
  year_to INTEGER,
  source TEXT NOT NULL
    CHECK (source IN ('retrosheet', 'story', 'manual')),
  source_content_item_id INTEGER,
  permission_status TEXT NOT NULL DEFAULT 'none_known'
    CHECK (permission_status IN ('none_known', 'approved', 'denied')),
  permission_note TEXT,
  reviewed_at TEXT,
  reviewed_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (year_from IS NULL OR year_to IS NULL OR year_from <= year_to)
);

CREATE TABLE IF NOT EXISTS gehrig_related_person_seasons (
  person_id INTEGER NOT NULL REFERENCES gehrig_related_people (id),
  season INTEGER NOT NULL,
  team TEXT NOT NULL,
  position TEXT,
  relation TEXT NOT NULL
    CHECK (relation IN ('teammate', 'opponent', 'other_league')),
  PRIMARY KEY (person_id, season, team)
);

CREATE INDEX IF NOT EXISTS idx_gehrig_related_person_seasons_season
  ON gehrig_related_person_seasons (season, relation);

CREATE INDEX IF NOT EXISTS idx_gehrig_related_people_name
  ON gehrig_related_people (display_name);
