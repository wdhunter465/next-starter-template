import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildDeployInfo, resolveCommitSha, writeDeployInfoFile } from '../scripts/write-deploy-info.mjs';

describe('deploy-info marker (#4696)', () => {
  it('writes unknown when no commit SHA is available and does not throw', () => {
    expect(resolveCommitSha({}, '')).toBe('unknown');
    const dir = mkdtempSync(path.join(tmpdir(), 'deploy-info-'));
    const filePath = path.join(dir, 'deploy-info.json');
    const info = buildDeployInfo({ sha: resolveCommitSha({}, ''), builtAt: '2026-10-22T00:00:00.000Z' });
    expect(() => writeDeployInfoFile(filePath, info)).not.toThrow();
    expect(JSON.parse(readFileSync(filePath, 'utf8'))).toEqual({
      sha: 'unknown',
      builtAt: '2026-10-22T00:00:00.000Z',
    });
  });

  it('prefers the Pages SHA, then the GitHub SHA, then git', () => {
    expect(resolveCommitSha({ CF_PAGES_COMMIT_SHA: 'pages-sha', GITHUB_SHA: 'github-sha' }, 'git-sha')).toBe('pages-sha');
    expect(resolveCommitSha({ GITHUB_SHA: 'github-sha' }, 'git-sha')).toBe('github-sha');
    expect(resolveCommitSha({}, 'git-sha')).toBe('git-sha');
  });
});
