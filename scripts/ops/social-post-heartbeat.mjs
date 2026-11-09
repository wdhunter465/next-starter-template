#!/usr/bin/env node
/**
 * social-post-heartbeat.mjs (#5159, design #5143)
 *
 * Runs after the posting window. For each approved queue post dated today (New York time) that
 * automation owns, it checks what this repository can see:
 *   - X: the ledger holds a 'posted' row
 *   - the post is in the public feed, and its image address returns an image
 * The Zapier Zaps for Facebook, Instagram and Pinterest cannot be read from here, so for those the
 * check proves the feed item and the image the Zaps depend on, and says so in its report.
 * Any problem exits 1 so the workflow opens one Operations Issue.
 *
 * Env: SCHEDULED_CONTENT_BRIDGE_TOKEN, BASE_URL (default the live site), NOW (ISO, tests only),
 *      HEARTBEAT_AFTER_HOUR (New York hour, default 12)
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { DEFAULT_QUEUE, validateQueue } from './social-post-queue.mjs';

const LIVE_BASE_URL = 'https://www.lougehrigfanclub.com';

/** Calendar date and hour of an instant in America/New_York. */
export function newYorkParts(ms) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date(ms));
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) % 24 };
}

/** Posts that automation owns and that are dated today in New York. */
export function postsDueToday(queue, now) {
  const start = queue.automation_starts_at ? Date.parse(queue.automation_starts_at) : 0;
  const today = newYorkParts(now).date;
  return queue.posts.filter(
    (p) => p.status === 'approved' && Date.parse(p.publish_at) >= start && newYorkParts(Date.parse(p.publish_at)).date === today,
  );
}

/**
 * Problems found for one day. Pure: takes what was fetched.
 * facts[post.id] = { ledgerRows, inFeed, imageOk }
 */
export function evaluateHeartbeat(posts, facts) {
  const problems = [];
  for (const post of posts) {
    const f = facts[post.id] ?? {};
    if (post.platforms.includes('x') && !(f.ledgerRows ?? []).some((r) => r.platform === 'x' && r.status === 'posted')) {
      const failed = (f.ledgerRows ?? []).find((r) => r.platform === 'x' && r.status === 'failed');
      problems.push(`${post.id}: X has no posted ledger row${failed ? ` (last attempt failed: ${failed.error ?? 'no detail'})` : ''}`);
    }
    if (post.platforms.some((p) => p !== 'x')) {
      if (!f.inFeed) problems.push(`${post.id}: not in the public feed, so the Facebook, Instagram and Pinterest Zaps have nothing to post`);
      if (!f.imageOk) problems.push(`${post.id}: the image address did not return an image, so the Zaps cannot attach the photo`);
    }
  }
  return problems;
}

export async function run(env = process.env, deps = {}) {
  const fetchImpl = deps.fetch ?? fetch;
  const queue = deps.queue ?? JSON.parse(readFileSync(DEFAULT_QUEUE, 'utf8'));
  const issues = validateQueue(queue);
  if (issues.length > 0) throw new Error(`queue is invalid: ${issues.join('; ')}`);

  const now = env.NOW ? Date.parse(env.NOW) : Date.now();
  const afterHour = Number(env.HEARTBEAT_AFTER_HOUR ?? 12);
  const ny = newYorkParts(now);
  const report = { date: ny.date, new_york_hour: ny.hour, checked: [], problems: [], note: '' };
  if (ny.hour < afterHour) {
    report.note = `before ${afterHour}:00 New York; nothing checked`;
    return report;
  }

  const baseUrl = String(env.BASE_URL ?? LIVE_BASE_URL).replace(/\/$/, '');
  const token = String(env.SCHEDULED_CONTENT_BRIDGE_TOKEN ?? '').trim();
  if (!token) throw new Error('SCHEDULED_CONTENT_BRIDGE_TOKEN is required (ledger)');
  const posts = postsDueToday(queue, now);
  if (posts.length === 0) {
    report.note = 'no automated post is dated today';
    return report;
  }

  const feed = await (await fetchImpl(`${baseUrl}/api/social/feed`)).text();
  const facts = {};
  for (const post of posts) {
    const ledgerRes = await fetchImpl(`${baseUrl}/api/social/ledger?post_id=${encodeURIComponent(post.id)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const ledger = ledgerRes.ok ? await ledgerRes.json() : { rows: [] };
    const image = await fetchImpl(`${baseUrl}/api/social/image/${post.id}`);
    facts[post.id] = {
      ledgerRows: ledger.rows ?? [],
      inFeed: feed.includes(`<guid isPermaLink="false">${post.id}</guid>`),
      imageOk: image.ok && (image.headers.get('content-type') ?? '').startsWith('image/'),
    };
    if (!ledgerRes.ok) facts[post.id].ledgerError = ledgerRes.status;
    await image.body?.cancel?.();
    report.checked.push(post.id);
  }
  report.problems = evaluateHeartbeat(posts, facts);
  for (const post of posts) {
    if (facts[post.id].ledgerError) report.problems.push(`${post.id}: the ledger could not be read (HTTP ${facts[post.id].ledgerError})`);
  }
  report.note = 'Facebook, Instagram and Pinterest delivery by Zapier cannot be read from here; check the Zaps in Zapier if a platform shows no post.';
  return report;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  run()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      if (report.problems.length > 0) {
        console.error(`Heartbeat found ${report.problems.length} problem(s):\n${report.problems.map((p) => `- ${p}`).join('\n')}`);
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error(`ERROR: ${String(error?.message ?? error)}`);
      process.exit(1);
    });
}
