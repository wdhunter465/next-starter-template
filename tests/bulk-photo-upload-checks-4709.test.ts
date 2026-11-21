import { describe, expect, it } from 'vitest';

import {
  BULK_PHOTO_LGFC_CREDIT,
  decideBulkPhotoRights,
  extractPhashFromTags,
  findNearDuplicatePhotoMatches,
  flagFlatCopyLookAlike,
  isHeicFileName,
  isValidBulkBatchId,
  NEAR_DUPLICATE_MAX_DISTANCE,
} from '../functions/_lib/bulk-photo-upload-checks';
import { hammingDistanceHex } from '../functions/_lib/perceptual-hash';

describe('bulk photo upload checks (#4709)', () => {
  it('sets LGFC holder and credit for lgfc_collection and always holds rights', () => {
    const d = decideBulkPhotoRights({ rightsClass: 'lgfc_collection' });
    expect(d).toMatchObject({
      rightsClass: 'lgfc_collection',
      rightsHold: true,
      publicationEligible: false,
      rightsHolder: 'Lou Gehrig Fan Club',
      creditLine: BULK_PHOTO_LGFC_CREDIT,
      source: null,
    });
  });

  it('never shows LGFC for someone_elses and requires source', () => {
    expect(decideBulkPhotoRights({ rightsClass: 'someone_elses' })).toEqual({
      ok: false,
      error: 'source is required when rights_class is someone_elses.',
    });
    const d = decideBulkPhotoRights({ rightsClass: 'someone_elses', source: 'Estate collection' });
    expect(d).toMatchObject({
      rightsClass: 'someone_elses',
      rightsHold: true,
      publicationEligible: false,
      rightsHolder: null,
      creditLine: null,
      source: 'Estate collection',
    });
  });

  it('rejects unknown rights_class', () => {
    expect(decideBulkPhotoRights({ rightsClass: 'other' })).toEqual({
      ok: false,
      error: 'rights_class must be lgfc_collection or someone_elses.',
    });
  });

  it('flags flat-copy look-alike file names for review', () => {
    expect(flagFlatCopyLookAlike('baseball_card_front.jpg').flagged).toBe(true);
    expect(flagFlatCopyLookAlike('poster_wall.png').flagged).toBe(true);
    expect(flagFlatCopyLookAlike('game_action_001.jpg').flagged).toBe(false);
  });

  it('detects HEIC/HEIF by file name', () => {
    expect(isHeicFileName('IMG_0001.HEIC')).toBe(true);
    expect(isHeicFileName('a.heif')).toBe(true);
    expect(isHeicFileName('a.jpg')).toBe(false);
  });

  it('accepts safe batch ids and refuses comma, slash, colon, empty, and dotted-only', () => {
    expect(isValidBulkBatchId('batch-42')).toBe(true);
    expect(isValidBulkBatchId('a.b_c-1')).toBe(true);
    expect(isValidBulkBatchId('bad,id')).toBe(false);
    expect(isValidBulkBatchId('a/b')).toBe(false);
    expect(isValidBulkBatchId('a:b')).toBe(false);
    expect(isValidBulkBatchId('')).toBe(false);
    expect(isValidBulkBatchId('..')).toBe(false);
    expect(isValidBulkBatchId('.')).toBe(false);
    expect(isValidBulkBatchId('a..b')).toBe(false);
  });

  it('extracts phash tags and finds near-duplicates at Hamming ≤ 10 (#4709 slice 3)', () => {
    expect(NEAR_DUPLICATE_MAX_DISTANCE).toBe(10);
    expect(extractPhashFromTags('bulk_batch:b,phash:abcdef0123456789,screenshot:ok')).toBe(
      'abcdef0123456789',
    );
    expect(extractPhashFromTags('no-hash-here')).toBeNull();

    const base = '0000000000000000';
    // Flip one bit → distance 1 (within threshold).
    const near = '0000000000000001';
    expect(hammingDistanceHex(base, near)).toBe(1);
    // Flip many bits → outside threshold.
    const far = 'ffffffffffffffff';
    expect(hammingDistanceHex(base, far)).toBe(64);

    const matches = findNearDuplicatePhotoMatches(base, [
      { id: 10, tags: `phash:${near}` },
      { id: 11, tags: `phash:${base}` }, // identical — excluded
      { id: 12, tags: `phash:${far}` },
      { id: 13, tags: null },
    ]);
    expect(matches).toEqual([{ photoId: 10, distance: 1, phash: near }]);
  });
});
