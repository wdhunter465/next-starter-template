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
