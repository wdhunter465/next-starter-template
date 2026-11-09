#!/usr/bin/env node
/**
 * social-post-x.mjs (#5157, design #5143)
 *
 * Posts the due, approved posts of the reviewed queue to X through Buffer, once each.
 * Order for each post: check the ledger, create the Buffer post, record the ledger row.
 * A post already 'posted' in the ledger is never sent again. Posts earlier than the queue's
 * automation_starts_at are left to the manual process. Dry run unless APPLY=true.
 *
 * Env: BUFFER_API_KEY, SCHEDULED_CONTENT_BRIDGE_TOKEN (ledger), BASE_URL (default the live site),
 *      BUFFER_CHANNEL_ID (default the X channel GehrigFanClub), APPLY, NOW (ISO, tests only)
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { BufferMcp, findFirst } from './buffer-mcp.mjs';
import { DEFAULT_QUEUE, classifyPosts, validateQueue } from './social-post-queue.mjs';

export const X_CHANNEL_ID = '6ae896c3e29c69a1713866ba';
export const LIVE_BASE_URL = 'https://www.lougehrigfanclub.com';

/** Due posts for X that automation owns: approved, on X, time arrived, inside the window, after the start date. */
export function selectXPosts(queue, now) {
  const start = queue.automation_starts_at ? Date.parse(queue.automation_starts_at) : 0;
  return classifyPosts(queue, now).due.filter((p) => p.platforms.includes('x') && Date.parse(p.publish_at) >= start);
}

export function buildCreatePostArgs(post, channelId, baseUrl) {
  return {
    channelId,
    schedulingType: 'automatic',
    mode: 'shareNow',
    text: post.text,
    assets: [{ image: { url: `${baseUrl}/api/social/image/${post.id}`, metadata: { altText: post.alt_text } } }],
  };
}

async function ledgerRequest(fetchImpl, baseUrl, token, path, init = {}) {
  const res = await fetchImpl(`${baseUrl}/api/social/ledger${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

export async function recordLedger(fetchImpl, baseUrl, token, row, attempts = 3) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    last = await ledgerRequest(fetchImpl, baseUrl, token, '', { method: 'POST', body: JSON.stringify(row) });
    if (last.status === 200 || last.status === 201 || last.status === 409) return last;
  }
  return last;
}

export async function run(env = process.env, deps = {}) {
  const fetchImpl = deps.fetch ?? fetch;
  const queue = deps.queue ?? JSON.parse(readFileSync(DEFAULT_QUEUE, 'utf8'));
  const problems = validateQueue(queue);
  if (problems.length > 0) throw new Error(`queue is invalid: ${problems.join('; ')}`);

  const apply = String(env.APPLY ?? 'false').toLowerCase() === 'true';
  const now = env.NOW ? Date.parse(env.NOW) : Date.now();
  const baseUrl = String(env.BASE_URL ?? LIVE_BASE_URL).replace(/\/$/, '');
  const channelId = String(env.BUFFER_CHANNEL_ID ?? X_CHANNEL_ID);
  const token = String(env.SCHEDULED_CONTENT_BRIDGE_TOKEN ?? '').trim();
  if (!token) throw new Error('SCHEDULED_CONTENT_BRIDGE_TOKEN is required (ledger)');

  const report = { mode: apply ? 'apply' : 'dry-run', considered: [], posted: [], skipped: [], failed: [] };
  const candidates = selectXPosts(queue, now);
  report.considered = candidates.map((p) => p.id);

  let client = null;
  for (const post of candidates) {
    const ledger = await ledgerRequest(fetchImpl, baseUrl, token, `?post_id=${encodeURIComponent(post.id)}`);
    if (ledger.status !== 200) {
      report.failed.push({ id: post.id, step: 'ledger-read', status: ledger.status });
      continue;
    }
    if ((ledger.body.rows ?? []).some((r) => r.platform === 'x' && r.status === 'posted')) {
      report.skipped.push({ id: post.id, reason: 'already posted' });
      continue;
    }
    if (!apply) {
      report.skipped.push({ id: post.id, reason: 'dry run', would_post: buildCreatePostArgs(post, channelId, baseUrl) });
      continue;
    }
    try {
      client ??= deps.client ?? new BufferMcp(String(env.BUFFER_API_KEY ?? '').trim(), fetchImpl);
      if (!deps.client) await client.initialize();
      const result = await client.callTool('create_post', buildCreatePostArgs(post, channelId, baseUrl));
      const platformPostId = String(findFirst(result, 'id') ?? '').slice(0, 200) || null;
      const recorded = await recordLedger(fetchImpl, baseUrl, token, {
        post_id: post.id,
        platform: 'x',
        status: 'posted',
        platform_post_id: platformPostId,
      });
      if (![200, 201, 409].includes(recorded.status)) {
        report.failed.push({ id: post.id, step: 'ledger-write-after-post', status: recorded.status, platform_post_id: platformPostId });
      } else {
        report.posted.push({ id: post.id, platform_post_id: platformPostId });
      }
    } catch (error) {
      const message = String(error?.message ?? error).slice(0, 400);
      await recordLedger(fetchImpl, baseUrl, token, { post_id: post.id, platform: 'x', status: 'failed', error: message });
      report.failed.push({ id: post.id, step: 'buffer', error: message });
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
      console.error(`ERROR: ${String(error?.message ?? error).replaceAll(process.env.BUFFER_API_KEY || '\u0000', '[redacted]')}`);
      process.exit(1);
    });
}
