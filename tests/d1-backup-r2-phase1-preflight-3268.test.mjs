import { describe, expect, it } from 'vitest';
import {
  buildResultMarkdown,
  extractR2BucketListing,
  extractS3ErrorCode,
  findBlankAfterTrim,
  parseListObjectsV2Page,
  redactSecrets,
  requireR2Env,
  summarizeDnsResult,
  validateEndpointStructure,
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

describe('redactSecrets', () => {
  it('replaces every literal occurrence of a secret value', () => {
    expect(redactSecrets('error connecting to abc123secret.example.com', ['abc123secret'])).toBe(
      'error connecting to [REDACTED].example.com',
    );
  });

  it('redacts multiple distinct secrets in the same text', () => {
    const text = 'key=AKIAEXAMPLE123 bucket=my-bucket-name-x host=account123456.example.com';
    const redacted = redactSecrets(text, ['AKIAEXAMPLE123', 'my-bucket-name-x', 'account123456']);
    expect(redacted).not.toContain('AKIAEXAMPLE123');
    expect(redacted).not.toContain('my-bucket-name-x');
    expect(redacted).not.toContain('account123456');
  });

  it('skips values shorter than 6 characters to avoid mass-redacting common short substrings', () => {
    expect(redactSecrets('the cat sat on the mat', ['cat'])).toBe('the cat sat on the mat');
  });

  it('handles null/undefined text and an empty/missing secrets list without throwing', () => {
    expect(redactSecrets(null, ['abcdef'])).toBe('');
    expect(redactSecrets(undefined, ['abcdef'])).toBe('');
    expect(redactSecrets('hello', undefined)).toBe('hello');
    expect(redactSecrets('hello', [])).toBe('hello');
  });
});

describe('validateEndpointStructure', () => {
  it('confirms a valid endpoint suffix and a real-shaped 32-char hex account-ID label', () => {
    const hostname = `${'a'.repeat(32)}.r2.cloudflarestorage.com`;
    expect(validateEndpointStructure(hostname)).toEqual({ suffixOk: true, labelLength: 32, labelIsHex32: true });
  });

  it('flags a wrong suffix without ever needing the actual hostname value to do so', () => {
    expect(validateEndpointStructure('example.com')).toEqual({ suffixOk: false, labelLength: 0, labelIsHex32: false });
  });

  it('flags a label that is present but not 32-char hex', () => {
    const hostname = 'not-a-real-account-id.r2.cloudflarestorage.com';
    const result = validateEndpointStructure(hostname);
    expect(result.suffixOk).toBe(true);
    expect(result.labelIsHex32).toBe(false);
  });

  it('does not throw on non-string/empty input', () => {
    expect(validateEndpointStructure(null)).toEqual({ suffixOk: false, labelLength: 0, labelIsHex32: false });
    expect(validateEndpointStructure('')).toEqual({ suffixOk: false, labelLength: 0, labelIsHex32: false });
  });
});

describe('summarizeDnsResult', () => {
  it('summarizes address count and de-duplicated families, never the addresses themselves', () => {
    const addresses = [
      { address: '1.2.3.4', family: 4 },
      { address: '1.2.3.5', family: 4 },
      { address: '::1', family: 6 },
    ];
    expect(summarizeDnsResult(addresses)).toEqual({ addressCount: 3, families: ['IPv4', 'IPv6'] });
  });

  it('returns a zero/empty summary for no addresses, without throwing', () => {
    expect(summarizeDnsResult([])).toEqual({ addressCount: 0, families: [] });
    expect(summarizeDnsResult(null)).toEqual({ addressCount: 0, families: [] });
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

  it('renders successful TLS handshake diagnostics with ALPN/protocol, never the hostname', () => {
    const md = buildResultMarkdown({
      checkedAt: '2026-08-10T00:00:00Z',
      bucketName: 'lgfc-d1-backups',
      listOk: false,
      listFailureReason: 'fetch failed',
      tlsDefault: { ok: true, alpnProtocol: 'h2', protocolVersion: 'TLSv1.3', cipherName: 'TLS_AES_256_GCM_SHA384', code: null },
      tlsHttp1Only: { ok: true, alpnProtocol: 'http/1.1', protocolVersion: 'TLSv1.3', cipherName: 'TLS_AES_256_GCM_SHA384', code: null },
    });
    expect(md).toContain('default ALPN (Node/undici default offer): OK (ALPN: h2, protocol: TLSv1.3, cipher: TLS_AES_256_GCM_SHA384)');
    expect(md).toContain('http/1.1-only ALPN: OK (ALPN: http/1.1, protocol: TLSv1.3, cipher: TLS_AES_256_GCM_SHA384)');
  });

  it('renders failed TLS handshake diagnostics with only the short error code', () => {
    const md = buildResultMarkdown({
      checkedAt: '2026-08-10T00:00:00Z',
      bucketName: 'lgfc-d1-backups',
      listOk: false,
      listFailureReason: 'fetch failed',
      tlsDefault: { ok: false, alpnProtocol: null, protocolVersion: null, code: 'ERR_SSL_TLSV1_ALERT_HANDSHAKE_FAILURE' },
      tlsHttp1Only: { ok: false, alpnProtocol: null, protocolVersion: null, code: 'ERR_SSL_TLSV1_ALERT_HANDSHAKE_FAILURE' },
    });
    expect(md).toContain('default ALPN (Node/undici default offer): FAILED (code: ERR_SSL_TLSV1_ALERT_HANDSHAKE_FAILURE)');
    expect(md).toContain('http/1.1-only ALPN: FAILED (code: ERR_SSL_TLSV1_ALERT_HANDSHAKE_FAILURE)');
  });

  it('renders "not attempted" for a missing TLS diagnostic entry instead of throwing', () => {
    const md = buildResultMarkdown({ checkedAt: '2026-08-10T00:00:00Z', bucketName: 'x', listOk: false });
    expect(md).toContain('default ALPN (Node/undici default offer): not attempted');
    expect(md).toContain('http/1.1-only ALPN: not attempted');
    expect(md).toContain('TLS 1.2 forced: not attempted');
    expect(md).toContain('TLS 1.3 forced: not attempted');
    expect(md).toContain('Endpoint structure: not checked');
    expect(md).toContain('DNS resolution: not attempted');
    expect(md).toContain('openssl s_client` (independent TLS client): not attempted');
    expect(md).toContain('curl` (independent HTTP/TLS client): not attempted');
  });

  it('renders endpoint structure and DNS results', () => {
    const md = buildResultMarkdown({
      checkedAt: '2026-08-10T00:00:00Z',
      bucketName: 'x',
      listOk: false,
      endpointStructure: { suffixOk: true, labelLength: 32, labelIsHex32: true },
      dnsResult: { ok: true, addressCount: 2, families: ['IPv4'] },
    });
    expect(md).toContain('suffix matches `.r2.cloudflarestorage.com`: YES; account-ID label length: 32; label is 32-char hex: YES');
    expect(md).toContain('DNS resolution: OK (2 address(es), families: IPv4)');
  });

  it('renders a failed DNS result with its code', () => {
    const md = buildResultMarkdown({
      checkedAt: '2026-08-10T00:00:00Z',
      bucketName: 'x',
      listOk: false,
      dnsResult: { ok: false, addressCount: 0, families: [], code: 'ENOTFOUND' },
    });
    expect(md).toContain('DNS resolution: FAILED (code: ENOTFOUND)');
  });

  it('renders the openssl s_client verify-return-code result when present', () => {
    const md = buildResultMarkdown({
      checkedAt: '2026-08-10T00:00:00Z',
      bucketName: 'x',
      listOk: false,
      opensslResult: { ranOk: true, exitCode: 0, timedOut: false, verifyReturnCode: 0, verifyReturnMessage: 'ok' },
    });
    expect(md).toContain('exit 0, verify return code 0 (ok)');
  });

  it('renders an openssl timeout distinctly from a normal failure', () => {
    const md = buildResultMarkdown({
      checkedAt: '2026-08-10T00:00:00Z',
      bucketName: 'x',
      listOk: false,
      opensslResult: { ranOk: true, exitCode: 124, timedOut: true, verifyReturnCode: null, verifyReturnMessage: null },
    });
    expect(md).toContain('openssl s_client` (independent TLS client): TIMED OUT (12s)');
  });

  it('renders the curl HTTP status when curl connected, or the exit code when it did not', () => {
    const connected = buildResultMarkdown({
      checkedAt: '2026-08-10T00:00:00Z',
      bucketName: 'x',
      listOk: false,
      curlResult: { ranOk: true, exitCode: 0, httpCode: '403' },
    });
    expect(connected).toContain('curl` (independent HTTP/TLS client): exit 0, HTTP 403');

    const failed = buildResultMarkdown({
      checkedAt: '2026-08-10T00:00:00Z',
      bucketName: 'x',
      listOk: false,
      curlResult: { ranOk: true, exitCode: 35, httpCode: null },
    });
    expect(failed).toContain('curl` (independent HTTP/TLS client): exit 35');
  });
});
