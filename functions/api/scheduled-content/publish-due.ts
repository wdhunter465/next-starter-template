// POST /api/scheduled-content/publish-due
// Publishes every content_blocks row whose scheduled_publish_at has arrived,
// then best-effort fans each one out to Zapier for social cross-posting.
// Authenticated by a bounded bridge token (functions/_lib/scheduled-content-auth.ts),
// NOT the admin session gate -- intended to be called by an unattended
// GitHub Actions cron job (.github/workflows/ops-scheduled-content-publish.yml).
// #4253.

import { requireScheduledContentBridge } from '../../_lib/scheduled-content-auth';
import { findDueScheduledBlocks, publishScheduledBlock } from '../../_lib/content-blocks-scheduled';

function json(data: any, status: number): Response {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { 'Content-Type': 'application/json' } });
}

async function postToZapier(env: any, payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const webhookUrl = typeof env?.SCHEDULED_CONTENT_ZAPIER_WEBHOOK_URL === 'string'
    ? env.SCHEDULED_CONTENT_ZAPIER_WEBHOOK_URL.trim()
    : '';

  if (!webhookUrl) {
    return { ok: false, error: 'SCHEDULED_CONTENT_ZAPIER_WEBHOOK_URL not configured' };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return { ok: false, error: `Zapier webhook returned ${res.status}` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: String(err?.message || err) };
  }
}

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const auth = requireScheduledContentBridge(request, env);
  if (!auth.ok) return auth.response;

  if (!env?.DB) {
    return json({ ok: false, error: 'DB binding unavailable' }, 503);
  }

  try {
    const due = await findDueScheduledBlocks(env.DB);

    const published: Array<{ key: string; version: number; published_at: string; social: { ok: boolean; error?: string } }> = [];

    for (const block of due) {
      const result = await publishScheduledBlock(env.DB, block, 'scheduled-content-bridge');
      // null means a concurrent call already published this row between our
      // read and our UPDATE -- nothing new happened, so skip it entirely
      // rather than firing a duplicate Zapier social post.
      if (!result) continue;

      const publicUrl = new URL(request.url);
      const social = await postToZapier(env, {
        key: block.key,
        page: block.page,
        section: block.section,
        title: block.title,
        caption: block.social_caption || block.title,
        body: block.body_md,
        image_url: block.image_url,
        image_alt: block.image_alt,
        published_at: result.published_at,
        site_origin: publicUrl.origin,
      });

      published.push({ ...result, social });
    }

    return json({ ok: true, checked: due.length, published }, 200);
  } catch (err: any) {
    console.error('scheduled-content publish-due error:', err);
    return json({ ok: false, error: 'Publish sweep failed.' }, 500);
  }
};
