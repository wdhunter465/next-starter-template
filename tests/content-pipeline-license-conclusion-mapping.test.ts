import { describe, expect, it } from 'vitest';

import {
  deriveTaggingRequirements,
  mapConclusionToRightsStatus,
  mapLicenseToConclusion,
  resolveCommonsUsageDecision,
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

describe('resolveCommonsUsageDecision (#3552 phase 5 / #3748)', () => {
  it('resolves a recognized public-domain license to permit with a conclusion', () => {
    expect(resolveCommonsUsageDecision('Public domain')).toEqual({
      usageDecision: 'permit',
      conclusion: 'public_domain_confirmed',
    });
  });

  it('resolves a recognized CC BY license to permit with permission_granted', () => {
    expect(resolveCommonsUsageDecision('CC BY-SA 4.0')).toEqual({
      usageDecision: 'permit',
      conclusion: 'permission_granted',
    });
  });

  it('resolves an unrecognized license to hold with no conclusion, instead of throwing', () => {
    expect(resolveCommonsUsageDecision('All rights reserved')).toEqual({
      usageDecision: 'hold',
      conclusion: null,
    });
    expect(resolveCommonsUsageDecision(null)).toEqual({ usageDecision: 'hold', conclusion: null });
    expect(resolveCommonsUsageDecision(undefined)).toEqual({ usageDecision: 'hold', conclusion: null });
  });

  it('mapLicenseToConclusion itself is unchanged and still throws for callers that want that', () => {
    expect(() => mapLicenseToConclusion('All rights reserved')).toThrow(/unrecognized license template/);
  });
});

describe('deriveTaggingRequirements (#3552 phase 5 / #3748)', () => {
  it('returns null for public domain / CC0 -- no attribution condition', () => {
    expect(deriveTaggingRequirements('Public domain', 'Some Photographer')).toBeNull();
    expect(deriveTaggingRequirements('CC0', 'Some Photographer')).toBeNull();
  });

  it('requires attribution for a CC BY variant, crediting the named artist', () => {
    expect(deriveTaggingRequirements('CC BY 1.0', 'University Archives')).toBe(
      'Attribution required per CC BY 1.0: credit University Archives.',
    );
  });

  it('falls back to crediting Wikimedia Commons when no artist is on record', () => {
    expect(deriveTaggingRequirements('CC BY-SA 4.0', null)).toBe(
      'Attribution required per CC BY-SA 4.0: credit Wikimedia Commons.',
    );
    expect(deriveTaggingRequirements('CC BY-SA 4.0', undefined)).toBe(
      'Attribution required per CC BY-SA 4.0: credit Wikimedia Commons.',
    );
  });

  it('returns null for an unrecognized license template', () => {
    expect(deriveTaggingRequirements('All rights reserved', 'Someone')).toBeNull();
    expect(deriveTaggingRequirements(null, 'Someone')).toBeNull();
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
