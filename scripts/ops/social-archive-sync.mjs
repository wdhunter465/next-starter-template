/**
 * social-archive-sync.mjs (#5097)
 *
 * Asks the site to save each published daily social post into the archive (POST /api/social/archive, which builds
 * the row itself from the reviewed queue and the send ledger). Run after the posting step; idempotent, so a rerun
 * or a catch-up changes nothing a person has decided. A failure here must never block or repeat a post: the
 * workflow step that runs it is marked continue-on-error, and this script only reads the queue file and calls the
 * archive endpoint.
 *
 * Usage:
 *   SCHEDULED_CONTENT_BRIDGE_TOKEN=... [BASE_URL=https://www.lougehrigfanclub.com] \
 *   node scripts/ops/social-archive-sync.mjs [--days 3 | --all] [--dry-run]
 * Default: posts published in the last 3 days. --all is the back-fill (every published post in the queue).
 * Exit code: 0 when every call succeeded or the post was simply not sent yet; 1 when a call failed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const DEFAULT_BASE_URL = 'https://www.lougehrigfanclub.com';
export const DEFAULT_DAYS = 3;
const DAY = 86_400_000;

export function parseArgs(argv) {
  const options = { days: DEFAULT_DAYS, all: false, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--all') options.all = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--days') options.days = Number(argv[++i]);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isFinite(options.days) || options.days <= 0) throw new Error('--days must be a positive number');
  return options;
}

/** Approved posts whose publish time has arrived, newest window first, oldest to newest in the list. */
export function postsToArchive(posts, { now = Date.now(), days = DEFAULT_DAYS, all = false } = {}) {
  return (posts ?? [])
    .filter((post) => post?.status === 'approved' && Date.parse(post.publish_at) <= now)
    .filter((post) => all || now - Date.parse(post.publish_at) <= days * DAY)
    .sort((a, b) => Date.parse(a.publish_at) - Date.parse(b.publish_at));
}

/**
 * Calls the archive endpoint once per post. 409 means the post is not published or not recorded as sent yet:
 * not a failure, and not retried here. Any other non-200, or a network error, is a failure.
 */
export async function syncArchive({ posts, baseUrl, token, fetchImpl = fetch, dryRun = false }) {
  const report = { archived: [], skipped: [], failed: [] };
  for (const post of posts) {
    if (dryRun) {
      report.skipped.push({ id: post.id, reason: 'dry_run' });
      continue;
    }
    try {
      const res = await fetchImpl(`${baseUrl}/api/social/archive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_id: post.id }),
        signal: AbortSignal.timeout(20_000),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 200 && data.ok) report.archived.push({ id: post.id, content_item_id: data.content_item_id, sent_platforms: data.sent_platforms });
      else if (res.status === 409) report.skipped.push({ id: post.id, reason: data.error ?? 'not sent yet' });
      else report.failed.push({ id: post.id, status: res.status, error: data.error ?? 'unexpected response' });
    } catch (error) {
      report.failed.push({ id: post.id, status: 0, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return report;
}

export function renderReport(report) {
  return [
    `Archived: ${report.archived.length}. Skipped: ${report.skipped.length}. Failed: ${report.failed.length}.`,
    ...report.archived.map((a) => `- ${a.id}: content_items row ${a.content_item_id} (sent: ${(a.sent_platforms ?? []).join(', ')})`),
    ...report.skipped.map((s) => `- ${s.id}: skipped (${s.reason})`),
    ...report.failed.map((f) => `- ${f.id}: FAILED (${f.status}) ${f.error}`),
  ].join('\n');
}

export async function main(env = process.env, argv = process.argv.slice(2), fetchImpl = fetch) {
  const options = parseArgs(argv);
  const token = env.SCHEDULED_CONTENT_BRIDGE_TOKEN;
  if (!token && !options.dryRun) throw new Error('SCHEDULED_CONTENT_BRIDGE_TOKEN is required');
  const queuePath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../data/social-post-queue.json');
  const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
  const posts = postsToArchive(queue.posts, { days: options.days, all: options.all });
  const report = await syncArchive({
    posts,
    baseUrl: env.BASE_URL || DEFAULT_BASE_URL,
    token,
    fetchImpl,
    dryRun: options.dryRun,
  });
  console.log(renderReport(report));
  return report.failed.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main()
    .then((code) => process.exit(code))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
