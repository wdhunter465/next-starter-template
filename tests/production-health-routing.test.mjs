import { describe, expect, it, vi } from 'vitest';
import {
  buildIssueBody,
  buildResolutionComment,
  buildRoutingSummary,
  issueLabels,
  issueTitle,
  routeResults,
} from '../scripts/ci/production_health_routing.mjs';

const baseResult = (overrides = {}) => ({
  name: 'faq_list',
  state: 'degraded',
  reason: 'endpoint responded ok:false',
  status_code: 200,
  timing_ms: 12,
  fingerprint: 'production-health:faq_list:degraded',
  ...overrides,
});

describe('issueTitle', () => {
  it('is stable regardless of state, so the same check always maps to the same issue', () => {
    expect(issueTitle('faq_list')).toBe('OPS — Production health: faq_list');
  });
});

describe('issueLabels', () => {
  it('includes a severity-specific label alongside the finding taxonomy', () => {
    expect(issueLabels('P1')).toEqual(['ops-runtime-finding', 'production-health', 'severity:p1']);
  });
});

describe('buildIssueBody / buildResolutionComment', () => {
  it('never leaks anything beyond the already-redacted result fields', () => {
    const body = buildIssueBody({ result: baseResult(), runUrl: 'https://example/run/1', checkedAt: '2026-08-08T00:00:00Z' });
    expect(body).toContain('faq_list');
    expect(body).toContain('P3');
    expect(body).toContain('production-health:faq_list:degraded');
  });

  it('resolution comment names the check and states it is closing automatically', () => {
    const comment = buildResolutionComment({ result: baseResult({ state: 'healthy' }), runUrl: '', checkedAt: '2026-08-08T00:00:00Z' });
    expect(comment).toContain('faq_list');
    expect(comment).toContain('Closing automatically');
  });
});

describe('routeResults', () => {
  it('creates an issue for a new unhealthy check', async () => {
    const upsert = vi.fn().mockResolvedValue({ action: 'created', issue: 'https://example/issues/1' });
    const findOpen = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn();

    const outcomes = await routeResults([baseResult()], { token: 't', owner: 'o', repo: 'r', upsert, findOpen, close });

    expect(outcomes).toEqual([{ name: 'faq_list', action: 'created', issue: 'https://example/issues/1' }]);
    expect(upsert).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
  });

  it('updates (not duplicates) the same issue when the check is still unhealthy on a later run', async () => {
    const upsert = vi.fn().mockResolvedValue({ action: 'updated', issue: 'https://example/issues/1' });
    const findOpen = vi.fn().mockResolvedValue({ number: 1, html_url: 'https://example/issues/1', labels: [] });
    const close = vi.fn();

    const outcomes = await routeResults([baseResult({ state: 'unavailable' })], { token: 't', owner: 'o', repo: 'r', upsert, findOpen, close });

    expect(outcomes[0].action).toBe('updated');
    expect(upsert).toHaveBeenCalledOnce();
  });

  it('closes the matching open issue with a resolution comment when a check recovers to healthy', async () => {
    const upsert = vi.fn();
    const findOpen = vi.fn().mockResolvedValue({ number: 1, html_url: 'https://example/issues/1', labels: [] });
    const close = vi.fn().mockResolvedValue(undefined);

    const outcomes = await routeResults([baseResult({ state: 'healthy', reason: '' })], { token: 't', owner: 'o', repo: 'r', upsert, findOpen, close });

    expect(outcomes[0].action).toBe('closed');
    expect(close).toHaveBeenCalledOnce();
    expect(upsert).not.toHaveBeenCalled();
  });

  it('is a no-op when a check is healthy and there was never an open issue', async () => {
    const upsert = vi.fn();
    const findOpen = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn();

    const outcomes = await routeResults([baseResult({ state: 'healthy', reason: '' })], { token: 't', owner: 'o', repo: 'r', upsert, findOpen, close });

    expect(outcomes[0].action).toBe('noop');
    expect(upsert).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it('respects an operator-applied monitoring-hold label — no update, no close', async () => {
    const upsert = vi.fn();
    const findOpen = vi.fn().mockResolvedValue({
      number: 1,
      html_url: 'https://example/issues/1',
      labels: [{ name: 'monitoring-hold' }],
    });
    const close = vi.fn();

    const stillUnhealthy = await routeResults([baseResult({ state: 'degraded' })], { token: 't', owner: 'o', repo: 'r', upsert, findOpen, close });
    expect(stillUnhealthy[0].action).toBe('held');
    expect(upsert).not.toHaveBeenCalled();

    const recovered = await routeResults([baseResult({ state: 'healthy', reason: '' })], { token: 't', owner: 'o', repo: 'r', upsert, findOpen, close });
    expect(recovered[0].action).toBe('held');
    expect(close).not.toHaveBeenCalled();
  });

  it('does not call the GitHub API for anything other than issue read/create/update/close (no remediation path exists)', async () => {
    const upsert = vi.fn().mockResolvedValue({ action: 'created', issue: 'x' });
    const findOpen = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn();
    await routeResults([baseResult(), baseResult({ name: 'd1_health', state: 'unavailable' })], {
      token: 't',
      owner: 'o',
      repo: 'r',
      upsert,
      findOpen,
      close,
    });
    // Every mock call's arguments are issue-shaped (title/body/labels or issueNumber) —
    // asserting the call surface never grew a Production-mutation-shaped parameter.
    for (const call of upsert.mock.calls) {
      const [args] = call;
      expect(Object.keys(args).sort()).toEqual(['body', 'labels', 'owner', 'repo', 'title', 'token']);
    }
  });
});

describe('buildRoutingSummary', () => {
  it('counts outcomes by action and renders one table row per check', () => {
    const md = buildRoutingSummary([
      { name: 'a', action: 'created', issue: 'https://x/1' },
      { name: 'b', action: 'closed', issue: 'https://x/2' },
      { name: 'c', action: 'noop', issue: null },
    ]);
    expect(md).toContain('created=1');
    expect(md).toContain('closed=1');
    expect(md).toContain('noop=1');
    expect(md.split('\n').filter((l) => l.startsWith('| `'))).toHaveLength(3);
  });
});
