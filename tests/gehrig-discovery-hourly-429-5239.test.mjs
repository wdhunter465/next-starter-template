import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decideOutage, onlyRateLimited } from '../scripts/ci/gehrig_discovery_summary.mjs';

describe('hourly discovery rate limit handling (#5239)', () => {
  it('skips, and stays green, when an hourly run is only rate limited', () => {
    expect(decideOutage({ sourceErrorCount: 1, consecutivePriorFailures: 0, hourly: true, rateLimitedOnly: true })).toBe('skip');
    // Even right after two failures: a rate limit is not a failure, so it never reaches the halt.
    expect(decideOutage({ sourceErrorCount: 1, consecutivePriorFailures: 2, hourly: true, rateLimitedOnly: true })).toBe('skip');
  });

  it('still fails, and still counts toward the halt, on a real source error in an hourly run', () => {
    expect(decideOutage({ sourceErrorCount: 1, consecutivePriorFailures: 0, hourly: true, rateLimitedOnly: false })).toBe('fail');
    expect(decideOutage({ sourceErrorCount: 1, consecutivePriorFailures: 2, hourly: true, rateLimitedOnly: false })).toBe('halt');
  });

  it('leaves weekly and manual runs exactly as before, even when they are only rate limited', () => {
    expect(decideOutage({ sourceErrorCount: 1, consecutivePriorFailures: 0, rateLimitedOnly: true })).toBe('fail');
    expect(decideOutage({ sourceErrorCount: 1, consecutivePriorFailures: 2, rateLimitedOnly: true })).toBe('halt');
    expect(decideOutage({ sourceErrorCount: 0, consecutivePriorFailures: 0 })).toBe('pass');
  });

  it('recognises a rate-limit-only outage', () => {
    expect(onlyRateLimited([{ status: 'rate_limited' }])).toBe(true);
    expect(onlyRateLimited([{ status: 'rate_limited' }, { status: 'completed' }])).toBe(true);
    expect(onlyRateLimited([{ status: 'rate_limited' }, { status: 'source_error' }])).toBe(false);
    expect(onlyRateLimited([{ status: 'source_error' }])).toBe(false);
    expect(onlyRateLimited([{ status: 'completed' }])).toBe(false);
    expect(onlyRateLimited([])).toBe(false);
    expect(onlyRateLimited(undefined)).toBe(false);
  });

  it('passes the hourly flag from the workflow to the outage step', () => {
    const workflow = readFileSync('.github/workflows/gehrig-content-discovery.yml', 'utf8');
    expect(workflow).toContain('DISCOVERY_HOURLY: ${{ steps.mode.outputs.hourly }}');
  });
});
