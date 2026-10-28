import { afterEach, describe, expect, it, vi } from 'vitest';

import { onRequestGet } from '../functions/api/admin/givebutter-snapshot';
import { ADMIN_SESSION_COOKIE, withAdminSession } from './helpers/adminSession';
import { makeScheduledContentDb } from './helpers/scheduledContentDb';

function getRequest(cookie: string | null = ADMIN_SESSION_COOKIE): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  return new Request('https://www.lougehrigfanclub.com/api/admin/givebutter-snapshot', { headers });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => vi.unstubAllGlobals());

describe('GET /api/admin/givebutter-snapshot (#4993)', () => {
  it('refuses an unauthenticated request', async () => {
    const env = { DB: makeScheduledContentDb([]), GIVEBUTTER_API_KEY: 'k', GIVEBUTTER_CAMPAIGN_ID: '42' };
    const response = await onRequestGet({ request: getRequest(null), env });
    expect(response.status).toBe(401);
  });

  it('refuses a signed-in member who is not an admin', async () => {
    const env = { DB: withAdminSession(makeScheduledContentDb([]), 'member'), GIVEBUTTER_API_KEY: 'k', GIVEBUTTER_CAMPAIGN_ID: '42' };
    const response = await onRequestGet({ request: getRequest(), env });
    expect(response.status).toBe(403);
  });

  it('reports not configured without revealing any value', async () => {
    const env = { DB: withAdminSession(makeScheduledContentDb([])) };
    const response = await onRequestGet({ request: getRequest(), env });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, configured: false });
  });

  it('returns an aggregate-only snapshot and never echoes the key', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/members')) {
        return json({
          data: [{ id: 'm1', display_name: 'Display', email: 'person@example.com', phone: '1', raised: 10, goal: 50, donors: 2, url: null }],
          links: { next: null },
        });
      }
      if (url.endsWith('/teams')) return json({ data: [], links: { next: null } });
      return json({ data: { title: 'Campaign', status: 'active', raised: 10, goal: 100, donors: 2 } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const env = { DB: withAdminSession(makeScheduledContentDb([])), GIVEBUTTER_API_KEY: 'secret-key-value', GIVEBUTTER_CAMPAIGN_ID: '42' };
    const response = await onRequestGet({ request: getRequest(), env });
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(text).not.toContain('secret-key-value');
    expect(text).not.toContain('person@example.com');
    expect(JSON.parse(text).snapshot.participants[0].displayName).toBe('Display');
  });

  it('answers 502 with a code only when Givebutter fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ message: 'secret-key-value' }, 500)));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const env = { DB: withAdminSession(makeScheduledContentDb([])), GIVEBUTTER_API_KEY: 'secret-key-value', GIVEBUTTER_CAMPAIGN_ID: '42' };
    const response = await onRequestGet({ request: getRequest(), env });
    const text = await response.text();
    expect(response.status).toBe(502);
    expect(JSON.parse(text)).toEqual({ ok: false, configured: true, error: 'http_error' });
    expect(text).not.toContain('secret-key-value');
  });
});
