import { describe, expect, it, vi } from 'vitest';

import {
  GivebutterError,
  fetchGivebutterSnapshot,
  givebutterConfigFromEnv,
  normalizeCampaign,
  normalizeParticipant,
  normalizeTeam,
} from '../functions/_lib/givebutter';

const API = 'https://api.givebutter.com/v1/campaigns/42';

// Synthetic only. The member rows carry the personal fields the real endpoint returns,
// to prove they never survive normalization (#4139).
function memberRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'm1',
    first_name: 'Firstname',
    last_name: 'Lastname',
    display_name: 'Display Name',
    email: 'person@example.com',
    phone: '+15555550100',
    picture: 'https://example.com/pic.jpg',
    url: 'https://givebutter.com/c/example/display-name',
    raised: 125.5,
    goal: 500,
    donors: 4,
    items: 0,
    created_at: '2027-02-01T00:00:00Z',
    updated_at: '2027-02-02T00:00:00Z',
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function routed(routes: Record<string, unknown>) {
  return vi.fn(async (url: string) => {
    if (!(url in routes)) return jsonResponse({ message: 'not found' }, 404);
    return jsonResponse(routes[url]);
  });
}

const campaign = { id: 42, title: 'Test Campaign', status: 'active', raised: 300, goal: 10000, donors: 9 };
const team = { id: 't1', name: 'Team One', logo: 'x', slug: 'team-one', url: 'https://givebutter.com/t', raised: 80, goal: 1000, supporters: 3, members: 2 };

describe('Givebutter allowlist normalization (#4139)', () => {
  it('keeps only aggregate participant fields and drops email, phone, names and picture', () => {
    const result = normalizeParticipant(memberRow());
    expect(Object.keys(result).sort()).toEqual(['displayName', 'goal', 'id', 'pageUrl', 'raised', 'supporters']);
    const serialized = JSON.stringify(result);
    for (const leaked of ['person@example.com', '5555550100', 'Firstname', 'Lastname', 'pic.jpg']) {
      expect(serialized).not.toContain(leaked);
    }
  });

  it('drops a participant page link that is not on givebutter.com', () => {
    expect(normalizeParticipant(memberRow({ url: 'https://evil.example.com/x' })).pageUrl).toBeNull();
    expect(normalizeParticipant(memberRow({ url: 'http://givebutter.com/x' })).pageUrl).toBeNull();
  });

  it('keeps only aggregate team fields', () => {
    const result = normalizeTeam({ ...team, logo: 'https://example.com/logo.png' });
    expect(Object.keys(result).sort()).toEqual(['goal', 'id', 'members', 'name', 'raised', 'supporters']);
  });

  it('accepts a wrapped campaign and numeric strings', () => {
    const result = normalizeCampaign({ data: { ...campaign, raised: '300.5' } });
    expect(result.raised).toBe(300.5);
    expect(result.supporters).toBe(9);
  });

  it('rejects negative, non-finite and fractional counts', () => {
    expect(() => normalizeParticipant(memberRow({ raised: -1 }))).toThrow(GivebutterError);
    expect(() => normalizeParticipant(memberRow({ raised: 'abc' }))).toThrow(GivebutterError);
    expect(() => normalizeParticipant(memberRow({ donors: 1.5 }))).toThrow(GivebutterError);
    expect(() => normalizeParticipant(memberRow({ display_name: '  ' }))).toThrow(GivebutterError);
  });
});

describe('fetchGivebutterSnapshot', () => {
  it('reads campaign, members and teams with a bearer key and returns aggregates only', async () => {
    const fetchImpl = routed({
      [API]: { data: campaign },
      [`${API}/members`]: { data: [memberRow()], links: { next: null } },
      [`${API}/teams`]: { data: [team], links: { next: null } },
    });

    const snapshot = await fetchGivebutterSnapshot({
      apiKey: 'test-key',
      campaignId: '42',
      fetchImpl,
      now: () => new Date('2027-04-01T12:00:00Z'),
    });

    expect(snapshot.capturedAt).toBe('2027-04-01T12:00:00.000Z');
    expect(snapshot.campaign.raised).toBe(300);
    expect(snapshot.participants).toHaveLength(1);
    expect(snapshot.teams[0].name).toBe('Team One');
    expect(JSON.stringify(snapshot)).not.toContain('person@example.com');

    const firstCall = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect((firstCall[1].headers as Record<string, string>).Authorization).toBe('Bearer test-key');
    expect(firstCall[1].method).toBe('GET');
  });

  it('follows links.next across pages', async () => {
    const page2 = `${API}/members?page=2`;
    const fetchImpl = routed({
      [API]: campaign,
      [`${API}/members`]: { data: [memberRow({ id: 'a' })], links: { next: page2 } },
      [page2]: { data: [memberRow({ id: 'b' })], links: { next: null } },
      [`${API}/teams`]: { data: [], links: { next: null } },
    });
    const snapshot = await fetchGivebutterSnapshot({ apiKey: 'k', campaignId: '42', fetchImpl });
    expect(snapshot.participants.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('refuses a next link on another host and never sends the key there', async () => {
    const fetchImpl = routed({
      [API]: campaign,
      [`${API}/members`]: { data: [], links: { next: 'https://evil.example.com/steal' } },
    });
    await expect(fetchGivebutterSnapshot({ apiKey: 'k', campaignId: '42', fetchImpl })).rejects.toMatchObject({
      code: 'invalid_response',
    });
    expect(fetchImpl.mock.calls.map((c) => c[0])).not.toContain('https://evil.example.com/steal');
  });

  it('fails closed on an HTTP error without leaking the body or the key', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ message: 'secret detail test-key' }, 401));
    const error = await fetchGivebutterSnapshot({ apiKey: 'test-key', campaignId: '42', fetchImpl }).catch((e) => e);
    expect(error).toBeInstanceOf(GivebutterError);
    expect(error.code).toBe('http_error');
    expect(error.status).toBe(401);
    expect(error.message).not.toContain('test-key');
    expect(error.message).not.toContain('secret detail');
  });

  it('fails closed on a network error and on an invalid participant', async () => {
    const down = vi.fn(async () => {
      throw new Error('boom test-key');
    });
    await expect(fetchGivebutterSnapshot({ apiKey: 'test-key', campaignId: '42', fetchImpl: down })).rejects.toMatchObject({
      code: 'network_error',
    });

    const bad = routed({
      [API]: campaign,
      [`${API}/members`]: { data: [memberRow({ raised: -5 })], links: { next: null } },
    });
    await expect(fetchGivebutterSnapshot({ apiKey: 'k', campaignId: '42', fetchImpl: bad })).rejects.toMatchObject({
      code: 'invalid_response',
    });
  });
});

describe('givebutterConfigFromEnv', () => {
  it('returns null unless both values are set and the campaign id is numeric', () => {
    expect(givebutterConfigFromEnv({})).toBeNull();
    expect(givebutterConfigFromEnv({ GIVEBUTTER_API_KEY: 'k' })).toBeNull();
    expect(givebutterConfigFromEnv({ GIVEBUTTER_API_KEY: 'k', GIVEBUTTER_CAMPAIGN_ID: '../x' })).toBeNull();
    expect(givebutterConfigFromEnv({ GIVEBUTTER_API_KEY: 'k', GIVEBUTTER_CAMPAIGN_ID: '42' })).toEqual({
      apiKey: 'k',
      campaignId: '42',
    });
  });
});
