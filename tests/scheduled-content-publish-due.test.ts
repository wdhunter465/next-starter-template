import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { onRequestPost as publishDue } from '../functions/api/scheduled-content/publish-due';
import { makeScheduledContentDb, type ContentBlockRow } from './helpers/scheduledContentDb';

const BRIDGE_TOKEN = 'test-bridge-token';

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
    scheduled_publish_at: '2027-02-01 15:00:00',
    social_caption: 'Grand prize day! 🎉',
    ...overrides,
  };
}

describe('POST /api/scheduled-content/publish-due (#4253)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn(async () => new Response(null, { status: 200 })) as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
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

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as any).mock.calls[0];
    expect(url).toBe('https://hooks.zapier.com/hooks/catch/test');
    const payload = JSON.parse(init.body);
    expect(payload.caption).toBe('Grand prize day! 🎉');
  });

  it('does not publish a row scheduled for the future', async () => {
    const db = makeScheduledContentDb([dueRow({ scheduled_publish_at: '2027-03-01 15:00:00' })]);
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
});
