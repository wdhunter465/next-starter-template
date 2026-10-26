import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { commonsFileIsWorthRecording, runDiscovery } from '../scripts/content-pipeline/collect-gehrig-external-sources.mjs';

function json(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

const imageinfo = (title: string, mime: string, width: number, height: number, extra: Record<string, unknown> = {}) => ({
  pageid: Math.abs(title.length * 7),
  title,
  imageinfo: [
    {
      url: `https://upload.wikimedia.org/${title.replace(/ /g, '_')}`,
      descriptionurl: `https://commons.wikimedia.org/wiki/${title.replace(/ /g, '_')}`,
      user: 'Uploader',
      mime,
      width,
      height,
      size: 123456,
      extmetadata: { LicenseShortName: { value: 'Public domain' }, ImageDescription: { value: 'Lou Gehrig at bat' }, ...extra },
    },
  ],
});

describe('commonsFileIsWorthRecording (#4894)', () => {
  it('keeps jpeg, png and tiff images of at least 800 px on the long side', () => {
    expect(commonsFileIsWorthRecording({ mime: 'image/jpeg', width: 3000, height: 2000 })).toBe(true);
    expect(commonsFileIsWorthRecording({ mime: 'image/tiff', width: 800, height: 600 })).toBe(true);
    expect(commonsFileIsWorthRecording({ mime: 'image/png', width: 1200, height: 3000 })).toBe(true);
  });

  it('drops PDFs, other types and small images', () => {
    expect(commonsFileIsWorthRecording({ mime: 'application/pdf', width: 3000, height: 3000 })).toBe(false);
    expect(commonsFileIsWorthRecording({ mime: 'image/gif', width: 3000, height: 3000 })).toBe(false);
    expect(commonsFileIsWorthRecording({ mime: 'image/jpeg', width: 430, height: 300 })).toBe(false);
    expect(commonsFileIsWorthRecording(undefined)).toBe(false);
  });
});

describe('Commons category crawl (#4894)', () => {
  let outDir: string;
  beforeEach(() => {
    process.env.DISCOVERY_RETRY_BASE_DELAY_MS = '0';
    process.env.DISCOVERY_QUERY_PAUSE_MS = '0';
    outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gehrig-commonscat-'));
  });
  afterEach(() => {
    delete process.env.DISCOVERY_RETRY_BASE_DELAY_MS;
    delete process.env.DISCOVERY_QUERY_PAUSE_MS;
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  it('crawls the root and Gehrig-named sub-categories, and records only large images', async () => {
    const requested: string[] = [];
    const fetchImpl = async (input: unknown) => {
      const url = String(input);
      requested.push(url);
      const decoded = decodeURIComponent(url);
      if (decoded.includes('list=categorymembers') && decoded.includes('cmtitle=Category:Lou_Gehrig&')) {
        return json({
          query: {
            categorymembers: [
              { ns: 6, title: 'File:Gehrig at bat.jpg' },
              { ns: 6, title: 'File:Gehrig scorecard.pdf' },
              { ns: 14, title: 'Category:Lou Gehrig Day' },
              { ns: 14, title: 'Category:Yankee Stadium' },
            ],
          },
        });
      }
      if (decoded.includes('cmtitle=Category:Lou Gehrig Day')) {
        return json({ query: { categorymembers: [{ ns: 6, title: 'File:Gehrig farewell.jpg' }, { ns: 6, title: 'File:Gehrig thumb.jpg' }] } });
      }
      if (decoded.includes('prop=imageinfo')) {
        return json({
          query: {
            pages: {
              1: imageinfo('File:Gehrig at bat.jpg', 'image/jpeg', 3000, 2400),
              2: imageinfo('File:Gehrig scorecard.pdf', 'application/pdf', 2000, 3000),
              3: imageinfo('File:Gehrig farewell.jpg', 'image/jpeg', 2600, 1800),
              4: imageinfo('File:Gehrig thumb.jpg', 'image/jpeg', 400, 300),
            },
          },
        });
      }
      return json({ query: {} });
    };

    const result = await runDiscovery(
      { query: 'Lou Gehrig', sources: ['commonscat'], limit: 100, out: path.join(outDir, 'candidates.json') },
      fetchImpl as unknown as typeof fetch,
    );

    const titles = result.candidates.map((candidate: { title: string }) => candidate.title).sort();
    expect(titles).toEqual(['File:Gehrig at bat.jpg', 'File:Gehrig farewell.jpg']);
    expect(requested.some((url) => decodeURIComponent(url).includes('Category:Yankee_Stadium'))).toBe(false);
    const first = result.candidates[0] as { source_domain: string; rights_evidence?: { evidence_type: string } };
    expect(first.source_domain).toBe('commons.wikimedia.org');
    expect(first.rights_evidence?.evidence_type).toBe('commons_license');
    expect(result.searchRuns).toHaveLength(1);
    expect(result.searchRuns[0].source_domain).toBe('commons.wikimedia.org');
  });

  it('follows category continuation and stops at the file limit', async () => {
    const fetchImpl = async (input: unknown) => {
      const decoded = decodeURIComponent(String(input));
      if (decoded.includes('list=categorymembers')) {
        if (decoded.includes('cmcontinue=next')) {
          return json({ query: { categorymembers: [{ ns: 6, title: 'File:C.jpg' }] } });
        }
        return json({
          continue: { cmcontinue: 'next' },
          query: { categorymembers: [{ ns: 6, title: 'File:A.jpg' }, { ns: 6, title: 'File:B.jpg' }] },
        });
      }
      if (decoded.includes('prop=imageinfo')) {
        const pages: Record<string, unknown> = {};
        for (const [index, title] of ['File:A.jpg', 'File:B.jpg', 'File:C.jpg'].entries()) {
          if (decoded.includes(title)) pages[index] = imageinfo(title, 'image/jpeg', 2000, 1500);
        }
        return json({ query: { pages } });
      }
      return json({ query: {} });
    };
    const result = await runDiscovery(
      { query: 'Lou Gehrig', sources: ['commonscat'], limit: 100, out: path.join(outDir, 'candidates.json') },
      fetchImpl as unknown as typeof fetch,
    );
    expect(result.candidates).toHaveLength(3);
    const limited = await runDiscovery(
      { query: 'Lou Gehrig', sources: ['commonscat'], limit: 2, out: path.join(outDir, 'candidates2.json') },
      fetchImpl as unknown as typeof fetch,
    );
    expect(limited.candidates.length).toBeLessThanOrEqual(2);
  });
});
