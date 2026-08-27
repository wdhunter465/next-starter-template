#!/usr/bin/env node
// #3794 (Chatterbox self-hosted room-actor design) — resolve the live
// Cloudflare Pages deployment URL for a given branch via the Cloudflare
// API, using the same CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID secrets
// already used by the existing D1 write tooling. Read-only: lists
// deployments, never creates or mutates one. Ported unchanged from the
// #3415 prototype (component/chatterbox-prototype) — branch-agnostic by
// design.
//
// Deliberately does not guess a pages.dev hostname from the branch name —
// Cloudflare's branch-alias sanitization/truncation rules are not worth
// hardcoding and re-deriving here when the real API already returns the
// exact URL for the most recent successful deployment on a branch.

import { pathToFileURL } from 'node:url';

/** Pure: pick the most recent successful deployment for `branch` from a Cloudflare deployments list page. */
export function selectLatestSuccessfulDeployment(deployments, branch) {
  if (!Array.isArray(deployments)) return null;
  const candidates = deployments.filter(
    (deployment) =>
      deployment?.deployment_trigger?.metadata?.branch === branch &&
      deployment?.latest_stage?.status === 'success',
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => new Date(b.created_on).getTime() - new Date(a.created_on).getTime());
  return candidates[0];
}

export async function resolvePagesDeploymentUrl({
  apiToken,
  accountId,
  projectName,
  branch,
  fetchFn = fetch,
}) {
  const response = await fetchFn(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments?per_page=25`,
    {
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
    },
  );
  const json = await response.json().catch(() => ({}));
  if (!response.ok || json?.success === false) {
    throw new Error(`Cloudflare Pages deployments request failed: ${response.status} ${JSON.stringify(json?.errors ?? json)}`);
  }

  const deployment = selectLatestSuccessfulDeployment(json?.result, branch);
  if (!deployment?.url) {
    throw new Error(`no successful Cloudflare Pages deployment found for branch "${branch}"`);
  }
  return deployment.url;
}

function readEnv(name, { required = true } = {}) {
  const value = process.env[name];
  if (!value && required) {
    console.error(`FAIL-CLOSED: missing required env var ${name}`);
    process.exitCode = 1;
    return null;
  }
  return value || '';
}

export async function main() {
  const apiToken = readEnv('CLOUDFLARE_API_TOKEN');
  const accountId = readEnv('CLOUDFLARE_ACCOUNT_ID');
  // The Cloudflare Pages *project name* (this API's path parameter) is
  // "next-starter-template" — the "-6yr" suffix only appears in the public
  // pages.dev subdomain (docs/reference/platform/CLOUDFLARE.md), a distinct
  // value from the project name. Defaulting to the subdomain here 404s.
  const projectName = readEnv('CLOUDFLARE_PAGES_PROJECT', { required: false }) || 'next-starter-template';
  const branch = readEnv('CHATTERBOX_TARGET_BRANCH');

  if (!apiToken || !accountId || !branch) return null;

  const url = await resolvePagesDeploymentUrl({ apiToken, accountId, projectName, branch });
  console.log(url);
  return url;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`FAIL-CLOSED: ${error.message}`);
    process.exitCode = 1;
  });
}
