#!/usr/bin/env node
/**
 * social-post-dispatch.mjs (#5173, supersedes the RSS feed path of #5158)
 *
 * At each post's publish time, hands the post to Zapier for Facebook Page, Instagram and
 * Pinterest by opening one GitHub Issue per platform. A Zap per platform watches for its
 * labelled Issue (GitHub "New Labeled Issue") and posts it through the existing connection.
 * Issue title = the post's image address; Issue body = the post text exactly. Those two are
 * the only fields a Zap maps, so there is nothing to get wrong. X is sent by social-post-x.mjs.
 *
 * Idempotent: the ledger (and a search of existing Issues) stops a second hand-off.
 * Dry run unless APPLY=true.
 *
 * Env: GITHUB_TOKEN, GITHUB_REPOSITORY, SCHEDULED_CONTENT_BRIDGE_TOKEN, BASE_URL, APPLY, NOW (tests)
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { DEFAULT_CALENDAR, DEFAULT_QUEUE, classifyPosts, validateMessaging, validateQueue } from './social-post-queue.mjs';
import { LIVE_BASE_URL, recordLedger } from './social-post-x.mjs';

export const ZAP_PLATFORMS = ['facebook', 'instagram', 'pinterest'];
export const POST_LABEL = 'social-post';

export const platformLabel = (platform) => `social:${platform}`;

export function selectDispatchPosts(queue, now) {
  const start = queue.automation_starts_at ? Date.parse(queue.automation_starts_at) : 0;
  return classifyPosts(queue, now).due.filter((p) => Date.parse(p.publish_at) >= start);
}

export function buildIssue(post, platform, baseUrl) {
  return {
    title: `${baseUrl}/api/social/image/${post.id}`,
    body: post.text,
    labels: [POST_LABEL, platformLabel(platform)],
  };
}

async function gh(fetchImpl, token, repo, path, init = {}) {
  const res = await fetchImpl(`https://api.github.com/repos/${repo}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function ledgerRead(fetchImpl, baseUrl, token, postId) {
  const res = await fetchImpl(`${baseUrl}/api/social/ledger?post_id=${encodeURIComponent(postId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

export async function run(env = process.env, deps = {}) {
  const fetchImpl = deps.fetch ?? fetch;
  const queue = deps.queue ?? JSON.parse(readFileSync(DEFAULT_QUEUE, 'utf8'));
  const calendar = deps.calendar ?? JSON.parse(readFileSync(DEFAULT_CALENDAR, 'utf8'));
  const problems = [...validateQueue(queue), ...validateMessaging(queue, calendar)];
  if (problems.length > 0) throw new Error(`queue is invalid: ${problems.join('; ')}`);

  const apply = String(env.APPLY ?? 'false').toLowerCase() === 'true';
  const now = env.NOW ? Date.parse(env.NOW) : Date.now();
  const baseUrl = String(env.BASE_URL ?? LIVE_BASE_URL).replace(/\/$/, '');
  const ledgerToken = String(env.SCHEDULED_CONTENT_BRIDGE_TOKEN ?? '').trim();
  const ghToken = String(env.GITHUB_TOKEN ?? '').trim();
  const repo = String(env.GITHUB_REPOSITORY ?? '').trim();
  if (!ledgerToken) throw new Error('SCHEDULED_CONTENT_BRIDGE_TOKEN is required (ledger)');
  if (apply && (!ghToken || !repo)) throw new Error('GITHUB_TOKEN and GITHUB_REPOSITORY are required to apply');

  const report = { mode: apply ? 'apply' : 'dry-run', considered: [], dispatched: [], skipped: [], failed: [] };
  const candidates = selectDispatchPosts(queue, now);
  report.considered = candidates.map((p) => p.id);

  for (const post of candidates) {
    const ledger = await ledgerRead(fetchImpl, baseUrl, ledgerToken, post.id);
    if (ledger.status !== 200) {
      report.failed.push({ id: post.id, step: 'ledger-read', status: ledger.status });
      continue;
    }
    const done = new Set((ledger.body.rows ?? []).filter((r) => r.status === 'posted').map((r) => r.platform));
    for (const platform of ZAP_PLATFORMS.filter((pl) => post.platforms.includes(pl))) {
      if (done.has(platform)) {
        report.skipped.push({ id: post.id, platform, reason: 'already handed off' });
        continue;
      }
      const issue = buildIssue(post, platform, baseUrl);
      if (!apply) {
        report.skipped.push({ id: post.id, platform, reason: 'dry run', would_open: issue });
        continue;
      }
      try {
        const found = await gh(
          fetchImpl,
          ghToken,
          repo,
          `/issues?state=all&per_page=100&labels=${POST_LABEL},${platformLabel(platform)}`,
        );
        if (found.status !== 200) throw new Error(`issue search failed (${found.status})`);
        let existing = (found.body ?? []).find((i) => i.title === issue.title);
        if (!existing) {
          const created = await gh(fetchImpl, ghToken, repo, '/issues', { method: 'POST', body: JSON.stringify(issue) });
          if (created.status !== 201) throw new Error(`issue create failed (${created.status})`);
          existing = created.body;
        }
        const recorded = await recordLedger(fetchImpl, baseUrl, ledgerToken, {
          post_id: post.id,
          platform,
          status: 'posted',
          platform_post_id: `issue#${existing.number}`,
        });
        if (![200, 201, 409].includes(recorded.status)) {
          report.failed.push({ id: post.id, platform, step: 'ledger-write', status: recorded.status, issue: existing.number });
        } else {
          report.dispatched.push({ id: post.id, platform, issue: existing.number });
        }
      } catch (error) {
        const message = String(error?.message ?? error).slice(0, 400);
        await recordLedger(fetchImpl, baseUrl, ledgerToken, { post_id: post.id, platform, status: 'failed', error: message });
        report.failed.push({ id: post.id, platform, step: 'github', error: message });
      }
    }
  }

  // Tidy: close hand-off Issues older than 3 days so the repository stays readable.
  if (apply) {
    const open = await gh(fetchImpl, ghToken, repo, `/issues?state=open&per_page=100&labels=${POST_LABEL}`);
    for (const i of open.status === 200 ? open.body : []) {
      if (now - Date.parse(i.created_at) > 3 * 86_400_000) {
        await gh(fetchImpl, ghToken, repo, `/issues/${i.number}`, { method: 'PATCH', body: JSON.stringify({ state: 'closed', state_reason: 'completed' }) });
      }
    }
  }
  return report;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  run()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      if (report.failed.length > 0) process.exit(1);
    })
    .catch((error) => {
      console.error(`ERROR: ${String(error?.message ?? error)}`);
      process.exit(1);
    });
}
