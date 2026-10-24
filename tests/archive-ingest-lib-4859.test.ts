import { describe, expect, it } from 'vitest';

import {
  appendArchiveNote,
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
      'Existing note. archive-ingest: skipped, too small (2026-10-24).',
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
