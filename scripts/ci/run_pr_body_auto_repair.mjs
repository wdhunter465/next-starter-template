#!/usr/bin/env node

import fs from 'node:fs';
import {
  canAutoRepairPullRequest,
  repairPullRequestBody,
  CURSOR_AGENT_PR_BODY_BEGIN,
} from './pr_body_auto_repair.mjs';

async function request(path, token, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'lgfc-pr-body-auto-repair',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${options.method || 'GET'} ${path} failed: ${response.status} ${text}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

async function paginate(path, token) {
  const results = [];
  let page = 1;

  while (true) {
    const separator = path.includes('?') ? '&' : '?';
    const data = await request(`${path}${separator}per_page=100&page=${page}`, token);
    if (!Array.isArray(data) || data.length === 0) break;
    results.push(...data);
    if (data.length < 100) break;
    page += 1;
  }

  return results;
}

export async function runPrBodyAutoRepair({
  token,
  owner,
  repo,
  prNumber,
  eventName = '',
  dryRun = false,
} = {}) {
  if (!token || !owner || !repo || !prNumber) {
    throw new Error('token, owner, repo, and prNumber are required.');
  }

  const pull = await request(`/repos/${owner}/${repo}/pulls/${prNumber}`, token);
  if (!canAutoRepairPullRequest({ pull, eventName, body: pull.body || '' })) {
    return {
      changed: false,
      skipped: true,
      report: pull.body?.includes(CURSOR_AGENT_PR_BODY_BEGIN)
        ? 'PR body auto-repair skipped: maintainer PR body marker present.'
        : 'PR body auto-repair skipped: PR is not an open trusted same-repository pull request.',
    };
  }

  const sha = pull.head?.sha || '';
  const [files, issueComments, reviewComments, reviews, combinedStatus] = await Promise.all([
    paginate(`/repos/${owner}/${repo}/pulls/${prNumber}/files`, token),
    paginate(`/repos/${owner}/${repo}/issues/${prNumber}/comments`, token),
    paginate(`/repos/${owner}/${repo}/pulls/${prNumber}/comments`, token),
    paginate(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, token),
    sha
      ? request(`/repos/${owner}/${repo}/commits/${sha}/status`, token).catch(() => ({ state: '' }))
      : Promise.resolve({ state: '' }),
  ]);

  const result = repairPullRequestBody({
    body: pull.body || '',
    pull,
    files,
    issueComments,
    reviewComments,
    reviews,
    headSha: sha,
    liveState: {
      mergeable: pull.mergeable,
      mergeableState: pull.mergeable_state,
      combinedState: combinedStatus?.state || '',
      labels: pull.labels || [],
    },
  });

  if (result.changed && !dryRun) {
    await request(`/repos/${owner}/${repo}/pulls/${prNumber}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ body: result.body }),
    });
  }

  return {
    ...result,
    skipped: false,
    dryRun,
  };
}

async function main() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const prNumber = process.env.PR_NUMBER;
  const eventName = process.env.GITHUB_EVENT_NAME || '';
  const dryRun = process.env.PR_BODY_AUTO_REPAIR_DRY_RUN === 'true';

  if (!token || !repository || !prNumber) {
    throw new Error('GITHUB_TOKEN/GH_TOKEN, GITHUB_REPOSITORY, and PR_NUMBER are required.');
  }

  const [owner, repo] = repository.split('/');
  const result = await runPrBodyAutoRepair({
    token,
    owner,
    repo,
    prNumber,
    eventName,
    dryRun,
  });

  const report = [
    result.report,
    `Skipped: ${result.skipped ? 'yes' : 'no'}`,
    `Dry run: ${result.dryRun ? 'yes' : 'no'}`,
  ].join('\n');

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    fs.appendFileSync(summaryPath, `\n### PR body auto-repair\n\n${report}\n`);
  }

  console.log(report);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
