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
  it('extracts fields from a wrangler d1 info array-wrapped result, including the raw record', () => {
    const raw = { file_size: 123, num_tables: 40, version: 'alpha' };
    expect(extractD1InfoMetadata([raw])).toEqual({
      fileSize: 123,
      numTables: 40,
      version: 'alpha',
      raw,
    });
  });

  it('extracts fields from a { result: {...} } shape', () => {
    const raw = { file_size: 5, num_tables: 1, version: 'beta' };
    expect(extractD1InfoMetadata({ result: raw })).toEqual({
      fileSize: 5,
      numTables: 1,
      version: 'beta',
      raw,
    });
  });

  it('falls back through alternate size/version field name guesses', () => {
    const raw = { database_size: 999, storage_version: 'v2', num_tables: 2 };
    const metadata = extractD1InfoMetadata(raw);
    expect(metadata.fileSize).toBe(999);
    expect(metadata.version).toBe('v2');
  });

  it('returns null for a non-object/empty payload instead of throwing', () => {
    expect(extractD1InfoMetadata(null)).toBeNull();
    expect(extractD1InfoMetadata([])).toBeNull();
  });
});

describe('extractTimeTravelBookmark', () => {
  it('extracts a bookmark field and the raw record', () => {
    const raw = { bookmark: 'abc123' };
    expect(extractTimeTravelBookmark([raw])).toEqual({ bookmark: 'abc123', raw });
  });

  it('falls back to a timestamp field when bookmark is absent', () => {
    const raw = { timestamp: '2026-08-10T00:00:00Z' };
    expect(extractTimeTravelBookmark({ result: raw })).toEqual({
      bookmark: '2026-08-10T00:00:00Z',
      raw,
    });
  });

  it('returns an empty bookmark and null raw for a non-object/empty payload instead of throwing', () => {
    expect(extractTimeTravelBookmark(null)).toEqual({ bookmark: '', raw: null });
    expect(extractTimeTravelBookmark([])).toEqual({ bookmark: '', raw: null });
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

  it('renders the raw d1 info and time-travel info payloads when present, for field-name evidence', () => {
    const md = buildResultMarkdown({
      checkedAt: '2026-08-10T00:00:00Z',
      identityConfirmed: true,
      infoOk: true,
      metadata: { fileSize: null, numTables: 40, version: null, raw: { num_tables: 40, unexpected_field: 'x' } },
      timeTravelConfirmed: true,
      timeTravelBookmark: 'abc123',
      timeTravelRaw: { bookmark: 'abc123', retention_end_time: '2026-09-10T00:00:00Z' },
    });
    expect(md).toContain('Raw `wrangler d1 info` response');
    expect(md).toContain('"unexpected_field": "x"');
    expect(md).toContain('Raw `wrangler d1 time-travel info` response');
    expect(md).toContain('"retention_end_time"');
  });

  it('omits the raw-payload sections when there is nothing to show', () => {
    const md = buildResultMarkdown({
      checkedAt: '2026-08-10T00:00:00Z',
      identityConfirmed: false,
      infoOk: false,
      timeTravelConfirmed: false,
    });
    expect(md).not.toContain('Raw `wrangler d1 info` response');
    expect(md).not.toContain('Raw `wrangler d1 time-travel info` response');
  });
});
