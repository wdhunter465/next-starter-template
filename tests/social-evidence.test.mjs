import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  appendToDay,
  buildEvidenceRecord,
  dayFilePath,
  emptyDay,
  latestRecords,
  newYorkDate,
  nextVersion,
  sha256Hex,
  toNewYorkIso,
  validateEvidenceRecord,
} from '../scripts/ops/social-evidence.mjs';

const post = (over = {}) => ({
  id: '2026-11-13-daily',
  publish_at: '2026-11-13T10:00:00-05:00',
  text: 'A fact.\n\nExplore his story with the Lou Gehrig Fan Club:\nhttps://lougehrigfanclub.com',
  photo_id: 862,
  alt_text: 'A photo',
  ...over,
});
const photo = { image_url: 'https://www.lougehrigfanclub.com/api/social/image/2026-11-13-daily', image_sha256: 'a'.repeat(64), image_bytes: 1000, width: 100, height: 120 };
const verified = { on: '2026-11-13', by: 'test', method: 'unit test' };
const handedOff = { at_utc: '2026-11-13T15:11:00Z', by: 'job', outcome: 'handed_off', detail: 'Issue #1' };

const confirmedX = (over = {}) =>
  buildEvidenceRecord({
    post: post(),
    platform: 'x',
    status: 'confirmed',
    attempts: [{ at_utc: '2026-11-13T15:04:07Z', by: 'job', outcome: 'ok', detail: 'sent' }],
    platformRecord: { post_id: 'abc', url: null, created_at_utc: '2026-11-13T15:04:07Z' },
    photo,
    verified,
    ...over,
  });

describe('time helpers', () => {
  it('formats New York time with the right offset in winter and summer', () => {
    expect(toNewYorkIso('2026-11-12T15:14:02Z')).toBe('2026-11-12T10:14:02-05:00');
    expect(toNewYorkIso('2027-06-09T14:00:00Z')).toBe('2027-06-09T10:00:00-04:00');
  });
  it('uses the New York calendar date, not the UTC date', () => {
    expect(newYorkDate('2026-11-13T02:00:00Z')).toBe('2026-11-12');
    expect(newYorkDate('2026-11-13T10:00:00-05:00')).toBe('2026-11-13');
  });
  it('builds the day file path', () => {
    expect(dayFilePath('2026-11-12')).toBe('data/social-audit/2026/11/2026-11-12.json');
    expect(() => dayFilePath('11/12/2026')).toThrow();
  });
});

describe('buildEvidenceRecord and validateEvidenceRecord', () => {
  it('builds a valid confirmed record with the text hash and the New York time', () => {
    const r = confirmedX();
    expect(validateEvidenceRecord(r)).toEqual([]);
    expect(r.text_sha256).toBe(sha256Hex(post().text));
    expect(r.platform_record.created_at_new_york).toBe('2026-11-13T10:04:07-05:00');
    expect(r.origin).toBe('queue');
  });

  it('rejects an unknown status, a bad time and a confirmed record with no platform id', () => {
    const r = confirmedX();
    expect(validateEvidenceRecord({ ...r, status: 'posted' }).join()).toMatch(/status must be one of/);
    expect(validateEvidenceRecord({ ...r, scheduled_for: 'tomorrow' }).join()).toMatch(/scheduled_for/);
    expect(validateEvidenceRecord({ ...r, platform_record: { created_at_utc: r.platform_record.created_at_utc } }).join()).toMatch(/confirmed record needs/);
  });

  it('rejects a text that does not match its hash and a created time that does not match New York time', () => {
    const r = confirmedX();
    expect(validateEvidenceRecord({ ...r, text: 'changed' }).join()).toMatch(/text_sha256/);
    expect(
      validateEvidenceRecord({ ...r, platform_record: { ...r.platform_record, created_at_new_york: '2026-11-13T10:04:07-04:00' } }).join(),
    ).toMatch(/created_at_new_york/);
  });

  it('needs an error attempt for failed, a hand-off for missing, and a note for not_eligible', () => {
    expect(() => buildEvidenceRecord({ post: post(), platform: 'x', status: 'failed', attempts: [], photo, verified })).toThrow(/failed record/);
    expect(() => buildEvidenceRecord({ post: post(), platform: 'facebook', status: 'missing', attempts: [], photo, verified })).toThrow(/missing record/);
    expect(() => buildEvidenceRecord({ post: post(), platform: 'instagram', status: 'not_eligible', attempts: [], photo, verified })).toThrow(/not_eligible/);
    const ok = buildEvidenceRecord({
      post: post(),
      platform: 'x',
      status: 'failed',
      attempts: [{ at_utc: '2026-11-13T15:04:07Z', by: 'job', outcome: 'error', detail: 'Buffer 500' }],
      photo,
      verified,
    });
    expect(ok.status).toBe('failed');
  });

  it('requires detail on an error attempt', () => {
    expect(() =>
      buildEvidenceRecord({
        post: post(),
        platform: 'x',
        status: 'failed',
        attempts: [{ at_utc: '2026-11-13T15:04:07Z', by: 'job', outcome: 'error' }],
        photo,
        verified,
      }),
    ).toThrow(/needs detail/);
  });

  it('keeps an ad hoc post honest: adhoc id, a note, and no adhoc id on a queue post', () => {
    const adHoc = { id: 'adhoc-2026-11-13-1', publish_at: '2026-11-13T12:30:00-05:00', text: 'Extra post', photo_id: 862, alt_text: 'A photo' };
    expect(() => buildEvidenceRecord({ post: adHoc, platform: 'x', status: 'handed_off', attempts: [handedOff], photo, verified, origin: 'ad_hoc' })).toThrow(/needs a note/);
    const r = buildEvidenceRecord({ post: adHoc, platform: 'x', status: 'handed_off', attempts: [handedOff], photo, verified, origin: 'ad_hoc', note: 'Asked by Product Authority: Lou Gehrig Day reminder' });
    expect(r.origin).toBe('ad_hoc');
    expect(() => buildEvidenceRecord({ post: adHoc, platform: 'x', status: 'handed_off', attempts: [handedOff], photo, verified })).toThrow(/ad_hoc/);
  });
});

describe('append-only day documents', () => {
  it('appends a first record and returns a new document without changing the old one', () => {
    const before = emptyDay('2026-11-13');
    const after = appendToDay(before, confirmedX());
    expect(before.records).toHaveLength(0);
    expect(after.records).toHaveLength(1);
  });

  it('creates the day document from the record when none exists', () => {
    expect(appendToDay(null, confirmedX()).date).toBe('2026-11-13');
  });

  it('a retry is a new version that supersedes the last and keeps every earlier attempt', () => {
    const failed = buildEvidenceRecord({
      post: post(),
      platform: 'x',
      status: 'failed',
      attempts: [{ at_utc: '2026-11-13T15:04:07Z', by: 'job', outcome: 'error', detail: 'Buffer 500' }],
      photo,
      verified,
    });
    const day1 = appendToDay(null, failed);
    expect(nextVersion(day1, '2026-11-13-daily', 'x')).toBe(2);
    const retry = buildEvidenceRecord({
      post: post(),
      platform: 'x',
      status: 'confirmed',
      version: 2,
      attempts: [...failed.attempts, { at_utc: '2026-11-13T15:34:09Z', by: 'job', outcome: 'ok', detail: 'sent' }],
      platformRecord: { post_id: 'abc', url: null, created_at_utc: '2026-11-13T15:34:09Z' },
      photo,
      verified,
    });
    const day2 = appendToDay(day1, retry);
    expect(day2.records).toHaveLength(2);
    expect(day2.records[0].status).toBe('failed');
    expect(latestRecords(day2)[0].status).toBe('confirmed');
    expect(latestRecords(day2)[0].attempts).toHaveLength(2);
  });

  it('refuses a duplicate version, a skipped version and a record for another day', () => {
    const day = appendToDay(null, confirmedX());
    expect(() => appendToDay(day, confirmedX())).toThrow(/already exists/);
    expect(() => appendToDay(day, confirmedX({ version: 3 }))).toThrow(/version must be 2/);
    expect(() => appendToDay(day, confirmedX({ post: post({ id: 'other', publish_at: '2026-11-14T10:00:00-05:00' }) }))).toThrow(/day document/);
  });

  it('refuses an invalid record', () => {
    expect(() => appendToDay(null, { ...confirmedX(), status: 'posted' })).toThrow(/invalid evidence record/);
  });
});

describe('the hand-built records in the design document', () => {
  const doc = readFileSync('docs/reference/operations/social-post-audit-design.md', 'utf8');
  const blocks = [...doc.matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) => JSON.parse(m[1]));
  const records = blocks.flat();

  it('has eleven records for three days', () => {
    expect(blocks).toHaveLength(3);
    expect(records).toHaveLength(11);
  });

  it('all validate, and each day appends cleanly into one day document', () => {
    for (const r of records) expect(validateEvidenceRecord(r), `${r.post_id}/${r.platform}`).toEqual([]);
    for (const block of blocks) {
      let day = null;
      for (const r of block) day = appendToDay(day, r);
      expect(day.records).toHaveLength(block.length);
    }
  });

  it('shows the 2026-11-11 Facebook and Pinterest posts as missing', () => {
    const missing = records.filter((r) => r.status === 'missing').map((r) => `${r.post_id}/${r.platform}`);
    expect(missing.sort()).toEqual(['2026-11-11-daily/facebook', '2026-11-11-daily/pinterest']);
  });
});
