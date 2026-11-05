import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { splitQueries } from '../scripts/content-pipeline/collect-gehrig-external-sources.mjs';

describe('splitQueries (#4890)', () => {
  it('splits on | and trims', () => {
    expect(splitQueries('Lou Gehrig | Gehrig, Lou|Henry Louis Gehrig')).toEqual(['Lou Gehrig', 'Gehrig, Lou', 'Henry Louis Gehrig']);
  });

  it('drops blanks and repeats, ignoring case, and keeps the order given', () => {
    expect(splitQueries('Lou Gehrig||lou gehrig| Babe Ruth |Lou Gehrig')).toEqual(['Lou Gehrig', 'Babe Ruth']);
  });

  it('keeps a single query as is, and gives nothing for an empty value', () => {
    expect(splitQueries('Lou Gehrig')).toEqual(['Lou Gehrig']);
    expect(splitQueries('  ')).toEqual([]);
    expect(splitQueries(undefined)).toEqual([]);
  });
});

describe('curated Gehrig query list (#4890)', () => {
  const file = path.join(process.cwd(), 'data/research/gehrig-discovery-queries.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8')) as { batches: Record<string, string[]> };
  const all = Object.values(data.batches).flat();

  it('has non-empty batches of clean queries', () => {
    expect(Object.keys(data.batches).length).toBeGreaterThan(0);
    for (const [name, queries] of Object.entries(data.batches)) {
      expect(queries.length, name).toBeGreaterThan(0);
      for (const query of queries) {
        expect(query.trim(), name).toBe(query);
        expect(query.length, query).toBeGreaterThan(0);
        expect(query.length, query).toBeLessThanOrEqual(80);
        expect(query.includes('|'), query).toBe(false);
      }
    }
  });

  it('never repeats a query, ignoring case', () => {
    const lower = all.map((query) => query.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
  });

  it('keeps every batch within one workflow input', () => {
    for (const queries of Object.values(data.batches)) expect(queries.join('|').length).toBeLessThan(1000);
  });
});

describe('curated query list follows the content rule (#5074)', () => {
  const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/research/gehrig-discovery-queries.json'), 'utf8')) as { batches: Record<string, string[]> };
  const plan = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'scripts/content-pipeline/gehrig-discovery-query-plan.json'), 'utf8')) as { steps: Array<{ id: string; query: string }> };
  const all = Object.values(data.batches).flat();
  const DISEASE = /\bals\b|amyotrophic|disease|patient|awareness|ice bucket|cure|research|charity|donat/i;

  it('has no query about the disease, patients or awareness, in the list or in the rotation plan', () => {
    for (const query of [...all, ...plan.steps.map((step) => step.query)]) expect(DISEASE.test(query), query).toBe(false);
  });

  it('names Gehrig in every query', () => {
    for (const query of [...all, ...plan.steps.map((step) => step.query)]) expect(/gehrig/i.test(query), query).toBe(true);
  });

  it('lists no query twice, ignoring case', () => {
    const lower = all.map((query) => query.toLowerCase());
    expect(new Set(lower).size).toBe(lower.length);
  });

  it('covers life and family, seasons and records, memorabilia and tributes, and newspapers and media', () => {
    for (const batch of ['life-and-family', 'seasons-and-records', 'memorabilia-and-tributes', 'newspapers-and-media']) {
      expect(data.batches[batch]?.length, batch).toBeGreaterThan(0);
    }
  });
});

describe('Library of Congress request spacing (#5074)', () => {
  it('spaces loc.gov and Wikimedia hosts and nothing else', async () => {
    const { spacingKeyFor, waitBeforeRequestMs } = await import('../scripts/content-pipeline/collect-gehrig-external-sources.mjs');
    expect(spacingKeyFor('https://www.loc.gov/photos/?q=x')).toBe('loc.gov');
    expect(spacingKeyFor('https://chroniclingamerica.loc.gov/search/pages/results/')).toBe('loc.gov');
    expect(spacingKeyFor('https://commons.wikimedia.org/w/api.php')).toBe('wikimedia.org');
    expect(spacingKeyFor('https://upload.wikimedia.org/x.jpg')).toBe('wikimedia.org');
    expect(spacingKeyFor('https://archive.org/advancedsearch.php')).toBeNull();
    expect(spacingKeyFor('not a url')).toBeNull();
    expect(waitBeforeRequestMs(undefined, 1000, 4000)).toBe(0);
    expect(waitBeforeRequestMs(1000, 2000, 4000)).toBe(3000);
    expect(waitBeforeRequestMs(1000, 9000, 4000)).toBe(0);
    expect(waitBeforeRequestMs(1000, 2000, 0)).toBe(0);
  });
});
