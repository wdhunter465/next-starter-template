// POST /api/admin/fundraiser-details/create
// Body: { publish_date (YYYY-MM-DD), publish_time? (HH:MM, 24h, defaults to
//   10:00), title, body_md, image_url?, image_alt?, social_caption?, updated_by? }
// Creates or overwrites (if the same publish_date is resubmitted before it
// goes live) a scheduled content_blocks row in the
// page='home', section='fundraiser-daily-details' feed. Protected by an
// authenticated D1 admin member session (requireAdmin), same as every other
// /api/admin/** route. #4253.
//
// image_url is a direct, already-resolved public URL (e.g. a B2 object
// already uploaded via the existing /admin/media-assets flow) -- this
// endpoint does not upload or process images itself. image_alt is required
// whenever image_url is set, matching the alt-text requirement the existing
// content_inventory_media pipeline applies to its own public image roles.

import { requireAdmin } from '../../../_lib/auth';

function json(res: any, status = 200): Response {
  return new Response(JSON.stringify(res, null, 2), { status, headers: { 'Content-Type': 'application/json' } });
}

const PAGE = 'home';
const SECTION = 'fundraiser-daily-details';
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const unauthorized = await requireAdmin(request, env);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.json().catch(() => ({}));
    const publishDate = String(body?.publish_date || '').trim();
    const publishTime = String(body?.publish_time || '10:00').trim();
    const title = String(body?.title || '').trim();
    const body_md = String(body?.body_md ?? '').trim();
    const image_url = String(body?.image_url ?? '').trim();
    const image_alt = String(body?.image_alt ?? '').trim();
    const social_caption = String(body?.social_caption ?? '').trim();
    const updated_by = String(body?.updated_by || 'admin').trim() || 'admin';

    if (!DATE_RE.test(publishDate)) {
      return json({ ok: false, error: 'publish_date must be YYYY-MM-DD.' }, 400);
    }
    if (!TIME_RE.test(publishTime)) {
      return json({ ok: false, error: 'publish_time must be HH:MM (24h).' }, 400);
    }
    if (!title) return json({ ok: false, error: 'title is required.' }, 400);
    if (!body_md) return json({ ok: false, error: 'body_md cannot be empty.' }, 400);
    if (image_url && !image_alt) {
      return json({ ok: false, error: 'image_alt is required whenever image_url is set.' }, 400);
    }

    const key = `${PAGE}.${SECTION}.${publishDate}`;
    const scheduledPublishAt = `${publishDate} ${publishTime}:00`;

    const nowRow = await env.DB.prepare("SELECT datetime('now') as now").first();
    const now = String((nowRow as any)?.now || '');

    const existing = await env.DB.prepare('SELECT key, version, status FROM content_blocks WHERE key = ?')
      .bind(key)
      .first();

    if (existing && (existing as any).status === 'published') {
      return json({ ok: false, error: 'This date has already published; content_blocks is append-only for a live post. Delete it first if you need to replace it.' }, 409);
    }

    if (!existing) {
      await env.DB.prepare(
        `INSERT INTO content_blocks
           (key, page, section, title, body_md, status, published_body_md, version, updated_at, published_at, updated_by, scheduled_publish_at, social_caption, image_url, image_alt)
         VALUES (?, ?, ?, ?, ?, 'draft', NULL, 1, ?, NULL, ?, ?, ?, ?, ?)`,
      )
        .bind(key, PAGE, SECTION, title, body_md, now, updated_by, scheduledPublishAt, social_caption || null, image_url || null, image_alt || null)
        .run();

      await env.DB.prepare(
        `INSERT INTO content_revisions (key, version, body_md, status, updated_at, updated_by)
         VALUES (?, 1, ?, 'draft', ?, ?)`,
      )
        .bind(key, body_md, now, updated_by)
        .run();

      return json({ ok: true, created: true, key, version: 1, scheduled_publish_at: scheduledPublishAt });
    }

    const nextVersion = Number((existing as any).version || 1) + 1;

    await env.DB.prepare(
      `UPDATE content_blocks
       SET title = ?, body_md = ?, status = 'draft', version = ?, updated_at = ?, updated_by = ?,
           scheduled_publish_at = ?, social_caption = ?, image_url = ?, image_alt = ?
       WHERE key = ?`,
    )
      .bind(title, body_md, nextVersion, now, updated_by, scheduledPublishAt, social_caption || null, image_url || null, image_alt || null, key)
      .run();

    await env.DB.prepare(
      `INSERT INTO content_revisions (key, version, body_md, status, updated_at, updated_by)
       VALUES (?, ?, ?, 'draft', ?, ?)`,
    )
      .bind(key, nextVersion, body_md, now, updated_by)
      .run();

    return json({ ok: true, created: false, key, version: nextVersion, scheduled_publish_at: scheduledPublishAt });
  } catch (err: any) {
    console.error('admin fundraiser-details create error:', err);
    return json({ ok: false, error: 'Save failed.' }, 500);
  }
};
