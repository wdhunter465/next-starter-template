import { describe, expect, it } from 'vitest';

import {
  DplaApiKeyMissingError,
  buildDplaSearchUrl,
  mapDplaDocToCandidateFields,
  requireDplaApiKey,
} from '../functions/_lib/content-pipeline-dpla-adapter';

describe('requireDplaApiKey (#3826)', () => {
  it('returns the key when present in the given env', () => {
    expect(requireDplaApiKey({ DPLA_API_KEY: 'test-key-123' })).toBe('test-key-123');
  });

  it('throws DplaApiKeyMissingError, not a silent skip, when absent', () => {
    expect(() => requireDplaApiKey({})).toThrow(DplaApiKeyMissingError);
  });

  it('throws when the key is an empty string', () => {
    expect(() => requireDplaApiKey({ DPLA_API_KEY: '' })).toThrow(DplaApiKeyMissingError);
  });
});

describe('buildDplaSearchUrl (#3826)', () => {
  it('encodes query, page_size, and api_key as query params against the v2 items endpoint', () => {
    const url = buildDplaSearchUrl('Lou Gehrig', 20, 'test-key-123');
    expect(url).toBe('https://api.dp.la/v2/items?q=Lou+Gehrig&page_size=20&api_key=test-key-123');
  });
});

describe('mapDplaDocToCandidateFields (#3826)', () => {
  const query = 'Lou Gehrig';

  it('maps a fully-populated DPLA doc, preserving rights fields as evidence only (no conclusion)', () => {
    const doc = {
      id: 'abc123hash',
      sourceResource: {
        title: ['Lou Gehrig, New York Yankees'],
        description: ['Half-length portrait of Lou Gehrig in Yankees uniform.'],
        creator: ['Unknown photographer'],
        date: { displayDate: '1927', begin: '1927', end: '1927' },
        rights: ['http://rightsstatements.org/vocab/NoC-US/1.0/'],
        collection: { title: 'Baseball history photograph collection' },
      },
      dataProvider: 'Some Historical Society',
      provider: { name: 'Example Digital Hub' },
      isShownAt: 'https://example.org/items/abc123hash',
      rightsCategory: 'Unknown',
    };

    const fields = mapDplaDocToCandidateFields(doc, query);

    expect(fields.title).toBe('Lou Gehrig, New York Yankees');
    expect(fields.sourceType).toBe('institution');
    expect(fields.sourceName).toBe('DPLA');
    expect(fields.sourceDomain).toBe('dp.la');
    expect(fields.sourceOwner).toBe('Some Historical Society');
    expect(fields.sourceUrl).toBe('https://example.org/items/abc123hash');
    expect(fields.dateOrPeriod).toBe('1927');
    expect(fields.sourceRecordId).toBe('abc123hash');
    expect(fields.sourceCitation).toBe('DPLA (contributing institution: Some Historical Society), item abc123hash');
    expect(fields.creditLine).toBeUndefined();

    // Rights fields land only in provenance_notes as verbatim evidence --
    // never surfaced as a rights_status or conclusion by this pure mapper.
    expect(fields.provenanceNotes).toContain('http://rightsstatements.org/vocab/NoC-US/1.0/');
    expect(fields.provenanceNotes).toContain('DPLA rightsCategory: Unknown.');
    expect(fields.provenanceNotes).toContain('Contributing institution: Some Historical Society.');
    expect(fields.provenanceNotes).toContain('pure aggregator');
    expect(fields.summary).toContain('Some Historical Society');
  });

  it('handles array-typed sourceResource fields (a known DPLA provider inconsistency)', () => {
    const doc = {
      id: 'arr789',
      sourceResource: {
        title: ['Gehrig at Yankee Stadium', 'alt title'],
        date: ['1934'],
      },
      dataProvider: 'Another Archive',
      isShownAt: ['https://example.org/items/arr789'],
    };

    const fields = mapDplaDocToCandidateFields(doc, query);

    expect(fields.title).toBe('Gehrig at Yankee Stadium');
    expect(fields.dateOrPeriod).toBe('1934');
    expect(fields.sourceUrl).toBe('https://example.org/items/arr789');
  });

  it('falls back to safe defaults when optional fields are entirely missing', () => {
    const doc = { id: 'minimal001' };

    const fields = mapDplaDocToCandidateFields(doc, query);

    expect(fields.title).toBe('Untitled DPLA item');
    expect(fields.sourceOwner).toBeUndefined();
    expect(fields.sourceUrl).toBeUndefined();
    expect(fields.dateOrPeriod).toBeUndefined();
    expect(fields.sourceRecordId).toBe('minimal001');
    expect(fields.provenanceNotes).toContain('Contributing institution: unknown.');
    expect(fields.provenanceNotes).toContain('DPLA rightsCategory: unknown.');
    expect(fields.summary).toContain('Discovered via DPLA search for "Lou Gehrig"');
  });

  it('never produces a rights_status or conclusion field -- mapping is metadata-only per #3551 core safety rule', () => {
    const doc = { id: 'x', rightsCategory: 'Public Domain' };
    const fields = mapDplaDocToCandidateFields(doc, query);
    expect(fields).not.toHaveProperty('rights_status');
    expect(fields).not.toHaveProperty('conclusion');
  });
});
