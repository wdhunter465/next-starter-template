import { describe, expect, it, vi } from 'vitest';

import { withBoundedRetry } from '../functions/_lib/bounded-retry';

describe('withBoundedRetry (#3657)', () => {
  it('succeeds on the first attempt without retrying', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const delay = vi.fn().mockResolvedValue(undefined);

    const result = await withBoundedRetry(fn, { delay });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
  });

  it('retries on failure and succeeds on a later attempt, backing off exponentially', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValueOnce('ok');
    const delay = vi.fn().mockResolvedValue(undefined);

    const result = await withBoundedRetry(fn, { maxAttempts: 5, baseDelayMs: 100, delay });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenNthCalledWith(1, 100); // 100 * 2^0
    expect(delay).toHaveBeenNthCalledWith(2, 200); // 100 * 2^1
  });

  it('exhausts all attempts and throws the last error', async () => {
    const errors = [new Error('e1'), new Error('e2'), new Error('e3')];
    const fn = vi
      .fn()
      .mockRejectedValueOnce(errors[0])
      .mockRejectedValueOnce(errors[1])
      .mockRejectedValueOnce(errors[2]);
    const delay = vi.fn().mockResolvedValue(undefined);

    await expect(withBoundedRetry(fn, { maxAttempts: 3, delay })).rejects.toBe(errors[2]);
    expect(fn).toHaveBeenCalledTimes(3);
    // Only 2 delays happen between 3 attempts -- no delay after the final,
    // exhausted attempt.
    expect(delay).toHaveBeenCalledTimes(2);
  });

  it('isRetryable returning false short-circuits immediately even with attempts remaining', async () => {
    const nonRetryableError = new Error('bad request');
    const fn = vi.fn().mockRejectedValue(nonRetryableError);
    const delay = vi.fn().mockResolvedValue(undefined);
    const isRetryable = vi.fn().mockReturnValue(false);

    await expect(withBoundedRetry(fn, { maxAttempts: 5, delay, isRetryable })).rejects.toBe(nonRetryableError);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
    expect(isRetryable).toHaveBeenCalledTimes(1);
    expect(isRetryable).toHaveBeenCalledWith(nonRetryableError);
  });

  it('defaults to 3 attempts when maxAttempts is not specified', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'));
    const delay = vi.fn().mockResolvedValue(undefined);

    await expect(withBoundedRetry(fn, { delay })).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  // Copilot review finding on PR #3663: maxAttempts <= 0 previously skipped
  // the loop entirely and threw `undefined` (lastError was never assigned),
  // which is effectively impossible to debug. Now rejected explicitly.
  it.each([0, -1, 1.5, -3])('rejects a non-positive-integer maxAttempts (%s) with a clear error, without calling fn', async (maxAttempts) => {
    const fn = vi.fn().mockResolvedValue('should never run');

    await expect(withBoundedRetry(fn, { maxAttempts })).rejects.toThrow(/maxAttempts must be a positive integer/);
    expect(fn).not.toHaveBeenCalled();
  });
});
