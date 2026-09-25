-- 0078_gehrig_life_timeline_3161.sql
-- #3161: extend `milestones` into a detailed Gehrig life timeline.
--
-- Public homepage (#milestones, no auth gate) continues to show headline
-- milestones only. FanClub members get the full researched timeline: more
-- data points (marriage, school, public appearances, finer-grained career
-- moments) plus a longer narrative per entry.
--
-- New columns (existing rows keep their current public behavior via defaults):
--   event_type   career|birth|death|marriage|graduation|public_appearance
--   event_date   ISO date (YYYY-MM-DD), optional and more precise than `year`.
--                Already recognized by functions/api/milestones/list.ts's
--                date-column probe, so ordering improves automatically.
--   detail_body  Extended, member-only narrative. Never selected by the
--                public list endpoint.
--   source_url   Attribution for the researched detail.
--   visibility   public|member. Public endpoint filters to 'public'.

ALTER TABLE milestones ADD COLUMN event_type TEXT NOT NULL DEFAULT 'career';
ALTER TABLE milestones ADD COLUMN event_date TEXT;
ALTER TABLE milestones ADD COLUMN detail_body TEXT;
ALTER TABLE milestones ADD COLUMN source_url TEXT;
ALTER TABLE milestones ADD COLUMN visibility TEXT NOT NULL DEFAULT 'public';

CREATE INDEX IF NOT EXISTS idx_milestones_visibility_date ON milestones(status, visibility, event_date);

-- Seed data is idempotent (WHERE NOT EXISTS by title) so re-running this
-- migration never duplicates rows.

-- Public headline milestones -------------------------------------------------

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1903, '1903-06-19', 'birth', 'Born in New York City',
  'Henry Louis Gehrig is born in the Yorkville section of Manhattan.',
  'Lou Gehrig was born to German immigrant parents Heinrich and Christina Gehrig on June 19, 1903. He was the only one of four children to survive infancy.',
  'https://baseballhall.org/hall-of-famers/gehrig-lou', 'public', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Born in New York City');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1923, '1923-06-15', 'career', 'Major League debut with the New York Yankees',
  'Gehrig makes his first appearance for the Yankees as a pinch hitter.',
  'Signed by Yankees scout Paul Krichell out of Columbia University, Gehrig debuted on June 15, 1923, and would go on to spend his entire 17-year career with the Yankees.',
  'https://sabr.org/bioproj/person/lou-gehrig/', 'public', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Major League debut with the New York Yankees');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1925, '1925-06-01', 'career', 'Begins the historic consecutive-games streak',
  'Gehrig starts at first base in place of Wally Pipp, launching a streak that would reach 2,130 games.',
  'What began as a routine substitution on June 1, 1925 turned into the "Iron Horse" streak, a record that stood for 56 years until broken by Cal Ripken Jr. in 1995.',
  'https://sabr.org/bioproj/person/lou-gehrig/', 'public', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Begins the historic consecutive-games streak');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1927, NULL, 'career', 'AL MVP, anchors the "Murderers'' Row" Yankees',
  'Gehrig wins his first American League Most Valuable Player award as part of one of the greatest lineups in baseball history.',
  'The 1927 Yankees are widely considered one of the greatest teams ever assembled. Gehrig batted .373 with 47 home runs and a then-record 175 RBI, edging teammate Babe Ruth for the MVP award.',
  'https://baseballhall.org/hall-of-famers/gehrig-lou', 'public', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'AL MVP, anchors the "Murderers'' Row" Yankees');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1934, NULL, 'career', 'Wins the Triple Crown',
  'Gehrig leads the American League in batting average, home runs, and RBI in the same season.',
  'In 1934 Gehrig hit .363 with 49 home runs and 165 RBI to capture the Triple Crown, one of the rarest feats in baseball.',
  'https://baseballhall.org/hall-of-famers/gehrig-lou', 'public', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Wins the Triple Crown');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1939, '1939-05-02', 'career', 'Voluntarily ends the 2,130-game streak',
  'Struggling with his health, Gehrig removes himself from the lineup before a game in Detroit.',
  'On May 2, 1939, Gehrig told manager Joe McCarthy he was benching himself "for the good of the team," ending a streak of 2,130 consecutive games. He would be diagnosed with ALS weeks later.',
  'https://sabr.org/bioproj/person/lou-gehrig/', 'public', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Voluntarily ends the 2,130-game streak');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1939, '1939-07-04', 'public_appearance', '"Luckiest Man" farewell speech at Yankee Stadium',
  'Gehrig addresses a packed Yankee Stadium on Lou Gehrig Appreciation Day.',
  'Between games of a doubleheader on July 4, 1939, Gehrig delivered his farewell address, telling the crowd, "Today I consider myself the luckiest man on the face of the earth." It remains one of the most famous speeches in sports history.',
  'https://baseballhall.org/hall-of-famers/gehrig-lou', 'public', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = '"Luckiest Man" farewell speech at Yankee Stadium');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1941, '1941-06-02', 'death', 'Dies in Riverdale, New York, at age 37',
  'Gehrig passes away from complications of ALS, less than two years after his diagnosis.',
  'Lou Gehrig died at his home in the Riverdale section of the Bronx on June 2, 1941. ALS is still widely known in the United States as "Lou Gehrig''s Disease."',
  'https://sabr.org/bioproj/person/lou-gehrig/', 'public', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Dies in Riverdale, New York, at age 37');

-- Member-only detailed timeline additions ------------------------------------

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1921, NULL, 'graduation', 'Graduates Commerce High School, enrolls at Columbia University',
  'Gehrig graduates from the High School of Commerce in Manhattan and enrolls at Columbia on an athletic scholarship.',
  'At Commerce High, Gehrig hit a legendary home run out of Chicago''s Wrigley Field in a schoolboy exhibition game. He enrolled at Columbia University in 1921, playing both football and baseball for the Lions as "Lou Lewis" for one summer season to preserve his college eligibility.',
  'https://sabr.org/bioproj/person/lou-gehrig/', 'member', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Graduates Commerce High School, enrolls at Columbia University');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1923, '1923-04-30', 'career', 'Leaves Columbia to sign with the Yankees',
  'Gehrig leaves Columbia University before graduating to sign a professional contract with the New York Yankees.',
  'Yankees scout Paul Krichell, who had watched Gehrig play for Columbia, convinced him to sign for a $1,500 bonus and a $400/month salary on April 30, 1923.',
  'https://sabr.org/bioproj/person/lou-gehrig/', 'member', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Leaves Columbia to sign with the Yankees');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1932, '1932-06-03', 'career', 'Hits four home runs in a single game',
  'Gehrig becomes the first American League player in the 20th century to hit four home runs in one game.',
  'Playing against the Philadelphia Athletics on June 3, 1932, Gehrig hit four consecutive home runs and narrowly missed a fifth on a deep fly ball caught at the wall.',
  'https://baseballhall.org/hall-of-famers/gehrig-lou', 'member', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Hits four home runs in a single game');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1933, '1933-09-29', 'marriage', 'Marries Eleanor Grace Twitchell',
  'Gehrig marries Eleanor Twitchell in New Rochelle, New York.',
  'Lou Gehrig and Eleanor Twitchell married on September 29, 1933. Eleanor became a devoted partner and, after his death, a lifelong advocate for ALS research and awareness.',
  'https://sabr.org/bioproj/person/lou-gehrig/', 'member', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Marries Eleanor Grace Twitchell');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1936, NULL, 'career', 'Wins a second AL MVP award',
  'Gehrig is named American League Most Valuable Player for the second time.',
  'In 1936 Gehrig led the league with 49 home runs and a .478 on-base percentage, helping the Yankees win the World Series and earning his second MVP award.',
  'https://baseballhall.org/hall-of-famers/gehrig-lou', 'member', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Wins a second AL MVP award');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1939, '1939-06-19', 'public_appearance', 'Diagnosed with ALS at the Mayo Clinic',
  'On his 36th birthday, Gehrig is diagnosed with amyotrophic lateral sclerosis.',
  'Gehrig traveled to the Mayo Clinic in Rochester, Minnesota, after his sudden decline in performance. He was diagnosed with ALS on June 19, 1939 — his 36th birthday. The news was made public days later.',
  'https://sabr.org/bioproj/person/lou-gehrig/', 'member', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Diagnosed with ALS at the Mayo Clinic');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1939, '1939-12-07', 'career', 'Elected to the Baseball Hall of Fame',
  'The Baseball Writers'' Association holds a special election, waiving the usual waiting period, to induct Gehrig.',
  'In recognition of his illness, the Hall of Fame waived its standard eligibility waiting period. Gehrig was elected on December 7, 1939, and formally inducted in 1939, becoming one of the fastest elections in history.',
  'https://baseballhall.org/hall-of-famers/gehrig-lou', 'member', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Elected to the Baseball Hall of Fame');
