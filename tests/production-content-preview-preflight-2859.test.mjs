import { describe, expect, it } from 'vitest';
import {
  buildResultMarkdown,
  requireEnv,
} from '../scripts/ci/production_content_preview_preflight_2859.mjs';

// #2859 Preview evidence preflight -- covers the pure helper functions only. `main()` invokes
// the real Backblaze B2 S3-compatible API against live credentials this sandbox does not
// have, and is verified by the real CI run, same precedent as every other #3268/#2913
// preflight/package script.
//
// This is the #3343 correction: #3341 established that this repo's own canonical isolation
// record classifies Preview D1 as production-shared (no isolated Preview D1 database exists)
// and that this repo's actual object storage for content media is Backblaze B2, not
// Cloudflare R2. The script no longer attempts any D1 check, and the storage check now
// targets B2_ENDPOINT/B2_BUCKET/B2_KEY_ID/B2_APP_KEY instead of R2_*/PREVIEW_R2_BUCKET_NAME.

describe('requireEnv', () => {
  it('lists every missing required credential', () => {
    expect(requireEnv({})).toEqual(['B2_ENDPOINT', 'B2_BUCKET', 'B2_KEY_ID', 'B2_APP_KEY']);
  });

  it('returns an empty list when every credential is present', () => {
    expect(
      requireEnv({
        B2_ENDPOINT: 'x',
        B2_BUCKET: 'x',
        B2_KEY_ID: 'x',
        B2_APP_KEY: 'x',
      }),
    ).toEqual([]);
  });

  it('no longer requires any D1 or R2/Preview-prefixed credential', () => {
    const missing = requireEnv({
      B2_ENDPOINT: 'x',
      B2_BUCKET: 'x',
      B2_KEY_ID: 'x',
      B2_APP_KEY: 'x',
    });
    expect(missing).not.toContain('PREVIEW_D1_DATABASE_NAME');
    expect(missing).not.toContain('PREVIEW_D1_DATABASE_ID');
    expect(missing).not.toContain('PREVIEW_R2_BUCKET_NAME');
    expect(missing).not.toContain('R2_ACCESS_KEY_ID');
  });
});

describe('buildResultMarkdown', () => {
  const fullyOk = {
    checkedAt: '2026-08-11T00:00:00Z',
    b2: { reachable: true, objectCount: 42, truncated: false, failureReason: '' },
  };

  it('always states the D1 evidence gap explicitly, by design', () => {
    const md = buildResultMarkdown(fullyOk);
    expect(md).toContain('D1 — no evidence collected (by design, not a failure)');
    expect(md).toContain('production-shared');
    expect(md).toContain('#3341');
    expect(md).toContain('#3343');
  });

  it('renders a fully-reachable B2 result', () => {
    const md = buildResultMarkdown(fullyOk);
    expect(md).toContain('Reachable: YES');
    expect(md).toContain('Object count (first page, max 1000): 42');
  });

  it('never includes credential values or object keys, by construction', () => {
    const md = buildResultMarkdown(fullyOk);
    expect(md).not.toContain('http://');
    expect(md).not.toContain('AccessKeyId');
  });

  it('states plainly what this evidence does not establish', () => {
    const md = buildResultMarkdown(fullyOk);
    expect(md).toContain('does **not** establish isolated Preview evidence');
    expect(md).toContain('Gate 1 remains HOLD');
    expect(md).toContain('Gate 2 remains NO-GO');
  });

  it('renders an unreachable B2 result with its failure reason, and omits the object-count line', () => {
    const md = buildResultMarkdown({
      ...fullyOk,
      b2: { reachable: false, objectCount: null, truncated: false, failureReason: 'HTTP 403: AccessDenied' },
    });
    expect(md).toContain('Reachable: NO (HTTP 403: AccessDenied)');
    expect(md).not.toContain('Object count (first page');
  });

  it('renders a truncated object count with a trailing +', () => {
    const md = buildResultMarkdown({
      ...fullyOk,
      b2: { reachable: true, objectCount: 1000, truncated: true, failureReason: '' },
    });
    expect(md).toContain('Object count (first page, max 1000): 1000+');
  });
});
