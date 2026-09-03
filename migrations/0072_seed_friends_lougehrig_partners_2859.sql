-- 0072_seed_friends_lougehrig_partners_2859.sql
-- #2859: seed additional "Friends of the Fan Club" / Recognition partner tiles
-- Bill supplied on 2026-09-03. Idempotent: will not duplicate rows if re-run.

INSERT INTO friends (name, kind, blurb, url, status)
SELECT
  'Phi Delta Theta — Lou Gehrig Award' AS name,
  'charity' AS kind,
  'The Phi Delta Theta Fraternity’s Lou Gehrig Award, honoring collegiate baseball players who exemplify Gehrig’s character on and off the field.' AS blurb,
  'https://museum.phideltatheta.org/lou-gehrig-award/' AS url,
  'posted' AS status
WHERE NOT EXISTS (SELECT 1 FROM friends WHERE url = 'https://museum.phideltatheta.org/lou-gehrig-award/');

INSERT INTO friends (name, kind, blurb, url, status)
SELECT
  'I AM ALS' AS name,
  'charity' AS kind,
  'A community-driven organization fighting to end ALS through advocacy, research, and support for people living with ALS.' AS blurb,
  'https://www.iamals.org/' AS url,
  'posted' AS status
WHERE NOT EXISTS (SELECT 1 FROM friends WHERE url = 'https://www.iamals.org/' OR url = 'https://www.iamals.org');

INSERT INTO friends (name, kind, blurb, url, status)
SELECT
  'LouGehrig.com' AS name,
  'business' AS kind,
  'A dedicated archive of Lou Gehrig history, statistics, and memorabilia.' AS blurb,
  'https://lougehrig.com/' AS url,
  'posted' AS status
WHERE NOT EXISTS (SELECT 1 FROM friends WHERE url = 'https://lougehrig.com/' OR url = 'https://lougehrig.com');
