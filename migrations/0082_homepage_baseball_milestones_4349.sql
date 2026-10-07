-- 0082_homepage_baseball_milestones_4349.sql
-- Product 2026-10-07 (#4349): the public homepage timeline is Gehrig's
-- baseball milestones. Club Home uses every posted row in this same table
-- for the full life record. Non-baseball rows that migration 0078 flagged
-- visibility='public' (birth, death, farewell speech) move to visibility
-- 'member' so they stay in the table for Fan Club and drop off the homepage.
-- Career rows already flagged public stay on the homepage.

UPDATE milestones
SET visibility = 'member'
WHERE status = 'posted'
  AND visibility = 'public'
  AND event_type IS NOT NULL
  AND event_type != 'career';
