import { describe, expect, it } from 'vitest';

import {
  mapConclusionToRightsStatus,
  mapLicenseToConclusion,
} from '../functions/_lib/content-pipeline-license-conclusion-mapping';

describe('mapLicenseToConclusion (#3552)', () => {
  it('maps "Public domain" to public_domain_confirmed', () => {
    expect(mapLicenseToConclusion('Public domain')).toBe('public_domain_confirmed');
  });

  it('maps CC0 to public_domain_confirmed', () => {
    expect(mapLicenseToConclusion('CC0')).toBe('public_domain_confirmed');
    expect(mapLicenseToConclusion('cc0')).toBe('public_domain_confirmed');
  });

  it('maps any CC BY variant to permission_granted, not public_domain_confirmed', () => {
    expect(mapLicenseToConclusion('CC BY 1.0')).toBe('permission_granted');
    expect(mapLicenseToConclusion('CC BY-SA 4.0')).toBe('permission_granted');
  });

  it('is case-insensitive and trims whitespace', () => {
    expect(mapLicenseToConclusion('  public domain  ')).toBe('public_domain_confirmed');
    expect(mapLicenseToConclusion('cc by 1.0')).toBe('permission_granted');
  });

  it('refuses to guess for an unrecognized license template', () => {
    expect(() => mapLicenseToConclusion('All rights reserved')).toThrow(/unrecognized license template/);
    expect(() => mapLicenseToConclusion(null)).toThrow(/unrecognized license template/);
    expect(() => mapLicenseToConclusion(undefined)).toThrow(/unrecognized license template/);
    expect(() => mapLicenseToConclusion('')).toThrow(/unrecognized license template/);
  });
});

describe('mapConclusionToRightsStatus (#3552)', () => {
  it('maps public_domain_confirmed to public_domain_candidate', () => {
    expect(mapConclusionToRightsStatus('public_domain_confirmed')).toBe('public_domain_candidate');
  });

  it('maps permission_granted to permission_granted', () => {
    expect(mapConclusionToRightsStatus('permission_granted')).toBe('permission_granted');
  });

  // #3657 / migration 0059: 'lgfc_owned_confirmed' now truthfully represents
  // LGFC-owned material -- it no longer borrows 'permission_granted's
  // meaning, which falsely implied a third party granted permission.
  it('maps lgfc_member_owned_item_photo to lgfc_owned_confirmed, not permission_granted', () => {
    expect(mapConclusionToRightsStatus('lgfc_member_owned_item_photo')).toBe('lgfc_owned_confirmed');
    expect(mapConclusionToRightsStatus('lgfc_member_owned_item_photo')).not.toBe('permission_granted');
  });
});
