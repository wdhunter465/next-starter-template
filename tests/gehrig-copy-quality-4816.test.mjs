import { describe, expect, it } from 'vitest';

import { applyCopyQuality, isDeniedImageHost } from '../scripts/content-pipeline/gehrig-copy-quality.mjs';

const lists = {
  minimum_long_side_px: 1500,
  denylist: ['gettyimages.com', 'shutterstock.com'],
};

function candidate(overrides) {
  return {
    candidate_id: 'lgfc-gehrig-2026-0001',
    title: 'Lou Gehrig at bat',
    date_or_period: '1935',
    source_domain: 'loc.gov',
    source_url: 'https://www.loc.gov/item/example/',
    original_file_url: 'https://tile.loc.gov/storage-services/master/pnp/example.tif',
    provenance_notes: 'Collected.',
    source_metadata: { source_record_id: 'ppmsca-12345' },
    ...overrides,
  };
}

describe('gehrig copy quality (#4816)', () => {
  it('rejects watermark-agency hosts and their subdomains', () => {
    expect(isDeniedImageHost('https://media.gettyimages.com/preview.jpg', lists.denylist)).toBe(true);
    expect(isDeniedImageHost('https://tile.loc.gov/master.tif', lists.denylist)).toBe(false);
  });

  it('keeps a denylisted image as a pointer and does not prefer it', () => {
    const [pointer, loc] = applyCopyQuality(
      [
        candidate({
          candidate_id: 'lgfc-gehrig-2026-0002',
          source_domain: 'gettyimages.com',
          original_file_url: 'https://media.gettyimages.com/id/1/preview.jpg',
          width_px: 4000,
          height_px: 3000,
        }),
        candidate({ width_px: 2000, height_px: 1500 }),
      ],
      lists,
    );

    expect(pointer.copy_role).toBe('pointer');
    expect(pointer.quality_flag).toBe('known_not_collected');
    expect(loc.copy_role).toBe('preferred');
  });

  it('groups matching title and date and prefers the larger unwatermarked copy', () => {
    const grouped = applyCopyQuality(
      [
        candidate({
          candidate_id: 'lgfc-gehrig-2026-0003',
          source_domain: 'commons.wikimedia.org',
          original_file_url: 'https://upload.wikimedia.org/wikipedia/commons/a/Example.jpg',
          width_px: 800,
          height_px: 600,
          file_bytes: 120000,
          file_format: 'image/jpeg',
        }),
        candidate({
          candidate_id: 'lgfc-gehrig-2026-0004',
          width_px: 2400,
          height_px: 1800,
          file_bytes: 2400000,
          file_format: 'image/tiff',
        }),
      ],
      lists,
    );

    const small = grouped.find((item) => item.candidate_id.endsWith('0003'));
    const large = grouped.find((item) => item.candidate_id.endsWith('0004'));
    expect(small.copy_group_key).toBe(large.copy_group_key);
    expect(large.copy_role).toBe('preferred');
    expect(small.copy_role).toBe('alternate');
    expect(small.quality_flag).toBe('low_resolution');
    expect(large.quality_flag).toBe('preferred');
  });

  it('flags a lone copy under 1500 px and still keeps it', () => {
    const [only] = applyCopyQuality(
      [candidate({ width_px: 900, height_px: 600, file_bytes: 40000, file_format: 'image/jpeg' })],
      lists,
    );
    expect(only.copy_role).toBe('preferred');
    expect(only.quality_flag).toBe('low_resolution');
  });
});
