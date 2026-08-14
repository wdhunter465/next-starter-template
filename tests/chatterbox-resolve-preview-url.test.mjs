import { describe, expect, it, vi } from 'vitest';

import {
  resolvePagesDeploymentUrl,
  selectLatestSuccessfulDeployment,
} from '../scripts/ci/chatterbox_resolve_preview_url.mjs';

function deployment(overrides = {}) {
  return {
    url: 'https://example.pages.dev',
    created_on: '2026-08-14T00:00:00Z',
    latest_stage: { status: 'success' },
    deployment_trigger: { metadata: { branch: 'component/chatterbox-prototype' } },
    ...overrides,
  };
}

describe('selectLatestSuccessfulDeployment', () => {
  it('returns null for non-array input', () => {
    expect(selectLatestSuccessfulDeployment(null, 'main')).toBe(null);
    expect(selectLatestSuccessfulDeployment(undefined, 'main')).toBe(null);
  });

  it('filters to the requested branch and success status only', () => {
    const deployments = [
      deployment({ url: 'https://other-branch.pages.dev', deployment_trigger: { metadata: { branch: 'main' } } }),
      deployment({ url: 'https://failed.pages.dev', latest_stage: { status: 'failure' } }),
      deployment({ url: 'https://match.pages.dev' }),
    ];
    const result = selectLatestSuccessfulDeployment(deployments, 'component/chatterbox-prototype');
    expect(result.url).toBe('https://match.pages.dev');
  });

  it('picks the most recently created deployment when multiple match', () => {
    const deployments = [
      deployment({ url: 'https://older.pages.dev', created_on: '2026-08-01T00:00:00Z' }),
      deployment({ url: 'https://newer.pages.dev', created_on: '2026-08-14T00:00:00Z' }),
    ];
    const result = selectLatestSuccessfulDeployment(deployments, 'component/chatterbox-prototype');
    expect(result.url).toBe('https://newer.pages.dev');
  });

  it('returns null when nothing matches the branch', () => {
    const deployments = [deployment({ deployment_trigger: { metadata: { branch: 'main' } } })];
    expect(selectLatestSuccessfulDeployment(deployments, 'component/chatterbox-prototype')).toBe(null);
  });
});

describe('resolvePagesDeploymentUrl', () => {
  it('returns the matched deployment url on success', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result: [deployment()] }),
    });

    const url = await resolvePagesDeploymentUrl({
      apiToken: 't',
      accountId: 'a',
      projectName: 'next-starter-template-6yr',
      branch: 'component/chatterbox-prototype',
      fetchFn,
    });

    expect(url).toBe('https://example.pages.dev');
    const [calledUrl, options] = fetchFn.mock.calls[0];
    expect(calledUrl).toContain('/accounts/a/pages/projects/next-starter-template-6yr/deployments');
    expect(options.headers.Authorization).toBe('Bearer t');
  });

  it('throws when the API call fails', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ success: false, errors: [{ message: 'unauthorized' }] }),
    });

    await expect(
      resolvePagesDeploymentUrl({ apiToken: 't', accountId: 'a', projectName: 'p', branch: 'b', fetchFn }),
    ).rejects.toThrow(/403/);
  });

  it('throws when no successful deployment matches the branch', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result: [] }),
    });

    await expect(
      resolvePagesDeploymentUrl({ apiToken: 't', accountId: 'a', projectName: 'p', branch: 'no-such-branch', fetchFn }),
    ).rejects.toThrow(/no successful Cloudflare Pages deployment/);
  });
});
