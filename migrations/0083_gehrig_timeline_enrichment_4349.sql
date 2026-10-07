-- 0083_gehrig_timeline_enrichment_4349.sql
-- #4349: add researched Gehrig life and baseball events to the one milestones
-- table. Wording is original. Dates and figures follow SABR
-- (https://sabr.org/bioproj/person/lou-gehrig/) and career totals follow
-- Baseball-Reference (https://www.baseball-reference.com/players/g/gehrilo01.shtml).
-- Homepage rows are baseball milestones: event_type career and visibility public.
-- Every other posted row is for the Club Home life timeline only.

-- Life and amateur baseball (Club Home only) ---------------------------------

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1920, '1920-06-26', 'graduation', 'Hits a grand slam out of Cubs Park for Commerce High',
  'In a high-school championship at Cubs Park, Gehrig hits a bases-loaded home run in the ninth.',
  'Commerce High of New York led Lane Tech of Chicago 8-6 when Gehrig batted with the bases full. He hit the first pitch over the right-field wall. The park was later renamed Wrigley Field.',
  'https://sabr.org/bioproj/person/lou-gehrig/', 'member', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Hits a grand slam out of Cubs Park for Commerce High');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1921, NULL, 'public_appearance', 'Tryout at the Polo Grounds for the Giants',
  'A Giants scout brings Gehrig to the Polo Grounds, where a batting-practice show does not produce a contract.',
  'Gehrig hit several balls out during batting practice, then missed a ground ball in the field. John McGraw did not sign him. The scout later steered him to Hartford instead.',
  'https://sabr.org/bioproj/person/lou-gehrig/', 'member', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Tryout at the Polo Grounds for the Giants');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1921, NULL, 'career', 'Plays for Hartford under assumed names',
  'Gehrig appears in a dozen Eastern League games for the Hartford Senators as Lefty Gehrig and Lou Lewis.',
  'Paid summer ball under those names cost him a year of Columbia eligibility. Coach Andy Coakley persuaded rival schools to suspend him for a year rather than ban him.',
  'https://sabr.org/bioproj/person/lou-gehrig/', 'member', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Plays for Hartford under assumed names');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1923, NULL, 'graduation', 'Sets Columbia single-season hitting marks',
  'In his only Columbia baseball season, Gehrig hits .444 with seven home runs in 19 games.',
  'He also pitched. A teammate later described one home run at Cornell that cleared the fence, a road, and landed in the trees beyond.',
  'https://sabr.org/bioproj/person/lou-gehrig/', 'member', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Sets Columbia single-season hitting marks');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1923, '1923-04-26', 'career', 'Paul Krichell scouts Gehrig against Rutgers',
  'Yankees scout Paul Krichell watches Gehrig hit two home runs against Rutgers and calls Ed Barrow.',
  'Krichell told Barrow he had found another Babe Ruth. Gehrig then agreed to a contract with a $1,500 bonus and $400 a month.',
  'https://sabr.org/bioproj/person/lou-gehrig/', 'member', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Paul Krichell scouts Gehrig against Rutgers');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1923, NULL, 'career', 'Optioned to Hartford after a brief Yankees look',
  'After a handful of Yankees games in 1923, Gehrig is sent to Hartford and hits .304 with 24 home runs in 59 games.',
  'Hartford finished in September and the Yankees recalled him. He hit well in a short return, but Commissioner Landis would not add him to the World Series roster.',
  'https://sabr.org/bioproj/person/lou-gehrig/', 'member', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Optioned to Hartford after a brief Yankees look');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1924, NULL, 'career', 'Returns to Hartford for a full minor-league season',
  'Gehrig spends 1924 at Hartford, hitting .369 with 37 home runs in 134 games.',
  'The Yankees still had no everyday spot for him. He rejoined New York again when the Hartford season ended.',
  'https://sabr.org/bioproj/person/lou-gehrig/', 'member', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Returns to Hartford for a full minor-league season');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1927, NULL, 'public_appearance', 'Barnstorms with Babe Ruth after the 1927 season',
  'Ruth and Gehrig tour the country captaining exhibition teams, the Bustin Babes and the Larrupin Lous.',
  'The tour drew very large crowds. Ruth''s publicist later estimated Gehrig earned about $10,000, more than his 1927 Yankees salary.',
  'https://sabr.org/bioproj/person/lou-gehrig/', 'member', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Barnstorms with Babe Ruth after the 1927 season');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1941, NULL, 'death', 'Interred at Kensico Cemetery in Valhalla',
  'After a funeral in Riverdale, Gehrig is cremated and buried at Kensico Cemetery.',
  'The same cemetery holds Yankees figures who shaped his career, including Ed Barrow, Jacob Ruppert, Paul Krichell, and Andy Coakley. Babe Ruth is buried in the neighboring Gate of Heaven Cemetery.',
  'https://sabr.org/bioproj/person/lou-gehrig/', 'member', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Interred at Kensico Cemetery in Valhalla');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1969, NULL, 'public_appearance', 'Voted the greatest first baseman by the baseball writers',
  'The Baseball Writers'' Association of America names Gehrig the greatest first baseman in a 1969 poll.',
  'The vote came nearly three decades after his death and placed him ahead of every other first baseman the writers considered.',
  'https://baseballhall.org/hall-of-famers/gehrig-lou', 'member', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Voted the greatest first baseman by the baseball writers');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1995, '1995-09-06', 'public_appearance', 'Cal Ripken Jr. passes the consecutive-games record',
  'Ripken plays in his 2,131st straight game, ending Gehrig''s record of 2,130 that had stood since 1939.',
  'The streak Gehrig began in 1925 had been treated as unreachable for 56 years. Ripken''s game on September 6, 1995 moved the record forward.',
  'https://baseballhall.org/hall-of-famers/gehrig-lou', 'member', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Cal Ripken Jr. passes the consecutive-games record');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1999, NULL, 'public_appearance', 'Leading vote-getter on the Major League Baseball All-Century Team',
  'Fans voting for the 1999 All-Century Team give Gehrig the most votes of any player.',
  'The selection kept him in the public argument about the best players of the century, sixty years after his last game.',
  'https://baseballhall.org/hall-of-famers/gehrig-lou', 'member', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Leading vote-getter on the Major League Baseball All-Century Team');

-- Baseball milestones (homepage and Club Home) -------------------------------

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1926, '1926-08-13', 'career', 'Hits two home runs off Walter Johnson',
  'Gehrig hits two over-the-fence home runs against Walter Johnson at Griffith Stadium.',
  'Johnson had won 417 games and had never allowed one player two over-the-fence home runs in a game. Gehrig did it at age 23.',
  'https://sabr.org/bioproj/person/lou-gehrig/', 'public', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Hits two home runs off Walter Johnson');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1926, NULL, 'career', 'Plays in his first World Series',
  'Gehrig hits .348 in the 1926 World Series as the Yankees lose to the St. Louis Cardinals in seven games.',
  'In the opener he drove in both New York runs in a 2-1 win. The Cardinals took the series in the seventh game.',
  'https://sabr.org/bioproj/person/lou-gehrig/', 'public', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Plays in his first World Series');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1927, NULL, 'career', 'Yankees sweep the Pirates in the World Series',
  'Gehrig hits .308 with four RBIs as the 1927 Yankees sweep Pittsburgh.',
  'The club won 110 games that year. Gehrig''s winner''s share was $5,592, against an $8,000 season salary.',
  'https://sabr.org/bioproj/person/lou-gehrig/', 'public', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Yankees sweep the Pirates in the World Series');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1928, NULL, 'career', 'Hits .545 with four home runs in the World Series',
  'Gehrig bats .545 with four home runs and nine RBIs as the Yankees sweep the Cardinals.',
  'Two of the home runs came in Game 3, one of them inside the park. Babe Ruth still drew the larger share of the attention, batting .625.',
  'https://sabr.org/bioproj/person/lou-gehrig/', 'public', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Hits .545 with four home runs in the World Series');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1930, NULL, 'career', 'Hits .379 and drives in 174 runs while playing hurt',
  'Gehrig bats .379 with 41 home runs and a league-leading 174 RBIs, including the last three weeks with a broken finger.',
  'Doctors later found bone chips in his left elbow that also needed surgery. He still appeared in every Yankees game that year.',
  'https://sabr.org/bioproj/person/lou-gehrig/', 'public', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Hits .379 and drives in 174 runs while playing hurt');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1931, NULL, 'career', 'Sets the American League record with 184 RBIs',
  'Gehrig drives in 184 runs, an American League record, while batting .341 with 46 home runs.',
  'He also led the league in hits, runs, and total bases. A home run on April 26 was taken off the books after he passed a teammate who had left the base path, costing him a 47th homer.',
  'https://sabr.org/bioproj/person/lou-gehrig/', 'public', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Sets the American League record with 184 RBIs');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1932, NULL, 'career', 'Yankees sweep the Cubs in the World Series',
  'Gehrig hits .529 with three home runs as New York sweeps Chicago in the 1932 World Series.',
  'He scored nine runs and drove in eight. The series is remembered more for Ruth''s called-shot home run in Game 3 than for Gehrig''s line.',
  'https://sabr.org/bioproj/person/lou-gehrig/', 'public', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Yankees sweep the Cubs in the World Series');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1935, '1935-04-21', 'career', 'Named captain of the Yankees',
  'Joe McCarthy names Gehrig Yankees captain on April 21, 1935, after Ruth has left the club.',
  'Gehrig told Eleanor he was unsure he was vocal enough for the job. He kept the captaincy until his death in 1941.',
  'https://sabr.org/bioproj/person/lou-gehrig/', 'public', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Named captain of the Yankees');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1936, NULL, 'career', 'Yankees beat the Giants in the World Series',
  'Gehrig hits .292 with two home runs as the Yankees defeat the Giants in six games.',
  'In Game 4 he homered off Carl Hubbell. It was New York''s first championship in four years. That October he was named American League MVP for the second time.',
  'https://sabr.org/bioproj/person/lou-gehrig/', 'public', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Yankees beat the Giants in the World Series');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1937, NULL, 'career', 'Hits his last World Series home run',
  'Gehrig homers off Carl Hubbell again as the Yankees beat the Giants in five games.',
  'He batted .294 and drove in three runs. The homer was the 10th of his World Series career and his last.',
  'https://sabr.org/bioproj/person/lou-gehrig/', 'public', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Hits his last World Series home run');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1938, NULL, 'career', 'Yankees sweep the Cubs for a third straight title',
  'The Yankees sweep Chicago in the 1938 World Series. Gehrig hits .286 without an extra-base hit.',
  'It was the club''s third consecutive pennant and sixth World Series championship of his career.',
  'https://sabr.org/bioproj/person/lou-gehrig/', 'public', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Yankees sweep the Cubs for a third straight title');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1939, '1939-04-30', 'career', 'Plays his final major-league game',
  'Gehrig''s last game is April 30, 1939, against Washington. He goes 0-for-4.',
  'He removed himself from the lineup two days later, ending the 2,130-game streak. He did not play again.',
  'https://www.baseball-reference.com/players/g/gehrilo01.shtml', 'public', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Plays his final major-league game');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1939, NULL, 'career', 'Yankees retire uniform number 4',
  'The Yankees retire Gehrig''s number 4, the first time a major-league club retires a player''s uniform number.',
  'The honor came in his final season, alongside his Hall of Fame election. Number 4 has not been issued to another Yankee.',
  'https://baseballhall.org/hall-of-famers/gehrig-lou', 'public', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Yankees retire uniform number 4');

INSERT INTO milestones (year, event_date, event_type, title, description, detail_body, source_url, visibility, status)
SELECT 1939, NULL, 'career', 'Career line: .340, 493 home runs, 1,995 RBIs',
  'Across 17 seasons and 2,164 games, Gehrig bats .340 with 493 home runs and 1,995 runs batted in.',
  'He also drew 1,508 walks and finished with 23 career grand slams, a mark that stood until 2013. The Yankees won seven pennants and six World Series during his years with the club.',
  'https://www.baseball-reference.com/players/g/gehrilo01.shtml', 'public', 'posted'
WHERE NOT EXISTS (SELECT 1 FROM milestones WHERE title = 'Career line: .340, 493 home runs, 1,995 RBIs');
