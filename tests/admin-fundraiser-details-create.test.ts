import { describe, expect, it } from 'vitest';

import { onRequestPost as createFundraiserDetail } from '../functions/api/admin/fundraiser-details/create';
import { ADMIN_SESSION_COOKIE, withAdminSession } from './helpers/adminSession';
import { makeScheduledContentDb, type ContentBlockRow } from './helpers/scheduledContentDb';

function postRequest(body: unknown, cookie: string | null = ADMIN_SESSION_COOKIE): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  return new Request('https://www.lougehrigfanclub.com/api/admin/fundraiser-details/create', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

const VALID_BODY = {
  publish_date: '2027-02-01',
  title: 'Grand prize announced!',
  body_md: 'Today we reveal the grand prize.',
  social_caption: 'Grand prize day! 🎉',
};

describe('POST /api/admin/fundraiser-details/create (#4253)', () => {
  it('refuses an unauthenticated request', async () => {
    const env = { DB: makeScheduledContentDb([]) };
    const response = await createFundraiserDetail({ request: postRequest(VALID_BODY, null), env });
    expect(response.status).toBe(401);
  });

  it('rejects a malformed publish_date', async () => {
    const env = { DB: withAdminSession(makeScheduledContentDb([])) };
    const response = await createFundraiserDetail({
      request: postRequest({ ...VALID_BODY, publish_date: '02/01/2027' }),
      env,
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, error: 'publish_date must be YYYY-MM-DD.' });
  });

  it('rejects image_url without image_alt', async () => {
    const env = { DB: withAdminSession(makeScheduledContentDb([])) };
    const response = await createFundraiserDetail({
      request: postRequest({ ...VALID_BODY, image_url: 'https://b2.example.com/photo.jpg' }),
      env,
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, error: 'image_alt is required whenever image_url is set.' });
  });

  it('accepts and persists image_url with image_alt', async () => {
    const db = makeScheduledContentDb([]);
    const env = { DB: withAdminSession(db) };
    const response = await createFundraiserDetail({
      request: postRequest({
        ...VALID_BODY,
        image_url: 'https://b2.example.com/photo.jpg',
        image_alt: 'The grand prize trophy on display',
      }),
      env,
    });
    expect(response.status).toBe(200);

    const row = db._rows.get('home.fundraiser-daily-details.2027-02-01')!;
    expect(row.image_url).toBe('https://b2.example.com/photo.jpg');
    expect(row.image_alt).toBe('The grand prize trophy on display');
  });

  it('rejects an impossible publish_time like 99:99', async () => {
    const env = { DB: withAdminSession(makeScheduledContentDb([])) };
    const response = await createFundraiserDetail({
      request: postRequest({ ...VALID_BODY, publish_time: '99:99' }),
      env,
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ ok: false, error: 'publish_time must be HH:MM (24h).' });
  });

  it('accepts a valid late publish_time like 23:59', async () => {
    const db = makeScheduledContentDb([]);
    const env = { DB: withAdminSession(db) };
    const response = await createFundraiserDetail({
      request: postRequest({ ...VALID_BODY, publish_time: '23:59' }),
      env,
    });
    expect(response.status).toBe(200);
    expect((await response.json()).scheduled_publish_at).toBe('2027-02-01 23:59:00');
  });

  it('rejects a missing title', async () => {
    const env = { DB: withAdminSession(makeScheduledContentDb([])) };
    const response = await createFundraiserDetail({
      request: postRequest({ ...VALID_BODY, title: '' }),
      env,
    });
    expect(response.status).toBe(400);
  });

  it('creates a new scheduled draft row defaulting to 10:00', async () => {
    const db = makeScheduledContentDb([]);
    const env = { DB: withAdminSession(db) };

    const response = await createFundraiserDetail({ request: postRequest(VALID_BODY), env });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body).toMatchObject({ ok: true, created: true, key: 'home.fundraiser-daily-details.2027-02-01' });
    expect(body.scheduled_publish_at).toBe('2027-02-01 10:00:00');

    const row = db._rows.get('home.fundraiser-daily-details.2027-02-01')!;
    expect(row.status).toBe('draft');
    expect(row.page).toBe('home');
    expect(row.section).toBe('fundraiser-daily-details');
    expect(row.social_caption).toBe('Grand prize day! 🎉');
  });

  it('upserts (overwrites) the same date while still a draft', async () => {
    const db = makeScheduledContentDb([]);
    const env = { DB: withAdminSession(db) };

    await createFundraiserDetail({ request: postRequest(VALID_BODY), env });
    const response = await createFundraiserDetail({
      request: postRequest({ ...VALID_BODY, title: 'Updated title' }),
      env,
    });

    const body = await response.json();
    expect(body).toMatchObject({ ok: true, created: false, version: 2 });
    expect(db._rows.get('home.fundraiser-daily-details.2027-02-01')!.title).toBe('Updated title');
  });

  it('refuses to overwrite a date that has already published', async () => {
    const publishedRow: ContentBlockRow = {
      key: 'home.fundraiser-daily-details.2027-02-01',
      page: 'home',
      section: 'fundraiser-daily-details',
      title: 'Already live',
      body_md: 'Already live body',
      status: 'published',
      published_body_md: 'Already live body',
      version: 2,
      updated_at: '2027-02-01 15:00:00',
      published_at: '2027-02-01 15:00:00',
      updated_by: 'scheduled-content-bridge',
      scheduled_publish_at: null,
      social_caption: null,
      image_url: null,
      image_alt: null,
    };
    const db = makeScheduledContentDb([publishedRow]);
    const env = { DB: withAdminSession(db) };

    const response = await createFundraiserDetail({ request: postRequest(VALID_BODY), env });
    expect(response.status).toBe(409);
  });
});
