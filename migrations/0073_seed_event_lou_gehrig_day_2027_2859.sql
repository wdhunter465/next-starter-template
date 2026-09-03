-- 0073_seed_event_lou_gehrig_day_2027_2859.sql
-- #2859: seed the first real Club Home "Events & Calendar" record, per Bill.
-- Idempotent: will not duplicate rows if re-run. Also republishes the row if
-- it already exists but was left in 'hidden' status (e.g. drafted through
-- /admin/events before this migration ran) -- an insert-if-missing guard
-- alone would silently no-op and leave it unpublished.

UPDATE events
SET status = 'posted', updated_at = datetime('now')
WHERE title = 'Lou Gehrig Day' AND start_date = '2027-06-02' AND status != 'posted';

INSERT INTO events (title, start_date, end_date, status)
SELECT
  'Lou Gehrig Day' AS title,
  '2027-06-02' AS start_date,
  '2027-06-02' AS end_date,
  'posted' AS status
WHERE NOT EXISTS (
  SELECT 1 FROM events WHERE title = 'Lou Gehrig Day' AND start_date = '2027-06-02'
);
