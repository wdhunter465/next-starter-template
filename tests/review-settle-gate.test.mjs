import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTLE_MS,
  MAX_SETTLE_MS,
  MIN_SETTLE_MS,
  assessReviewSettle,
  clampSettleMs,
  latestTrustedActivityAt,
  runReviewSettle,
} from '../scripts/ci/review_settle_gate.mjs';

describe('review settle gate (#3746)', () => {
  it('clamps settle bounds', () => {
    expect(clampSettleMs(5_000)).toBe(MIN_SETTLE_MS);
    expect(clampSettleMs(90_000)).toBe(90_000);
    expect(clampSettleMs(999_999)).toBe(MAX_SETTLE_MS);
    expect(clampSettleMs('bad')).toBe(DEFAULT_SETTLE_MS);
  });

  it('passes immediately with no trusted activity', () => {
    const decision = assessReviewSettle({
      now: 1_000_000,
      latestTrustedAt: 0,
      settleMs: 90_000,
      lifecycleOk: true,
    });
    expect(decision.ok).toBe(true);
    expect(decision.reason).toBe('no-trusted-activity');
    expect(decision.waitMs).toBe(0);
  });

  it('passes when quiet period already elapsed', () => {
    const now = 1_000_000;
    const decision = assessReviewSettle({
      now,
      latestTrustedAt: now - 91_000,
      settleMs: 90_000,
      lifecycleOk: true,
    });
    expect(decision.ok).toBe(true);
    expect(decision.reason).toBe('quiet-period-complete');
  });

  it('blocks while quiet period is active (late review before merge)', () => {
    const now = 1_000_000;
    const decision = assessReviewSettle({
      now,
      latestTrustedAt: now - 10_000,
      settleMs: 90_000,
      lifecycleOk: true,
    });
    expect(decision.ok).toBe(false);
    expect(decision.reason).toBe('quiet-period-active');
    expect(decision.waitMs).toBe(80_000);
  });

  it('clamps negative elapsed under clock skew so waitMs stays within bound', () => {
    const now = 1_000_000;
    const decision = assessReviewSettle({
      now,
      // Trusted activity appears 5s in the future relative to runner clock.
      latestTrustedAt: now + 5_000,
      settleMs: 90_000,
      lifecycleOk: true,
    });
    expect(decision.ok).toBe(false);
    expect(decision.reason).toBe('quiet-period-active');
    expect(decision.waitMs).toBe(90_000);
    expect(decision.elapsedSinceTrustedMs).toBe(0);
  });

  it('fails closed when lifecycle is blocking', () => {
    const decision = assessReviewSettle({
      now: 1_000_000,
      latestTrustedAt: 0,
      lifecycleOk: false,
    });
    expect(decision.ok).toBe(false);
    expect(decision.reason).toBe('lifecycle-blocking');
  });

  it('computes latest trusted activity for current head only', () => {
    const isTrusted = (login) => login === 'copilot-pull-request-reviewer[bot]';
    const latest = latestTrustedActivityAt({
      headSha: 'head-sha',
      isTrusted,
      reviews: [
        {
          user: { login: 'copilot-pull-request-reviewer[bot]' },
          commit_id: 'old-sha',
          submitted_at: '2026-08-25T20:50:00Z',
        },
        {
          user: { login: 'copilot-pull-request-reviewer[bot]' },
          commit_id: 'head-sha',
          submitted_at: '2026-08-25T20:58:28Z',
        },
        {
          user: { login: 'human-reviewer' },
          commit_id: 'head-sha',
          submitted_at: '2026-08-25T21:00:00Z',
        },
      ],
      reviewComments: [
        {
          user: { login: 'copilot-pull-request-reviewer[bot]' },
          commit_id: 'head-sha',
          created_at: '2026-08-25T20:58:27Z',
        },
      ],
    });
    expect(latest).toBe(Date.parse('2026-08-25T20:58:28Z'));
  });

  it('resets settle window when reassess reports newer trusted activity', async () => {
    let now = 1_000_000;
    let trustedAt = now - 10_000;
    const sleeps = [];

    const result = await runReviewSettle({
      nowFn: () => now,
      latestTrustedAt: trustedAt,
      settleMs: 30_000,
      lifecycleOk: true,
      sleepFn: async (ms) => {
        sleeps.push(ms);
        now += ms;
      },
      reassess: async () => {
        // Simulate a new trusted review arriving during the wait.
        if (sleeps.length === 1) {
          trustedAt = now - 1_000;
        }
        return { latestTrustedAt: trustedAt, lifecycleOk: true };
      },
      maxRounds: 2,
    });

    expect(sleeps.length).toBe(2);
    expect(result.ok).toBe(true);
    expect(result.reason).toBe('quiet-period-complete');
    expect(result.rounds).toBe(2);
  });

  it('does not wait when already settled', async () => {
    const sleeps = [];
    const result = await runReviewSettle({
      nowFn: () => 1_000_000,
      latestTrustedAt: 1_000_000 - 120_000,
      settleMs: 90_000,
      lifecycleOk: true,
      sleepFn: async (ms) => sleeps.push(ms),
    });
    expect(result.ok).toBe(true);
    expect(sleeps).toEqual([]);
    expect(result.rounds).toBe(0);
  });
});
