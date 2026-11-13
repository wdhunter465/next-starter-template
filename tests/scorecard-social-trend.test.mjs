import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  generateScorecardPage,
  historyUrl,
  loadHistory,
  parseHistoryText,
  renderScorecardHtml,
  renderTrendHtml,
  trendPeriods,
} from '../scripts/pmo-dashboard/build-scorecard-page.mjs';

const row = (week_start, platform, over = {}) => ({
  week_start,
  week_end: week_start,
  platform,
  planned: 3,
  confirmed: 3,
  failed: 0,
  missing: 0,
  handed_off: 0,
  not_logged: 0,
  pending: 0,
  not_eligible: 0,
  ...over,
});
const weeks = (n, start = Date.UTC(2026, 10, 9)) => Array.from({ length: n }, (_, i) => new Date(start + i * 7 * 86400000).toISOString().slice(0, 10));

describe('history loading', () => {
  it('points at the public history branch', () => {
    expect(historyUrl({ GITHUB_REPOSITORY: 'o/r' })).toBe('https://raw.githubusercontent.com/o/r/scorecard-history/social-weekly.jsonl');
  });

  it('reads rows, skips damaged lines and anything that is not a history row', () => {
    const text = `${JSON.stringify(row('2026-11-09', 'x'))}\nnot json\n${JSON.stringify({ generatedAt: 'x', card: {} })}\n`;
    expect(parseHistoryText(text)).toHaveLength(1);
  });

  it('returns nothing, without throwing, when the file is missing or the fetch fails', async () => {
    expect(await loadHistory('u', undefined)).toEqual([]);
    expect(await loadHistory('u', async () => ({ ok: false }))).toEqual([]);
    expect(await loadHistory('u', async () => { throw new Error('offline'); })).toEqual([]);
    expect(await loadHistory('u', async () => ({ ok: true, text: async () => JSON.stringify(row('2026-11-09', 'x')) }))).toHaveLength(1);
  });
});

describe('trend periods', () => {
  it('keeps weeks while there are 26 or fewer, and rolls up to months after that', () => {
    const few = weeks(10).map((w) => row(w, 'x'));
    expect(trendPeriods(few)).toMatchObject({ bucket: 'week' });
    expect(trendPeriods(few).platforms.x).toHaveLength(10);
    const many = weeks(30).map((w) => row(w, 'x', { planned: 7, confirmed: 6, missing: 1 }));
    const rolled = trendPeriods(many);
    expect(rolled.bucket).toBe('month');
    expect(rolled.platforms.x.length).toBeLessThan(10);
    expect(rolled.platforms.x.reduce((sum, p) => sum + p.planned, 0)).toBe(30 * 7);
    expect(rolled.platforms.x.reduce((sum, p) => sum + p.problem, 0)).toBe(30);
  });
});

describe('trend graph', () => {
  const rows = weeks(4).flatMap((w, i) => ['x', 'facebook', 'instagram', 'pinterest'].map((p) => row(w, p, i === 1 && p === 'facebook' ? { confirmed: 1, failed: 1, missing: 1 } : {})));

  it('shows an empty state when there is no history yet', () => {
    expect(renderTrendHtml([])).toContain('No weekly history yet');
  });

  it('draws one chart per platform with a legend, labelled bars and a table, so colour is never the only signal', () => {
    const html = renderTrendHtml(rows);
    expect(html.match(/<svg /g)).toHaveLength(4);
    expect(html).toContain('role="img"');
    for (const label of ['Confirmed', 'Handed off, not verified', 'Not logged', 'Failed or missing']) expect(html).toContain(label);
    expect(html).toContain('<title>');
    expect(html).toContain('Table view');
    expect(html).toContain('2026-11-16: 1 of 3 confirmed, 1 failed, 1 missing');
  });

  it('is part of the scorecard page, and a missing history does not break it', () => {
    const result = { card: { window: { start: '2026-11-09T13:00:00Z', end: '2026-11-16T13:00:00Z' }, rows: [] }, generatedAt: '2026-11-16T13:00:00Z', status: 'fresh' };
    expect(renderScorecardHtml(result, rows)).toContain('id="social-trend"');
    expect(renderScorecardHtml(result)).toContain('No weekly history yet');
  });

  it('builds the page with the history it can read', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'page-'));
    const history = rows.map((r) => JSON.stringify(r)).join('\n');
    const fetchImpl = async (url) => (String(url).includes('scorecard-history')
      ? { ok: true, text: async () => history }
      : { ok: false });
    await generateScorecardPage({ outDir: dir, env: { GITHUB_REPOSITORY: 'o/r' }, now: new Date('2026-11-16T13:00:00Z'), fetchImpl, collect: async () => ({ window: { start: '2026-11-09T13:00:00Z', end: '2026-11-16T13:00:00Z' }, rows: [] }) });
    expect(readFileSync(join(dir, 'scorecard.html'), 'utf8')).toContain('2026-11-16: 1 of 3 confirmed');
    rmSync(dir, { recursive: true });
  });
});
