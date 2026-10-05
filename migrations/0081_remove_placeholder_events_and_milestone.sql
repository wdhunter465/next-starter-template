-- 0081_remove_placeholder_events_and_milestone.sql
-- Issue #4411: Product Authority direction (2026-10-01) that placeholder content
-- must not appear on the website.
--
-- Removes only the exact placeholder rows seeded by migrations 0009/0015/0028, the
-- Feb 2026 calendar seed, and the now-removed admin "Seed next 10 placeholders"
-- control. Every predicate matches title AND description (and location/host for the
-- generated calendar rows), so real events and milestones are never touched.
-- Applies to Production (lgfc_lite) and Development (lgfc-litedev); rows that do
-- not exist in a given database are simply not matched.

DELETE FROM events
WHERE (title = 'Event placeholder'
       AND description = 'This is text content from events table.')
   OR (title LIKE 'LGFC Event __'
       AND description = 'Placeholder event for calendar display.'
       AND location = 'LGFC'
       AND host = 'Fan Club')
   OR (title LIKE 'LGFC Placeholder Event __'
       AND description = 'Placeholder event for calendar display (replace with real content later).'
       AND location = 'LGFC'
       AND host = 'Fan Club');

DELETE FROM milestones
WHERE title = 'Milestone placeholder'
  AND description = 'This is text content from milestones table.';
