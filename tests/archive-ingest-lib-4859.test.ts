import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import {
  appendArchiveNote,
  backoffDelayMs,
  buildArchiveCandidatesSql,
  describeLocFiles,
  isRetryableStatus,
  archiveVerdict,
  assessPictureQuality,
  minimumLongSideFor,
  pictureKind,
  locItemIsPicture,
  pickBestLocImage,
  pickCommonsFile,
  textSuggestsWatermark,
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
      'Existing note. archive-ingest-v2: skipped, too small (2026-10-24).',
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

  it('selects unprocessed rows and legacy file-reason skips, and nothing else', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(
      "CREATE TABLE content_items(id INTEGER, candidate_id TEXT, title TEXT, source_url TEXT, source_domain TEXT, admin_notes TEXT, media_asset_id TEXT, superseded_at TEXT, content_type TEXT)",
    );
    const notes: Array<string | null> = [
      null,
      'Automated discovery candidate.',
      'x archive-ingest: skipped, loc.gov record is not a photograph, print or drawing (2026-10-24).',
      'x archive-ingest: skipped, loc.gov record names no downloadable image file (2026-10-24).',
      'x archive-ingest: skipped, long side 1024px is under the 1500px minimum (2026-10-24).',
      'x archive-ingest: skipped, loc.gov record names no downloadable image file (2026-10-24). archive-ingest-v2: skipped, again (2026-10-25).',
      'x archive-ingest: skipped, Commons file is not a keepable image type (2026-10-24).',
    ];
    const insert = db.prepare("INSERT INTO content_items VALUES (?, ?, 't', 'u', 'loc.gov', ?, NULL, NULL, 'photo')");
    notes.forEach((note, index) => insert.run(index + 1, `c${index + 1}`, note));
    const ids = (db.prepare(sql).all(100) as Array<{ id: number }>).map((row) => row.id);
    expect(ids).toEqual([1, 2, 4, 5]);
  });
});
