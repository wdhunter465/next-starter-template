#!/usr/bin/env node
/**
 * social-post-queue.mjs (#5155, design #5143)
 *
 * Validates the reviewed social post queue and reports which posts are due.
 * Read-only: it never posts, never calls a platform, and needs no secret.
 *
 * Usage: node scripts/ops/social-post-queue.mjs [--now <ISO time>] [--posted <id,id>] [--queue <file>]
 */

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const PLATFORMS = ['x', 'facebook', 'instagram', 'pinterest'];
export const X_LIMIT = 280;
export const DEFAULT_QUEUE = 'docs/reference/operations/social-post-queue.json';

/** Problems with the queue itself (photo lists, footer, lateness). */
export function validateQueueShape(queue) {
  const problems = [];
  if (!queue || typeof queue !== 'object') return ['queue is not an object'];
  if (!Array.isArray(queue.posts)) problems.push('posts must be an array');
  if (!Array.isArray(queue.rights_cleared_photo_ids) || queue.rights_cleared_photo_ids.length === 0) {
    problems.push('rights_cleared_photo_ids must be a non-empty array');
  }
  if (!(Number(queue.lateness_hours) > 0)) problems.push('lateness_hours must be a positive number');
  if (typeof queue.footer_required !== 'string' || !queue.footer_required.trim()) {
    problems.push('footer_required must be set');
  }
  return problems;
}

/** Problems with one post. Pure; returns an array of messages (empty means valid). */
export function validatePost(post, queue) {
  const problems = [];
  const id = post?.id ?? '(no id)';
  const add = (msg) => problems.push(`${id}: ${msg}`);
  if (!post?.id || typeof post.id !== 'string') add('id is required');
  if (!post || Number.isNaN(Date.parse(post.publish_at))) add('publish_at must be an ISO time with an offset');
  else if (!/(Z|[+-]\d{2}:\d{2})$/.test(post.publish_at)) add('publish_at needs a UTC offset');
  if (typeof post?.text !== 'string' || !post.text.trim()) add('text is required');
  else {
    if (post.text.length > X_LIMIT) add(`text is ${post.text.length} characters, over ${X_LIMIT}`);
    if (queue.footer_required && !post.text.endsWith(queue.footer_required)) add('text does not end with the required footer');
  }
  if (typeof post?.alt_text !== 'string' || !post.alt_text.trim()) add('alt_text is required');
  const cleared = new Set(queue.rights_cleared_photo_ids ?? []);
  const held = new Set(queue.held_photo_ids ?? []);
  if (held.has(post?.photo_id)) add(`photo ${post.photo_id} is held`);
  else if (!cleared.has(post?.photo_id)) add(`photo ${post?.photo_id} is not on the rights-cleared list`);
  if (!Array.isArray(post?.platforms) || post.platforms.length === 0) add('platforms is required');
  else for (const p of post.platforms) if (!PLATFORMS.includes(p)) add(`unknown platform ${p}`);
  if (typeof post?.sources !== 'string' || !post.sources.trim()) add('sources is required');
  if (!['approved', 'draft', 'skipped'].includes(post?.status)) add('status must be approved, draft or skipped');
  return problems;
}

/** Whole-queue problems: shape, each post, duplicate ids, a photo used twice. */
export function validateQueue(queue) {
  const problems = validateQueueShape(queue);
  if (problems.length > 0 || !Array.isArray(queue.posts)) return problems;
  const ids = new Set();
  const photos = new Set();
  for (const post of queue.posts) {
    problems.push(...validatePost(post, queue));
    if (ids.has(post.id)) problems.push(`${post.id}: duplicate id`);
    ids.add(post.id);
    if (photos.has(post.photo_id)) problems.push(`${post.id}: photo ${post.photo_id} is used twice`);
    photos.add(post.photo_id);
  }
  return problems;
}

/**
 * Classifies approved posts at `now`:
 * - due: publish_at has arrived and is within lateness_hours
 * - late: past the window, so skipped (never sent a day late)
 * - upcoming: not yet time
 * Posts already recorded as posted are left out.
 */
export function classifyPosts(queue, now, postedIds = []) {
  const posted = new Set(postedIds);
  const windowMs = Number(queue.lateness_hours) * 3_600_000;
  const out = { due: [], late: [], upcoming: [] };
  for (const post of queue.posts) {
    if (post.status !== 'approved' || posted.has(post.id)) continue;
    const at = Date.parse(post.publish_at);
    if (now < at) out.upcoming.push(post);
    else if (now - at <= windowMs) out.due.push(post);
    else out.late.push(post);
  }
  return out;
}

export function formatReport(result, now) {
  const line = (p) => `  - ${p.id} (${p.publish_at}) photo ${p.photo_id} -> ${p.platforms.join(', ')}`;
  const parts = [`Dry run at ${new Date(now).toISOString()} (nothing is posted)`];
  parts.push(`Due now (${result.due.length}):`, ...result.due.map(line));
  parts.push(`Late, would be skipped (${result.late.length}):`, ...result.late.map(line));
  parts.push(`Upcoming (${result.upcoming.length}):`, ...result.upcoming.map(line));
  return parts.join('\n');
}

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
}

export function main() {
  const queue = JSON.parse(readFileSync(arg('--queue') ?? DEFAULT_QUEUE, 'utf8'));
  const problems = validateQueue(queue);
  if (problems.length > 0) {
    console.error(`Queue is invalid (${problems.length}):\n${problems.map((p) => `  - ${p}`).join('\n')}`);
    process.exit(1);
  }
  const now = arg('--now') ? Date.parse(arg('--now')) : Date.now();
  if (Number.isNaN(now)) {
    console.error('--now must be an ISO time');
    process.exit(1);
  }
  const posted = (arg('--posted') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  console.log(formatReport(classifyPosts(queue, now, posted), now));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
