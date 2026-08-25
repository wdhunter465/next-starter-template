-- 0060_media_assets_perceptual_hash.sql
-- #3552 phase 4: adds a perceptual (difference-hash) column to media_assets
-- so a newly-ingested photo can be compared against every already-ingested
-- photo for a likely cross-source duplicate (the same real-world photo
-- found on two different platforms, therefore two different source_urls --
-- not caught by the source_url dedupe guard added in phase 1). Additive
-- only: a simple ADD COLUMN, no rebuild needed.

ALTER TABLE media_assets ADD COLUMN perceptual_hash TEXT;
