import { describe, expect, it } from 'vitest';

import { signB2Url, signB2UrlsDeep } from '../functions/_lib/b2-presign';

const env = {
  B2_ENDPOINT: 'https://s3.us-east-005.backblazeb2.com',
  B2_BUCKET: 'LouGehrigFanClub',
  B2_KEY_ID: 'test-key-id',
  B2_APP_KEY: 'test-app-key',
};
const stored = 'https://s3.us-east-005.backblazeb2.com/LouGehrigFanClub/LGFC_sha256_abc.jpg';

describe('signB2Url (#5131)', () => {
  it('turns a stored bucket address into a SigV4 query-signed GET link that expires in an hour', async () => {
    const signed = new URL(await signB2Url(env, stored));
    expect(signed.origin + signed.pathname).toBe(stored);
    expect(signed.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256');
    expect(signed.searchParams.get('X-Amz-Expires')).toBe('3600');
    expect(signed.searchParams.get('X-Amz-Credential')).toMatch(/^test-key-id\/\d{8}\/us-east-005\/s3\/aws4_request$/);
    expect(signed.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
  });

  it('never exposes the application key', async () => {
    expect(await signB2Url(env, stored)).not.toContain('test-app-key');
  });

  it('returns the value unchanged when B2 secrets are missing (fail closed on config)', async () => {
    expect(await signB2Url({ ...env, B2_APP_KEY: '' }, stored)).toBe(stored);
    expect(await signB2Url(undefined, stored)).toBe(stored);
  });

  it('returns a foreign address unchanged', async () => {
    const other = 'https://example.com/pic.jpg';
    expect(await signB2Url(env, other)).toBe(other);
    expect(await signB2Url(env, 'https://s3.us-east-005.backblazeb2.com/OtherBucket/x.jpg')).toBe(
      'https://s3.us-east-005.backblazeb2.com/OtherBucket/x.jpg',
    );
  });

  it('does not sign an address twice', async () => {
    const once = await signB2Url(env, stored);
    expect(await signB2Url(env, once)).toBe(once);
  });

  it('maps an address under PUBLIC_B2_BASE_URL to the same bucket key', async () => {
    const withBase = { ...env, PUBLIC_B2_BASE_URL: 'https://f005.backblazeb2.com/file/LouGehrigFanClub' };
    const signed = new URL(
      await signB2Url(withBase, 'https://f005.backblazeb2.com/file/LouGehrigFanClub/club-newspaper/renditions/7/lead.jpg'),
    );
    expect(signed.origin).toBe('https://s3.us-east-005.backblazeb2.com');
    expect(signed.pathname).toBe('/LouGehrigFanClub/club-newspaper/renditions/7/lead.jpg');
    expect(signed.searchParams.get('X-Amz-Signature')).toBeTruthy();
  });
});

describe('signB2UrlsDeep (#5131)', () => {
  it('signs bucket addresses anywhere in nested bodies and leaves other values alone', async () => {
    const body = {
      ok: true,
      items: [{ id: 1, url: stored, title: 'x', n: 3, nothing: null }, { id: 2, url: 'https://example.com/a.jpg' }],
      nested: { photo_url: stored },
    };
    const out = await signB2UrlsDeep(env, body);
    expect(out.items[0].url).toContain('X-Amz-Signature=');
    expect(out.items[0].title).toBe('x');
    expect(out.items[0].n).toBe(3);
    expect(out.items[0].nothing).toBeNull();
    expect(out.items[1].url).toBe('https://example.com/a.jpg');
    expect(out.nested.photo_url).toContain('X-Amz-Signature=');
    expect(body.items[0].url).toBe(stored); // input is not mutated
  });

  it('returns the body untouched when B2 is not configured', async () => {
    const body = { items: [{ url: stored }] };
    expect(await signB2UrlsDeep({}, body)).toBe(body);
  });
});

describe('endpoints return signed image links (#5131)', () => {
  const row = { id: 9, url: stored, is_memorabilia: 0, description: '', created_at: '2026-11-08' };
  const db = { prepare: () => ({ bind: () => ({ all: async () => ({ results: [row] }), first: async () => row }) }) };
  const request = new Request('https://www.lougehrigfanclub.com/api/photos/list?limit=1');

  it('/api/photos/list signs the stored address', async () => {
    const { onRequestGet } = await import('../functions/api/photos/list');
    const res = await onRequestGet({ env: { ...env, DB: db }, request });
    const body = (await res.json()) as { items: Array<{ url: string }> };
    expect(res.status).toBe(200);
    expect(body.items[0].url).toContain('X-Amz-Signature=');
    expect(body.items[0].url.startsWith(stored)).toBe(true);
  });

  it('/api/photos/get signs the stored address', async () => {
    const { onRequestGet } = await import('../functions/api/photos/get');
    const res = await onRequestGet({
      env: { ...env, DB: db },
      request: new Request('https://www.lougehrigfanclub.com/api/photos/get?id=9'),
    });
    const body = (await res.json()) as { item: { url: string } };
    expect(body.item.url).toContain('X-Amz-Signature=');
  });

  it('/api/photos/list still returns the plain address when B2 secrets are absent', async () => {
    const { onRequestGet } = await import('../functions/api/photos/list');
    const res = await onRequestGet({ env: { DB: db }, request });
    const body = (await res.json()) as { items: Array<{ url: string }> };
    expect(body.items[0].url).toBe(stored);
  });
});
