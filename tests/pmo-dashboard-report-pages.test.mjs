import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { REPORT_PAGES, renderReportNav, applyReportNav, NAV_PLACEHOLDER } from '../scripts/pmo-dashboard/report-nav.mjs';
import { resolveScorecard, renderScorecardHtml, generateScorecardPage, previousDataUrl } from '../scripts/pmo-dashboard/build-scorecard-page.mjs';

const NOW = new Date('2026-10-28T13:00:00Z');
const card = {
  window: { start: '2026-10-21T13:00:00.000Z', end: '2026-10-28T13:00:00.000Z' },
  rows: [
    { name: 'Website uptime (www and apex)', value: '100.0% of 316 probe runs', rag: 'green' },
    { name: 'Operations queue', value: '12 open, oldest 1796.4 h', rag: 'red' },
    { name: 'Ops issues opened', value: '10 (monitoring 5, person 5)', rag: '—' },
  ],
};
const saved = (generatedAt) => ({ generatedAt, card });
const fetchOf = (body, ok = true) => async () => ({ ok, json: async () => body });

describe('report navigation', () => {
  it('links to all three pages and marks the current one', () => {
    const html = renderReportNav('queues');
    for (const page of REPORT_PAGES) expect(html).toContain(`<a href="${page.href}"`);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/href=".\/queues.html" aria-current="page"/);
  });
  it('replaces the placeholder and refuses a template without one', () => {
    expect(applyReportNav(`<body>${NAV_PLACEHOLDER}</body>`, 'book')).toContain('Scorecard');
    expect(() => applyReportNav('<body></body>', 'book')).toThrow(/missing/);
  });
});

describe('scorecard refresh', () => {
  const collect = async () => card;
  it('reuses a scorecard younger than a day without collecting', async () => {
    let called = false;
    const result = await resolveScorecard({ now: NOW, fetchImpl: fetchOf(saved('2026-10-28T01:00:00Z')), collect: async () => { called = true; return card; } });
    expect(result.status).toBe('reused');
    expect(called).toBe(false);
  });
  it('recomputes when the saved scorecard is a day old', async () => {
    const result = await resolveScorecard({ now: NOW, fetchImpl: fetchOf(saved('2026-10-27T01:00:00Z')), collect });
    expect(result.status).toBe('fresh');
    expect(result.generatedAt).toBe(NOW.toISOString());
  });
  it('recomputes when nothing was published before', async () => {
    const result = await resolveScorecard({ now: NOW, fetchImpl: fetchOf({}, false), collect });
    expect(result.status).toBe('fresh');
  });
  it('shows the last good scorecard when collection fails', async () => {
    const result = await resolveScorecard({ now: NOW, fetchImpl: fetchOf(saved('2026-10-26T01:00:00Z')), collect: async () => { throw new Error('rate limited'); } });
    expect(result.status).toBe('stale');
    expect(result.note).toMatch(/rate limited/);
    expect(result.card.rows).toHaveLength(3);
  });
  it('reports unavailable, never throws, with no data and no token', async () => {
    const result = await resolveScorecard({ now: NOW });
    expect(result.status).toBe('unavailable');
    expect(result.card).toBeNull();
  });
});

describe('scorecard page', () => {
  it('renders rows, status text, generated time and escapes values', () => {
    const html = renderScorecardHtml({ card: { ...card, rows: [{ name: '<b>x</b>', value: 'a & b', rag: 'amber' }] }, generatedAt: NOW.toISOString(), status: 'fresh' });
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).toContain('a &amp; b');
    expect(html).toContain('rag-amber');
    expect(html).toContain(NOW.toISOString());
    expect(html).toContain(NAV_PLACEHOLDER);
  });
  it('writes the page with navigation and the data file', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'scorecard-'));
    try {
      const result = await generateScorecardPage({ outDir: dir, env: {}, now: NOW, fetchImpl: fetchOf({}, false), collect: async () => card });
      expect(result.status).toBe('fresh');
      const html = await readFile(path.join(dir, 'scorecard.html'), 'utf8');
      for (const page of REPORT_PAGES) expect(html).toContain(`<a href="${page.href}"`);
      expect(html).toMatch(/href=".\/scorecard.html" aria-current="page"/);
      const data = JSON.parse(await readFile(path.join(dir, 'scorecard-data.json'), 'utf8'));
      expect(data.card.rows).toHaveLength(3);
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it('writes a notice page and no data file when there is no token', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'scorecard-'));
    try {
      const result = await generateScorecardPage({ outDir: dir, env: {}, now: NOW });
      expect(result.status).toBe('unavailable');
      expect(await readFile(path.join(dir, 'scorecard.html'), 'utf8')).toContain('no GitHub token');
      await expect(readFile(path.join(dir, 'scorecard-data.json'), 'utf8')).rejects.toThrow();
    } finally { await rm(dir, { recursive: true, force: true }); }
  });
  it('derives the previous-data URL from the repository', () => {
    expect(previousDataUrl({ GITHUB_REPOSITORY: 'wdhunter465/next-starter-template' })).toBe('https://wdhunter465.github.io/next-starter-template/pmo-dashboard/scorecard-data.json');
  });
});
