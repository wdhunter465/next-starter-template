import { describe, expect, it, vi } from 'vitest';
import {
	GitHubInfrastructureError,
	computeBackoffDelayMs,
	formatAttemptEvidence,
	githubApiFetch,
	isGitHubRateLimitResponse,
	isRetryableNetworkError,
	isTransientGitHubStatus,
} from '../scripts/ci/github_api_retry.mjs';

describe('github api retry classification', () => {
	it('detects transient 5xx statuses', () => {
		expect(isTransientGitHubStatus(500)).toBe(true);
		expect(isTransientGitHubStatus(502)).toBe(true);
		expect(isTransientGitHubStatus(503)).toBe(true);
		expect(isTransientGitHubStatus(504)).toBe(true);
		expect(isTransientGitHubStatus(429)).toBe(false);
		expect(isTransientGitHubStatus(404)).toBe(false);
	});

	it('detects rate-limit responses without treating ordinary 403 as retryable', () => {
		expect(isGitHubRateLimitResponse(429, '')).toBe(true);
		expect(isGitHubRateLimitResponse(403, 'secondary rate limit')).toBe(true);
		expect(isGitHubRateLimitResponse(403, 'forbidden')).toBe(false);
	});

	it('detects retryable network errors', () => {
		expect(isRetryableNetworkError(new TypeError('fetch failed'))).toBe(true);
		expect(isRetryableNetworkError(Object.assign(new Error('boom'), { code: 'ECONNRESET' }))).toBe(true);
		expect(isRetryableNetworkError(new Error('validation failed'))).toBe(false);
	});

	it('computes bounded exponential backoff', () => {
		expect(computeBackoffDelayMs(1, 1000)).toBe(1000);
		expect(computeBackoffDelayMs(2, 1000)).toBe(2000);
		expect(computeBackoffDelayMs(10, 1000, 30000)).toBe(30000);
	});
});

describe('githubApiFetch', () => {
	it('retries transient 5xx then succeeds with attempt evidence', async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValueOnce({
				ok: false,
				status: 503,
				text: async () => 'service unavailable',
			})
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ ok: true }),
			});
		const sleepFn = vi.fn(async () => {});

		const result = await githubApiFetch({
			url: 'https://api.github.com/repos/o/r/pulls/1',
			pathLabel: '/repos/o/r/pulls/1',
			maxRetries: 3,
			initialBackoffMs: 10,
			sleepFn,
			fetchFn,
		});

		expect(result.response.ok).toBe(true);
		expect(result.attempts).toBe(2);
		expect(result.attemptLog).toEqual([
			expect.objectContaining({
				attempt: 1,
				status: 503,
				classification: 'transient-infrastructure',
				delayMs: 10,
			}),
		]);
		expect(formatAttemptEvidence(result.attemptLog)).toContain('status=503');
		expect(sleepFn).toHaveBeenCalledWith(10);
	});

	it('throws infrastructure classification after retry exhaustion', async () => {
		const fetchFn = vi.fn(async () => ({
			ok: false,
			status: 503,
			text: async () => 'unavailable',
		}));

		await expect(
			githubApiFetch({
				url: 'https://api.github.com/repos/o/r/pulls/1',
				pathLabel: '/repos/o/r/pulls/1',
				maxRetries: 2,
				initialBackoffMs: 1,
				sleepFn: async () => {},
				fetchFn,
			}),
		).rejects.toMatchObject({
			name: 'GitHubInfrastructureError',
			classification: 'transient-infrastructure',
			status: 503,
			attempts: 3,
		});

		expect(fetchFn).toHaveBeenCalledTimes(3);
	});

	it('does not retry deterministic 4xx policy/client failures', async () => {
		const fetchFn = vi.fn(async () => ({
			ok: false,
			status: 404,
			text: async () => 'not found',
		}));

		const result = await githubApiFetch({
			url: 'https://api.github.com/repos/o/r/pulls/1',
			pathLabel: '/repos/o/r/pulls/1',
			maxRetries: 3,
			sleepFn: async () => {},
			fetchFn,
		});

		expect(result.response.status).toBe(404);
		expect(result.bodyText).toBe('not found');
		expect(result.attemptLog).toEqual([]);
		expect(fetchFn).toHaveBeenCalledTimes(1);
	});

	it('retries network failures then classifies exhaustion as infrastructure', async () => {
		const fetchFn = vi.fn(async () => {
			throw new TypeError('fetch failed');
		});

		await expect(
			githubApiFetch({
				url: 'https://api.github.com/graphql',
				pathLabel: '/graphql',
				maxRetries: 1,
				initialBackoffMs: 5,
				sleepFn: async () => {},
				fetchFn,
			}),
		).rejects.toBeInstanceOf(GitHubInfrastructureError);

		expect(fetchFn).toHaveBeenCalledTimes(2);
	});
});
