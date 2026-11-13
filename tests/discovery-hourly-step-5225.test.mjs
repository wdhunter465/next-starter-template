import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { loadQueryPlan, stepForHour } from '../scripts/content-pipeline/discovery-query-plan.mjs';

describe('hourly discovery step selection (#5225)', () => {
  const plan = loadQueryPlan();
  const n = plan.steps.length;

  it('uses the same step for every moment inside one UTC hour', () => {
    const a = stepForHour(plan, new Date('2026-11-13T15:00:00Z'));
    const b = stepForHour(plan, new Date('2026-11-13T15:59:59Z'));
    expect(b.id).toBe(a.id);
  });

  it('moves to the next step each hour and wraps after the last one', () => {
    const start = Date.parse('2026-11-13T00:00:00Z');
    const ids = Array.from({ length: n + 1 }, (_, i) => stepForHour(plan, new Date(start + i * 3_600_000)).id);
    expect(new Set(ids.slice(0, n)).size).toBe(n);
    expect(ids[n]).toBe(ids[0]);
  });

  it('visits every step in the plan once per cycle, so a skipped step returns one cycle later', () => {
    const start = Date.parse('2026-12-01T07:00:00Z');
    const seen = new Set();
    for (let i = 0; i < n; i += 1) seen.add(stepForHour(plan, new Date(start + i * 3_600_000)).id);
    expect([...seen].sort()).toEqual(plan.steps.map((s) => s.id).sort());
  });

  it('carries the date bound for pre-1931 steps and none for later steps', () => {
    for (let i = 0; i < n; i += 1) {
      const step = stepForHour(plan, new Date(Date.parse('2026-11-13T00:00:00Z') + i * 3_600_000));
      if (step.pre1931) expect(step.dateEnd).toBe('1930-12-31');
      else expect(step.dateEnd).toBeNull();
    }
  });

  it('rejects an invalid date', () => {
    expect(() => stepForHour(plan, 'not a date')).toThrow();
  });
});

describe('hourly discovery workflow gate (#5225)', () => {
  const workflow = readFileSync('.github/workflows/gehrig-content-discovery.yml', 'utf8');

  it('keeps the weekly run and adds an hourly one', () => {
    expect(workflow).toContain('cron: "0 13 * * 1"');
    expect(workflow).toContain('cron: "17 * * * *"');
  });

  it('writes to production D1 only through the one mode decision', () => {
    const gated = workflow.match(/steps\.mode\.outputs\.import == 'true'/g) ?? [];
    expect(gated.length).toBe(3);
    expect(workflow).not.toMatch(/github\.event_name == 'schedule' \|\| github\.event\.inputs\.import_to_d1/);
  });

  it('keeps the hourly import off unless the repository variable is set to true', () => {
    expect(workflow).toContain('HOURLY_IMPORT: ${{ vars.GEHRIG_DISCOVERY_HOURLY_IMPORT }}');
    expect(workflow).toContain('if [ "$HOURLY_IMPORT" = "true" ]; then import=true; fi');
  });

  it('bounds each run', () => {
    expect(workflow).toContain('timeout-minutes: 25');
  });
});
