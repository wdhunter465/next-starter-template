import { describe, expect, it, vi } from 'vitest';

import { diagnoseB2Signing } from '../functions/_lib/b2-presign';

const good = {
  B2_ENDPOINT: 'https://s3.us-east-005.backblazeb2.com',
  B2_BUCKET: 'LouGehrigFanClub',
  B2_KEY_ID: 'secret-key-id-value',
  B2_APP_KEY: 'secret-app-key-value',
};

describe('diagnoseB2Signing (#5131)', () => {
  it('reports enabled for a good configuration and never echoes a secret', () => {
    const d = diagnoseB2Signing(good);
    expect(d.signing_enabled).toBe(true);
    expect(d.region).toBe('us-east-005');
    expect(d.bucket_equals_expected).toBe(true);
    expect(JSON.stringify(d)).not.toContain('secret-key-id-value');
    expect(JSON.stringify(d)).not.toContain('secret-app-key-value');
  });

  it('flags an endpoint without https', () => {
    const d = diagnoseB2Signing({ ...good, B2_ENDPOINT: 's3.us-east-005.backblazeb2.com' });
    expect(d.signing_enabled).toBe(false);
    expect(d.endpoint_starts_with_https).toBe(false);
    expect(d.endpoint_host_shape_ok).toBe(false);
  });

  it('flags a bucket with a folder or another name', () => {
    expect(diagnoseB2Signing({ ...good, B2_BUCKET: 'LouGehrigFanClub/uploads' }).bucket_contains_slash).toBe(true);
    expect(diagnoseB2Signing({ ...good, B2_BUCKET: 'other' }).bucket_equals_expected).toBe(false);
  });

  it('flags missing keys', () => {
    const d = diagnoseB2Signing({ B2_ENDPOINT: good.B2_ENDPOINT, B2_BUCKET: good.B2_BUCKET });
    expect(d.key_id_present).toBe(false);
    expect(d.app_key_present).toBe(false);
    expect(d.signing_enabled).toBe(false);
  });
});

describe('/api/admin/b2-signing-check (#5131)', () => {
  it('denies a request with no admin session', async () => {
    const { onRequestGet } = await import('../functions/api/admin/b2-signing-check');
    const res = await onRequestGet({
      env: { ...good, DB: {} },
      request: new Request('https://www.lougehrigfanclub.com/api/admin/b2-signing-check'),
    });
    expect([401, 403]).toContain(res.status);
    expect(await res.text()).not.toContain('secret-app-key-value');
  });
});
