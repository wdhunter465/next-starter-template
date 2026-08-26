#!/usr/bin/env node

/**
 * CI entrypoint for review-settle (#3746).
 * Runs only on enforcing events after the lifecycle gate has passed.
 * Waits a bounded quiet period after the latest trusted activity on the
 * current head, then re-checks once. New trusted activity resets the window.
 */

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import {
  DEFAULT_SETTLE_MS,
  buildSettleReport,
  latestTrustedActivityAt,
  runReviewSettle,
} from './review_settle_gate.mjs';
import {
  isTrustedReviewer,
  parseTrustedBotLogins,
  trustedBotSet,
} from './reviewer_trusted_bots.mjs';
import {
  githubApiFetch,
  formatAttemptEvidence,
} from './github_api_retry.mjs';

async function request(path, token) {
  const { response, bodyText, attemptLog } = await githubApiFetch({
    url: `https://api.github.com${path}`,
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'lgfc-review-settle',
    },
    pathLabel: path,
  });
  if (attemptLog.length) {
    console.warn(`GitHub API retry evidence:\n${formatAttemptEvidence(attemptLog)}`);
  }
  if (!response.ok) {
    throw new Error(`GET ${path} failed: ${response.status} ${bodyText || ''}`);
  }
  if (response.status === 204) return null;
  // githubApiFetch returns bodyText=null on HTTP success; read the Response body.
  return bodyText ? JSON.parse(bodyText) : response.json();
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

/**
 * Fail closed when lifecycle artifact is missing or unreadable.
 * This step runs only after the lifecycle gate, so unknown status must not pass.
 */
export function lifecycleStillOk(resultPath = '') {
  if (!resultPath || !fs.existsSync(resultPath)) return false;
  try {
    const artifact = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
    return Boolean(artifact.ok);
  } catch {
    return false;
  }
}

async function loadTrustedActivity({ token, owner, repo, prNumber, trustedBots }) {
  const pull = await request(`/repos/${owner}/${repo}/pulls/${prNumber}`, token);
  const headSha = pull?.head?.sha || '';
  const [reviews, reviewComments] = await Promise.all([
    paginate(`/repos/${owner}/${repo}/pulls/${prNumber}/reviews`, token),
    paginate(`/repos/${owner}/${repo}/pulls/${prNumber}/comments`, token),
  ]);
  const latestTrustedAt = latestTrustedActivityAt({
    reviews,
    reviewComments,
    headSha,
    isTrusted: (login) => isTrustedReviewer(login, trustedBots),
  });
  return { headSha, latestTrustedAt, reviews, reviewComments };
}

async function main() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY || '';
  const prNumber = process.env.PR_NUMBER;
  const settleMs = Number(process.env.REVIEW_SETTLE_MS || DEFAULT_SETTLE_MS);
  const resultPath = process.env.REVIEWER_LIFECYCLE_RESULT_JSON || '';
  const trustedBots = trustedBotSet(parseTrustedBotLogins(process.env.TRUSTED_BOT_LOGINS || ''));

  if (!token || !repository || !prNumber) {
    throw new Error('GITHUB_TOKEN, GITHUB_REPOSITORY, and PR_NUMBER are required.');
  }

  const [owner, repo] = repository.split('/');
  const lifecycleOk = lifecycleStillOk(resultPath);
  if (!lifecycleOk) {
    console.error('Review settle skipped: lifecycle gate is not ok (missing/unreadable artifact or ok=false).');
    process.exitCode = 1;
    return;
  }

  const initial = await loadTrustedActivity({ token, owner, repo, prNumber, trustedBots });
  const decision = await runReviewSettle({
    latestTrustedAt: initial.latestTrustedAt,
    settleMs,
    lifecycleOk: true,
    reassess: async () => {
      const next = await loadTrustedActivity({ token, owner, repo, prNumber, trustedBots });
      return {
        latestTrustedAt: next.latestTrustedAt,
        lifecycleOk: lifecycleStillOk(resultPath),
      };
    },
  });

  const report = buildSettleReport(decision);
  console.log(report);

  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    fs.appendFileSync(summaryPath, `\n### Review settle\n\n\`\`\`\n${report}\n\`\`\`\n`);
  }

  if (!decision.ok) {
    console.error(`Review settle gate failed: ${decision.reason}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { loadTrustedActivity };
