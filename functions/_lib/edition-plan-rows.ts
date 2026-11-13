// #5075 -- turns a planner result (#5039) into rows for the `edition_plan` table (migration 0099)
// and holds the one statement that writes them. Pure: it builds rows and SQL and touches no database.
//
// Re-running the write is safe. The statement inserts a new row, or refreshes an existing row only
// while its status is still 'planned'. A queued, posted, failed or skipped row is left as it is, and
// the migration's triggers refuse any change to a posted row.

import type { EditionPlan, PlatformKey } from './social-edition-planner';

export type EditionPlanRow = {
  edition_date: string;
  surface: 'website' | 'social';
  /** 'website' for the website surface; the platform key for social. */
  platform: 'website' | PlatformKey;
  channel: 'zapier' | 'buffer' | null;
  content_item_id: string | null;
  story_ref: string | null;
  text: string | null;
  link: string | null;
  image_url: string | null;
  image_alt: string | null;
  skip: 0 | 1;
  skip_reason: 'no_image' | 'picture_shape' | 'budget' | 'empty_pool' | null;
  status: 'planned' | 'skipped';
  plan_version: string;
};

/** Column order for EDITION_PLAN_UPSERT_SQL; bind values in this order. */
export const EDITION_PLAN_COLUMNS = [
  'edition_date',
  'surface',
  'platform',
  'channel',
  'content_item_id',
  'story_ref',
  'text',
  'link',
  'image_url',
  'image_alt',
  'skip',
  'skip_reason',
  'status',
  'plan_version',
] as const;

export const EDITION_PLAN_UPSERT_SQL = `INSERT INTO edition_plan (${EDITION_PLAN_COLUMNS.join(', ')})
VALUES (${EDITION_PLAN_COLUMNS.map(() => '?').join(', ')})
ON CONFLICT (edition_date, surface, platform) DO UPDATE SET
  channel = excluded.channel,
  content_item_id = excluded.content_item_id,
  story_ref = excluded.story_ref,
  text = excluded.text,
  link = excluded.link,
  image_url = excluded.image_url,
  image_alt = excluded.image_alt,
  skip = excluded.skip,
  skip_reason = excluded.skip_reason,
  status = excluded.status,
  plan_version = excluded.plan_version,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE edition_plan.status = 'planned'`;

export function bindValues(row: EditionPlanRow): Array<string | number | null> {
  return EDITION_PLAN_COLUMNS.map((column) => row[column]);
}

/**
 * One row per website day, and one row per social day and platform that the planner placed.
 * A social day with no placed platforms (a budget-deferred day) produces no rows; the planner's
 * summary already lists those days. A website day with no item is a skipped row, so the gap is visible.
 */
export function planToRows(plan: EditionPlan, planVersion: string): EditionPlanRow[] {
  if (!planVersion.trim()) throw new Error('planVersion is required');
  const rows: EditionPlanRow[] = [];

  for (const day of plan.website) {
    const empty = day.item_id === null;
    rows.push({
      edition_date: day.date,
      surface: 'website',
      platform: 'website',
      channel: null,
      content_item_id: empty ? null : String(day.item_id),
      story_ref: null,
      text: null,
      link: null,
      image_url: null,
      image_alt: null,
      skip: empty ? 1 : 0,
      skip_reason: empty ? 'empty_pool' : null,
      status: empty ? 'skipped' : 'planned',
      plan_version: planVersion,
    });
  }

  for (const day of plan.social) {
    for (const [platform, variant] of Object.entries(day.platforms) as Array<
      [PlatformKey, NonNullable<(typeof day.platforms)[PlatformKey]>]
    >) {
      rows.push({
        edition_date: day.date,
        surface: 'social',
        platform,
        channel: variant.channel,
        content_item_id: day.item_id === null ? null : String(day.item_id),
        story_ref: null,
        text: variant.text,
        link: variant.link,
        image_url: variant.image_url,
        image_alt: variant.image_alt,
        skip: variant.skip ? 1 : 0,
        skip_reason: variant.skip_reason,
        status: variant.skip ? 'skipped' : 'planned',
        plan_version: planVersion,
      });
    }
  }
  return rows;
}
