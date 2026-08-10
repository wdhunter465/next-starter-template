import { describe, expect, it } from 'vitest';
import {
  buildResultMarkdown,
  extractD1InfoMetadata,
  extractTimeTravelBookmark,
  requireEnv,
} from '../scripts/ci/d1_backup_phase1_preflight_3268.mjs';

// #3268 Phase 1 preflight — covers the pure helper functions only. `main()` invokes the real
// `wrangler` CLI against live Production credentials and is verified by the real CI run against
// Production (same precedent as #2913's preflight, which has no unit test of its own for the
// same reason), not by a mocked unit test here.

describe('requireEnv', () => {
  it('lists every missing required credential', () => {
    expect(requireEnv({})).toEqual([
      'CLOUDFLARE_API_TOKEN',
      'CLOUDFLARE_ACCOUNT_ID',
      'D1_DATABASE_NAME',
      'D1_DATABASE_ID',
    ]);
  });

  it('returns an empty list when every credential is present', () => {
    expect(
      requireEnv({
        CLOUDFLARE_API_TOKEN: 'x',
        CLOUDFLARE_ACCOUNT_ID: 'x',
        D1_DATABASE_NAME: 'x',
        D1_DATABASE_ID: 'x',
      }),
    ).toEqual([]);
  });
});

describe('extractD1InfoMetadata', () => {
  it('extracts fields from a wrangler d1 info array-wrapped result', () => {
    expect(extractD1InfoMetadata([{ file_size: 123, num_tables: 40, version: 'alpha' }])).toEqual({
      fileSize: 123,
      numTables: 40,
      version: 'alpha',
    });
  });

  it('extracts fields from a { result: {...} } shape', () => {
    expect(extractD1InfoMetadata({ result: { file_size: 5, num_tables: 1, version: 'beta' } })).toEqual({
      fileSize: 5,
      numTables: 1,
      version: 'beta',
    });
  });

  it('returns null for a non-object/empty payload instead of throwing', () => {
    expect(extractD1InfoMetadata(null)).toBeNull();
    expect(extractD1InfoMetadata([])).toBeNull();
  });
});

describe('extractTimeTravelBookmark', () => {
  it('extracts a bookmark field', () => {
    expect(extractTimeTravelBookmark([{ bookmark: 'abc123' }])).toBe('abc123');
  });

  it('falls back to a timestamp field when bookmark is absent', () => {
    expect(extractTimeTravelBookmark({ result: { timestamp: '2026-08-10T00:00:00Z' } })).toBe(
      '2026-08-10T00:00:00Z',
    );
  });

  it('returns an empty string for a non-object/empty payload instead of throwing', () => {
    expect(extractTimeTravelBookmark(null)).toBe('');
    expect(extractTimeTravelBookmark([])).toBe('');
  });
});

describe('buildResultMarkdown', () => {
  it('renders a fully-successful result', () => {
    const md = buildResultMarkdown({
      checkedAt: '2026-08-10T00:00:00Z',
      identityConfirmed: true,
      infoOk: true,
      metadata: { fileSize: 100, numTables: 40, version: 'alpha' },
      timeTravelConfirmed: true,
      timeTravelBookmark: 'abc123',
    });
    expect(md).toContain('Database identity confirmed: YES');
    expect(md).toContain('`wrangler d1 info`: OK');
    expect(md).toContain('file_size: 100, num_tables: 40, version: alpha');
    expect(md).toContain('Time Travel confirmed via CLI: YES');
    expect(md).toContain('bookmark present: YES');
  });

  it('renders a Time Travel not-confirmed result with its reason, without throwing', () => {
    const md = buildResultMarkdown({
      checkedAt: '2026-08-10T00:00:00Z',
      identityConfirmed: true,
      infoOk: true,
      metadata: { fileSize: 100, numTables: 40, version: 'alpha' },
      timeTravelConfirmed: false,
      timeTravelFailureReason: 'wrangler d1 time-travel info did not succeed (exit 1)',
    });
    expect(md).toContain('Time Travel confirmed via CLI: NO');
    expect(md).toContain('wrangler d1 time-travel info did not succeed (exit 1)');
  });

  it('always documents which Phase 1 items this preflight cannot answer', () => {
    const md = buildResultMarkdown({ checkedAt: '2026-08-10T00:00:00Z', identityConfirmed: false, infoOk: false });
    expect(md).toContain('not answerable from this preflight');
    expect(md).toContain('no R2-scoped credential exists');
  });
});
