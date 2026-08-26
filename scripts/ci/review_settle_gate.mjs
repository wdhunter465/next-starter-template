#!/usr/bin/env node

/**
 * Review-settle gate (#3746)
 *
 * Closes the late-review merge race where a trusted reviewer/Copilot event
 * arrives just before merge and the enforcing Actions job has not yet completed.
 *
 * Design:
 * - Prefer event-driven re-evaluation (workflow re-runs on review events).
 * - Use a short, evidence-based quiet period only as a bounded fallback after
 *   recent trusted activity on the current head (default 90s, max 120s).
 * - Quiet period resets when newer trusted activity is observed.
 * - Does not replace reviewer_lifecycle_gate disposition enforcement.
 */

export const DEFAULT_SETTLE_MS = 90_000;
export const MAX_SETTLE_MS = 120_000;
export const MIN_SETTLE_MS = 15_000;

function timestamp(value = '') {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

export function clampSettleMs(value = DEFAULT_SETTLE_MS) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_SETTLE_MS;
  return Math.min(MAX_SETTLE_MS, Math.max(MIN_SETTLE_MS, Math.floor(n)));
}

/**
 * Latest trusted review/comment activity timestamp for the current head.
 * @param {{ reviews?: any[], reviewComments?: any[], headSha?: string, isTrusted?: (login: string) => boolean }} input
 */
export function latestTrustedActivityAt({
  reviews = [],
  reviewComments = [],
  headSha = '',
  isTrusted = () => false,
} = {}) {
  let latest = 0;

  for (const review of reviews) {
    const login = review.user?.login || review.author?.login || '';
    if (!isTrusted(login)) continue;
    if (headSha && review.commit_id && review.commit_id !== headSha) continue;
    const t = timestamp(review.submitted_at || review.submittedAt || review.created_at || '');
    if (t > latest) latest = t;
  }

  for (const comment of reviewComments) {
    const login = comment.user?.login || comment.author?.login || '';
    if (!isTrusted(login)) continue;
    if (headSha && comment.commit_id && comment.commit_id !== headSha) continue;
    const t = timestamp(comment.created_at || comment.updated_at || '');
    if (t > latest) latest = t;
  }

  return latest;
}

/**
 * Pure settle decision.
 *
 * @returns {{
 *   ok: boolean,
 *   reason: string,
 *   waitMs: number,
 *   settleMs: number,
 *   latestTrustedAt: number,
 *   now: number,
 *   elapsedSinceTrustedMs: number | null,
 * }}
 */
export function assessReviewSettle({
  now = Date.now(),
  latestTrustedAt = 0,
  settleMs = DEFAULT_SETTLE_MS,
  lifecycleOk = true,
} = {}) {
  const bound = clampSettleMs(settleMs);

  if (!lifecycleOk) {
    return {
      ok: false,
      reason: 'lifecycle-blocking',
      waitMs: 0,
      settleMs: bound,
      latestTrustedAt,
      now,
      elapsedSinceTrustedMs: latestTrustedAt ? now - latestTrustedAt : null,
    };
  }

  if (!latestTrustedAt) {
    return {
      ok: true,
      reason: 'no-trusted-activity',
      waitMs: 0,
      settleMs: bound,
      latestTrustedAt: 0,
      now,
      elapsedSinceTrustedMs: null,
    };
  }

  const elapsed = now - latestTrustedAt;
  if (elapsed >= bound) {
    return {
      ok: true,
      reason: 'quiet-period-complete',
      waitMs: 0,
      settleMs: bound,
      latestTrustedAt,
      now,
      elapsedSinceTrustedMs: elapsed,
    };
  }

  return {
    ok: false,
    reason: 'quiet-period-active',
    waitMs: bound - elapsed,
    settleMs: bound,
    latestTrustedAt,
    now,
    elapsedSinceTrustedMs: elapsed,
  };
}

export function buildSettleReport(decision) {
  const lines = [
    'Review settle gate',
    `reason: ${decision.reason}`,
    `ok: ${decision.ok}`,
    `settleMs: ${decision.settleMs}`,
    `waitMs: ${decision.waitMs}`,
    `latestTrustedAt: ${decision.latestTrustedAt || 'none'}`,
    `elapsedSinceTrustedMs: ${decision.elapsedSinceTrustedMs ?? 'n/a'}`,
  ];
  return lines.join('\n');
}

/**
 * Sleep helper injectable for tests.
 */
export function sleep(ms, sleepFn = (n) => new Promise((r) => setTimeout(r, n))) {
  if (!ms || ms <= 0) return Promise.resolve();
  return sleepFn(ms);
}

/**
 * Run settle with at most one bounded wait + optional reassess callback.
 * Resets wait if reassess reports newer trusted activity still inside the window.
 */
export async function runReviewSettle({
  nowFn = () => Date.now(),
  latestTrustedAt = 0,
  settleMs = DEFAULT_SETTLE_MS,
  lifecycleOk = true,
  reassess = null,
  sleepFn,
  maxRounds = 2,
} = {}) {
  let decision = assessReviewSettle({
    now: nowFn(),
    latestTrustedAt,
    settleMs,
    lifecycleOk,
  });

  let rounds = 0;
  while (!decision.ok && decision.reason === 'quiet-period-active' && rounds < maxRounds) {
    rounds += 1;
    await sleep(decision.waitMs, sleepFn);
    if (typeof reassess === 'function') {
      const next = await reassess();
      decision = assessReviewSettle({
        now: nowFn(),
        latestTrustedAt: next.latestTrustedAt ?? latestTrustedAt,
        settleMs,
        lifecycleOk: next.lifecycleOk ?? lifecycleOk,
      });
    } else {
      decision = assessReviewSettle({
        now: nowFn(),
        latestTrustedAt,
        settleMs,
        lifecycleOk,
      });
    }
  }

  return { ...decision, rounds };
}
