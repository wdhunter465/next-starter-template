// #5085: the rights verdict used at send time is recorded in the evidence record, and only records it.
import { describe, expect, it } from 'vitest';
import { buildEvidenceRecord, rightsCheckFor, validateEvidenceRecord } from '../scripts/ops/social-evidence.mjs';

const AT = '2026-11-13T15:04:07+00:00';
const post = { id: '2026-11-13-daily', publish_at: '2026-11-13T10:00:00-05:00', text: 'A fact.', photo_id: 862, alt_text: 'A photo' };
const photo = { image_url: 'https://example.test/i', image_sha256: 'a'.repeat(64), image_bytes: 10, width: 100, height: 120 };
const build = (extra = {}) =>
  buildEvidenceRecord({
    post,
    platform: 'x',
    status: 'confirmed',
    attempts: [{ at_utc: '2026-11-13T15:04:07Z', by: 'job', outcome: 'ok', detail: 'sent' }],
    platformRecord: { post_id: 'abc', url: null, created_at_utc: '2026-11-13T15:04:07Z' },
    photo,
    verified: { on: '2026-11-13', by: 'test', method: 'unit test' },
    ...extra,
  });

describe('rightsCheckFor', () => {
  const queue = { rights_cleared_photo_ids: [855, 862], held_photo_ids: [855] };

  it('is cleared only when the queue lists the photo as cleared and not held', () => {
    expect(rightsCheckFor(queue, 862, AT)).toMatchObject({ verdict: 'cleared', checked_at_utc: AT });
    expect(rightsCheckFor(queue, 855, AT).verdict).toBe('not_cleared'); // cleared but held
    expect(rightsCheckFor(queue, 999, AT).verdict).toBe('not_cleared'); // not listed
    expect(rightsCheckFor({}, 862, AT).verdict).toBe('not_cleared');
  });

  it('does not change the queue', () => {
    const copy = JSON.parse(JSON.stringify(queue));
    rightsCheckFor(queue, 862, AT);
    expect(queue).toEqual(copy);
  });
});

describe('evidence record with a rights check', () => {
  it('stores the verdict under photo.rights_check and stays valid', () => {
    const record = build({ rightsCheck: rightsCheckFor({ rights_cleared_photo_ids: [862], held_photo_ids: [] }, 862, AT) });
    expect(record.photo.rights_check).toMatchObject({ verdict: 'cleared', checked_at_utc: AT });
    expect(validateEvidenceRecord(record)).toEqual([]);
  });

  it('records not_cleared too (it records, it does not decide)', () => {
    const record = build({ rightsCheck: rightsCheckFor({ rights_cleared_photo_ids: [], held_photo_ids: [] }, 862, AT) });
    expect(record.photo.rights_check.verdict).toBe('not_cleared');
  });

  it('earlier records without a rights check stay valid', () => {
    const record = build();
    expect(record.photo.rights_check).toBeUndefined();
    expect(validateEvidenceRecord(record)).toEqual([]);
  });

  it('refuses a malformed rights check', () => {
    for (const bad of [{ verdict: 'maybe', source: 's', checked_at_utc: AT }, { verdict: 'cleared', source: '', checked_at_utc: AT }, { verdict: 'cleared', source: 's', checked_at_utc: 'yesterday' }]) {
      expect(() => build({ rightsCheck: bad })).toThrow(/rights_check/);
    }
  });
});
