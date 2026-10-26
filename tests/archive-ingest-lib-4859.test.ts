import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import {
  appendArchiveNote,
  backoffDelayMs,
  buildArchiveCandidatesSql,
  describeLocFiles,
  masterTargetSize,
  pickLocFile,
  pickLocTiffMaster,
  isRetryableStatus,
  archiveVerdict,
  assessPictureQuality,
  minimumLongSideFor,
  pictureKind,
  locItemIsPicture,
  pickBestLocImage,
  pickCommonsFile,
  textSuggestsWatermark,
  buildDplaImageLadder,
  parseDplaLinks,
} from '../scripts/content-pipeline/archive-ingest-lib.mjs';

const lists = {
  minimum_long_side_px: 1500,
  denylist: ['gettyimages.com', 'media.gettyimages.com', 'shutterstock.com', 'alamy.com'],
};

describe('archive ingest policy (#4859)', () => {
  it('accepts only picture records from loc.gov', () => {
    expect(locItemIsPicture({ item: { original_format: ['photo, print, drawing'] } })).toBe(true);
    expect(locItemIsPicture({ item: { original_format: ['newspaper'] } })).toBe(false);
    expect(locItemIsPicture({ item: { original_format: ['manuscript/mixed material'] } })).toBe(false);
  });

  it('picks the largest jpeg and skips thumbnails', () => {
    const best = pickBestLocImage({
      resources: [
        {
          files: [
            [
              { url: 'https://tile.loc.gov/a/150px.jpg', mimetype: 'image/jpeg', width: 150, height: 120, size: 4000 },
              { url: 'https://tile.loc.gov/a/full.jpg', mimetype: 'image/jpeg', width: 3000, height: 2400, size: 900000 },
              { url: 'https://tile.loc.gov/a/full.tif', mimetype: 'image/tiff', width: 6000, height: 4800, size: 20000000 },
            ],
          ],
        },
      ],
    });
    expect(best?.url).toBe('https://tile.loc.gov/a/full.jpg');
  });

  it('reads size from an image_url fragment and returns null when nothing usable exists', () => {
    expect(pickBestLocImage({ item: { image_url: ['https://tile.loc.gov/b/img.jpg#h=1800&w=2400'] } })?.width).toBe(2400);
    expect(pickBestLocImage({ item: {} })).toBeNull();
  });

  it('rejects a Commons file that is not a keepable image type', () => {
    expect(pickCommonsFile({ imageinfo: [{ url: 'https://upload.wikimedia.org/x.pdf', mime: 'application/pdf' }] })).toBeNull();
    expect(pickCommonsFile({ imageinfo: [{ url: 'https://upload.wikimedia.org/x.jpg', mime: 'image/jpeg', width: 2000, height: 1500 }] })?.width).toBe(2000);
  });

  it('skips watermark-denylist hosts, watermark wording and small images', () => {
    const base = { imageUrl: 'https://tile.loc.gov/a/full.jpg', text: ['Lou Gehrig'], width: 3000, height: 2000, minimumLongSide: 1500, denylist: lists.denylist };
    expect(archiveVerdict(base).ok).toBe(true);
    expect(archiveVerdict({ ...base, imageUrl: 'https://media.gettyimages.com/id/1.jpg' }).ok).toBe(false);
    expect(archiveVerdict({ ...base, text: ['Watermarked preview'] }).ok).toBe(false);
    expect(archiveVerdict({ ...base, text: ['Credit: Getty Images'] }).ok).toBe(false);
    expect(archiveVerdict({ ...base, width: 800, height: 600 }).ok).toBe(false);
  });

  it('recognizes agency and watermark wording', () => {
    expect(textSuggestsWatermark('Alamy stock photo')).toBe(true);
    expect(textSuggestsWatermark('Lou Gehrig at bat, 1932')).toBe(false);
  });

  it('writes a dated note that the selection query can find', () => {
    expect(appendArchiveNote('Existing note.', 'skipped, too small', '2026-10-24')).toBe(
      'Existing note. archive-ingest-v3: skipped, too small (2026-10-24).',
    );
  });
});

describe('picture quality standards (#4861)', () => {
  it('uses the newspaper standard only when the source says newspaper', () => {
    expect(pictureKind('Lou Gehrig, newspaper halftone')).toBe('newspaper');
    expect(pictureKind('Lou Gehrig, 1938', 'Library of Congress')).toBe('photograph');
    expect(minimumLongSideFor('photograph', 1500)).toBe(1500);
    expect(minimumLongSideFor('newspaper', 1500)).toBe(800);
  });

  it('marks each standard size from the master without upscaling', () => {
    const tall = assessPictureQuality({ width: 1600, height: 2000, kind: 'photograph' });
    expect(tall.ok).toEqual({ thumbnail: true, small: true, medium: true, large: true, socialLink: true, socialSquare: true });
    const mid = assessPictureQuality({ width: 1500, height: 1000, kind: 'photograph' });
    expect(mid.ok.medium).toBe(true);
    expect(mid.ok.large).toBe(false);
    expect(mid.ok.socialSquare).toBe(false);
    expect(mid.publishBlocked).toBe(false);
  });

  it('never offers a newspaper picture at the large size or on social posts', () => {
    const paper = assessPictureQuality({ width: 3000, height: 2400, kind: 'newspaper' });
    expect(paper.ok.medium).toBe(true);
    expect(paper.ok.large).toBe(false);
    expect(paper.ok.socialLink).toBe(false);
    expect(paper.ok.socialSquare).toBe(false);
  });

  it('blocks publication when the size is unknown or too small for the small size', () => {
    const unknown = assessPictureQuality({ width: 0, height: 0 });
    expect(unknown.publishBlocked).toBe(true);
    expect(unknown.publishBlockReason).toMatch(/could not be read/);
    const tiny = assessPictureQuality({ width: 500, height: 400, kind: 'newspaper' });
    expect(tiny.ok.small).toBe(false);
    expect(tiny.publishBlocked).toBe(true);
  });
});

describe('loc.gov file choice and retry rules (#4870)', () => {
  const file = (url: string, mimetype: string, width: number, height: number, size: number) => ({ url, mimetype, width, height, size });

  it('falls back to a larger TIFF master when the best JPEG is under the minimum', () => {
    const best = pickBestLocImage({
      resources: [
        {
          files: [
            [
              file('https://tile.loc.gov/a/r.jpg', 'image/jpeg', 1024, 800, 200000),
              file('https://tile.loc.gov/a/master.tif', 'image/tiff', 4000, 3200, 20_000_000),
            ],
          ],
        },
      ],
    });
    expect(best?.url).toBe('https://tile.loc.gov/a/master.tif');
  });

  it('never picks a file over the 25 MB limit', () => {
    const best = pickBestLocImage({
      resources: [
        {
          files: [
            [
              file('https://tile.loc.gov/a/r.jpg', 'image/jpeg', 1600, 1200, 300000),
              file('https://tile.loc.gov/a/master.tif', 'image/tiff', 6000, 4800, 60_000_000),
            ],
          ],
        },
      ],
    });
    expect(best?.url).toBe('https://tile.loc.gov/a/r.jpg');
  });

  it('keeps the JPEG when it meets the minimum, even if a TIFF is larger', () => {
    const best = pickBestLocImage({
      resources: [
        {
          files: [
            [
              file('https://tile.loc.gov/a/full.jpg', 'image/jpeg', 3000, 2400, 900000),
              file('https://tile.loc.gov/a/full.tif', 'image/tiff', 6000, 4800, 20_000_000),
            ],
          ],
        },
      ],
    });
    expect(best?.url).toBe('https://tile.loc.gov/a/full.jpg');
  });

  it('prefers JPEG when two files have the same size in pixels', () => {
    const best = pickBestLocImage({
      resources: [
        { files: [[file('https://tile.loc.gov/a/x.tif', 'image/tiff', 2000, 1500, 9_000_000), file('https://tile.loc.gov/a/x.jpg', 'image/jpeg', 2000, 1500, 900000)]] },
      ],
    });
    expect(best?.url).toBe('https://tile.loc.gov/a/x.jpg');
  });

  it('describes what a record offered, or its shape when it offered no file', () => {
    expect(describeLocFiles({ resources: [{ files: [[file('https://tile.loc.gov/a/r.jpg', 'image/jpeg', 1024, 800, 200000)]] }] })).toBe(
      'files found: jpeg 1024x800 0.2MB',
    );
    const none = describeLocFiles({ item: {}, resources: [{ url: 'x' }] });
    expect(none).toMatch(/^no image files found; record keys: item,resources; resources: 1/);
    expect(describeLocFiles({ resources: [] }).length).toBeLessThanOrEqual(260);
  });

  it('retries throttling and gateway errors with a growing delay, honouring Retry-After', () => {
    expect(isRetryableStatus(503)).toBe(true);
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(404)).toBe(false);
    expect(backoffDelayMs(1, null)).toBe(5000);
    expect(backoffDelayMs(2, null)).toBe(15000);
    expect(backoffDelayMs(3, null)).toBe(45000);
    expect(backoffDelayMs(1, '12')).toBe(12000);
    expect(backoffDelayMs(1, '900')).toBe(60000);
  });
});

describe('archive candidate selection SQL (#4872)', () => {
  const sql = buildArchiveCandidatesSql();

  it('keeps every LIKE and GLOB pattern within the 50 byte limit D1 enforces', () => {
    const patterns = [...sql.matchAll(/\b(?:LIKE|GLOB)\s+'([^']*)'/gi)].map((match) => match[1]);
    for (const pattern of patterns) expect(Buffer.byteLength(pattern)).toBeLessThanOrEqual(50);
  });

  it('selects unprocessed rows and older file-reason skips, and nothing else', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(
      "CREATE TABLE content_items(id INTEGER, candidate_id TEXT, title TEXT, source_url TEXT, source_domain TEXT, provenance_notes TEXT, admin_notes TEXT, media_asset_id TEXT, superseded_at TEXT, content_type TEXT)",
    );
    const notes: Array<string | null> = [
      null, // 1 never processed
      'Automated discovery candidate.', // 2 never processed
      'x archive-ingest: skipped, loc.gov record is not a photograph, print or drawing (2026-10-24).', // 3 final
      'x archive-ingest: skipped, loc.gov record names no downloadable image file (2026-10-24).', // 4 recheck
      'x archive-ingest: skipped, long side 1024px is under the 1500px minimum (2026-10-24).', // 5 recheck
      'x archive-ingest-v2: skipped, long side 1024px is under the 1500px minimum (2026-10-24).', // 6 recheck
      'x archive-ingest: skipped, Commons file is not a keepable image type (2026-10-24).', // 7 final
      'x archive-ingest-v2: skipped, long side 1024px is under the 1500px minimum (2026-10-24). archive-ingest-v3: skipped, again (2026-10-25).', // 8 already rechecked
      'x archive-ingest-v2: skipped, loc.gov record is not a photograph, print or drawing (2026-10-24).', // 9 final
    ];
    const insert = db.prepare("INSERT INTO content_items VALUES (?, ?, 't', 'u', 'loc.gov', NULL, ?, NULL, NULL, 'photo')");
    notes.forEach((note, index) => insert.run(index + 1, `c${index + 1}`, note));
    const ids = (db.prepare(sql).all(100) as Array<{ id: number }>).map((row) => row.id);
    expect(ids).toEqual([1, 2, 4, 5, 6]);
  });
});

describe('TIFF master handling (#4874)', () => {
  const file = (url: string, mimetype: string, width: number, height: number, size: number) => ({ url, mimetype, width, height, size });
  const record = (files: Array<ReturnType<typeof file>>) => ({ resources: [{ files: [files] }] });

  it('picks the largest TIFF between 2 MB and 100 MB as the master', () => {
    const data = record([
      file('https://tile.loc.gov/a/small.tif', 'image/tiff', 0, 0, 1_100_000),
      file('https://tile.loc.gov/a/master.tif', 'image/tiff', 0, 0, 21_000_000),
      file('https://tile.loc.gov/a/huge.tif', 'image/tiff', 0, 0, 163_000_000),
    ]);
    expect(pickLocTiffMaster(data)?.url).toBe('https://tile.loc.gov/a/master.tif');
    expect(pickLocTiffMaster(record([file('https://tile.loc.gov/a/huge.tif', 'image/tiff', 0, 0, 163_000_000)]))).toBeNull();
  });

  it('uses the TIFF master when the best JPEG is under the minimum', () => {
    const data = record([
      file('https://tile.loc.gov/a/r.jpg', 'image/jpeg', 1024, 834, 100000),
      file('https://tile.loc.gov/a/master.tif', 'image/tiff', 0, 0, 22_000_000),
    ]);
    expect(pickLocFile(data, 1500)?.url).toBe('https://tile.loc.gov/a/master.tif');
  });

  it('keeps the JPEG when it meets the minimum, and falls back to the small JPEG when there is no master', () => {
    const big = record([
      file('https://tile.loc.gov/a/x.jpg', 'image/jpeg', 2400, 1800, 900000),
      file('https://tile.loc.gov/a/x.tif', 'image/tiff', 0, 0, 22_000_000),
    ]);
    expect(pickLocFile(big, 1500)?.url).toBe('https://tile.loc.gov/a/x.jpg');
    const small = record([file('https://tile.loc.gov/a/r.jpg', 'image/jpeg', 1024, 834, 100000)]);
    expect(pickLocFile(small, 1500)?.url).toBe('https://tile.loc.gov/a/r.jpg');
    expect(pickLocFile({ resources: [] }, 1500)).toBeNull();
  });

  it('scales a master to at most 4000 px and never upscales', () => {
    expect(masterTargetSize(6000, 4800)).toEqual({ width: 4000, height: 3200, scaled: true });
    expect(masterTargetSize(3000, 2000)).toEqual({ width: 3000, height: 2000, scaled: false });
    expect(masterTargetSize(4800, 6000)).toEqual({ width: 3200, height: 4000, scaled: true });
  });
});

describe('DPLA image ladder (#4902)', () => {
  it('reads the links back out of the notes discovery wrote', () => {
    const notes =
      'DPLA discovery. Contributing institution: Boston Public Library. Provider (hub): Digital Commonwealth. ' +
      'Original item URL (isShownAt): https://ark.digitalcommonwealth.org/ark:/50959/xyz123. ' +
      'DPLA thumbnail (object): https://ark.digitalcommonwealth.org/ark:/50959/xyz123/thumbnail. ' +
      'DPLA media links (hasView): https://a.example/1 https://a.example/2. DPLA is a pure aggregator -- x';
    expect(parseDplaLinks(notes)).toEqual({
      thumbnail: 'https://ark.digitalcommonwealth.org/ark:/50959/xyz123/thumbnail',
      views: ['https://a.example/1', 'https://a.example/2'],
      institution: 'Boston Public Library',
    });
    expect(parseDplaLinks(null)).toEqual({ thumbnail: null, views: [], institution: '' });
  });

  it('builds full-size links for NYPL and Digital Commonwealth, and nothing else', () => {
    expect(buildDplaImageLadder({ thumbnail: 'http://images.nypl.org/index.php?id=123&t=t' }).map((s) => s.url)).toEqual([
      'https://images.nypl.org/index.php?id=123&t=g',
      'https://images.nypl.org/index.php?id=123&t=q',
      'https://images.nypl.org/index.php?id=123&t=w',
    ]);
    expect(buildDplaImageLadder({ thumbnail: 'https://ark.digitalcommonwealth.org/ark:/50959/xyz123/thumbnail' }).map((s) => s.url)).toEqual([
      'https://iiif.digitalcommonwealth.org/iiif/2/commonwealth:xyz123/full/!3000,3000/0/default.jpg',
      'https://ark.digitalcommonwealth.org/ark:/50959/xyz123/large',
    ]);
    expect(buildDplaImageLadder({ thumbnail: 'https://cdm1.contentdm.oclc.org/utils/getthumbnail/collection/p1/id/42' })).toEqual([]);
    expect(buildDplaImageLadder({ thumbnail: 'https://example.org/x.jpg', views: [] })).toEqual([]);
  });

  it('selects dp.la rows for archiving', () => {
    expect(buildArchiveCandidatesSql()).toContain("'dp.la'");
  });
});
