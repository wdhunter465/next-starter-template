import { describe, expect, it } from 'vitest';

import {
  buildDefaultCitation,
  buildInternetArchiveSearchUrl,
  buildWikiPageInfoUrl,
  buildWikiSearchUrl,
  classifyStoryRights,
  cleanOriginUrl,
  mapInternetArchiveDocToCandidateFields,
  mapWikiPageToCandidateFields,
} from '../functions/_lib/content-pipeline-story-adapter';

describe('classifyStoryRights (#4532)', () => {
  it('treats CC0 and Public Domain Mark as free use', () => {
    for (const licenseUrl of [
      'https://creativecommons.org/publicdomain/zero/1.0/',
      'https://creativecommons.org/publicdomain/mark/1.0/',
    ]) {
      const result = classifyStoryRights({ licenseUrl });
      expect(result.usageBasis).toBe('free_use');
      expect(result.conclusion).toBe('public_domain_confirmed');
      expect(result.ambiguity).toEqual([]);
    }
  });

  it('treats CC BY as free use with credit and flags CC BY-SA as share-alike', () => {
    const by = classifyStoryRights({ licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' });
    expect(by.usageBasis).toBe('free_use_credit');
    expect(by.shareAlike).toBe(false);
    const bySa = classifyStoryRights({ licenseName: 'CC BY-SA 4.0' });
    expect(bySa.usageBasis).toBe('free_use_credit');
    expect(bySa.shareAlike).toBe(true);
    expect(bySa.rightsStatus).toBe('permission_granted');
  });

  it('treats non-commercial and no-derivatives licenses as ambiguous, not permitted, with a reason', () => {
    for (const licenseUrl of [
      'https://creativecommons.org/licenses/by-nc/4.0/',
      'https://creativecommons.org/licenses/by-nd/4.0/',
      'https://creativecommons.org/licenses/by-nc-sa/3.0/',
    ]) {
      const result = classifyStoryRights({ licenseUrl });
      expect(result.usageBasis).toBe('not_permitted');
      expect(result.conclusion).toBeUndefined();
      expect(result.ambiguity.length).toBeGreaterThan(0);
    }
  });

  it('never decides public domain from a date alone', () => {
    const result = classifyStoryRights({ publicationYear: 1927 });
    expect(result.usageBasis).toBe('not_permitted');
    expect(result.conclusion).toBeUndefined();
    expect(result.ambiguity.join(' ')).toMatch(/date alone/);
  });

  it('treats a missing or free-text license as ambiguous with a reason', () => {
    expect(classifyStoryRights({}).ambiguity).toContain('The origin states no license.');
    const freeText = classifyStoryRights({ licenseName: 'All rights reserved' });
    expect(freeText.usageBasis).toBe('not_permitted');
    expect(freeText.ambiguity[0]).toMatch(/not a recognized free-use license/);
  });
});

describe('buildDefaultCitation (#4532)', () => {
  it('formats "Title, by Creator, via Source (License)"', () => {
    expect(
      buildDefaultCitation({ title: 'Lou Gehrig', creator: 'Wikipedia contributors', source: 'Wikipedia', license: 'CC BY-SA 4.0' }),
    ).toBe('Lou Gehrig, by Wikipedia contributors, via Wikipedia (CC BY-SA 4.0)');
  });

  it('omits the creator and license when unknown', () => {
    expect(buildDefaultCitation({ title: 'A Story', source: 'Internet Archive' })).toBe('A Story, via Internet Archive');
  });
});

describe('cleanOriginUrl (#4532)', () => {
  it('keeps https URLs and removes tracking parameters and fragments', () => {
    expect(cleanOriginUrl('https://example.com/a?id=7&utm_source=x&fbclid=y#top')).toBe('https://example.com/a?id=7');
  });

  it('ignores http entirely and rejects invalid URLs', () => {
    expect(cleanOriginUrl('http://example.com/a')).toBeNull();
    expect(cleanOriginUrl('not a url')).toBeNull();
    expect(cleanOriginUrl(null)).toBeNull();
  });
});

describe('URL builders (#4532)', () => {
  it('builds Wikipedia and Wikisource search and info URLs', () => {
    expect(buildWikiSearchUrl('wikipedia', 'Lou Gehrig', 5)).toContain('https://en.wikipedia.org/w/api.php?');
    expect(buildWikiSearchUrl('wikisource', 'Lou Gehrig', 5)).toContain('https://en.wikisource.org/w/api.php?');
    const info = buildWikiPageInfoUrl('wikipedia', ['Lou Gehrig', 'Murderers\' Row']);
    expect(info).toContain('siprop=rightsinfo');
    expect(info).toContain('titles=Lou+Gehrig%7CMurderers%27+Row');
  });

  it('builds an Internet Archive text search URL', () => {
    const url = buildInternetArchiveSearchUrl('Lou Gehrig', 10);
    expect(url).toContain('https://archive.org/advancedsearch.php?');
    const parsed = new URL(url);
    expect(parsed.searchParams.get('q')).toBe('"Lou Gehrig" AND mediatype:texts');
    expect(parsed.searchParams.getAll('fl[]')).toContain('licenseurl');
  });
});

describe('mapWikiPageToCandidateFields (#4532)', () => {
  it('records a Wikipedia page as free use with credit cited, share-alike, with the default citation', () => {
    const fields = mapWikiPageToCandidateFields(
      'wikipedia',
      { pageid: 1, title: 'Lou Gehrig', extract: 'Henry Louis Gehrig was an American baseball first baseman.', fullurl: 'https://en.wikipedia.org/wiki/Lou_Gehrig' },
      { text: 'Creative Commons Attribution-ShareAlike 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
      'Lou Gehrig',
    );
    expect(fields.sourceUrl).toBe('https://en.wikipedia.org/wiki/Lou_Gehrig');
    expect(fields.sourceDomain).toBe('en.wikipedia.org');
    expect(fields.classification.usageBasis).toBe('free_use_credit');
    expect(fields.classification.shareAlike).toBe(true);
    expect(fields.creditLine).toBe(
      'Lou Gehrig, by Wikipedia contributors, via Wikipedia (Creative Commons Attribution-ShareAlike 4.0)',
    );
    expect(fields.rightsEvidence?.conclusion).toBe('permission_granted');
    expect(fields.provenanceNotes).toMatch(/share-alike/);
  });

  it('treats Wikisource as ambiguous because the site license covers the transcription only', () => {
    const fields = mapWikiPageToCandidateFields(
      'wikisource',
      { pageid: 2, title: 'A Speech', fullurl: 'https://en.wikisource.org/wiki/A_Speech' },
      { text: 'Creative Commons Attribution-Share Alike 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
      'q',
    );
    expect(fields.classification.usageBasis).toBe('not_permitted');
    expect(fields.classification.ambiguity.join(' ')).toMatch(/underlying work/);
    expect(fields.rightsStatus).toBe('unknown');
  });

  it('is ambiguous, not permitted, when the site states no license', () => {
    const fields = mapWikiPageToCandidateFields('wikisource', { title: 'Some Page', fullurl: 'https://en.wikisource.org/wiki/Some_Page' }, {}, 'q');
    expect(fields.classification.usageBasis).toBe('not_permitted');
    expect(fields.rightsEvidence).toBeUndefined();
  });
});

describe('mapInternetArchiveDocToCandidateFields (#4532)', () => {
  it('uses only the item license URL, never the date, to classify', () => {
    const open = mapInternetArchiveDocToCandidateFields(
      { identifier: 'abc', title: 'A Tribute', creator: 'J. Writer', date: '1941-07-01T00:00:00Z', licenseurl: 'https://creativecommons.org/licenses/by/4.0/' },
      'Lou Gehrig',
    );
    expect(open.sourceUrl).toBe('https://archive.org/details/abc');
    expect(open.classification.usageBasis).toBe('free_use_credit');
    expect(open.creditLine).toContain('by J. Writer, via Internet Archive');

    const dateOnly = mapInternetArchiveDocToCandidateFields({ identifier: 'old', title: 'Old Paper', date: '1928-01-17T00:00:00Z', year: '1928' }, 'q');
    expect(dateOnly.classification.usageBasis).toBe('not_permitted');
    expect(dateOnly.classification.ambiguity.join(' ')).toMatch(/date alone/);
    expect(dateOnly.rightsEvidence).toBeUndefined();
  });
});
