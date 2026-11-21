import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runDiscovery } from '../scripts/content-pipeline/collect-gehrig-external-sources.mjs';
import {
  buildLougehrigCandidateFields,
  extractCredit,
  fullSizeFromThumbnail,
  htmlToText,
  isAlsMentioned,
  isAlsSubject,
  newsFreshness,
  parseGalleryFigures,
} from '../scripts/content-pipeline/lougehrig-collector-lib.mjs';

// A trimmed copy of lougehrig.com's real REST responses and gallery markup, read 2026-11-21 (#4839).
const fixture = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'tests/fixtures/lougehrig/site-excerpt-2026-11-21.json'), 'utf8'),
);
const NOW = new Date('2026-11-21T12:00:00Z');
const galleryHtml = fixture.pages.find((p) => p.slug === 'photo-gallery').content.rendered;

describe('lougehrig.com credits (#4839)', () => {
  it('reads an AP credit and an AP-agency match', () => {
    const c = extractCredit('The Yankees stormed to a 22-2 win. (AP Photo)');
    expect(c.creditLine).toBe('AP Photo');
    expect(c.agencies).toEqual(['ap']);
    expect(c.thirdParty).toBe(true);
  });

  it('reads a Getty credit with the photographer', () => {
    const c = extractCredit('Lou Gehrig whacks a double. (Photo by Mark Rucker/Transcendental Graphics, Getty Images)');
    expect(c.creditLine).toBe('Photo by Mark Rucker/Transcendental Graphics, Getty Images');
    expect(c.agencies).toEqual(['getty']);
  });

  it('treats a caption with no credit as not third-party (and does not invent one)', () => {
    const c = extractCredit('New York Yankees Lou Gehrig sitting on dugout step. Lefty Gomez with him on step, 1939');
    expect(c).toEqual({ creditLine: null, agencies: [], thirdParty: false });
  });
});

describe('lougehrig.com gallery parsing (#4839)', () => {
  it('ties each credit to its own photo through the caption id', () => {
    const figures = parseGalleryFigures(galleryHtml);
    expect(figures).toHaveLength(3);
    const byId = Object.fromEntries(figures.filter((f) => f.mediaId).map((f) => [f.mediaId, f]));
    expect(byId[147].agencies).toEqual(['ap']);
    expect(byId[163].agencies).toEqual(['getty']);
  });

  it('keeps an uncaptioned photo, with no media id and no credit, and its full-size link', () => {
    const plain = parseGalleryFigures(galleryHtml).find((f) => f.mediaId == null);
    expect(plain.thirdParty).toBe(false);
    expect(plain.caption).toBe('');
    expect(plain.fullUrl).toMatch(/^https:\/\/lougehrig\.com\/wp-content\/uploads\/.+\.(jpg|png)$/);
    expect(plain.fullUrl).not.toMatch(/-\d+x\d+\./);
  });

  it('turns a WordPress thumbnail address into the full-size address', () => {
    expect(fullSizeFromThumbnail('https://lougehrig.com/wp-content/uploads/2021/09/gehl028-150x150.jpg')).toBe(
      'https://lougehrig.com/wp-content/uploads/2021/09/gehl028.jpg',
    );
  });

  it('decodes entities and strips tags', () => {
    expect(htmlToText('<p>Oris &#038; the &#8220;Gehrig&#8221; day&nbsp;</p>')).toBe('Oris & the “Gehrig” day');
  });
});

describe('lougehrig.com news freshness and subject tags (#4839)', () => {
  it('counts a post inside 12 months as current and an older one as older', () => {
    expect(newsFreshness('2026-06-09T15:58:28', NOW)).toBe('current');
    expect(newsFreshness('2025-11-22T00:00:00', NOW)).toBe('current');
    expect(newsFreshness('2025-11-20T00:00:00', NOW)).toBe('older');
    expect(newsFreshness('not a date', NOW)).toBe('unknown');
  });

  it('tags an ALS subject from the slug or title, and a mention from the body, without deciding anything', () => {
    expect(isAlsSubject({ slug: 'als' })).toBe(true);
    expect(isAlsSubject({ title: 'Stephen Hillenburg Reveals ALS Diagnosis' })).toBe(true);
    expect(isAlsSubject({ title: 'June 2 Is Now Lou Gehrig Day In Baseball' })).toBe(false);
    expect(isAlsMentioned({ text: 'The day raises awareness of ALS.' })).toBe(true);
    expect(isAlsMentioned({ text: 'July 4, 1939 at Yankee Stadium' })).toBe(false);
  });
});

describe('lougehrig.com candidate fields (#4839)', () => {
  const fields = buildLougehrigCandidateFields({ ...fixture, now: NOW });
  const photos = fields.filter((f) => f.kind === 'photo');

  it('holds AP and Getty photos as do-not-host and leaves the rest alone', () => {
    const held = photos.filter((p) => p.heldDoNotHost);
    expect(held).toHaveLength(2);
    expect(held.every((p) => p.topicTags.includes('hold-do-not-host') && p.provenanceNotes.includes('HELD and not hosted'))).toBe(true);
    expect(photos.filter((p) => !p.heldDoNotHost)).toHaveLength(1);
  });

  it('gives every photo its own source address, so none is dropped as already recorded', () => {
    const addresses = photos.map((p) => p.sourceUrl);
    expect(new Set(addresses).size).toBe(photos.length);
    expect(photos.every((p) => p.provenanceNotes.includes('/photo-gallery/'))).toBe(true);
  });

  it('uses the media record address for a captioned photo', () => {
    const ap = photos.find((p) => p.sourceRecordId === 'wp-media-147');
    expect(ap.originalFileUrl).toBe('https://lougehrig.com/wp-content/uploads/2021/09/gehl028.jpg');
  });

  it('records the About pages by slug and tags the ALS page', () => {
    const about = fields.filter((f) => f.kind === 'about');
    expect(about.map((a) => a.sourceRecordId).sort()).toHaveLength(2);
    expect(about.find((a) => a.topicTags.includes('als'))?.topicTags).toContain('als-subject');
    expect(about.find((a) => a.topicTags.includes('achievements'))?.topicTags).not.toContain('als-subject');
  });

  it('marks news as current or older than 12 months', () => {
    const news = fields.filter((f) => f.kind === 'news');
    const byDate = Object.fromEntries(news.map((n) => [n.dateOrPeriod, n.topicTags]));
    expect(byDate['2026-06-09']).toContain('news-current');
    expect(byDate['2023-06-01']).toContain('news-older-than-12-months');
    expect(byDate['2021-09-20']).toContain('als-subject');
  });
});

describe('lougehrig source through the collector (#4839)', () => {
  let outDir;

  beforeEach(() => {
    process.env.DISCOVERY_RETRY_BASE_DELAY_MS = '0';
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lougehrig-discovery-'));
  });

  afterEach(() => {
    delete process.env.DISCOVERY_RETRY_BASE_DELAY_MS;
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  const respond = (body) => ({ ok: true, status: 200, json: async () => body });

  it('writes metadata-only, unreviewed candidates and fetches the site once for two queries', async () => {
    const urls = [];
    const result = await runDiscovery(
      { query: 'Lou Gehrig', sources: ['lougehrig'], limit: 10, out: path.join(outDir, 'candidates.json') },
      async (url) => {
        const href = String(url);
        urls.push(href);
        if (href.includes('/wp/v2/pages')) return respond(fixture.pages);
        if (href.includes('/wp/v2/posts')) return respond(fixture.posts);
        if (href.includes('/wp/v2/media')) return respond(fixture.media);
        throw new Error(`unexpected url ${href}`);
      },
    );

    expect(result.errors).toEqual([]);
    expect(urls.every((u) => u.startsWith('https://lougehrig.com/index.php/wp-json/wp/v2/'))).toBe(true);
    expect(urls).toHaveLength(3);
    expect(result.candidates.length).toBeGreaterThan(0);
    for (const c of result.candidates) {
      expect(c.source_domain).toBe('lougehrig.com');
      expect(c.rights_status).toBe('unknown');
      expect(c.review_status).toBe('pending_review');
      expect(c.publication_status).toBe('not_ready');
      expect(c.relevance_status).toBe('pending');
    }
    const held = result.candidates.filter((c) => c.topic_tags.includes('hold-do-not-host'));
    expect(held).toHaveLength(2);
    expect(held.every((c) => c.admin_notes.includes('HOLD, DO NOT HOST'))).toBe(true);
    expect(result.searchRuns[0].source_domain).toBe('lougehrig.com');
  });

  it('is not part of the default source list, so scheduled discovery does not change', () => {
    const script = fs.readFileSync(
      path.join(process.cwd(), 'scripts/content-pipeline/collect-gehrig-external-sources.mjs'),
      'utf8',
    );
    const defaults = /const DEFAULT_SOURCES = \[([\s\S]*?)\];/.exec(script)[1];
    expect(defaults).not.toContain('lougehrig');
  });
});
