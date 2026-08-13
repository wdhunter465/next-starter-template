import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	GitHubInfrastructureError,
	GitHubRateLimitError,
	computeBackoffDelayMs,
	githubRepoRequest,
	isGitHubRateLimitResponse,
} from '../scripts/ci/github_issue_api.mjs';

describe('github rate limit helpers', () => {
	it('detects 429 and rate-limited 403 responses', () => {
		expect(isGitHubRateLimitResponse(429, '')).toBe(true);
		expect(isGitHubRateLimitResponse(403, 'API rate limit exceeded')).toBe(true);
		expect(isGitHubRateLimitResponse(403, 'secondary rate limit')).toBe(true);
		expect(isGitHubRateLimitResponse(403, 'forbidden')).toBe(false);
	});

	it('computes exponential backoff delays', () => {
		expect(computeBackoffDelayMs(1, 1000)).toBe(1000);
		expect(computeBackoffDelayMs(2, 1000)).toBe(2000);
		expect(computeBackoffDelayMs(3, 500)).toBe(2000);
	});

	it('caps exponential backoff at the configured maximum', () => {
		expect(computeBackoffDelayMs(10, 1000, 30000)).toBe(30000);
		expect(computeBackoffDelayMs(3, 1000, 1500)).toBe(1500);
	});
});

describe('githubRepoRequest', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('sends authenticated JSON requests with the configured user agent', async () => {
		const fetchMock = vi.fn(async () => ({
			ok: true,
			status: 200,
			json: async () => [{ number: 1 }],
		}));
		vi.stubGlobal('fetch', fetchMock);

		const result = await githubRepoRequest({
			token: 'test-token',
			repository: 'owner/repo',
			path: '/issues?state=open',
			userAgent: 'lgfc-test-agent',
		});

		expect(result).toEqual([{ number: 1 }]);
		expect(fetchMock).toHaveBeenCalledWith(
			'https://api.github.com/repos/owner/repo/issues?state=open',
			expect.objectContaining({
				method: 'GET',
				headers: expect.objectContaining({
					Authorization: 'Bearer test-token',
					Accept: 'application/vnd.github+json',
					'X-GitHub-Api-Version': '2022-11-28',
					'User-Agent': 'lgfc-test-agent',
				}),
			}),
		);
	});

	it('returns null for 204 responses', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				status: 204,
			})),
		);

		await expect(
			githubRepoRequest({
				token: 'test-token',
				repository: 'owner/repo',
				path: '/issues/1',
				method: 'PATCH',
				body: { state: 'closed' },
			}),
		).resolves.toBeNull();
	});

	it('throws detailed errors for non-OK responses', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: false,
				status: 403,
				text: async () => 'forbidden',
			})),
		);

		await expect(
			githubRepoRequest({
				token: 'test-token',
				repository: 'owner/repo',
				path: '/issues',
				method: 'POST',
				body: { title: 'test' },
			}),
		).rejects.toThrow('POST /issues failed: 403 forbidden');
	});

	it('retries rate-limit responses with bounded exponential backoff', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce({
				ok: false,
				status: 429,
				text: async () => 'rate limit',
			})
			.mockResolvedValueOnce({
				ok: false,
				status: 403,
				text: async () => 'secondary rate limit',
			})
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ ok: true }),
			});
		const sleepFn = vi.fn(async () => {});

		const result = await githubRepoRequest({
			token: 'test-token',
			repository: 'owner/repo',
			path: '/issues/1',
			maxRetries: 3,
			initialBackoffMs: 10,
			sleepFn,
			fetchFn: fetchMock,
		});

		expect(result).toEqual({ ok: true });
		expect(fetchMock).toHaveBeenCalledTimes(3);
		expect(sleepFn).toHaveBeenCalledTimes(2);
		expect(sleepFn.mock.calls.map(([delay]) => delay)).toEqual([10, 20]);
	});

	it('throws GitHubRateLimitError after retry budget is exhausted', async () => {
		const fetchMock = vi.fn(async () => ({
			ok: false,
			status: 429,
			text: async () => 'rate limit',
		}));

		await expect(
			githubRepoRequest({
				token: 'test-token',
				repository: 'owner/repo',
				path: '/issues/1',
				maxRetries: 2,
				initialBackoffMs: 1,
				sleepFn: async () => {},
				fetchFn: fetchMock,
			}),
		).rejects.toBeInstanceOf(GitHubRateLimitError);

		expect(fetchMock).toHaveBeenCalledTimes(3);
	});

	it('retries transient 5xx responses then succeeds', async () => {
		const fetchMock = vi
			.fn()
			.mockResolvedValueOnce({
				ok: false,
				status: 502,
				text: async () => 'bad gateway',
			})
			.mockResolvedValueOnce({
				ok: true,
				status: 200,
				json: async () => ({ number: 42 }),
			});

		const result = await githubRepoRequest({
			token: 'test-token',
			repository: 'owner/repo',
			path: '/pulls/42',
			maxRetries: 3,
			initialBackoffMs: 1,
			sleepFn: async () => {},
			fetchFn: fetchMock,
		});

		expect(result).toEqual({ number: 42 });
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it('throws GitHubInfrastructureError when transient retries are exhausted', async () => {
		const fetchMock = vi.fn(async () => ({
			ok: false,
			status: 503,
			text: async () => 'unavailable',
		}));

		await expect(
			githubRepoRequest({
				token: 'test-token',
				repository: 'owner/repo',
				path: '/pulls/1',
				maxRetries: 1,
				initialBackoffMs: 1,
				sleepFn: async () => {},
				fetchFn: fetchMock,
			}),
		).rejects.toSatisfy(
			(error) => error instanceof GitHubInfrastructureError
				&& error.classification === 'transient-infrastructure',
		);
	});
});
