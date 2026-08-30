import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import {
	evaluatePostMergeSnapshot,
	loadGitHubPostMergeSnapshot,
	REQUIRED_CHECK_NAMES,
	stabilizePostMergeState,
} from '../scripts/ci/post_merge_stabilization.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function workflowHasAutomaticTrigger(workflowRelativePath) {
	const contents = fs.readFileSync(path.resolve(rootDir, workflowRelativePath), 'utf8');
	const onBlockMatch = contents.match(/^on:\n([\s\S]*?)(?=\njobs:)/m);
	const onBlock = onBlockMatch ? onBlockMatch[1] : contents;
	return /^\s*(pull_request|pull_request_target|push):/m.test(onBlock);
}

function settledSnapshot(overrides = {}) {
	return {
		pr: {
			merged_at: '2026-08-29T12:00:00Z',
			merge_commit_sha: 'merge-sha',
		},
		mainContainsMerge: true,
		requiredChecksLoaded: true,
		requiredChecks: [
			{ name: 'quality', status: 'completed', conclusion: 'success' },
			{ name: 'gitleaks', status: 'completed', conclusion: 'success' },
		],
		reviewStateSettled: true,
		...overrides,
	};
}

describe('post-merge stabilization evaluation', () => {
	it('accepts terminal required checks even when validation must later handle their conclusion', () => {
		const result = evaluatePostMergeSnapshot(
			settledSnapshot({
				requiredChecks: [{ name: 'quality', status: 'completed', conclusion: 'failure' }],
			}),
			{ expectedMergeSha: 'merge-sha' },
		);

		expect(result).toEqual({ settled: true, classification: 'settled', reasons: [] });
	});

	it('keeps check and reviewer visibility lag unsettled', () => {
		const result = evaluatePostMergeSnapshot(
			settledSnapshot({
				requiredChecks: [{ name: 'quality', status: 'in_progress', conclusion: null }],
				reviewStateSettled: false,
			}),
			{ expectedMergeSha: 'merge-sha' },
		);

		expect(result).toEqual({
			settled: false,
			classification: 'post_merge_state_unsettled',
			reasons: ['required_checks_unsettled', 'review_state_unsettled'],
		});
	});

	it('fails merge-SHA mismatch immediately instead of treating it as visibility lag', () => {
		const result = evaluatePostMergeSnapshot(settledSnapshot(), { expectedMergeSha: 'other-sha' });

		expect(result).toEqual({
			settled: false,
			terminal: true,
			classification: 'merge_sha_mismatch',
			reasons: ['merge_sha_mismatch'],
		});
	});

	it('fails a review-thread pagination overflow immediately instead of retrying until timeout', () => {
		const result = evaluatePostMergeSnapshot(
			settledSnapshot({ reviewThreadsPaginationOverflow: true, reviewStateSettled: false }),
			{ expectedMergeSha: 'merge-sha' },
		);

		expect(result).toEqual({
			settled: false,
			terminal: true,
			classification: 'review_thread_pagination_unsupported',
			reasons: ['review_thread_pagination_unsupported'],
		});
	});
});

describe('post-merge stabilization retry window', () => {
	it('waits 60 seconds before the first re-fetch and returns settled state', async () => {
		const sleep = vi.fn().mockResolvedValue(undefined);
		const loadSnapshot = vi.fn().mockResolvedValue(settledSnapshot());

		const result = await stabilizePostMergeState({
			expectedMergeSha: 'merge-sha',
			loadSnapshot,
			sleep,
		});

		expect(sleep.mock.calls).toEqual([[60_000]]);
		expect(loadSnapshot).toHaveBeenCalledTimes(1);
		expect(result).toMatchObject({ status: 'settled', attempts: 1, elapsedMs: 60_000 });
	});

	it('retries every 15 seconds until delayed check and reviewer state settle', async () => {
		const sleep = vi.fn().mockResolvedValue(undefined);
		const loadSnapshot = vi
			.fn()
			.mockResolvedValueOnce(
				settledSnapshot({
					requiredChecks: [{ name: 'quality', status: 'queued', conclusion: null }],
					reviewStateSettled: false,
				}),
			)
			.mockResolvedValueOnce(settledSnapshot());

		const result = await stabilizePostMergeState({
			expectedMergeSha: 'merge-sha',
			loadSnapshot,
			sleep,
		});

		expect(sleep.mock.calls).toEqual([[60_000], [15_000]]);
		expect(result).toMatchObject({ status: 'settled', attempts: 2, elapsedMs: 75_000 });
	});

	it('times out after four additional retries with one bounded classification', async () => {
		const sleep = vi.fn().mockResolvedValue(undefined);
		const loadSnapshot = vi.fn().mockResolvedValue(settledSnapshot({ mainContainsMerge: false, reviewStateSettled: false }));

		const result = await stabilizePostMergeState({
			expectedMergeSha: 'merge-sha',
			loadSnapshot,
			sleep,
		});

		expect(sleep.mock.calls).toEqual([[60_000], [15_000], [15_000], [15_000], [15_000]]);
		expect(loadSnapshot).toHaveBeenCalledTimes(5);
		expect(result).toEqual({
			status: 'failed',
			classification: 'post_merge_stabilization_timeout',
			reasons: ['merge_sha_not_visible_on_main', 'review_state_unsettled'],
			attempts: 5,
			elapsedMs: 120_000,
		});
	});

	it('does not retry a wrong merge SHA', async () => {
		const sleep = vi.fn().mockResolvedValue(undefined);
		const loadSnapshot = vi.fn().mockResolvedValue(settledSnapshot());

		const result = await stabilizePostMergeState({
			expectedMergeSha: 'other-sha',
			loadSnapshot,
			sleep,
		});

		expect(sleep.mock.calls).toEqual([[60_000]]);
		expect(loadSnapshot).toHaveBeenCalledTimes(1);
		expect(result).toEqual({
			status: 'failed',
			classification: 'merge_sha_mismatch',
			reasons: ['merge_sha_mismatch'],
			attempts: 1,
			elapsedMs: 60_000,
		});
	});

	it('does not retry a review-thread pagination overflow for the full window', async () => {
		const sleep = vi.fn().mockResolvedValue(undefined);
		const loadSnapshot = vi
			.fn()
			.mockResolvedValue(settledSnapshot({ reviewThreadsPaginationOverflow: true, reviewStateSettled: false }));

		const result = await stabilizePostMergeState({
			expectedMergeSha: 'merge-sha',
			loadSnapshot,
			sleep,
		});

		expect(sleep.mock.calls).toEqual([[60_000]]);
		expect(loadSnapshot).toHaveBeenCalledTimes(1);
		expect(result).toEqual({
			status: 'failed',
			classification: 'review_thread_pagination_unsupported',
			reasons: ['review_thread_pagination_unsupported'],
			attempts: 1,
			elapsedMs: 60_000,
		});
	});
});

describe('GitHub stabilization snapshot', () => {
	it('reads required PR checks from the immutable head while proving the merge SHA is on main', async () => {
		const requestedUrls = [];
		const fetch = vi.fn(async (url) => {
			requestedUrls.push(String(url));
			if (url === 'https://api.github.com/graphql') {
				return new Response(
					JSON.stringify({
						data: {
							repository: {
								pullRequest: { reviewThreads: { pageInfo: { hasNextPage: false }, nodes: [] } },
							},
						},
					}),
					{ status: 200 },
				);
			}
			if (String(url).endsWith('/pulls/3800')) {
				return new Response(
					JSON.stringify({
						merged_at: '2026-08-29T12:00:00Z',
						merge_commit_sha: 'merge-sha',
						head: { sha: 'head-sha' },
					}),
					{ status: 200 },
				);
			}
			if (String(url).includes('/compare/merge-sha...main')) {
				return new Response(JSON.stringify({ status: 'ahead' }), { status: 200 });
			}
			if (String(url).includes('/commits/head-sha/check-runs')) {
				return new Response(
					JSON.stringify({
						check_runs: [
							{ name: 'quality', status: 'completed', conclusion: 'success' },
							{ name: 'gitleaks', status: 'completed', conclusion: 'success' },
						],
					}),
					{ status: 200 },
				);
			}
			if (String(url).endsWith('/pulls/3800/reviews?per_page=100')) {
				return new Response(JSON.stringify([]), { status: 200 });
			}
			return new Response(JSON.stringify({ message: 'unexpected URL' }), { status: 404 });
		});
		vi.stubGlobal('fetch', fetch);

		try {
			const snapshot = await loadGitHubPostMergeSnapshot({
				token: 'token',
				repository: 'owner/repo',
				prNumber: 3800,
				expectedMergeSha: 'merge-sha',
			});

			expect(snapshot).toMatchObject({
				mainContainsMerge: true,
				requiredChecksLoaded: true,
				reviewStateSettled: true,
			});
			expect(requestedUrls).toContain('https://api.github.com/repos/owner/repo/commits/head-sha/check-runs?per_page=100');
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('flags review-thread pagination overflow when the first page has more than 100 threads', async () => {
		const fetch = vi.fn(async (url) => {
			if (url === 'https://api.github.com/graphql') {
				return new Response(
					JSON.stringify({
						data: {
							repository: {
								pullRequest: { reviewThreads: { pageInfo: { hasNextPage: true }, nodes: [] } },
							},
						},
					}),
					{ status: 200 },
				);
			}
			if (String(url).endsWith('/pulls/3800')) {
				return new Response(
					JSON.stringify({
						merged_at: '2026-08-29T12:00:00Z',
						merge_commit_sha: 'merge-sha',
						head: { sha: 'head-sha' },
					}),
					{ status: 200 },
				);
			}
			if (String(url).includes('/compare/merge-sha...main')) {
				return new Response(JSON.stringify({ status: 'ahead' }), { status: 200 });
			}
			if (String(url).includes('/commits/head-sha/check-runs')) {
				return new Response(
					JSON.stringify({
						check_runs: [
							{ name: 'quality', status: 'completed', conclusion: 'success' },
							{ name: 'gitleaks', status: 'completed', conclusion: 'success' },
						],
					}),
					{ status: 200 },
				);
			}
			if (String(url).endsWith('/pulls/3800/reviews?per_page=100')) {
				return new Response(JSON.stringify([]), { status: 200 });
			}
			return new Response(JSON.stringify({ message: 'unexpected URL' }), { status: 404 });
		});
		vi.stubGlobal('fetch', fetch);

		try {
			const snapshot = await loadGitHubPostMergeSnapshot({
				token: 'token',
				repository: 'owner/repo',
				prNumber: 3800,
				expectedMergeSha: 'merge-sha',
			});

			expect(snapshot).toMatchObject({
				reviewThreadsPaginationOverflow: true,
				reviewStateSettled: false,
			});
		} finally {
			vi.unstubAllGlobals();
		}
	});
});

describe('required check surface only names checks that can actually produce a check-run', () => {
	it('excludes pr-issue-accounting while ops-pr-issue-accounting.yml stays workflow_dispatch-only', () => {
		// A required-check name that never appears on a pull_request/push event makes
		// requiredChecksLoaded permanently false, turning every stabilization run into a
		// guaranteed post_merge_stabilization_timeout regardless of the retry window.
		const hasAutomaticTrigger = workflowHasAutomaticTrigger('.github/workflows/ops-pr-issue-accounting.yml');

		if (hasAutomaticTrigger) {
			// The workflow now runs automatically, so it's safe (and expected) to require it again.
			expect(REQUIRED_CHECK_NAMES).toContain('pr-issue-accounting');
		} else {
			expect(REQUIRED_CHECK_NAMES).not.toContain('pr-issue-accounting');
		}
	});
});
