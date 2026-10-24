import { describe, expect, it } from 'vitest';

import {
  appendArchiveNote,
  archiveVerdict,
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
      'Existing note. archive-ingest: skipped, too small (2026-10-24).',
    );
  });
});
