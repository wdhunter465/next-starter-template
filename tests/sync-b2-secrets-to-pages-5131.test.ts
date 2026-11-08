import { describe, expect, it } from 'vitest';

import { checkB2Values, normalizeEndpoint } from '../scripts/ops/sync-b2-secrets-to-pages.mjs';

const good = {
  endpoint: 'https://s3.us-east-005.backblazeb2.com',
  bucket: 'LouGehrigFanClub',
  keyId: '005cfd8748d7b780000000006',
  appKey: 'K005abcdefghijklmnopqrstuvwxyzAB',
};

describe('normalizeEndpoint (#5131)', () => {
  it('makes an https origin from a bare host, http and a trailing path', () => {
    for (const raw of ['s3.us-east-005.backblazeb2.com', 'http://s3.us-east-005.backblazeb2.com/', 'https://s3.us-east-005.backblazeb2.com/LouGehrigFanClub']) {
      expect(normalizeEndpoint(raw)).toBe('https://s3.us-east-005.backblazeb2.com');
    }
    expect(normalizeEndpoint('')).toBe('');
  });
});

describe('checkB2Values (#5131)', () => {
  it('accepts a correct set of values', () => {
    expect(checkB2Values(good).refusals).toEqual([]);
  });

  it('refuses the values found on Production on 2026-11-08', () => {
    const bad = checkB2Values({
      endpoint: 's3.us-east-005.backblazeb2.com',
      bucket: 'acdfcd68a764582d978b0718',
      keyId: 'cfd8748d7b78',
      appKey: '005cfd8748d7b780000000002',
    });
    expect(bad.refusals.join(' | ')).toMatch(/bucket id/);
    expect(bad.refusals.join(' | ')).toMatch(/master key/);
    expect(bad.refusals.join(' | ')).toMatch(/looks like a key id/);
  });

  it('refuses an empty key, an empty bucket and a foreign endpoint', () => {
    expect(checkB2Values({ ...good, keyId: '' }).refusals.length).toBeGreaterThan(0);
    expect(checkB2Values({ ...good, bucket: '' }).refusals.length).toBeGreaterThan(0);
    expect(checkB2Values({ ...good, endpoint: 'https://example.com' }).refusals.join()).toMatch(/not an s3/);
  });

  it('never echoes a key or a secret in the facts', () => {
    const facts = JSON.stringify(checkB2Values(good).facts);
    expect(facts).not.toContain(good.keyId);
    expect(facts).not.toContain(good.appKey);
  });
});
