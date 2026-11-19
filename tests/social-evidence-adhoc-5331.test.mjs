// #5331: ad hoc social evidence logs are dry-run by default and use adhoc-YYYY-MM-DD-N ids.

import { describe, expect, it, vi } from 'vitest';

import { buildAdHocRecord, nextAdHocPostId, parseArgs, run } from '../scripts/ops/social-evidence-adhoc.mjs';
import { validateEvidenceRecord } from '../scripts/ops/social-evidence.mjs';

const BASE_ARGS = [
  '--now',
  '2026-11-18T15:30:00Z',
  '--platform',
  'x',
  '--status',
  'confirmed',
  '--text',
  'Ad hoc Lou Gehrig Fan Club post.',
  '--photo-id',
  '864',
  '--image-url',
  'https://www.lougehrigfanclub.com/api/social/image/ad-hoc',
  '--image-sha256',
  'a'.repeat(64),
  '--image-bytes',
  '12345',
  '--width',
  '1200',
  '--height',
  '800',
  '--alt-text',
  'Lou Gehrig portrait.',
  '--platform-post-id',
  'post-123',
  '--platform-created-at-utc',
  '2026-11-18T15:29:00Z',
  '--note',
  'Bill asked for this post to announce the fundraiser because the daily queue did not cover it.',
];

describe('social evidence ad hoc command', () => {
  it('parses dry-run by default and apply only when explicit', () => {
    expect(parseArgs(BASE_ARGS).apply).toBe(false);
    expect(parseArgs([...BASE_ARGS, '--apply']).apply).toBe(true);
    expect(() => parseArgs(['--note'])).toThrow(/needs a value/);
  });

  it('builds a valid ad hoc record with the New York date id format', () => {
    const record = buildAdHocRecord(parseArgs(BASE_ARGS));

    expect(record.post_id).toMatch(/^adhoc-2026-11-18-\d+$/);
    expect(record).toMatchObject({ origin: 'ad_hoc', platform: 'x', status: 'confirmed', version: 1 });
    expect(validateEvidenceRecord(record)).toEqual([]);
  });

  it('selects the next ad hoc id from existing ids', () => {
    expect(nextAdHocPostId('2026-11-18', ['adhoc-2026-11-18-1', 'adhoc-2026-11-18-3', 'adhoc-2026-11-17-9'])).toBe(
      'adhoc-2026-11-18-4',
    );
  });

  it('dry run prints the target and record without sending anything', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 500 }));
    const report = await run({ BASE_URL: 'https://example.test' }, BASE_ARGS, fetchImpl);

    expect(report.mode).toBe('dry-run');
    expect(report.target).toBe('https://example.test/api/social/evidence');
    expect(report.record.post_id).toMatch(/^adhoc-2026-11-18-\d+$/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('apply discovers the next empty id and posts the record with the bridge token', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, rows: [{ version: 1 }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, rows: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, version: 1 }), { status: 201 }));

    const report = await run(
      { BASE_URL: 'https://example.test', SCHEDULED_CONTENT_BRIDGE_TOKEN: 'tok' },
      [...BASE_ARGS, '--apply'],
      fetchImpl,
    );

    expect(report.mode).toBe('apply');
    expect(report.record.post_id).toBe('adhoc-2026-11-18-2');
    const [, postInit] = fetchImpl.mock.calls[2];
    expect(postInit.method).toBe('POST');
    expect(postInit.headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(postInit.body).origin).toBe('ad_hoc');
  });
});
