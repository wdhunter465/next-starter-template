-- 0100_events_calendar_import_4889.sql
-- #4889: events imported from an approved calendar keep their source, the source's own id, and a lock flag so a
-- manual admin edit is never overwritten by the next import. Nothing is imported by this migration.
ALTER TABLE events ADD COLUMN source TEXT;
ALTER TABLE events ADD COLUMN source_uid TEXT;
ALTER TABLE events ADD COLUMN locked INTEGER NOT NULL DEFAULT 0 CHECK (locked IN (0, 1));
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_source_uid ON events(source, source_uid) WHERE source IS NOT NULL;
