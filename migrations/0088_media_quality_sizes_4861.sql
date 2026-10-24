-- #4861: record how good each archived picture is and which standard sizes it
-- may be used at. One column per size so a reviewer can see exactly where a
-- picture must not be used. NULL means "not assessed" (rows archived before
-- this migration); 1 means usable at that size without upscaling; 0 means not
-- usable there. publish_blocked = 1 keeps a picture off the site entirely
-- (for example when it cannot be decoded or resized), even after rights clear.
-- No backfill.

ALTER TABLE media_assets ADD COLUMN width_px INTEGER;
ALTER TABLE media_assets ADD COLUMN height_px INTEGER;
ALTER TABLE media_assets ADD COLUMN quality_tier TEXT
  CHECK (quality_tier IS NULL OR quality_tier IN ('photograph', 'newspaper'));

-- Website sizes (long edge): thumbnail 320, small 640, medium 1280, large 1920.
ALTER TABLE media_assets ADD COLUMN ok_thumbnail INTEGER CHECK (ok_thumbnail IS NULL OR ok_thumbnail IN (0, 1));
ALTER TABLE media_assets ADD COLUMN ok_small INTEGER CHECK (ok_small IS NULL OR ok_small IN (0, 1));
ALTER TABLE media_assets ADD COLUMN ok_medium INTEGER CHECK (ok_medium IS NULL OR ok_medium IN (0, 1));
ALTER TABLE media_assets ADD COLUMN ok_large INTEGER CHECK (ok_large IS NULL OR ok_large IN (0, 1));

-- Social sizes: link card 1200x630, square post 1080x1080.
ALTER TABLE media_assets ADD COLUMN ok_social_link INTEGER CHECK (ok_social_link IS NULL OR ok_social_link IN (0, 1));
ALTER TABLE media_assets ADD COLUMN ok_social_square INTEGER CHECK (ok_social_square IS NULL OR ok_social_square IN (0, 1));

ALTER TABLE media_assets ADD COLUMN publish_blocked INTEGER NOT NULL DEFAULT 0
  CHECK (publish_blocked IN (0, 1));
ALTER TABLE media_assets ADD COLUMN publish_block_reason TEXT;
