import { describe, expect, it } from 'vitest';

import {
	CLOSEOUT_DEFECT_EXCEPTION_LABELS,
	circuitBreakerSuppressesOpsException,
	closeoutDefectMarker,
	ensureCloseoutDefectOpsException,
	hasCloseoutDefect,
} from '../scripts/ci/open_closeout_defect_exception.mjs';
import { ensureCloseoutRemediationEvidence } from '../scripts/ci/run_post_merge_closeout.mjs';

function defectResult(overrides = {}) {
	return {
		status: 'fail',
		pr: 5001,
		merge_sha: 'abcdef0123456789',
		source_issue: 4001,
		remediation_required: true,
		metadata_failures: [{ code: 'closeout_runtime_error', message: 'boom' }],
		workflow_failures: [],
		implementation_failures: [],
		diataxis_failures: [],
		reviewer_findings: [],
		originating_agent: 'cursor',
		...overrides,
	};
}

function makeRequestFn({ remediationIssues = [], exceptionIssues = [] } = {}) {
	const calls = [];
	const requestFn = async ({ path, method = 'GET', body }) => {
		calls.push({ path, method, body });
		if (method === 'GET' && path.includes(`labels=${encodeURIComponent('post-merge-failure')}`)) {
			return remediationIssues;
		}
		if (method === 'GET' && path.includes(`labels=${encodeURIComponent('ops-exception')}`)) {
			return exceptionIssues;
		}
		if (method === 'POST' && path === '/issues') {
			return { number: 9100, html_url: 'https://github.com/example/repo/issues/9100' };
		}
		if (method === 'POST' && path.endsWith('/comments')) {
			return { id: 1 };
		}
		throw new Error(`Unexpected ${method} ${path}`);
	};
	return { requestFn, calls };
}

describe('closeout defect ops exception (#5327 / #5369)', () => {
	it('detects a closeout defect', () => {
		expect(hasCloseoutDefect(defectResult())).toBe(true);
		expect(hasCloseoutDefect({ status: 'pass', remediation_required: false })).toBe(false);
		expect(
			hasCloseoutDefect({
				status: 'pass',
				self_healing_safe: true,
				metadata_failures: [{ code: 'x', message: 'y' }],
			}),
		).toBe(false);
	});

	it('opens one team:operations exception when no post-merge-failure exists', async () => {
		const { requestFn, calls } = makeRequestFn();
		const result = await ensureCloseoutDefectOpsException({
			token: 't',
			repository: 'o/r',
			result: defectResult(),
			remediationOutcome: { action: 'skipped', reason: 'no-remediation-required' },
			requestFn,
		});

		expect(result.action).toBe('created');
		expect(result.number).toBe(9100);
		const created = calls.find((c) => c.method === 'POST' && c.path === '/issues');
		expect(created.body.labels).toEqual(
			expect.arrayContaining([...CLOSEOUT_DEFECT_EXCEPTION_LABELS, 'agent:cursor', 'status:active']),
		);
		expect(created.body.body).toContain(closeoutDefectMarker(5001));
		expect(created.body.title).toContain('OPS EXCEPTION: closeout defect');
	});

	it('comments on the existing closeout-defect exception instead of duplicating', async () => {
		const marker = closeoutDefectMarker(5001);
		const { requestFn, calls } = makeRequestFn({
			exceptionIssues: [{ number: 77, body: `${marker}\nprior`, state: 'open' }],
		});
		const result = await ensureCloseoutDefectOpsException({
			token: 't',
			repository: 'o/r',
			result: defectResult(),
			remediationOutcome: { action: 'skipped', reason: 'no-remediation-required' },
			requestFn,
		});

		expect(result).toEqual({
			action: 'commented',
			number: 77,
			issue: '#77',
		});
		expect(calls.some((c) => c.method === 'POST' && c.path === '/issues')).toBe(false);
		expect(calls.some((c) => c.path === '/issues/77/comments')).toBe(true);
	});

	it('skips when a post-merge-failure Issue already covers the PR', async () => {
		const { requestFn, calls } = makeRequestFn({
			remediationIssues: [
				{
					number: 88,
					title: 'Post-merge closeout remediation — PR #5001 / source #4001 / closeout_runtime_error',
					body: 'x',
					state: 'open',
					html_url: 'https://github.com/example/repo/issues/88',
				},
			],
		});
		const result = await ensureCloseoutDefectOpsException({
			token: 't',
			repository: 'o/r',
			result: defectResult(),
			remediationOutcome: { action: 'skipped', reason: 'no-remediation-required' },
			requestFn,
		});

		expect(result.action).toBe('skipped');
		expect(result.reason).toBe('post-merge-failure-exists');
		expect(calls.some((c) => c.method === 'POST')).toBe(false);
	});

	it('skips when remediation upsert already created the post-merge-failure Issue', async () => {
		const { requestFn, calls } = makeRequestFn();
		const result = await ensureCloseoutDefectOpsException({
			token: 't',
			repository: 'o/r',
			result: defectResult(),
			remediationOutcome: { action: 'created', issue: '#99' },
			requestFn,
		});

		expect(result).toEqual({ action: 'skipped', reason: 'post-merge-failure-upserted' });
		expect(calls).toEqual([]);
	});

	it('does not open a per-PR exception when the circuit breaker suppressed remediation', async () => {
		expect(
			circuitBreakerSuppressesOpsException({
				action: 'skipped',
				reason: 'circuit-breaker-open',
			}),
		).toBe(true);
		expect(
			circuitBreakerSuppressesOpsException({
				action: 'skipped',
				reason: 'circuit-breaker-threshold',
			}),
		).toBe(true);

		for (const reason of ['circuit-breaker-open', 'circuit-breaker-threshold']) {
			const { requestFn, calls } = makeRequestFn();
			const result = await ensureCloseoutDefectOpsException({
				token: 't',
				repository: 'o/r',
				result: defectResult(),
				remediationOutcome: { action: 'skipped', issue: null, reason },
				requestFn,
			});
			expect(result).toEqual({ action: 'skipped', reason: 'circuit-breaker-suppress' });
			expect(calls).toEqual([]);
		}
	});

});

describe('ensureCloseoutRemediationEvidence ops_exception error (#5369)', () => {
	it('returns ops_exception.action error and preserves remediation skip fields', async () => {
		const combined = await ensureCloseoutRemediationEvidence({
			token: 't',
			repository: 'o/r',
			result: {
				status: 'pass',
				pr: 5001,
				remediation_required: false,
				metadata_failures: [],
				workflow_failures: [],
				implementation_failures: [],
				diataxis_failures: [],
				reviewer_findings: [],
			},
			ensureOpsException: async () => {
				throw new Error('GitHub API 502');
			},
		});

		expect(combined).toEqual({
			action: 'skipped',
			issue: null,
			reason: 'no-remediation-required',
			ops_exception: { action: 'error', message: 'GitHub API 502' },
		});
	});

	it('returns ops_exception.action error and keeps circuit-breaker remediation fields', async () => {
		const combined = await ensureCloseoutRemediationEvidence({
			token: 't',
			repository: 'o/r',
			result: defectResult(),
			suppressRemediationIssues: true,
			batchCircuitBreaker: { tripped: true, threshold: 3 },
			ensureOpsException: async () => {
				throw new Error('ops helper boom');
			},
		});

		expect(combined.action).toBe('skipped');
		expect(combined.reason).toBe('circuit-breaker-open');
		expect(combined.issue).toBeNull();
		expect(combined.ops_exception).toEqual({
			action: 'error',
			message: 'ops helper boom',
		});
	});
});
