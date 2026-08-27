// #3794 regression: the live Development integration check ran within
// seconds of a push and resolved the *previous* commit's already-built
// Cloudflare Pages deployment instead of waiting for the just-pushed
// commit's own build, so the workflow validated stale code. These tests
// cover the commit-pinning and poll/fail-fast logic added to fix that.

import { describe, expect, it, vi } from 'vitest';

import {
  DeploymentBuildFailedError,
  findDeploymentForCommit,
  pollForPagesDeploymentUrl,
  resolvePagesDeploymentUrl,
  selectLatestSuccessfulDeployment,
} from '../scripts/ci/chatterbox_resolve_preview_url.mjs';

function deployment(overrides: Record<string, unknown>) {
  return {
    id: 'dep-1',
    url: 'https://example.pages.dev',
    created_on: '2026-08-27T00:00:00Z',
    deployment_trigger: { metadata: { branch: 'my-branch', commit_hash: 'sha-old' } },
    latest_stage: { status: 'success' },
    ...overrides,
  };
}

describe('selectLatestSuccessfulDeployment', () => {
  it('falls back to the most recent successful deployment when no commitSha is given', () => {
    const deployments = [
      deployment({ id: 'a', created_on: '2026-08-27T00:00:00Z' }),
      deployment({ id: 'b', created_on: '2026-08-27T00:05:00Z' }),
    ];
    expect(selectLatestSuccessfulDeployment(deployments, 'my-branch')?.id).toBe('b');
  });

  it('requires an exact commit match when commitSha is given, even if a newer other-commit deployment exists', () => {
    const deployments = [
      deployment({ id: 'old-commit', created_on: '2026-08-27T00:00:00Z', deployment_trigger: { metadata: { branch: 'my-branch', commit_hash: 'sha-old' } } }),
      deployment({ id: 'newer-but-different-commit', created_on: '2026-08-27T00:05:00Z', deployment_trigger: { metadata: { branch: 'my-branch', commit_hash: 'sha-unrelated' } } }),
    ];
    expect(selectLatestSuccessfulDeployment(deployments, 'my-branch', 'sha-old')?.id).toBe('old-commit');
  });

  it('returns null when the pinned commit has no successful deployment yet', () => {
    const deployments = [deployment({ deployment_trigger: { metadata: { branch: 'my-branch', commit_hash: 'sha-old' } } })];
    expect(selectLatestSuccessfulDeployment(deployments, 'my-branch', 'sha-new')).toBeNull();
  });
});

describe('findDeploymentForCommit', () => {
  it('finds the deployment for an exact branch+commit pair regardless of status', () => {
    const deployments = [
      deployment({ id: 'building', latest_stage: { status: 'active' }, deployment_trigger: { metadata: { branch: 'my-branch', commit_hash: 'sha-new' } } }),
    ];
    expect(findDeploymentForCommit(deployments, 'my-branch', 'sha-new')?.id).toBe('building');
  });

  it('returns null when no commitSha is given', () => {
    const deployments = [deployment({})];
    expect(findDeploymentForCommit(deployments, 'my-branch', undefined)).toBeNull();
  });
});

describe('resolvePagesDeploymentUrl (commit-pinned)', () => {
  function fetchFnReturning(result: unknown[]) {
    return vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result }),
    });
  }

  it('throws a non-retryable DeploymentBuildFailedError when the pinned commit failed to build', async () => {
    const fetchFn = fetchFnReturning([
      deployment({ latest_stage: { status: 'failure' }, deployment_trigger: { metadata: { branch: 'my-branch', commit_hash: 'sha-new' } } }),
    ]);
    await expect(
      resolvePagesDeploymentUrl({ apiToken: 't', accountId: 'a', projectName: 'p', branch: 'my-branch', commitSha: 'sha-new', fetchFn }),
    ).rejects.toBeInstanceOf(DeploymentBuildFailedError);
  });

  it('throws a plain (retryable) error when the pinned commit has not appeared yet', async () => {
    const fetchFn = fetchFnReturning([
      deployment({ deployment_trigger: { metadata: { branch: 'my-branch', commit_hash: 'sha-old' } } }),
    ]);
    await expect(
      resolvePagesDeploymentUrl({ apiToken: 't', accountId: 'a', projectName: 'p', branch: 'my-branch', commitSha: 'sha-new', fetchFn }),
    ).rejects.not.toBeInstanceOf(DeploymentBuildFailedError);
  });

  it('resolves once the pinned commit succeeds', async () => {
    const fetchFn = fetchFnReturning([
      deployment({ url: 'https://right-commit.pages.dev', deployment_trigger: { metadata: { branch: 'my-branch', commit_hash: 'sha-new' } } }),
    ]);
    await expect(
      resolvePagesDeploymentUrl({ apiToken: 't', accountId: 'a', projectName: 'p', branch: 'my-branch', commitSha: 'sha-new', fetchFn }),
    ).resolves.toBe('https://right-commit.pages.dev');
  });
});

describe('pollForPagesDeploymentUrl', () => {
  it('retries a not-yet-appeared deployment until it succeeds, without sleeping past the first success', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, result: [deployment({ deployment_trigger: { metadata: { branch: 'my-branch', commit_hash: 'sha-old' } } })] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          result: [deployment({ url: 'https://caught-up.pages.dev', deployment_trigger: { metadata: { branch: 'my-branch', commit_hash: 'sha-new' } } })],
        }),
      });
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    const url = await pollForPagesDeploymentUrl(
      { apiToken: 't', accountId: 'a', projectName: 'p', branch: 'my-branch', commitSha: 'sha-new', fetchFn },
      { sleepFn, timeoutMs: 60_000 },
    );

    expect(url).toBe('https://caught-up.pages.dev');
    expect(sleepFn).toHaveBeenCalledTimes(1);
  });

  it('gives up immediately on a build failure instead of retrying until timeout', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        result: [deployment({ latest_stage: { status: 'failure' }, deployment_trigger: { metadata: { branch: 'my-branch', commit_hash: 'sha-new' } } })],
      }),
    });
    const sleepFn = vi.fn().mockResolvedValue(undefined);

    await expect(
      pollForPagesDeploymentUrl(
        { apiToken: 't', accountId: 'a', projectName: 'p', branch: 'my-branch', commitSha: 'sha-new', fetchFn },
        { sleepFn, timeoutMs: 60_000 },
      ),
    ).rejects.toBeInstanceOf(DeploymentBuildFailedError);
    expect(sleepFn).not.toHaveBeenCalled();
  });

  it('stops polling once the deadline passes', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result: [] }),
    });
    let now = 0;
    const sleepFn = vi.fn().mockImplementation(async () => {
      now += 10_000;
    });
    const nowFn = () => now;

    await expect(
      pollForPagesDeploymentUrl(
        { apiToken: 't', accountId: 'a', projectName: 'p', branch: 'my-branch', commitSha: 'sha-new', fetchFn },
        { sleepFn, timeoutMs: 25_000, pollIntervalMs: 10_000, nowFn },
      ),
    ).rejects.toThrow(/no successful Cloudflare Pages deployment found/);
  });
});
