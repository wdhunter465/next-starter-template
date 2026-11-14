import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { assertSelectOnly } from '../scripts/ops/archive-report-lib.mjs';
import {
  COUNTS_SQL,
  MARKER,
  PLAN_END,
  PLAN_START,
  TARGET,
  computeProgress,
  daysInclusive,
  renderMarkdown,
  weekdaysInclusive,
} from '../scripts/ops/inventory-progress-lib.mjs';

describe('inventory progress calendar (#5231)', () => {
  it('counts the 396 posting days and 284 weekdays from 2026-12-01 to 2027-12-31', () => {
    expect(TARGET).toBe(396);
    expect(daysInclusive('2026-12-01', '2026-12-31')).toBe(31);
    expect(weekdaysInclusive('2026-12-01', '2026-12-31')).toBe(23);
    expect(daysInclusive('2027-01-01', '2027-12-31')).toBe(365);
    expect(weekdaysInclusive('2027-01-01', '2027-12-31')).toBe(261);
    expect(daysInclusive(PLAN_START, PLAN_END)).toBe(396);
    expect(weekdaysInclusive(PLAN_START, PLAN_END)).toBe(284);
  });

  it('returns zero when the end is before the start', () => {
    expect(daysInclusive('2027-01-02', '2027-01-01')).toBe(0);
    expect(weekdaysInclusive('2027-01-02', '2027-01-01')).toBe(0);
  });
});

describe('inventory progress classification (#5231)', () => {
  const counts = (cleared) => ({ stories_total: cleared + 50, stories_published: cleared + 10, stories_draft: 40, stories_cleared: cleared, drafts_with_cleared_picture: 12 });

  it('says daily posting is covered when cleared stories reach the days left', () => {
    const p = computeProgress(counts(400), '2026-11-14');
    expect(p.remaining_days).toBe(396);
    expect(p.posting).toBe('daily_ok');
    expect(p.toward_target).toBe(396);
    expect(p.still_needed).toBe(0);
    expect(p.percent).toBe(100);
  });

  it('applies the weekday fallback when cleared stories cover the weekdays but not every day', () => {
    expect(computeProgress(counts(300), '2026-11-14').posting).toBe('switch_to_weekdays');
    expect(computeProgress(counts(284), '2026-11-14').posting).toBe('switch_to_weekdays');
    expect(computeProgress(counts(395), '2026-11-14').posting).toBe('switch_to_weekdays');
  });

  it('flags a shortage even for weekdays', () => {
    const p = computeProgress(counts(100), '2026-11-14');
    expect(p.posting).toBe('short_even_for_weekdays');
    expect(p.still_needed).toBe(296);
    expect(p.percent).toBe(25);
  });

  it('shrinks the window as the plan runs, and ends it after 2027-12-31', () => {
    const mid = computeProgress(counts(214), '2027-06-01');
    expect(mid.remaining_days).toBe(214);
    expect(mid.posting).toBe('daily_ok');
    expect(computeProgress(counts(0), '2028-01-01').posting).toBe('plan_window_over');
  });

  it('renders a marked Markdown report with the numbers and the fallback text', () => {
    const md = renderMarkdown(computeProgress(counts(300), '2026-11-14'));
    expect(md.startsWith(MARKER)).toBe(true);
    expect(md).toContain('**300 of 396**');
    expect(md).toContain('weekdays only');
    expect(md).toContain('Read-only');
  });
});

describe('inventory progress SQL (#5231)', () => {
  it('is a single read-only SELECT', () => {
    expect(() => assertSelectOnly(COUNTS_SQL)).not.toThrow();
  });

  it('counts approved stories with a cleared picture, against a real SQLite', async () => {
    let DatabaseSync;
    try {
      ({ DatabaseSync } = await import('node:sqlite'));
    } catch {
      return; // node:sqlite unavailable on this runtime; the SQL is still checked as read-only above
    }
    const db = new DatabaseSync(':memory:');
    db.exec(`
      CREATE TABLE content_inventory (id INTEGER PRIMARY KEY, canonical INTEGER, status TEXT);
      CREATE TABLE photos (id INTEGER PRIMARY KEY, publication_eligible INTEGER, rights_hold INTEGER);
      CREATE TABLE content_inventory_media (id INTEGER PRIMARY KEY, story_id INTEGER, media_id INTEGER, media_role TEXT);
      INSERT INTO photos VALUES (1, 1, 0), (2, 1, 1), (3, 0, 0), (4, 1, 0), (5, 1, 0);
      INSERT INTO content_inventory VALUES
        (1, 1, 'published'), (2, 1, 'published'), (3, 1, 'published'), (4, 1, 'published'),
        (5, 1, 'published'), (6, 1, 'draft'), (7, 0, 'published'), (8, 1, 'published');
      INSERT INTO content_inventory_media (story_id, media_id, media_role) VALUES
        (1, 1, 'primary_image'),
        (2, 2, 'primary_image'),
        (3, 3, 'primary_image'),
        (5, 4, 'ocr_source'),
        (6, 1, 'primary_image'),
        (7, 1, 'primary_image'),
        (8, 1, 'primary_image'), (8, 5, 'gallery_image');
    `);
    const row = db.prepare(COUNTS_SQL).get();
    expect(Number(row.stories_total)).toBe(7);
    expect(Number(row.stories_published)).toBe(6);
    expect(Number(row.stories_draft)).toBe(1);
    // Story 1 and story 8 (two cleared pictures, counted once). Not: 2 (rights hold), 3 (not eligible),
    // 4 (no picture), 5 (picture only as an OCR source), 7 (not canonical).
    expect(Number(row.stories_cleared)).toBe(2);
    expect(Number(row.drafts_with_cleared_picture)).toBe(1);
  });
});

describe('inventory progress workflow (#5231)', () => {
  const workflow = readFileSync('.github/workflows/ops-inventory-progress.yml', 'utf8');

  it('is read-only: no pull_request trigger, contents read, no write step', () => {
    expect(workflow).toContain('contents: read');
    expect(workflow).not.toMatch(/pull_request/);
    expect(workflow).not.toMatch(/d1 execute|--file|INSERT|UPDATE|DELETE/i);
    expect(workflow).toContain('scripts/ops/inventory-progress.mjs --remote');
  });

  it('runs weekly and on demand, and posts the report on #5231', () => {
    expect(workflow).toMatch(/schedule:\s*\n(\s*#.*\n)*\s*- cron:/);
    expect(workflow).toContain('workflow_dispatch');
    expect(workflow).toContain('gh issue comment 5231');
  });
});
