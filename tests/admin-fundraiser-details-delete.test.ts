import { describe, expect, it } from 'vitest';

import { onRequestPost as deleteFundraiserDetail } from '../functions/api/admin/fundraiser-details/delete';
import { ADMIN_SESSION_COOKIE, withAdminSession } from './helpers/adminSession';
import { makeScheduledContentDb, type ContentBlockRow } from './helpers/scheduledContentDb';

function postRequest(body: unknown, cookie: string | null = ADMIN_SESSION_COOKIE): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  return new Request('https://www.lougehrigfanclub.com/api/admin/fundraiser-details/delete', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function row(overrides: Partial<ContentBlockRow> = {}): ContentBlockRow {
  return {
    key: 'home.fundraiser-daily-details.2027-02-01',
    page: 'home',
    section: 'fundraiser-daily-details',
    title: 'Pilot post',
    body_md: 'Pilot post body',
    status: 'draft',
    published_body_md: null,
    version: 1,
    updated_at: '2027-01-15 10:00:00',
    published_at: null,
    updated_by: 'admin',
    scheduled_publish_at: '2027-02-01 10:00:00',
    social_caption: null,
    image_url: null,
    image_alt: null,
    ...overrides,
  };
}

describe('POST /api/admin/fundraiser-details/delete (#4253)', () => {
  it('refuses an unauthenticated request', async () => {
    const env = { DB: makeScheduledContentDb([row()]) };
    const response = await deleteFundraiserDetail({
      request: postRequest({ key: 'home.fundraiser-daily-details.2027-02-01' }, null),
      env,
    });
    expect(response.status).toBe(401);
  });

  it('requires a key', async () => {
    const env = { DB: withAdminSession(makeScheduledContentDb([row()])) };
    const response = await deleteFundraiserDetail({ request: postRequest({}), env });
    expect(response.status).toBe(400);
  });

  it('returns 404 for a key that does not exist', async () => {
    const env = { DB: withAdminSession(makeScheduledContentDb([])) };
    const response = await deleteFundraiserDetail({
      request: postRequest({ key: 'home.fundraiser-daily-details.2027-02-01' }),
      env,
    });
    expect(response.status).toBe(404);
  });

  it('deletes a draft pilot post', async () => {
    const db = makeScheduledContentDb([row()]);
    const env = { DB: withAdminSession(db) };

    const response = await deleteFundraiserDetail({
      request: postRequest({ key: 'home.fundraiser-daily-details.2027-02-01' }),
      env,
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, deleted: 'home.fundraiser-daily-details.2027-02-01' });
    expect(db._rows.has('home.fundraiser-daily-details.2027-02-01')).toBe(false);
  });

  it('deletes an already-published pilot post', async () => {
    const db = makeScheduledContentDb([row({ status: 'published', published_body_md: 'Pilot post body', scheduled_publish_at: null })]);
    const env = { DB: withAdminSession(db) };

    const response = await deleteFundraiserDetail({
      request: postRequest({ key: 'home.fundraiser-daily-details.2027-02-01' }),
      env,
    });
    expect(response.status).toBe(200);
    expect(db._rows.has('home.fundraiser-daily-details.2027-02-01')).toBe(false);
  });

  it('does not delete a content_blocks row from a different page/section', async () => {
    const db = makeScheduledContentDb([row({ key: 'home.campaign_spotlight', page: 'home', section: 'campaign-spotlight' })]);
    const env = { DB: withAdminSession(db) };

    const response = await deleteFundraiserDetail({ request: postRequest({ key: 'home.campaign_spotlight' }), env });
    expect(response.status).toBe(404);
    expect(db._rows.has('home.campaign_spotlight')).toBe(true);
  });
});
