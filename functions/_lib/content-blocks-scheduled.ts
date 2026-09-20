// #4253 -- scheduled auto-publish for content_blocks rows.
//
// A content_blocks row becomes "scheduled" by having a non-null
// scheduled_publish_at (an ISO datetime string comparable with SQLite's
// datetime('now')) while status stays 'draft'. This mirrors the manual
// publish flow in functions/api/admin/cms/publish.ts (copy body_md ->
// published_body_md, bump version, write a content_revisions row) so a
// scheduled row and a manually-published row are indistinguishable once
// live.

export type DueContentBlock = {
  key: string;
  page: string;
  section: string;
  title: string;
  body_md: string;
  social_caption: string | null;
  scheduled_publish_at: string;
  version: number;
};

export async function findDueScheduledBlocks(db: any): Promise<DueContentBlock[]> {
  const rows = await db
    .prepare(
      `SELECT key, page, section, title, body_md, social_caption, scheduled_publish_at, version
       FROM content_blocks
       WHERE status = 'draft'
         AND scheduled_publish_at IS NOT NULL
         AND scheduled_publish_at <= datetime('now')
       ORDER BY scheduled_publish_at ASC`,
    )
    .all();

  return ((rows?.results || []) as DueContentBlock[]).map((row) => ({
    ...row,
    version: Number(row.version || 1),
  }));
}

export async function publishScheduledBlock(
  db: any,
  block: DueContentBlock,
  publishedBy: string,
): Promise<{ key: string; version: number; published_at: string }> {
  const nowRow = await db.prepare("SELECT datetime('now') as now").first();
  const now = String((nowRow as any)?.now || '');
  const nextVersion = block.version + 1;

  await db
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

  await db
    .prepare(
      `INSERT INTO content_revisions (key, version, body_md, status, updated_at, updated_by)
       VALUES (?, ?, ?, 'published', ?, ?)`,
    )
    .bind(block.key, nextVersion, block.body_md, now, publishedBy)
    .run();

  return { key: block.key, version: nextVersion, published_at: now };
}
