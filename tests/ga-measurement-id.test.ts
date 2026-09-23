import { describe, expect, it } from 'vitest';

import {
  PRODUCTION_GA_MEASUREMENT_ID,
  resolveGaMeasurementId,
} from '@/lib/gaMeasurementId';

describe('resolveGaMeasurementId (#4350)', () => {
  it('uses the Product Measurement ID on Cloudflare Pages main', () => {
    expect(
      resolveGaMeasurementId({
        CF_PAGES: '1',
        CF_PAGES_BRANCH: 'main',
      }),
    ).toBe(PRODUCTION_GA_MEASUREMENT_ID);
    expect(PRODUCTION_GA_MEASUREMENT_ID).toBe('G-BRV48J1VEJ');
  });

  it('honors an explicit Production env override on main', () => {
    expect(
      resolveGaMeasurementId({
        CF_PAGES: '1',
        CF_PAGES_BRANCH: 'main',
        NEXT_PUBLIC_GA_ID: 'G-OVERRIDE1',
      }),
    ).toBe('G-OVERRIDE1');
  });

  it('never emits an id on Preview Pages branches', () => {
    expect(
      resolveGaMeasurementId({
        CF_PAGES: '1',
        CF_PAGES_BRANCH: 'cursor/4350-ga4-production-id-2e48',
        NEXT_PUBLIC_GA_ID: 'G-SHOULDNOT',
      }),
    ).toBe('');
  });

  it('omits GA for local builds when env is empty', () => {
    expect(resolveGaMeasurementId({})).toBe('');
  });
});
