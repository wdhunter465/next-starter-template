import { describe, expect, it } from 'vitest';

import {
	cycleIsComplete,
	openExceptionsForOriginalSource,
	parseExceptionLineage,
	planSuccessorPause,
	planSuccessorResume,
	resolveDeliveryLineage,
	shouldWithholdOriginalSourceCloseout,
	toIssueNumber,
	toLineageIssue,
} from '../scripts/ci/post_merge_delivery_lineage.mjs';
import { remediationBody, resolveOriginatingAgent } from '../scripts/ci/post_merge_remediation_issue.mjs';
import { shouldCloseSourceIssue, terminalSourceIssueCloseoutModeFromSync } from '../scripts/ci/post_merge_source_issue_closeout.mjs';

function exceptionIssue({
	number,
	original = 3455,
	pr = 3457,
	iteration = 1,
	owner = 'agent:cursor',
	state = 'open',
} = {}) {
	return {
		number,
		state,
		title: `Post-merge closeout exception for PR #${pr} / source #${original} / outdated_reviewer_thread_without_disposition`,
		labels: ['post-merge-failure', owner, 'status:active'],
		body: [
			`- PR: #${pr}`,
			`- Source issue: #${original}`,
			`- Original source issue: #${original}`,
			`- Cycle iteration: ${iteration}`,
			`- Requested owner/action: Cursor Local (${owner}) — immediate originating-delivery remediation; no new PMO dispatch`,
		].join('\n'),
		created_at: `2026-08-14T18:0${number % 10}:00Z`,
	};
}

describe('#3069 originating-delivery closeout cycle', () => {
	it('parses original source lineage from a new exception Issue', () => {
		const parsed = parseExceptionLineage(exceptionIssue({ number: 3458 }));
		expect(parsed).toMatchObject({
			is_exception: true,
			originating_pr: 3457,
			original_source_issue: 3455,
			cycle_iteration: 1,
		});
	});

	it('normalizes GitHub label objects and issue numbers for closeout artifacts', () => {
		const slim = toLineageIssue({
			number: 3462,
			title: 'Post-merge closeout exception for PR #3461 / source #3069 / unresolved_exception_chain',
			state: 'open',
			labels: [{ name: 'post-merge-failure' }, { name: 'agent:cursor' }],
			body: '- Original source issue: #3069',
			created_at: '2026-08-14T18:59:00Z',
		});
		expect(slim.labels).toEqual(['post-merge-failure', 'agent:cursor']);
		expect(toIssueNumber('3069')).toBe(3069);
		expect(toIssueNumber(0)).toBeNull();
	});

	it('keeps the same original source and originating owner across a second exception', () => {
		const first = exceptionIssue({ number: 3458, iteration: 1 });
		const lineage = resolveDeliveryLineage({
			result: {
				pr: 3459,
				source_issue: 3458,
				head_ref: 'cursor/3458-search-eligibility-failclosed-2e48',
			},
			declaredSourceIssueMeta: first,
			openExceptionIssues: [first],
		});

		expect(lineage.original_source_issue).toBe(3455);
		expect(lineage.in_exception_cycle).toBe(true);
		expect(lineage.cycle_iteration).toBe(2);
		expect(resolveOriginatingAgent({
			head_ref: 'cursor/3458-search-eligibility-failclosed-2e48',
		}).id).toBe('cursor');
	});

	it('withholds original source-Issue terminal closeout while any exception in the chain remains open', () => {
		const open = [exceptionIssue({ number: 3458 }), exceptionIssue({ number: 3461, iteration: 2 })];
		expect(shouldWithholdOriginalSourceCloseout({
			sourceIssueNumber: 3455,
			originalSourceIssue: 3455,
			openExceptionIssues: open,
			issueMeta: { number: 3455, title: 'OPS: Dev search eligibility', labels: ['status:failed'] },
		})).toBe(true);

		expect(shouldCloseSourceIssue({
			action: 'post_merge_success',
			issueNumber: '3455',
			isMerged: true,
			postMergeResult: { status: 'pass', remediation_required: false, original_source_issue: 3455 },
			issueMeta: { title: 'OPS: Dev search eligibility', labels: ['status:post-merge-verify'] },
			openExceptionIssues: open,
			originalSourceIssue: 3455,
		})).toEqual({ close: false, reason: 'unresolved_exception_chain' });
	});

	it('allows the exception Issue itself to close on a clean iteration without closing the original while another exception remains', () => {
		const remaining = [exceptionIssue({ number: 3461, iteration: 2 })];
		expect(shouldWithholdOriginalSourceCloseout({
			sourceIssueNumber: 3458,
			originalSourceIssue: 3455,
			openExceptionIssues: remaining,
			issueMeta: exceptionIssue({ number: 3458 }),
		})).toBe(false);
	});

	it('completes the cycle only after the original source Issue is closed and no exception remains', () => {
		const first = exceptionIssue({ number: 3458, iteration: 1 });
		const second = exceptionIssue({ number: 3461, iteration: 2 });
		expect(cycleIsComplete({
			originalSourceClosed: false,
			openExceptionIssues: [first, second],
			originalSourceIssue: 3455,
		})).toBe(false);
		expect(cycleIsComplete({
			originalSourceClosed: true,
			openExceptionIssues: [second],
			originalSourceIssue: 3455,
		})).toBe(false);
		expect(cycleIsComplete({
			originalSourceClosed: true,
			openExceptionIssues: [],
			originalSourceIssue: 3455,
		})).toBe(true);
		expect(openExceptionsForOriginalSource([first, second], 3455)).toHaveLength(2);
		expect(terminalSourceIssueCloseoutModeFromSync('unresolved_exception_chain')).toBe('preserve_open');
	});

	it('pauses only the originating agent successor and resumes it only after clean terminal closeout', () => {
		const cursorSuccessor = {
			number: 3456,
			created_at: '2026-08-14T17:30:00Z',
			labels: ['agent:cursor', 'status:queued', 'team:operations'],
			title: 'OPS: Production promotion',
		};
		const claudeLane = {
			number: 3415,
			created_at: '2026-08-13T11:20:00Z',
			labels: ['agent:claude', 'status:active', 'team:engineering'],
			title: 'PROJECT: Chatterbox',
		};
		const pause = planSuccessorPause({
			agentLabel: 'agent:cursor',
			openIssues: [cursorSuccessor, claudeLane, exceptionIssue({ number: 3458 })],
			exceptionIssueNumbers: [3458],
		});
		expect(pause).toMatchObject({ pause: true, issue: 3456 });

		const otherLane = planSuccessorPause({
			agentLabel: 'agent:claude',
			openIssues: [cursorSuccessor, claudeLane],
			exceptionIssueNumbers: [3458],
		});
		expect(otherLane).toMatchObject({ pause: false, reason: 'no_successor' });

		const activeCursorWork = planSuccessorPause({
			agentLabel: 'agent:cursor',
			openIssues: [{
				number: 3410,
				created_at: '2026-08-14T16:00:00Z',
				labels: ['agent:cursor', 'status:active'],
				title: 'In-flight Cursor task',
			}],
			exceptionIssueNumbers: [3458],
		});
		expect(activeCursorWork).toMatchObject({ pause: false, reason: 'no_successor' });

		expect(planSuccessorResume({
			pausedIssueNumber: 3456,
			openExceptionIssues: [exceptionIssue({ number: 3458 })],
			originalSourceIssue: 3455,
		}).resume).toBe(false);
		expect(planSuccessorResume({
			pausedIssueNumber: 3456,
			openExceptionIssues: [],
			originalSourceIssue: 3455,
		})).toMatchObject({ resume: true, issue: 3456, reason: 'clean_terminal_closeout' });
	});

	it('records original source, cycle iteration, and no handoff:ready re-entry on generated exception bodies', () => {
		const body = remediationBody({
			status: 'fail',
			pr: 3457,
			source_issue: 3455,
			head_ref: 'cursor/dev-library-search-eligibility-2e48',
			reviewer_disposition_failures: [{
				code: 'outdated_reviewer_thread_without_disposition',
				message: 'thread unresolved',
			}],
		});
		expect(body).toContain('- Original source issue: #3455');
		expect(body).toContain('- Cycle iteration: 1');
		expect(body).toContain('Exception creates a new Issue in this lineage');
		expect(body).toContain('Do not reintroduce `handoff:ready`');
		expect(body).not.toContain('then assign a bounded remediation owner');
	});
});
