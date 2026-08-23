// Generic bounded retry with exponential backoff. Pure aside from the
// injectable delay function, so it's fully unit-testable without real
// timers. Used by scripts/content-pipeline/collect-gehrig-external-sources.mjs
// to satisfy #3551's "source failed after bounded retries" search-run
// contract -- a transient failure must be retried before a search run is
// classified source_error/rate_limited, not given up on after one attempt.

export type BoundedRetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  isRetryable?: (error: unknown) => boolean;
  delay?: (ms: number) => Promise<void>;
};

export async function withBoundedRetry<T>(fn: () => Promise<T>, options: BoundedRetryOptions = {}): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 500;
  const isRetryable = options.isRetryable ?? (() => true);
  const delay = options.delay ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isRetryable(error)) {
        throw error;
      }
      await delay(baseDelayMs * 2 ** (attempt - 1));
    }
  }
  throw lastError;
}
