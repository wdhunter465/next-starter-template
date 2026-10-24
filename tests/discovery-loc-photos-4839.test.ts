import { describe, expect, it } from 'vitest';

import { isLocPhotoAboutGehrig } from '../scripts/content-pipeline/collect-gehrig-external-sources.mjs';

describe('loc.gov photo filter (#4839)', () => {
  it('keeps a picture record whose metadata names Gehrig', () => {
    expect(
      isLocPhotoAboutGehrig({
        title: 'Lou Gehrig, New York Yankees',
        original_format: ['photo, print, drawing'],
      }),
    ).toBe(true);
  });

  it('drops a record that never names Gehrig', () => {
    expect(isLocPhotoAboutGehrig({ title: 'Babe Ruth batting', original_format: ['photo, print, drawing'] })).toBe(false);
  });

  it('drops a newspaper page even when the text mentions Gehrig', () => {
    expect(
      isLocPhotoAboutGehrig({
        title: 'The East Hartford Gazette, 1953',
        description: ['Gehrig'],
        original_format: ['newspaper'],
      }),
    ).toBe(false);
  });
});
