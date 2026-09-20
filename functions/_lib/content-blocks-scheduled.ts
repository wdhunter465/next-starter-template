// #4253 -- scheduled auto-publish for content_blocks rows.
//
// A content_blocks row becomes "scheduled" by having a non-null
// scheduled_publish_at -- a "YYYY-MM-DD HH:MM:SS" string authored (and
// compared) in America/New_York local time, per the admin create endpoint's
// publish_time default -- while status stays 'draft'. This mirrors the
// manual publish flow in functions/api/admin/cms/publish.ts (copy body_md ->
// published_body_md, bump version, write a content_revisions row) so a
// scheduled row and a manually-published row are indistinguishable once
// live.
//
// The due-check deliberately does NOT compare against SQLite's
// datetime('now') (UTC): scheduled_publish_at is authored in NY-local time,
// so comparing it to a UTC clock would make a 10:00 AM row look overdue as
// soon as UTC's own clock ticks past 10:00 -- hours before it's actually
// 10:00 AM in New York. nowInNewYork() computes a comparable NY-local "now"
// string instead, which is also what makes the ops-scheduled-content-publish
// workflow's 14:00/15:00 UTC dual-cron actually cover the EST/EDT boundary
// correctly (only the tick that's genuinely >= 10:00 AM NY time finds
// anything due).

export type DueContentBlock = {
  key: string;
  page: string;
  section: string;
  title: string;
  body_md: string;
  social_caption: string | null;
  image_url: string | null;
  image_alt: string | null;
  scheduled_publish_at: string;
  version: number;
};

export function nowInNewYork(): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

export async function findDueScheduledBlocks(db: any): Promise<DueContentBlock[]> {
  const rows = await db
    .prepare(
      `SELECT key, page, section, title, body_md, social_caption, image_url, image_alt, scheduled_publish_at, version
       FROM content_blocks
       WHERE status = 'draft'
         AND scheduled_publish_at IS NOT NULL
         AND scheduled_publish_at <= ?
       ORDER BY scheduled_publish_at ASC`,
    )
    .bind(nowInNewYork())
    .all();

  return ((rows?.results || []) as DueContentBlock[]).map((row) => ({
    ...row,
    version: Number(row.version || 1),
  }));
}

/**
 * Publishes a due block. Returns null (a no-op) if another concurrent call
 * already published this same row between this call's findDueScheduledBlocks
 * read and its own UPDATE -- the WHERE status = 'draft' guard means the
 * UPDATE affects zero rows in that race, and this function must not insert a
 * duplicate content_revisions row or report a publish (which would fire a
 * duplicate Zapier social post) for a row it didn't actually transition.
 */
export async function publishScheduledBlock(
  db: any,
  block: DueContentBlock,
  publishedBy: string,
): Promise<{ key: string; version: number; published_at: string } | null> {
  const nowRow = await db.prepare("SELECT datetime('now') as now").first();
  const now = String((nowRow as any)?.now || '');
  const nextVersion = block.version + 1;

  const updateResult = await db
    .prepare(
      `UPDATE content_blocks
       SET status = 'published',
           published_body_md = body_md,
           published_at = ?,
           version = ?,
           updated_at = ?,
           updated_by = ?,
           scheduled_publish_at = NULL
       WHERE key = ? AND status = 'draft'`,
    )
    .bind(now, nextVersion, now, publishedBy, block.key)
    .run();

  const changes = Number((updateResult as any)?.meta?.changes || 0);
  if (changes === 0) return null;

  await db
    .prepare(
      `INSERT INTO content_revisions (key, version, body_md, status, updated_at, updated_by)
       VALUES (?, ?, ?, 'published', ?, ?)`,
    )
    .bind(block.key, nextVersion, block.body_md, now, publishedBy)
    .run();

  return { key: block.key, version: nextVersion, published_at: now };
}
