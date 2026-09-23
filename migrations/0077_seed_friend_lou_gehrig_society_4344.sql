-- 0077_seed_friend_lou_gehrig_society_4344.sql
-- #4344: add The Lou Gehrig Society. Does not hide or delete LouGehrig.com.
-- Idempotent: will not duplicate rows if re-run.

INSERT INTO friends (name, kind, blurb, url, status)
SELECT
  'The Lou Gehrig Society' AS name,
  'charity' AS kind,
  'Supporting research and programs to conquer ALS and other neuromuscular diseases.' AS blurb,
  'https://www.thelougehrigsociety.org/' AS url,
  'posted' AS status
WHERE NOT EXISTS (
  SELECT 1 FROM friends
  WHERE url IN (
    'https://www.thelougehrigsociety.org/',
    'https://www.thelougehrigsociety.org',
    'https://theloungehrigsociety.org/',
    'https://theloungehrigsociety.org'
  )
);
