import { describe, expect, it } from 'vitest';

import { onRequestGet as listFundraiserDetails } from '../functions/api/fundraiser-details/list';
import { makeScheduledContentDb, type ContentBlockRow } from './helpers/scheduledContentDb';

function getRequest(query = ''): Request {
  return new Request(`https://www.lougehrigfanclub.com/api/fundraiser-details/list${query}`);
}

function publishedRow(overrides: Partial<ContentBlockRow> = {}): ContentBlockRow {
  return {
    key: 'home.fundraiser-daily-details.2027-02-01',
    page: 'home',
    section: 'fundraiser-daily-details',
    title: 'Day 1',
    body_md: 'Day 1 body',
    status: 'published',
    published_body_md: 'Day 1 body',
    version: 2,
    updated_at: '2027-02-01 15:00:00',
    published_at: '2027-02-01 15:00:00',
    updated_by: 'scheduled-content-bridge',
    scheduled_publish_at: null,
    social_caption: null,
    image_url: null,
    image_alt: null,
    ...overrides,
  };
}

describe('GET /api/fundraiser-details/list (#4253)', () => {
  it('returns 503 when the DB binding is unavailable', async () => {
    const response = await listFundraiserDetails({ request: getRequest(), env: {} });
    expect(response.status).toBe(503);
  });

  it('requires no authentication', async () => {
    const env = { DB: makeScheduledContentDb([publishedRow()]) };
    const response = await listFundraiserDetails({ request: getRequest(), env });
    expect(response.status).toBe(200);
  });

  it('returns only published rows, newest first', async () => {
    const db = makeScheduledContentDb([
      publishedRow({ key: 'a', published_at: '2027-02-01 15:00:00', title: 'Day 1' }),
      publishedRow({ key: 'b', published_at: '2027-02-03 15:00:00', title: 'Day 3' }),
      publishedRow({ key: 'c', status: 'draft', published_at: null, published_body_md: null, title: 'Not yet live' }),
    ]);
    const env = { DB: db };

    const response = await listFundraiserDetails({ request: getRequest(), env });
    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.items.map((item: { title: string }) => item.title)).toEqual(['Day 3', 'Day 1']);
  });

  it('respects the limit param', async () => {
    const db = makeScheduledContentDb([
      publishedRow({ key: 'a', published_at: '2027-02-01 15:00:00' }),
      publishedRow({ key: 'b', published_at: '2027-02-02 15:00:00' }),
      publishedRow({ key: 'c', published_at: '2027-02-03 15:00:00' }),
    ]);
    const env = { DB: db };

    const limited = await listFundraiserDetails({ request: getRequest('?limit=1'), env });
    const body = await limited.json();
    expect(body.items).toHaveLength(1);
  });

  it('includes image_url and image_alt when present', async () => {
    const db = makeScheduledContentDb([
      publishedRow({ image_url: 'https://b2.example.com/photo.jpg', image_alt: 'The trophy' }),
    ]);
    const env = { DB: db };

    const response = await listFundraiserDetails({ request: getRequest(), env });
    const body = await response.json();
    expect(body.items[0]).toMatchObject({
      image_url: 'https://b2.example.com/photo.jpg',
      image_alt: 'The trophy',
    });
  });

  it('returns null image fields when no image was set', async () => {
    const db = makeScheduledContentDb([publishedRow()]);
    const env = { DB: db };

    const response = await listFundraiserDetails({ request: getRequest(), env });
    const body = await response.json();
    expect(body.items[0].image_url).toBeNull();
    expect(body.items[0].image_alt).toBeNull();
  });
});
