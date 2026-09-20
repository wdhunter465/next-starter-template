import { describe, expect, it } from 'vitest';

import { onRequestGet as listAdminFundraiserDetails } from '../functions/api/admin/fundraiser-details/list';
import { ADMIN_SESSION_COOKIE, withAdminSession } from './helpers/adminSession';
import { makeScheduledContentDb, type ContentBlockRow } from './helpers/scheduledContentDb';

function getRequest(cookie: string | null = ADMIN_SESSION_COOKIE): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  return new Request('https://www.lougehrigfanclub.com/api/admin/fundraiser-details/list', { headers });
}

function row(overrides: Partial<ContentBlockRow> = {}): ContentBlockRow {
  return {
    key: 'home.fundraiser-daily-details.2027-02-01',
    page: 'home',
    section: 'fundraiser-daily-details',
    title: 'Day 1',
    body_md: 'Day 1 body',
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

describe('GET /api/admin/fundraiser-details/list (#4253)', () => {
  it('refuses an unauthenticated request', async () => {
    const env = { DB: makeScheduledContentDb([row()]) };
    const response = await listAdminFundraiserDetails({ request: getRequest(null), env });
    expect(response.status).toBe(401);
  });

  it('lists both draft and published rows for an authenticated admin', async () => {
    const db = makeScheduledContentDb([
      row({ key: 'a', status: 'draft' }),
      row({ key: 'b', status: 'published', scheduled_publish_at: null, published_at: '2027-01-20 15:00:00' }),
    ]);
    const env = { DB: withAdminSession(db) };

    const response = await listAdminFundraiserDetails({ request: getRequest(), env });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.items).toHaveLength(2);
  });

  it('includes image_url and image_alt in the listed items', async () => {
    const db = makeScheduledContentDb([
      row({ image_url: 'https://b2.example.com/photo.jpg', image_alt: 'The trophy' }),
    ]);
    const env = { DB: withAdminSession(db) };

    const response = await listAdminFundraiserDetails({ request: getRequest(), env });
    const body = await response.json();
    expect(body.items[0]).toMatchObject({
      image_url: 'https://b2.example.com/photo.jpg',
      image_alt: 'The trophy',
    });
  });
});
