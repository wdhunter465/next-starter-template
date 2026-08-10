import { describe, expect, it } from 'vitest';
import {
  buildResultMarkdown,
  extractR2BucketListing,
  extractS3ErrorCode,
  findBlankAfterTrim,
  parseListObjectsV2Page,
  requireR2Env,
} from '../scripts/ci/d1_backup_r2_phase1_preflight_3268.mjs';

// #3268 Phase 1 R2 preflight — covers the pure helper functions only. `main()` invokes the
// real R2 S3 API and (best-effort) wrangler CLI against live credentials this sandbox does not
// have, and is verified by the real CI run, same precedent as the D1 preflight and #2913.

describe('requireR2Env', () => {
  it('lists every missing required credential', () => {
    expect(requireR2Env({})).toEqual(['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'R2_ACCOUNT_ID']);
  });

  it('returns an empty list when every credential is present', () => {
    expect(
      requireR2Env({
        R2_ACCESS_KEY_ID: 'x',
        R2_SECRET_ACCESS_KEY: 'x',
        R2_BUCKET_NAME: 'x',
        R2_ACCOUNT_ID: 'x',
      }),
    ).toEqual([]);
  });
});

describe('parseListObjectsV2Page', () => {
  it('parses object keys from a single-page XML response', () => {
    const xml = `<?xml version="1.0"?><ListBucketResult><Contents><Key>a.sql</Key></Contents><Contents><Key>b.sql</Key></Contents><IsTruncated>false</IsTruncated></ListBucketResult>`;
    expect(parseListObjectsV2Page(xml)).toEqual({ keys: ['a.sql', 'b.sql'], isTruncated: false });
  });

  it('returns an empty key list for a bucket with zero objects', () => {
    const xml = `<?xml version="1.0"?><ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>`;
    expect(parseListObjectsV2Page(xml)).toEqual({ keys: [], isTruncated: false });
  });

  it('detects truncation', () => {
    const xml = `<ListBucketResult><Contents><Key>a</Key></Contents><IsTruncated>true</IsTruncated></ListBucketResult>`;
    expect(parseListObjectsV2Page(xml).isTruncated).toBe(true);
  });

  it('decodes XML entities in keys instead of throwing', () => {
    const xml = `<ListBucketResult><Contents><Key>a&amp;b.sql</Key></Contents></ListBucketResult>`;
    expect(parseListObjectsV2Page(xml).keys).toEqual(['a&b.sql']);
  });

  it('does not throw on empty or malformed input', () => {
    expect(parseListObjectsV2Page('')).toEqual({ keys: [], isTruncated: false });
    expect(parseListObjectsV2Page(undefined)).toEqual({ keys: [], isTruncated: false });
  });
});

describe('findBlankAfterTrim', () => {
  it('catches a whitespace-only value that requireR2Env alone would not', () => {
    // requireR2Env's presence check treats a whitespace-only string as present (truthy).
    expect(requireR2Env({ R2_ACCOUNT_ID: '   ', R2_BUCKET_NAME: 'x', R2_ACCESS_KEY_ID: 'x', R2_SECRET_ACCESS_KEY: 'x' })).toEqual([]);
    // findBlankAfterTrim, run on the already-trimmed values, catches it.
    expect(findBlankAfterTrim({ R2_ACCOUNT_ID: '   '.trim(), R2_BUCKET_NAME: 'x' })).toEqual(['R2_ACCOUNT_ID']);
  });

  it('lists every name whose trimmed value is blank', () => {
    expect(findBlankAfterTrim({ A: '', B: 'x', C: '' })).toEqual(['A', 'C']);
  });

  it('returns an empty list when every trimmed value is non-blank', () => {
    expect(findBlankAfterTrim({ A: 'x', B: 'y' })).toEqual([]);
  });
});

describe('extractS3ErrorCode', () => {
  it('extracts the short Code field without the surrounding body', () => {
    const xml = `<?xml version="1.0"?><Error><Code>AccessDenied</Code><Message>Access Denied.</Message><BucketName>lgfc-d1-backups</BucketName></Error>`;
    expect(extractS3ErrorCode(xml)).toBe('AccessDenied');
  });

  it('does not surface BucketName, RequestId, or any other field the body might contain', () => {
    const xml = `<Error><Code>NoSuchBucket</Code><BucketName>lgfc-d1-backups</BucketName></Error>`;
    const code = extractS3ErrorCode(xml);
    expect(code).toBe('NoSuchBucket');
    expect(code).not.toContain('lgfc-d1-backups');
  });

  it('returns an empty string for a body with no Code field or malformed input, instead of throwing', () => {
    expect(extractS3ErrorCode('<Error><Message>oops</Message></Error>')).toBe('');
    expect(extractS3ErrorCode('')).toBe('');
    expect(extractS3ErrorCode(undefined)).toBe('');
  });
});

describe('extractR2BucketListing', () => {
  it('finds the matching bucket by name and extracts non-sensitive metadata', () => {
    const parsed = [
      { name: 'other-bucket', creation_date: '2025-01-01T00:00:00Z' },
      { name: 'lgfc-d1-backups', creation_date: '2026-08-10T00:00:00Z', location: 'ENAM', storage_class: 'Standard' },
    ];
    expect(extractR2BucketListing(parsed, 'lgfc-d1-backups')).toEqual({
      found: true,
      creationDate: '2026-08-10T00:00:00Z',
      location: 'ENAM',
      storageClass: 'Standard',
    });
  });

  it('reports found: false when the bucket name is not in the list', () => {
    expect(extractR2BucketListing([{ name: 'other-bucket' }], 'lgfc-d1-backups')).toEqual({ found: false });
  });

  it('handles a { result: [...] } or { buckets: [...] } wrapper shape', () => {
    const bucket = { name: 'lgfc-d1-backups' };
    expect(extractR2BucketListing({ result: [bucket] }, 'lgfc-d1-backups').found).toBe(true);
    expect(extractR2BucketListing({ buckets: [bucket] }, 'lgfc-d1-backups').found).toBe(true);
  });

  it('returns null for a non-array/unrecognized payload instead of throwing', () => {
    expect(extractR2BucketListing(null, 'x')).toBeNull();
    expect(extractR2BucketListing({}, 'x')).toBeNull();
  });
});

describe('buildResultMarkdown', () => {
  it('renders a fully-successful result with wrangler corroboration', () => {
    const md = buildResultMarkdown({
      checkedAt: '2026-08-10T00:00:00Z',
      bucketName: 'lgfc-d1-backups',
      listOk: true,
      objectCount: 0,
      isTruncated: false,
      wranglerConfirmed: true,
      wranglerBucket: { found: true, creationDate: '2026-08-10T00:00:00Z', location: 'ENAM', storageClass: 'Standard' },
    });
    expect(md).toContain('Bucket: `lgfc-d1-backups`');
    expect(md).toContain('S3 `ListObjectsV2` read: OK');
    expect(md).toContain('object count in this page: 0');
    expect(md).toContain('found in account bucket list: YES');
    expect(md).toContain('storage_class: Standard');
  });

  it('renders a failed S3 read with its reason', () => {
    const md = buildResultMarkdown({
      checkedAt: '2026-08-10T00:00:00Z',
      bucketName: 'lgfc-d1-backups',
      listOk: false,
      listFailureReason: 'HTTP 403: access denied',
    });
    expect(md).toContain('S3 `ListObjectsV2` read: FAILED');
    expect(md).toContain('HTTP 403: access denied');
  });

  it('renders wrangler-not-confirmed with its reason, without throwing', () => {
    const md = buildResultMarkdown({
      checkedAt: '2026-08-10T00:00:00Z',
      bucketName: 'lgfc-d1-backups',
      listOk: true,
      objectCount: 0,
      isTruncated: false,
      wranglerConfirmed: false,
      wranglerFailureReason: 'CLOUDFLARE_API_TOKEN may lack R2 scope',
    });
    expect(md).toContain('wrangler r2 bucket list` corroboration: not confirmed');
    expect(md).toContain('CLOUDFLARE_API_TOKEN may lack R2 scope');
  });

  it('always documents what this preflight does and does not confirm', () => {
    const md = buildResultMarkdown({ checkedAt: '2026-08-10T00:00:00Z', bucketName: 'x', listOk: false });
    expect(md).toContain('Does NOT confirm "public access disabled" directly');
    expect(md).toContain('Does NOT write, upload, or delete any object');
  });

  it('reports whether an R2 secret had leading/trailing whitespace, without ever printing the value', () => {
    const withWhitespace = buildResultMarkdown({
      checkedAt: '2026-08-10T00:00:00Z',
      bucketName: 'lgfc-d1-backups',
      listOk: false,
      listFailureReason: 'fetch failed',
      hadUntrimmedCredential: true,
    });
    expect(withWhitespace).toContain('had leading/trailing whitespace (trimmed before use, values never logged): YES');

    const clean = buildResultMarkdown({
      checkedAt: '2026-08-10T00:00:00Z',
      bucketName: 'lgfc-d1-backups',
      listOk: false,
      listFailureReason: 'fetch failed',
      hadUntrimmedCredential: false,
    });
    expect(clean).toContain('had leading/trailing whitespace (trimmed before use, values never logged): NO');
  });
});
