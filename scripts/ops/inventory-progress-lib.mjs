// #5231 -- inventory progress against the confirmed target (Product Authority, 2026-11-13): at least 396
// approved stories, each with a rights-cleared picture, for December 2026 plus 2027 (one post a day), with the
// weekday-only fallback if there is a shortage. Pure functions (SQL text, calendar math, classification,
// Markdown); the CLI in inventory-progress.mjs runs the SQL. Nothing here writes.

export const TARGET = 396;
export const PLAN_START = '2026-12-01';
export const PLAN_END = '2027-12-31';
export const MARKER = '<!-- inventory-progress-5231 -->';

// A story is a canonical content_inventory row. "Approved" means published. A "cleared picture" is an associated
// photos row that is publication_eligible and off rights hold, the same test the site uses to show a picture.
const CLEARED_PICTURE_EXISTS = `EXISTS (
         SELECT 1
           FROM content_inventory_media cim
           JOIN photos p ON p.id = cim.media_id
          WHERE cim.story_id = ci.id
            AND cim.media_role IN ('primary_image', 'gallery_image', 'supporting_image')
            AND p.publication_eligible = 1
            AND p.rights_hold = 0)`;

export const COUNTS_SQL = `
SELECT
  (SELECT COUNT(*) FROM content_inventory WHERE canonical = 1) AS stories_total,
  (SELECT COUNT(*) FROM content_inventory WHERE canonical = 1 AND status = 'published') AS stories_published,
  (SELECT COUNT(*) FROM content_inventory WHERE canonical = 1 AND status = 'draft') AS stories_draft,
  (SELECT COUNT(*) FROM content_inventory ci
    WHERE ci.canonical = 1 AND ci.status = 'published' AND ${CLEARED_PICTURE_EXISTS}) AS stories_cleared,
  (SELECT COUNT(*) FROM content_inventory ci
    WHERE ci.canonical = 1 AND ci.status = 'draft' AND ${CLEARED_PICTURE_EXISTS}) AS drafts_with_cleared_picture`;

function parseUtcDate(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Inclusive count of calendar days between two YYYY-MM-DD dates (0 if end is before start). */
export function daysInclusive(start, end) {
  const s = parseUtcDate(start);
  const e = parseUtcDate(end);
  return e < s ? 0 : Math.round((e - s) / 86_400_000) + 1;
}

/** Inclusive count of Monday to Friday days between two YYYY-MM-DD dates. */
export function weekdaysInclusive(start, end) {
  const s = parseUtcDate(start);
  const e = parseUtcDate(end);
  let count = 0;
  for (let t = s; t <= e; t += 86_400_000) {
    const day = new Date(t).getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}

const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

/**
 * counts: the single row from COUNTS_SQL. today: YYYY-MM-DD. The posting window is the later of today and
 * PLAN_START, through PLAN_END. Stories that have already been used for a post are not subtracted yet.
 */
export function computeProgress(counts, today) {
  const cleared = num(counts.stories_cleared);
  const start = parseUtcDate(today) > parseUtcDate(PLAN_START) ? String(today).slice(0, 10) : PLAN_START;
  const remainingDays = daysInclusive(start, PLAN_END);
  const remainingWeekdays = weekdaysInclusive(start, PLAN_END);
  let posting;
  if (remainingDays === 0) posting = 'plan_window_over';
  else if (cleared >= remainingDays) posting = 'daily_ok';
  else if (cleared >= remainingWeekdays) posting = 'switch_to_weekdays';
  else posting = 'short_even_for_weekdays';
  return {
    today: String(today).slice(0, 10),
    target: TARGET,
    stories_total: num(counts.stories_total),
    stories_published: num(counts.stories_published),
    stories_draft: num(counts.stories_draft),
    stories_cleared: cleared,
    drafts_with_cleared_picture: num(counts.drafts_with_cleared_picture),
    toward_target: Math.min(cleared, TARGET),
    still_needed: Math.max(TARGET - cleared, 0),
    percent: Math.min(100, Math.round((cleared / TARGET) * 100)),
    remaining_days: remainingDays,
    remaining_weekdays: remainingWeekdays,
    posting,
  };
}

const POSTING_TEXT = {
  daily_ok: 'Daily posting is covered: cleared stories are at least the number of days left in the plan.',
  switch_to_weekdays: 'Shortage for daily posting: cleared stories cover the weekdays left but not every day. Per Product Authority (2026-11-13), post on weekdays only.',
  short_even_for_weekdays: 'Shortage even for weekday posting: cleared stories are fewer than the weekdays left in the plan.',
  plan_window_over: 'The plan window (to 2027-12-31) is over.',
};

export function renderMarkdown(progress) {
  return [
    MARKER,
    `## Story inventory progress, ${progress.today}`,
    '',
    `**${progress.toward_target} of ${progress.target}** approved stories with a rights-cleared picture (${progress.percent}%). Still needed: **${progress.still_needed}**.`,
    '',
    '| Measure | Count |',
    '| --- | --- |',
    `| Stories in the inventory (canonical) | ${progress.stories_total} |`,
    `| Published (approved) | ${progress.stories_published} |`,
    `| Published with a cleared picture (counts toward the target) | ${progress.stories_cleared} |`,
    `| Pending (draft) | ${progress.stories_draft} |`,
    `| Pending with a cleared picture (ready to approve) | ${progress.drafts_with_cleared_picture} |`,
    '',
    `**Posting window** (${progress.today > PLAN_START ? progress.today : PLAN_START} to ${PLAN_END}): ${progress.remaining_days} days, ${progress.remaining_weekdays} weekdays.`,
    '',
    `**Weekday fallback check:** ${POSTING_TEXT[progress.posting]}`,
    '',
    '_Limits: a cleared picture is an associated photo that is publication-eligible and off rights hold. Stories already used for a post are not subtracted yet. Read-only; nothing was written._',
  ].join('\n');
}
