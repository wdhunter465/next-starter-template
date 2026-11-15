import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';

import {
	clearFailedLabelAfterRemediation,
	closeRemediationIssuesForPr,
} from '../scripts/ci/close_remediation_issues_for_pr.mjs';

// #5246: the original source issue leaves status:failed once a remediation PR merges and re-verification passes.

function exception({ number, pr, source, original, labels = ['post-merge-failure'] }) {
	return {
		number,
		title: `Post-merge closeout exception for PR #${pr} / source #${source} / diataxis`,
		body: [
			`- PR: #${pr}`,
			'- Merge SHA: abc',
			`- Source issue: #${source}`,
			...(original ? [`- Original source issue: #${original}`] : []),
		].join('\n'),
		labels: labels.map((name) => ({ name })),
	};
}

function fakeGitHub(issues) {
	const calls = [];
	const requestFn = vi.fn(async ({ path, method = 'GET', body }) => {
		calls.push({ path, method, body });
		const match = path.match(/^\/issues\/(\d+)$/);
		if (match && method === 'GET') return issues[Number(match[1])] ?? null;
		if (match && method === 'PATCH' && body?.labels) {
			issues[Number(match[1])] = {
				...issues[Number(match[1])],
				labels: body.labels.map((name) => ({ name })),
			};
		}
		return null;
	});
	return { requestFn, calls };
}

describe('clear status:failed after a passing remediation (#5246)', () => {
	it('clears status:failed on the original source issue and leaves it open', async () => {
		const issues = {
			4480: { number: 4480, state: 'open', labels: [{ name: 'status:failed' }, { name: 'team:governance' }] },
		};
		const { requestFn, calls } = fakeGitHub(issues);
		const open = [exception({ number: 4484, pr: 4482, source: 4480 })];

		const outcome = await closeRemediationIssuesForPr({
			token: 't',
			repository: 'o/r',
			prNumber: '4482',
			mergeSha: 'sha1',
			listOpenIssues: async () => open,
			requestFn,
		});
		expect(outcome.originalSources).toEqual([4480]);

		const result = await clearFailedLabelAfterRemediation({
			token: 't',
			repository: 'o/r',
			prNumber: '4485',
			mergeSha: 'sha2',
			originalSources: outcome.originalSources,
			remainingOpenIssues: outcome.remainingOpenIssues,
			requestFn,
		});

		expect(result.cleared).toEqual([{ number: 4480, removeLabels: ['status:failed'] }]);
		expect(issues[4480].labels.map((l) => l.name)).toEqual(['team:governance']);
		expect(calls.some((c) => c.path === '/issues/4480' && c.method === 'PATCH' && c.body.state)).toBe(false);
		const comment = calls.find((c) => c.path === '/issues/4480/comments');
		expect(comment.body.body).toContain('Remediation PR: #4485');
		expect(comment.body.body).toContain('Merge SHA: sha2');
		expect(comment.body.body).toContain('stays open');
	});

	it('uses the original source issue named in the exception, not the immediate one', async () => {
		const issues = { 100: { number: 100, state: 'open', labels: [{ name: 'status:failed' }] } };
		const { requestFn } = fakeGitHub(issues);
		const open = [exception({ number: 120, pr: 119, source: 110, original: 100 })];
		const outcome = await closeRemediationIssuesForPr({
			token: 't',
			repository: 'o/r',
			prNumber: '119',
			listOpenIssues: async () => open,
			requestFn,
		});
		expect(outcome.originalSources).toEqual([100]);
	});

	it('leaves status:failed while another exception in the same chain is still open', async () => {
		const issues = { 4480: { number: 4480, state: 'open', labels: [{ name: 'status:failed' }] } };
		const { requestFn } = fakeGitHub(issues);
		const open = [
			exception({ number: 4484, pr: 4482, source: 4480 }),
			exception({ number: 4490, pr: 4488, source: 4480, original: 4480 }),
		];
		const outcome = await closeRemediationIssuesForPr({
			token: 't',
			repository: 'o/r',
			prNumber: '4482',
			listOpenIssues: async () => open,
			requestFn,
		});
		const result = await clearFailedLabelAfterRemediation({
			token: 't',
			repository: 'o/r',
			prNumber: '4482',
			originalSources: outcome.originalSources,
			remainingOpenIssues: outcome.remainingOpenIssues,
			requestFn,
		});
		expect(result.cleared).toEqual([]);
		expect(result.skipped).toEqual([{ number: 4480, reason: 'exception_chain_open' }]);
		expect(issues[4480].labels.map((l) => l.name)).toEqual(['status:failed']);
	});

	it('does not touch a source issue that is closed or has no status:failed', async () => {
		const issues = {
			1: { number: 1, state: 'closed', labels: [{ name: 'status:failed' }] },
			2: { number: 2, state: 'open', labels: [{ name: 'status:active' }] },
		};
		const { requestFn, calls } = fakeGitHub(issues);
		const result = await clearFailedLabelAfterRemediation({
			token: 't',
			repository: 'o/r',
			prNumber: '9',
			originalSources: [1, 2],
			remainingOpenIssues: [],
			requestFn,
		});
		expect(result.cleared).toEqual([]);
		expect(result.skipped).toEqual([
			{ number: 1, reason: 'source_not_open' },
			{ number: 2, reason: 'no_failed_label' },
		]);
		expect(calls.every((c) => c.method === 'GET')).toBe(true);
	});

	it('dry run reports the change and writes nothing', async () => {
		const issues = { 7: { number: 7, state: 'open', labels: [{ name: 'status:failed' }] } };
		const { requestFn, calls } = fakeGitHub(issues);
		const result = await clearFailedLabelAfterRemediation({
			token: 't',
			repository: 'o/r',
			prNumber: '9',
			originalSources: [7],
			remainingOpenIssues: [],
			dryRun: true,
			requestFn,
		});
		expect(result.cleared).toEqual([{ number: 7, dry_run: true, removeLabels: ['status:failed'] }]);
		expect(calls.every((c) => c.method === 'GET')).toBe(true);
	});

	it('records a failure and keeps going when a label update fails', async () => {
		const issues = {
			7: { number: 7, state: 'open', labels: [{ name: 'status:failed' }] },
			8: { number: 8, state: 'open', labels: [{ name: 'status:failed' }] },
		};
		const base = fakeGitHub(issues);
		let failedOnce = false;
		const requestFn = vi.fn(async (args) => {
			if (!failedOnce && args.method === 'PATCH') {
				failedOnce = true;
				throw new Error('rate limited');
			}
			return base.requestFn(args);
		});
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const result = await clearFailedLabelAfterRemediation({
			token: 't',
			repository: 'o/r',
			prNumber: '9',
			originalSources: [7, 8],
			remainingOpenIssues: [],
			requestFn,
		});
		errorSpy.mockRestore();
		expect(result.failed).toEqual([{ number: 7, message: 'rate limited' }]);
		expect(result.cleared.map((c) => c.number)).toEqual([8]);
	});

	it('is only called on a passing re-verification (post_merge_success)', () => {
		const source = fs.readFileSync('scripts/ci/run_post_merge_closeout.mjs', 'utf8');
		const block = source.slice(source.indexOf("if (result.sync_action === 'post_merge_success') {"));
		const callAt = block.indexOf('clearFailedLabelAfterRemediation({');
		const blockEnd = block.indexOf('\n\t}\n');
		expect(callAt).toBeGreaterThan(-1);
		expect(callAt).toBeLessThan(blockEnd);
		// the failure paths never call it
		const beforeSuccessBlock = source.slice(0, source.indexOf("if (result.sync_action === 'post_merge_success') {"));
		expect(beforeSuccessBlock.includes('clearFailedLabelAfterRemediation({')).toBe(false);
	});
});
