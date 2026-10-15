import { describe, expect, it } from 'vitest';
import { assessDeployedCommit, runIdentityCheck } from '../scripts/ci/deployed-commit-identity.mjs';

function deployment({ id, status, sha, branch = 'main' }) {
  return {
    id,
    created_on: '2026-10-14T00:00:00Z',
    latest_stage: { status },
    deployment_trigger: { metadata: { branch, commit_hash: sha } },
  };
}

describe('assessDeployedCommit', () => {
  it('passes when the latest successful Production deployment is the candidate', () => {
    const result = assessDeployedCommit({
      branch: 'main',
      candidateSha: 'sha-new',
      deployments: [deployment({ id: 'live', status: 'success', sha: 'sha-new' })],
    });
    expect(result).toMatchObject({ ok: true, pending: false, deployedSha: 'sha-new' });
  });

  it('fails when Production is still serving a different commit', () => {
    const result = assessDeployedCommit({
      branch: 'main',
      candidateSha: 'sha-new',
      deployments: [deployment({ id: 'old', status: 'success', sha: 'sha-old' })],
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('deployed commit differs from candidate');
    expect(result.deployedSha).toBe('sha-old');
  });

  it('does not fail while the candidate deployment is still in progress', () => {
    const result = assessDeployedCommit({
      branch: 'main',
      candidateSha: 'sha-new',
      deployments: [
        deployment({ id: 'old', status: 'success', sha: 'sha-old' }),
        deployment({ id: 'building', status: 'active', sha: 'sha-new' }),
      ],
    });
    expect(result).toMatchObject({ ok: true, pending: true });
  });

  it('fails when the candidate deployment itself failed', () => {
    const result = assessDeployedCommit({
      branch: 'main',
      candidateSha: 'sha-new',
      deployments: [
        deployment({ id: 'old', status: 'success', sha: 'sha-old' }),
        deployment({ id: 'bad', status: 'failure', sha: 'sha-new' }),
      ],
    });
    expect(result).toMatchObject({ ok: false, reason: 'candidate deployment failed', deployedSha: 'sha-new' });
  });

  it('fails when there is no successful deployment', () => {
    expect(assessDeployedCommit({ branch: 'main', candidateSha: 'sha-new', deployments: [] })).toMatchObject({
      ok: false,
      reason: 'no successful deployment',
    });
  });
});

describe('runIdentityCheck', () => {
  it('fails closed when the recorded API shows a different deployed commit', async () => {
    const result = await runIdentityCheck(
      {
        CLOUDFLARE_API_TOKEN: 'token',
        CLOUDFLARE_ACCOUNT_ID: 'account',
        CLOUDFLARE_PAGES_PROJECT: 'next-starter-template',
        GITHUB_SHA: 'sha-new',
        DEPLOY_BRANCH: 'main',
      },
      async () => ({
        ok: true,
        json: async () => ({
          result: [deployment({ id: 'old', status: 'success', sha: 'sha-old' })],
        }),
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.deployedSha).toBe('sha-old');
  });
});
