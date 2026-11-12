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
export const DEFAULT_QUEUE = 'data/social-post-queue.json';
export const DEFAULT_CALENDAR = 'data/social-messaging-calendar.json';

/** Problems with the queue itself (photo lists, footer, lateness). */
export function validateQueueShape(queue) {
  const problems = [];
  if (!queue || typeof queue !== 'object') return ['queue is not an object'];
  if (!Array.isArray(queue.posts)) problems.push('posts must be an array');
  if (!Array.isArray(queue.rights_cleared_photo_ids) || queue.rights_cleared_photo_ids.length === 0) {
    problems.push('rights_cleared_photo_ids must be a non-empty array');
  }
  if (!(Number(queue.lateness_hours) > 0)) problems.push('lateness_hours must be a positive number');
  if (queue.automation_starts_at !== undefined && Number.isNaN(Date.parse(queue.automation_starts_at))) {
    problems.push('automation_starts_at must be an ISO time with an offset');
  }
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

/**
 * Whole-queue problems: shape, each post, duplicate ids, a photo reused too soon, and Instagram
 * posts whose photo is outside Instagram's 4:5 to 1.91:1 limits (instagram_ok_photo_ids, #5173).
 * A photo may repeat (Product Authority, 2026-11-12) but not within photo_reuse_min_gap_days of its
 * last use, so the five cleared photos can rotate.
 */
export function validateQueue(queue) {
  const problems = validateQueueShape(queue);
  if (problems.length > 0 || !Array.isArray(queue.posts)) return problems;
  const ids = new Set();
  const gapDays = Number(queue.photo_reuse_min_gap_days ?? 0);
  const instagramOk = new Set(queue.instagram_ok_photo_ids ?? []);
  const lastUse = new Map();
  const ordered = [...queue.posts].sort((a, b) => Date.parse(a.publish_at) - Date.parse(b.publish_at));
  for (const post of queue.posts) {
    problems.push(...validatePost(post, queue));
    if (ids.has(post.id)) problems.push(`${post.id}: duplicate id`);
    ids.add(post.id);
  }
  for (const post of ordered) {
    const at = Date.parse(post.publish_at);
    const previous = lastUse.get(post.photo_id);
    if (previous !== undefined && (at - previous) / 86_400_000 < gapDays) {
      problems.push(`${post.id}: photo ${post.photo_id} is used again within ${gapDays} days`);
    }
    lastUse.set(post.photo_id, at);
    if (queue.instagram_ok_photo_ids && post.platforms?.includes('instagram') && !instagramOk.has(post.photo_id)) {
      problems.push(`${post.id}: photo ${post.photo_id} is outside Instagram's aspect-ratio limits; leave instagram off this post`);
    }
  }
  return problems;
}

/** The calendar phase for a New York calendar date (YYYY-MM-DD), or null. */
export function phaseForDate(calendar, date) {
  return (calendar?.phases ?? []).find((ph) => date >= ph.from && date <= ph.through) ?? null;
}

/** Messaging problems: each approved post at or after enforce_from must fit its phase (#5173). */
export function validateMessaging(queue, calendar) {
  const problems = [];
  if (!calendar) return problems;
  const from = calendar.enforce_from ?? '0000-00-00';
  for (const post of queue.posts ?? []) {
    if (post.status !== 'approved') continue;
    const date = String(post.publish_at).slice(0, 10);
    if (date < from) continue;
    const phase = phaseForDate(calendar, date);
    if (!phase) {
      problems.push(`${post.id}: no messaging phase covers ${date}`);
      continue;
    }
    for (const needle of phase.must_match ?? []) {
      if (!post.text.toLowerCase().includes(needle.toLowerCase())) problems.push(`${post.id}: phase ${phase.id} needs "${needle}" in the text`);
    }
    for (const needle of phase.must_not_match ?? []) {
      if (post.text.toLowerCase().includes(needle.toLowerCase())) problems.push(`${post.id}: phase ${phase.id} must not mention "${needle}"`);
    }
  }
  return problems;
}

/**
 * Days and slots in [fromDate, throughDate] with no approved post. A missing slot is how the queue
 * runs dry, which is the main way a daily post gets missed.
 */
export function findCoverageGaps(queue, calendar, fromDate, throughDate) {
  const have = new Set(
    (queue.posts ?? []).filter((p) => p.status === 'approved').map((p) => String(p.publish_at).slice(0, 16)),
  );
  const gaps = [];
  for (let t = Date.parse(`${fromDate}T12:00:00Z`); t <= Date.parse(`${throughDate}T12:00:00Z`); t += 86_400_000) {
    const date = new Date(t).toISOString().slice(0, 10);
    const phase = phaseForDate(calendar, date);
    if (!phase) continue;
    for (const slot of phase.slots ?? ['10:00']) {
      if (!have.has(`${date}T${slot}`)) gaps.push(`${date} ${slot}`);
    }
  }
  return gaps;
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
  const calendar = JSON.parse(readFileSync(arg('--calendar') ?? DEFAULT_CALENDAR, 'utf8'));
  const problems = [...validateQueue(queue), ...validateMessaging(queue, calendar)];
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
  const today = new Date(now).toISOString().slice(0, 10);
  const horizon = new Date(now + 14 * 86_400_000).toISOString().slice(0, 10);
  const gaps = findCoverageGaps(queue, calendar, today, horizon);
  console.log(gaps.length ? `Queue gaps in the next 14 days (${gaps.length}): ${gaps.join(', ')}` : 'No queue gaps in the next 14 days.');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) main();
