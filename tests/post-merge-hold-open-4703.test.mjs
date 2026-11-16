import { describe, expect, it, vi } from 'vitest';

import {
	shouldCloseSourceIssue,
	uncheckedAcceptanceCriteria,
} from '../scripts/ci/post_merge_source_issue_closeout.mjs';
import { classifyWorkflowRun, workflowFailures } from '../scripts/ci/post_merge_validator.mjs';

// #4703: a merge alone does not complete an Issue with unchecked acceptance criteria, and a workflow finding is
// not a pass. Closing is explicit, in the PR body's POST-MERGE ISSUE DISPOSITION.

const PARTIAL_ISSUE = [
	'## Purpose',
	'Record the design register rows.',
	'',
	'## Acceptance criteria',
	'- [x] Launch publication rule recorded',
	'- [ ] Audit report shows every public item is cleared, or listed with a decision',
	'- [ ] No unresolved publication-rights stop remains for launch content',
	'',
	'## Protected stops',
	'- [ ] this later checklist is not an acceptance criterion',
].join('\n');

const open = (body) => ({ state: 'OPEN', labels: ['status:active'], title: 'TASK: example', body });
const decide = (over = {}) =>
	shouldCloseSourceIssue({
		action: 'post_merge_success',
		issueNumber: '4420',
		isMerged: true,
		issueMeta: open(PARTIAL_ISSUE),
		postMergeResult: { status: 'pass', remediation_required: false },
		terminalLabelResult: { ok: true },
		prBody: '- **Issue:** #4420\n\nA partial slice.',
		...over,
	});

describe('uncheckedAcceptanceCriteria (#4703)', () => {
	it('lists only the unchecked items under the acceptance heading', () => {
		expect(uncheckedAcceptanceCriteria(PARTIAL_ISSUE)).toEqual([
			'Audit report shows every public item is cleared, or listed with a decision',
			'No unresolved publication-rights stop remains for launch content',
		]);
	});

	it('finds the section under the heading styles Issues use here', () => {
		expect(uncheckedAcceptanceCriteria('### Acceptance\n- [ ] one\n- [x] two')).toEqual(['one']);
		expect(uncheckedAcceptanceCriteria('**Acceptance criteria**\n- [ ] bold heading')).toEqual(['bold heading']);
		expect(uncheckedAcceptanceCriteria('## Acceptance Criteria\n* [ ] star bullet')).toEqual(['star bullet']);
		expect(uncheckedAcceptanceCriteria('## ACCEPTANCE CRITERIA\r\n- [ ] windows line ends\r\n')).toEqual(['windows line ends']);
	});

	it('returns nothing when everything is checked, there is no checklist, or the body is empty', () => {
		expect(uncheckedAcceptanceCriteria('## Acceptance criteria\n- [x] a\n- [X] b')).toEqual([]);
		expect(uncheckedAcceptanceCriteria('## Acceptance criteria\nThe widget renders without error.')).toEqual([]);
		expect(uncheckedAcceptanceCriteria('## Notes\n- [ ] a task that is not an acceptance criterion')).toEqual([]);
		expect(uncheckedAcceptanceCriteria('')).toEqual([]);
		expect(uncheckedAcceptanceCriteria(undefined)).toEqual([]);
	});

	it('stops at the next heading', () => {
		expect(uncheckedAcceptanceCriteria('## Acceptance criteria\n- [x] done\n## Rollback\n- [ ] revert')).toEqual([]);
	});
});

describe('an unchecked criterion holds the source Issue open (#4703)', () => {
	it('keeps it open and names the unchecked items when the PR does not say to close', () => {
		const result = decide();
		expect(result).toMatchObject({ close: false, reason: 'unchecked_acceptance_criteria' });
		expect(result.unchecked).toHaveLength(2);
	});

	it('closes it when the PR says to close it in its disposition', () => {
		const prBody = '- **Issue:** #4420\n\nPOST-MERGE ISSUE DISPOSITION: close #4420 on merge; every criterion is met';
		expect(decide({ prBody })).toEqual({ close: true, reason: 'post_merge_validation_success' });
	});

	it('does not close it for a disposition that closes a different Issue', () => {
		const prBody = '- **Issue:** #4420\n\nPOST-MERGE ISSUE DISPOSITION: close #9999 on merge';
		expect(decide({ prBody }).reason).toBe('unchecked_acceptance_criteria');
	});

	it('keeps an explicit keep-open line working as before', () => {
		const prBody = '- **Issue:** #4420\n\nPOST-MERGE ISSUE DISPOSITION: keep #4420 open on merge; rows remain';
		expect(decide({ prBody }).reason).toBe('active_source_issue_remains_open');
	});

	it('closes an Issue whose criteria are all checked, exactly as before', () => {
		const issueMeta = open('## Acceptance criteria\n- [x] a\n- [x] b');
		expect(decide({ issueMeta })).toEqual({ close: true, reason: 'post_merge_validation_success' });
	});

	it('closes an Issue with no checklist, exactly as before', () => {
		expect(decide({ issueMeta: open('## Purpose\nNothing to tick.') }).close).toBe(true);
		expect(decide({ issueMeta: { state: 'OPEN', labels: [], title: 't' } }).close).toBe(true);
	});

	it('does not apply to a closed Issue or to a PR that was not merged or not a success', () => {
		expect(decide({ issueMeta: { ...open(PARTIAL_ISSUE), state: 'CLOSED' } }).reason).not.toBe('unchecked_acceptance_criteria');
		expect(decide({ isMerged: false }).reason).toBe('pr_not_merged');
		expect(decide({ action: 'post_merge_failure' }).reason).toBe('action_post_merge_failure');
	});

	it.each([
		['the four Issues reopened by hand on 2026-11-15, as a partial PR would have left them', '#4420'],
		['an Issue whose only unchecked item is the human merge', '#5196'],
	])('holds %s', (_name, issue) => {
		const body = '## Acceptance criteria\n- [x] Built\n- [ ] Product Authority approves and merges';
		const result = decide({ issueNumber: issue.slice(1), issueMeta: open(body), prBody: `- **Issue:** ${issue}\n\nFirst slice.` });
		expect(result.close).toBe(false);
		expect(result.unchecked).toEqual(['Product Authority approves and merges']);
	});
});

describe('the sync path leaves the Issue open and says why (#4703)', () => {
	it('relabels it active and comments the unchecked items and how to close', async () => {
		process.env.GITHUB_REPOSITORY = 'owner/repo';
		const syncPrState = await import('../scripts/orchestrator/sync-pr-state.mjs');
		const run = vi.fn();
		const reconciliations = [];
		const result = syncPrState.syncPrState({
			prNumber: '5300',
			action: 'post_merge_success',
			pr: {
				body: '- **Issue:** #4420\n\nA partial slice.',
				mergedAt: '2026-11-15T12:00:00Z',
				state: 'MERGED',
				url: 'https://example.test/pr/5300',
				mergeCommit: { oid: 'abc123' },
			},
			postMergeResult: { status: 'pass', remediation_required: false, merge_sha: 'abc123', source_issue: '4420' },
			getRepoLabels: () => new Set(['status:active', 'status:complete']),
			getIssueMeta: () => ({ title: 'TASK: example', labels: ['status:active', 'status:post-merge-verify'], state: 'OPEN', body: PARTIAL_ISSUE }),
			reconcileTerminalLabelsFn: (...args) => reconciliations.push(args),
			run,
		});
		expect(result).toBe('active_relabeled');
		expect(run).not.toHaveBeenCalledWith(expect.arrayContaining(['issue', 'close', '4420']));
		const comment = run.mock.calls.map((c) => c[0]).find((args) => args[0] === 'issue' && args[1] === 'comment');
		const text = comment[comment.indexOf('--body') + 1];
		expect(text).toContain('2 acceptance criteria are unchecked');
		expect(text).toContain('Audit report shows every public item is cleared');
		expect(text).toContain('POST-MERGE ISSUE DISPOSITION: close #4420 on merge');
		expect(text).toContain('Closeout reason: unchecked_acceptance_criteria');
		expect(reconciliations).toHaveLength(1);
	});
});

describe('a workflow finding is not a pass (#4703)', () => {
	const run = (over = {}) => ({ name: 'Some Other Workflow', conclusion: 'failure', status: 'completed', databaseId: 1, url: 'u', ...over });

	it('a failed workflow that is not a merge-protection run now counts as required', () => {
		expect(classifyWorkflowRun(run())).toMatchObject({ required: true });
	});

	it('timed-out and action-required runs count too', () => {
		expect(classifyWorkflowRun(run({ conclusion: 'timed_out' })).required).toBe(true);
		expect(classifyWorkflowRun(run({ conclusion: 'action_required' })).required).toBe(true);
	});

	it('a cancelled run of an ordinary workflow was superseded and does not count as required', () => {
		expect(classifyWorkflowRun(run({ conclusion: 'cancelled' })).required).toBe(false);
	});

	it('a merge-protection run counts whatever its conclusion', () => {
		expect(classifyWorkflowRun(run({ name: 'GATE — Quality Checks', conclusion: 'cancelled' })).required).toBe(true);
		expect(classifyWorkflowRun(run({ name: 'GATE — Quality Checks' })).required).toBe(true);
	});

	it('the closeout runs themselves are still never counted', () => {
		const failures = workflowFailures({
			runs: [run({ name: 'Post-Merge Detection', databaseId: 2 }), run({ name: 'post-merge-closeout', databaseId: 3 }), run({ databaseId: 4 })],
		});
		expect(failures.map((f) => f.run_id)).toEqual([4]);
	});

	it('the optional list starts empty: no workflow is exempt by default', () => {
		for (const name of ['OPS — Post-Merge Self-Healing', 'Cloudflare Pages', 'Claude Code Wake Delivery', 'AI Review']) {
			expect(classifyWorkflowRun(run({ name })).required, name).toBe(true);
		}
	});
});
