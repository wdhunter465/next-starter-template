import { describe, expect, it } from 'vitest';

import { isKnownUrlRegistryFile } from '../scripts/content-pipeline/collect-gehrig-external-sources.mjs';

describe('known-URL registry files (#4868)', () => {
  it('counts the curated registries as already recorded', () => {
    expect(isKnownUrlRegistryFile('lou-gehrig-content-candidates.json')).toBe(true);
    expect(isKnownUrlRegistryFile('lou-gehrig-wikimedia-approved-batch-2026-08-17.json')).toBe(true);
  });

  it('does not count the discovery run output', () => {
    expect(isKnownUrlRegistryFile('lou-gehrig-content-candidates-external-discovery.json')).toBe(false);
    expect(isKnownUrlRegistryFile('lou-gehrig-content-candidates-external-discovery.search-runs.json')).toBe(false);
  });

  it('ignores files that are not JSON', () => {
    expect(isKnownUrlRegistryFile('notes.md')).toBe(false);
  });
});
