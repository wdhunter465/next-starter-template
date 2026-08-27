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
//
// Live-fire regression (Development integration check, #3794): a
// push-triggered workflow reaches this script within seconds of the push,
// but a Cloudflare Pages build routinely takes 1-3 minutes. Without a
// commit filter, "most recent successful deployment on this branch"
// silently resolves to the *previous* commit's already-built deployment —
// which still passes the URL's own regex check, so the workflow proceeds
// against stale code and fails (or worse, passes) for the wrong reason.
// When commitSha is supplied, this now requires that exact commit's
// deployment and polls (see pollForPagesDeploymentUrl) until it succeeds,
// fails, or a timeout elapses, instead of ever falling back to an older
// commit's deployment.

import { pathToFileURL } from 'node:url';

export class DeploymentBuildFailedError extends Error {}

/** Pure: pick the most recent successful deployment for `branch` (optionally pinned to `commitSha`) from a Cloudflare deployments list page. */
export function selectLatestSuccessfulDeployment(deployments, branch, commitSha) {
  if (!Array.isArray(deployments)) return null;
  const candidates = deployments.filter(
    (deployment) =>
      deployment?.deployment_trigger?.metadata?.branch === branch &&
      deployment?.latest_stage?.status === 'success' &&
      (!commitSha || deployment?.deployment_trigger?.metadata?.commit_hash === commitSha),
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => new Date(b.created_on).getTime() - new Date(a.created_on).getTime());
  return candidates[0];
}

/** Pure: find the (any-status) deployment for the exact branch+commit pair, so a failed build can be detected without waiting out the full poll timeout. */
export function findDeploymentForCommit(deployments, branch, commitSha) {
  if (!Array.isArray(deployments) || !commitSha) return null;
  return (
    deployments.find(
      (deployment) =>
        deployment?.deployment_trigger?.metadata?.branch === branch &&
        deployment?.deployment_trigger?.metadata?.commit_hash === commitSha,
    ) ?? null
  );
}

export async function resolvePagesDeploymentUrl({
  apiToken,
  accountId,
  projectName,
  branch,
  commitSha,
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

  if (commitSha) {
    const matched = findDeploymentForCommit(json?.result, branch, commitSha);
    if (matched && matched?.latest_stage?.status === 'failure') {
      throw new DeploymentBuildFailedError(
        `Cloudflare Pages build failed for branch "${branch}" at commit ${commitSha} (deployment ${matched.id})`,
      );
    }
  }

  const deployment = selectLatestSuccessfulDeployment(json?.result, branch, commitSha);
  if (!deployment?.url) {
    throw new Error(
      `no successful Cloudflare Pages deployment found for branch "${branch}"${commitSha ? ` at commit ${commitSha}` : ''}`,
    );
  }
  return deployment.url;
}

const DEFAULT_POLL_INTERVAL_MS = 10_000;
const DEFAULT_POLL_TIMEOUT_MS = 5 * 60 * 1000;

/**
 * Retries resolvePagesDeploymentUrl until it resolves, a build failure is
 * detected (non-retryable — a new push is needed, not more waiting), or
 * timeoutMs elapses. Only meaningful when `options.commitSha` is set; with
 * no commitSha the first call either resolves or throws immediately, same
 * as before this existed.
 */
export async function pollForPagesDeploymentUrl(
  options,
  {
    pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
    timeoutMs = DEFAULT_POLL_TIMEOUT_MS,
    sleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    nowFn = () => Date.now(),
  } = {},
) {
  const deadline = nowFn() + timeoutMs;
  for (;;) {
    try {
      return await resolvePagesDeploymentUrl(options);
    } catch (error) {
      if (error instanceof DeploymentBuildFailedError || nowFn() >= deadline) throw error;
      await sleepFn(pollIntervalMs);
    }
  }
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
  const commitSha = readEnv('CHATTERBOX_TARGET_COMMIT_SHA', { required: false }) || undefined;

  if (!apiToken || !accountId || !branch) return null;

  const url = await pollForPagesDeploymentUrl({ apiToken, accountId, projectName, branch, commitSha });
  console.log(url);
  return url;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`FAIL-CLOSED: ${error.message}`);
    process.exitCode = 1;
  });
}
