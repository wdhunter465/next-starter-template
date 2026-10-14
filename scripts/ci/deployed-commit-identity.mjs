#!/usr/bin/env node
// #4466 row 10: the latest successful Production deployment must be the merged
// candidate. A deployment still in progress for that commit is not a failure.
// Read-only against the Cloudflare Pages deployments API.

import { pathToFileURL } from 'node:url';
import {
  findDeploymentForCommit,
  selectLatestSuccessfulDeployment,
} from './chatterbox_resolve_preview_url.mjs';

const PENDING_STATUSES = new Set(['active', 'queued', 'idle']);

export function assessDeployedCommit({ deployments, branch, candidateSha }) {
  if (!candidateSha) {
    return { ok: false, pending: false, reason: 'missing candidate sha', deployedSha: null };
  }
  const matched = findDeploymentForCommit(deployments, branch, candidateSha);
  const matchedStatus = matched?.latest_stage?.status || null;
  if (matchedStatus === 'failure' || matchedStatus === 'canceled') {
    return { ok: false, pending: false, reason: 'candidate deployment failed', deployedSha: candidateSha };
  }
  if (matched && matchedStatus !== 'success' && PENDING_STATUSES.has(matchedStatus)) {
    return { ok: true, pending: true, reason: 'candidate deployment in progress', deployedSha: null };
  }
  const latest = selectLatestSuccessfulDeployment(deployments, branch);
  const deployedSha = latest?.deployment_trigger?.metadata?.commit_hash || null;
  if (!latest) {
    return { ok: false, pending: false, reason: 'no successful deployment', deployedSha: null };
  }
  if (deployedSha !== candidateSha) {
    return { ok: false, pending: false, reason: 'deployed commit differs from candidate', deployedSha };
  }
  return { ok: true, pending: false, reason: 'deployed commit matches candidate', deployedSha };
}

export async function fetchDeployments({ accountId, projectName, apiToken, fetchImpl = fetch }) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments?per_page=25`;
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${apiToken}`, Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Cloudflare deployments request failed (${response.status})`);
  }
  const body = await response.json();
  return Array.isArray(body?.result) ? body.result : [];
}

export async function runIdentityCheck(env = process.env, fetchImpl = fetch) {
  const apiToken = env.CLOUDFLARE_API_TOKEN || '';
  const accountId = env.CLOUDFLARE_ACCOUNT_ID || '';
  const projectName = env.CLOUDFLARE_PAGES_PROJECT || env.CF_PAGES_PROJECT || 'next-starter-template';
  const candidateSha = env.GITHUB_SHA || '';
  const branch = env.DEPLOY_BRANCH || 'main';
  if (!apiToken || !accountId) {
    throw new Error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required');
  }
  const deployments = await fetchDeployments({ accountId, projectName, apiToken, fetchImpl });
  return assessDeployedCommit({ deployments, branch, candidateSha });
}

async function main() {
  const result = await runIdentityCheck();
  console.log(JSON.stringify(result));
  if (!result.ok) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
