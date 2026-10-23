#!/usr/bin/env node
// #4696: publish the commit this build came from. The file holds the SHA
// and the build time only. A missing SHA is "unknown" and does not fail the build.

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function resolveCommitSha(env = {}, gitSha = '') {
  const fromEnv = String(env.CF_PAGES_COMMIT_SHA || env.GITHUB_SHA || '').trim();
  if (fromEnv) return fromEnv;
  const fromGit = String(gitSha || '').trim();
  if (fromGit) return fromGit;
  return 'unknown';
}

export function readGitSha() {
  try {
    const sha = execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return sha || '';
  } catch {
    return '';
  }
}

export function buildDeployInfo({ sha, builtAt }) {
  const value = String(sha || '').trim();
  return {
    sha: value || 'unknown',
    builtAt: String(builtAt),
  };
}

export function writeDeployInfoFile(filePath, info) {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, `${JSON.stringify(info, null, 2)}\n`);
}

function main() {
  const sha = resolveCommitSha(process.env, readGitSha());
  const info = buildDeployInfo({ sha, builtAt: new Date().toISOString() });
  const outDir = process.env.DEPLOY_INFO_OUT_DIR || path.join(process.cwd(), 'out');
  writeDeployInfoFile(path.join(outDir, 'deploy-info.json'), info);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main();
}
