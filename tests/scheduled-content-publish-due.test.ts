import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { onRequestPost as publishDue } from '../functions/api/scheduled-content/publish-due';
import { publishScheduledBlock } from '../functions/_lib/content-blocks-scheduled';
import { makeScheduledContentDb, type ContentBlockRow } from './helpers/scheduledContentDb';

const BRIDGE_TOKEN = 'test-bridge-token';

// Comparisons run against the real nowInNewYork(), so fixtures use dates far
// enough in the past/future to be unambiguous regardless of when the test
// suite actually runs.
const PAST = '2020-01-01 00:00:00';
const FUTURE = '2099-01-01 00:00:00';

function postRequest(token: string | null): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return new Request('https://www.lougehrigfanclub.com/api/scheduled-content/publish-due', {
    method: 'POST',
    headers,
  });
}

function dueRow(overrides: Partial<ContentBlockRow> = {}): ContentBlockRow {
  return {
    key: 'home.fundraiser-daily-details.2027-02-01',
    page: 'home',
    section: 'fundraiser-daily-details',
    title: 'Grand prize announced!',
    body_md: 'Today we reveal the grand prize.',
    status: 'draft',
    published_body_md: null,
    version: 1,
    updated_at: '2027-01-15 10:00:00',
    published_at: null,
    updated_by: 'admin',
    scheduled_publish_at: PAST,
    social_caption: 'Grand prize day! 🎉',
    image_url: null,
    image_alt: null,
    ...overrides,
  };
}

describe('POST /api/scheduled-content/publish-due (#4253)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('refuses a request with no bearer token', async () => {
    const env = { DB: makeScheduledContentDb([]), SCHEDULED_CONTENT_BRIDGE_TOKEN: BRIDGE_TOKEN };
    const response = await publishDue({ request: postRequest(null), env });
    expect(response.status).toBe(401);
  });

  it('refuses a request with the wrong bearer token', async () => {
    const env = { DB: makeScheduledContentDb([]), SCHEDULED_CONTENT_BRIDGE_TOKEN: BRIDGE_TOKEN };
    const response = await publishDue({ request: postRequest('wrong-token'), env });
    expect(response.status).toBe(401);
  });

  it('returns 503 when no bridge token is configured', async () => {
    const env = { DB: makeScheduledContentDb([]) };
    const response = await publishDue({ request: postRequest(BRIDGE_TOKEN), env });
    expect(response.status).toBe(503);
  });

  it('publishes a due draft row and fires the Zapier webhook', async () => {
    const db = makeScheduledContentDb([dueRow()]);
    const env = {
      DB: db,
      SCHEDULED_CONTENT_BRIDGE_TOKEN: BRIDGE_TOKEN,
      SCHEDULED_CONTENT_ZAPIER_WEBHOOK_URL: 'https://hooks.zapier.com/hooks/catch/test',
    };

    const response = await publishDue({ request: postRequest(BRIDGE_TOKEN), env });
    expect(response.status).toBe(200);

    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.checked).toBe(1);
    expect(body.published).toHaveLength(1);
    expect(body.published[0].key).toBe('home.fundraiser-daily-details.2027-02-01');
    expect(body.published[0].social.ok).toBe(true);

    const updated = db._rows.get('home.fundraiser-daily-details.2027-02-01')!;
    expect(updated.status).toBe('published');
    expect(updated.published_body_md).toBe('Today we reveal the grand prize.');
    expect(updated.scheduled_publish_at).toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://hooks.zapier.com/hooks/catch/test');
    const payload = JSON.parse(init.body);
    expect(payload.caption).toBe('Grand prize day! 🎉');
  });

  it('includes image_url and image_alt in the Zapier payload when the post has an image', async () => {
    const db = makeScheduledContentDb([
      dueRow({ image_url: 'https://b2.example.com/photo.jpg', image_alt: 'The trophy' }),
    ]);
    const env = {
      DB: db,
      SCHEDULED_CONTENT_BRIDGE_TOKEN: BRIDGE_TOKEN,
      SCHEDULED_CONTENT_ZAPIER_WEBHOOK_URL: 'https://hooks.zapier.com/hooks/catch/test',
    };

    await publishDue({ request: postRequest(BRIDGE_TOKEN), env });

    const [, init] = fetchMock.mock.calls[0];
    const payload = JSON.parse(init.body);
    expect(payload.image_url).toBe('https://b2.example.com/photo.jpg');
    expect(payload.image_alt).toBe('The trophy');
  });

  it('does not publish a row scheduled for the future', async () => {
    const db = makeScheduledContentDb([dueRow({ scheduled_publish_at: FUTURE })]);
    const env = { DB: db, SCHEDULED_CONTENT_BRIDGE_TOKEN: BRIDGE_TOKEN };

    const response = await publishDue({ request: postRequest(BRIDGE_TOKEN), env });
    const body = await response.json();
    expect(body.checked).toBe(0);
    expect(db._rows.get('home.fundraiser-daily-details.2027-02-01')!.status).toBe('draft');
  });

  it('is idempotent -- a second sweep does not republish an already-published row', async () => {
    const db = makeScheduledContentDb([dueRow()]);
    const env = { DB: db, SCHEDULED_CONTENT_BRIDGE_TOKEN: BRIDGE_TOKEN };

    const first = await publishDue({ request: postRequest(BRIDGE_TOKEN), env });
    expect((await first.json()).checked).toBe(1);

    const second = await publishDue({ request: postRequest(BRIDGE_TOKEN), env });
    const secondBody = await second.json();
    expect(secondBody.checked).toBe(0);
    expect(secondBody.published).toHaveLength(0);
  });

  it('still reports a successful publish when the Zapier webhook is not configured', async () => {
    const db = makeScheduledContentDb([dueRow()]);
    const env = { DB: db, SCHEDULED_CONTENT_BRIDGE_TOKEN: BRIDGE_TOKEN };

    const response = await publishDue({ request: postRequest(BRIDGE_TOKEN), env });
    const body = await response.json();
    expect(body.published[0].social.ok).toBe(false);
    expect(db._rows.get('home.fundraiser-daily-details.2027-02-01')!.status).toBe('published');
  });

  it('publishScheduledBlock returns null (no duplicate revision) when a concurrent call already published the row', async () => {
    const db = makeScheduledContentDb([dueRow()]);
    const block = {
      key: 'home.fundraiser-daily-details.2027-02-01',
      page: 'home',
      section: 'fundraiser-daily-details',
      title: 'Grand prize announced!',
      body_md: 'Today we reveal the grand prize.',
      social_caption: 'Grand prize day! 🎉',
      image_url: null,
      image_alt: null,
      scheduled_publish_at: PAST,
      version: 1,
    };

    const first = await publishScheduledBlock(db, block, 'scheduled-content-bridge');
    expect(first).not.toBeNull();
    expect(db._revisions).toHaveLength(1);

    // Simulates a second, racing call operating on the same pre-race block
    // snapshot (as if both had read it as 'draft' before either published).
    const second = await publishScheduledBlock(db, block, 'scheduled-content-bridge');
    expect(second).toBeNull();
    expect(db._revisions).toHaveLength(1);
  });
});
