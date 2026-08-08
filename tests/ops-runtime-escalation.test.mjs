import { describe, expect, it, vi } from 'vitest';
import {
  buildOpsRuntimeEscalationBody,
  escalationTitle,
  findOpenIssueByTitle,
  OPS_RUNTIME_ESCALATION_MARKER,
  upsertOpsRuntimeIssue,
} from '../scripts/ci/ops_runtime_escalation.mjs';

describe('OPS runtime escalation helper', () => {
  it('builds evidence-rich escalation bodies', () => {
    const body = buildOpsRuntimeEscalationBody({
      workflowName: 'OPS — B2 S3 Smoke Test',
      runUrl: 'https://github.test/actions/1',
      commitSha: 'abc123',
      details: 'Smoke test failed on list-objects.',
      nextSteps: ['Review B2 credentials', 'Re-run workflow_dispatch manually'],
      retryEvidence: '- Retry attempts: 0\n- Result: failed before retry',
    });

    expect(body).toContain(OPS_RUNTIME_ESCALATION_MARKER);
    expect(body).toContain('OPS — B2 S3 Smoke Test');
    expect(body).toContain('Smoke test failed on list-objects.');
    expect(body).toContain('Review B2 credentials');
  });

  it('creates stable escalation titles', () => {
    expect(escalationTitle({ workflowName: 'OPS — Snapshot Backup' }))
      .toBe('OPS — Snapshot Backup — failure detected');
  });
});

describe('findOpenIssueByTitle (pagination-safe lookup)', () => {
  it('uses the Search API (not the plain open-issues list) so results are not capped at 100 open issues', async () => {
    const requestImpl = vi.fn().mockResolvedValue({ items: [] });
    await findOpenIssueByTitle({ token: 't', owner: 'o', repo: 'r', title: 'OPS — X', requestImpl });

    expect(requestImpl).toHaveBeenCalledTimes(1);
    const [path] = requestImpl.mock.calls[0];
    expect(path).toMatch(/^\/search\/issues\?/);
    expect(path).not.toMatch(/\/issues\?state=open/);
    const query = new URLSearchParams(path.split('?')[1]).get('q');
    expect(query).toContain('repo:o/r');
    expect(query).toContain('is:issue');
    expect(query).toContain('is:open');
    expect(query).toContain('in:title');
    expect(query).toContain('"OPS — X"');
  });

  it('finds the exact-title match even when the search result set is large or has near-matches', async () => {
    const requestImpl = vi.fn().mockResolvedValue({
      items: [
        { number: 1, title: 'OPS — X (archived)', pull_request: undefined },
        { number: 2, title: 'OPS — X', pull_request: undefined },
        { number: 3, title: 'OPS — X extra', pull_request: undefined },
      ],
    });
    const found = await findOpenIssueByTitle({ token: 't', owner: 'o', repo: 'r', title: 'OPS — X', requestImpl });
    expect(found?.number).toBe(2);
  });

  it('excludes pull requests from the match set', async () => {
    const requestImpl = vi.fn().mockResolvedValue({
      items: [{ number: 5, title: 'OPS — X', pull_request: { url: 'x' } }],
    });
    const found = await findOpenIssueByTitle({ token: 't', owner: 'o', repo: 'r', title: 'OPS — X', requestImpl });
    expect(found).toBeUndefined();
  });

  it('returns undefined when nothing matches', async () => {
    const requestImpl = vi.fn().mockResolvedValue({ items: [] });
    const found = await findOpenIssueByTitle({ token: 't', owner: 'o', repo: 'r', title: 'OPS — X', requestImpl });
    expect(found).toBeUndefined();
  });
});

describe('upsertOpsRuntimeIssue (dedup via injectable findOpen)', () => {
  it('updates the existing issue (body PATCH + comment) when findOpen returns a match', async () => {
    const findOpen = vi.fn().mockResolvedValue({ number: 42, html_url: 'https://x/42' });
    const requestImpl = vi.fn().mockResolvedValue({});
    const result = await upsertOpsRuntimeIssue({
      token: 't',
      owner: 'o',
      repo: 'r',
      title: 'OPS — X',
      body: 'body',
      findOpen,
      requestImpl,
    });
    expect(result.action).toBe('updated');
    expect(result.issue).toBe('https://x/42');
    expect(findOpen).toHaveBeenCalledWith({ token: 't', owner: 'o', repo: 'r', title: 'OPS — X' });
  });

  it('creates a new issue when findOpen finds nothing', async () => {
    const findOpen = vi.fn().mockResolvedValue(undefined);
    const requestImpl = vi.fn().mockResolvedValue({ number: 99, html_url: 'https://x/99' });
    const result = await upsertOpsRuntimeIssue({
      token: 't',
      owner: 'o',
      repo: 'r',
      title: 'OPS — X',
      body: 'body',
      findOpen,
      requestImpl,
    });
    expect(result.action).toBe('created');
    expect(result.issue).toBe('https://x/99');
  });
});
