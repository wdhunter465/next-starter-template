import { describe, expect, it } from 'vitest';
import { buildDiscoveryUrl, cursorAfter, loadQueryPlan, resolveCursor, stepAt } from '../scripts/content-pipeline/discovery-query-plan.mjs';

describe('Gehrig discovery query plan (#4787)', () => {
  const plan = loadQueryPlan();

  it('puts pre-1931 steps first and keeps every one inside 1930', () => {
    const firstLater = plan.steps.findIndex((step) => !step.pre1931);
    expect(firstLater).toBeGreaterThan(0);
    expect(plan.steps.slice(0, firstLater).every((step) => step.pre1931)).toBe(true);
    expect(plan.dateEnd).toBe('1930-12-31');
    expect(stepAt(plan, { version: 1, index: 0 }).dateEnd).toBe('1930-12-31');
    expect(stepAt(plan, { version: 1, index: firstLater }).dateEnd).toBeNull();
  });

  it('fails a missing or corrupt cursor closed to the first step', () => {
    for (const raw of [null, '', 'not-json', {}, { version: 2, index: 3 }, { version: 1, index: -1 }, { version: 1, index: 999 }]) {
      const cursor = resolveCursor(raw, plan);
      expect(cursor).toMatchObject({ version: 1, index: 0, reset: true });
      expect(stepAt(plan, cursor).id).toBe(plan.steps[0].id);
    }
  });

  it('repeats the step when a source is down or rate limited, and advances on zero results', () => {
    const cursor = { version: 1, index: 2 };
    expect(cursorAfter(plan, cursor, 'source_error')).toEqual({ version: 1, index: 2 });
    expect(cursorAfter(plan, cursor, 'rate_limited')).toEqual({ version: 1, index: 2 });
    expect(cursorAfter(plan, cursor, 'no_results')).toEqual({ version: 1, index: 3 });
    expect(cursorAfter(plan, { version: 1, index: plan.steps.length - 1 }, 'completed').index).toBe(0);
  });

  it('keeps the current discovery URLs unless a later page or date bound is asked for', () => {
    expect(buildDiscoveryUrl('openverse', { query: 'Lou Gehrig', limit: 10 })).toBe('https://api.openverse.org/v1/images/?q=Lou%20Gehrig&page_size=10');
    expect(buildDiscoveryUrl('loc', { query: 'Lou Gehrig', limit: 10 })).toBe('https://www.loc.gov/photos/?q=Lou%20Gehrig&fo=json&c=10');
    expect(buildDiscoveryUrl('wikimedia', { query: 'Lou Gehrig', limit: 10 })).toBe('https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=Lou%20Gehrig&srnamespace=6&srlimit=10&format=json&origin=*');
    expect(buildDiscoveryUrl('loc', { query: 'Lou Gehrig 1927', limit: 10, page: 2, dateEnd: '1930-12-31' })).toBe('https://www.loc.gov/photos/?q=Lou%20Gehrig%201927&fo=json&c=10&dates=1903/1930&sp=2');
    expect(buildDiscoveryUrl('wikimedia', { query: 'Lou Gehrig', limit: 10, page: 2 })).toContain('sroffset=10');
    expect(buildDiscoveryUrl('openverse', { query: 'Lou Gehrig', limit: 10, page: 2 })).toContain('&page=2');
  });
});
