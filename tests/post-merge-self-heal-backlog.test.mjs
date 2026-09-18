import { describe, expect, it } from 'vitest';

import {
	BACKLOG_DISPOSITIONS,
	buildBacklogReport,
	dispositionComment,
	executeBacklogReport,
	extractDetectedFailureConditions,
	hasOpsPrEscalationLabel,
	hasUnsafeOperatorSignal,
	isBacklogScanCandidate,
	isPostMergeExceptionIssue,
	OPS_PR_ESCALATION_LABEL,
	opsEscalationLabelsToApply,
	parsePostMergeExceptionIssue,
	POST_MERGE_EXCEPTION_SIGNATURE,
} from '../scripts/ci/post_merge_self_heal_backlog.mjs';

function exceptionIssue(overrides = {}) {
	return {
		number: 1900,
		state: 'open',
		title: 'Post-merge closeout exception for PR #1888 / source #1851 / closeout_exception',
		body: [
			POST_MERGE_EXCEPTION_SIGNATURE,
			'',
			'- PR: #1888',
			'- Source issue: #1851',
			'- Validator status: pass',
			'- Remediation required: no',
		].join('\n'),
		labels: [{ name: 'post-merge-failure' }],
		created_at: '2026-06-20T00:00:00Z',
		...overrides,
	};
}

describe('post-merge self-healing backlog matching', () => {
	it('matches post-merge exception issues by title, body signature, or label', () => {
		expect(isPostMergeExceptionIssue(exceptionIssue({ labels: [] }))).toBe(true);
		expect(isPostMergeExceptionIssue(exceptionIssue({ title: 'Other title' }))).toBe(true);
		expect(isPostMergeExceptionIssue(exceptionIssue({
			title: 'Other title',
			body: 'Other body',
			labels: [{ name: 'post-merge-failure' }],
		}))).toBe(true);
		expect(isPostMergeExceptionIssue({ title: 'Unrelated issue', body: '', labels: [] })).toBe(false);
	});

	it('excludes ops-pr-escalation issues from backlog scan candidates', () => {
		const escalated = exceptionIssue({
			labels: [{ name: 'post-merge-failure' }, { name: OPS_PR_ESCALATION_LABEL }],
		});
		expect(hasOpsPrEscalationLabel(escalated)).toBe(true);
		expect(isBacklogScanCandidate(escalated)).toBe(false);
		expect(isBacklogScanCandidate(exceptionIssue())).toBe(true);
	});

	it('adds post-merge-failure when applying ops-pr-escalation without it', () => {
		expect(opsEscalationLabelsToApply(['post-merge-self-healing'])).toEqual([
			'post-merge-failure',
			OPS_PR_ESCALATION_LABEL,
		]);
		expect(opsEscalationLabelsToApply(['post-merge-failure'])).toEqual([OPS_PR_ESCALATION_LABEL]);
	});

	it('parses PR, source, failure, and canonical evidence from issue bodies', () => {
		const parsed = parsePostMergeExceptionIssue(exceptionIssue({
			body: [
				POST_MERGE_EXCEPTION_SIGNATURE,
				'- PR: #1888',
				'- Source issue: #1851',
				'## Detected failure condition',
				'- closeout_blocker_declared: blocked scaffold',
				'Canonical remediation issue: #1902',
			].join('\n'),
		}));

		expect(parsed).toMatchObject({
			pr_number: 1888,
			source_issue: 1851,
			failure_code: 'closeout_blocker_declared',
			canonical_issue: 1902,
		});
	});
});

describe('post-merge self-healing backlog classification', () => {
	it('reports required burn-down counts for safe stale and duplicate issues', () => {
		const issues = [
			exceptionIssue({
				number: 1900,
				created_at: '2026-06-20T00:00:00Z',
				body: [
					POST_MERGE_EXCEPTION_SIGNATURE,
					'',
					'- PR: #1888',
					'- Source issue: #1851',
					'- Validator status: pass',
					'- Remediation required: no',
					'Newer canonical issue: #1901',
				].join('\n'),
			}),
			exceptionIssue({ number: 1901, created_at: '2026-06-21T00:00:00Z' }),
			exceptionIssue({
				number: 1902,
				source_issue: 1852,
				body: [
					POST_MERGE_EXCEPTION_SIGNATURE,
					'- PR: #1889',
					'- Source issue: #1852',
					'## Detected failure condition',
					'- missing_reviewer_disposition: reviewer evidence is ambiguous',
				].join('\n'),
			}),
		];

		const report = buildBacklogReport({
			issues,
			sourceIssuesByNumber: {
				1851: { number: 1851, state: 'closed', state_reason: 'completed', labels: [{ name: 'status:complete' }] },
				1852: { number: 1852, state: 'open', labels: [{ name: 'status:active' }] },
			},
			dryRun: true,
		});

		expect(report.summary).toMatchObject({
			total_scanned: 3,
			auto_close_planned: 2,
			duplicate_closures_planned: 1,
			preserved_active_source_issues: 1,
			before_open_post_merge_issue_count: 3,
			after_open_post_merge_issue_count: 3,
		});
		expect(report.classifications.find((entry) => entry.issue_number === 1900).disposition)
			.toBe(BACKLOG_DISPOSITIONS.DUPLICATE_OF_CANONICAL_REMEDIATION);
	});

	it('does not close duplicate groups without explicit canonical evidence', () => {
		const report = buildBacklogReport({
			issues: [
				exceptionIssue({ number: 1900, created_at: '2026-06-20T00:00:00Z' }),
				exceptionIssue({ number: 1901, created_at: '2026-06-21T00:00:00Z' }),
			],
			sourceIssuesByNumber: {
				1851: { number: 1851, state: 'open', labels: [{ name: 'status:active' }] },
			},
			dryRun: true,
		});

		expect(report.summary.duplicate_closures_planned).toBe(0);
		expect(report.classifications.every((entry) =>
			entry.disposition !== BACKLOG_DISPOSITIONS.DUPLICATE_OF_CANONICAL_REMEDIATION,
		)).toBe(true);
	});

	it('emits parsed issue metadata for detector ingestion', () => {
		const report = buildBacklogReport({
			issues: [exceptionIssue()],
			sourceIssuesByNumber: {},
			dryRun: true,
		});

		expect(report.exceptionIssues[0]).toMatchObject({
			linked_pr: 1888,
			pr_number: 1888,
			linked_source_issue: 1851,
			source_issue: 1851,
			failure_code: 'closeout_exception',
			metadata: {
				pr: 1888,
				source_issue: 1851,
				failure_code: 'closeout_exception',
			},
		});
	});

	it('preserves ambiguous reviewer/source/verification evidence', () => {
		const report = buildBacklogReport({
			issues: [
				exceptionIssue({
					number: 1903,
					body: [
						POST_MERGE_EXCEPTION_SIGNATURE,
						'- PR: #1890',
						'- Source issue candidates: #1850, #1851',
						'## Reviewer findings',
						'- trusted reviewer finding lacks disposition',
					].join('\n'),
				}),
			],
			sourceIssuesByNumber: {},
			dryRun: true,
		});

		expect(report.classifications[0].disposition)
			.toBe(BACKLOG_DISPOSITIONS.PRESERVE_AMBIGUOUS_EVIDENCE);
		expect(report.summary.preserved_ambiguous_issues).toBe(1);
	});

	it('skips issues already labeled ops-pr-escalation during backlog scans', () => {
		const report = buildBacklogReport({
			issues: [
				exceptionIssue({ number: 1900 }),
				exceptionIssue({
					number: 1901,
					labels: [{ name: 'post-merge-failure' }, { name: OPS_PR_ESCALATION_LABEL }],
				}),
			],
			sourceIssuesByNumber: { 1851: null },
			dryRun: true,
		});

		expect(report.summary).toMatchObject({
			total_open_post_merge_exception_issues: 2,
			skipped_already_escalated: 1,
			total_scanned: 1,
		});
	});

	it('does not throw when fetched source issue metadata is null', () => {
		const report = buildBacklogReport({
			issues: [exceptionIssue()],
			sourceIssuesByNumber: { 1851: null },
			dryRun: true,
		});

		expect(report.summary.total_scanned).toBe(1);
		expect(report.classifications[0].disposition)
			.toBe(BACKLOG_DISPOSITIONS.PRESERVE_AMBIGUOUS_EVIDENCE);
	});

	it('does not treat generated Queue advancement status boilerplate as unsafe (#2117)', () => {
		// Historical exception bodies still contain the structured hygiene code plus
		// generated remediation boilerplate that previously false-escalated.
		const body = [
			POST_MERGE_EXCEPTION_SIGNATURE,
			'',
			'- PR: #2116',
			'- Source issue: #2113',
			'- Validator status: fail',
			'- Remediation required: yes',
			'- Queue advancement status: stopped; reviewer exception or remediation issue requires ChatGPT/Bill review',
			'',
			'## Detected failure condition',
			'- missing_required_section: PR body is missing ## CHANGE SUMMARY.',
			'',
			'## Required ChatGPT/Bill decision',
			'- Decide whether the source issue may be closed, corrected, or kept open.',
			'- Queue advancement remains stopped until the exception is resolved.',
			'',
			'## Rollback recommendation',
			'- Consider reverting the merge commit if the merged change cannot be corrected quickly and production/orchestration risk remains.',
		].join('\n');
		const parsed = parsePostMergeExceptionIssue(exceptionIssue({
			number: 2117,
			title: 'Post-merge closeout exception for PR #2116 / source #2113 / missing_required_section',
			body,
		}));

		expect(body).toContain('Queue advancement status');
		expect(body).toContain('Required ChatGPT/Bill decision');
		expect(extractDetectedFailureConditions(body)).toEqual([
			expect.objectContaining({ code: 'missing_required_section' }),
		]);
		expect(hasUnsafeOperatorSignal(parsed)).toBe(false);
	});

	it('still escalates structured secret/token/runtime/production defects as unsafe', () => {
		const parsed = parsePostMergeExceptionIssue(exceptionIssue({
			number: 2118,
			body: [
				POST_MERGE_EXCEPTION_SIGNATURE,
				'- PR: #2116',
				'- Source issue: #2113',
				'## Detected failure condition',
				'- auth_token_secret_failure: missing token configuration blocks closeout',
				'',
				'## Rollback recommendation',
				'- Consider reverting the merge commit if production risk remains.',
			].join('\n'),
		}));

		expect(hasUnsafeOperatorSignal(parsed)).toBe(true);
		const report = buildBacklogReport({
			issues: [exceptionIssue({
				number: 2118,
				body: parsed.body,
			})],
			sourceIssuesByNumber: {
				2113: { number: 2113, state: 'closed', state_reason: 'completed', labels: [{ name: 'status:complete' }] },
			},
			dryRun: true,
		});
		expect(report.classifications[0].disposition)
			.toBe(BACKLOG_DISPOSITIONS.UNSAFE_OPERATOR_REVIEW_REQUIRED);
	});

	it('safe-closes historical hygiene exceptions when the source issue is closed complete', () => {
		const body = [
			POST_MERGE_EXCEPTION_SIGNATURE,
			'',
			'- PR: #2116',
			'- Source issue: #2113',
			'- Validator status: pass',
			'- Remediation required: no',
			'- Queue advancement status: stopped; ChatGPT/Bill review required',
			'',
			'## Detected failure condition',
			'- missing_required_section: PR body is missing ## CHANGE SUMMARY.',
			'',
			'## Required ChatGPT/Bill decision',
			'- Decide whether the source issue may be closed, corrected, or kept open.',
		].join('\n');
		const report = buildBacklogReport({
			issues: [exceptionIssue({
				number: 2117,
				title: 'Post-merge closeout exception for PR #2116 / source #2113 / missing_required_section',
				body,
			})],
			sourceIssuesByNumber: {
				2113: { number: 2113, state: 'closed', state_reason: 'completed', labels: [{ name: 'status:complete' }] },
			},
			dryRun: true,
		});

		expect(report.classifications[0]).toMatchObject({
			disposition: BACKLOG_DISPOSITIONS.SAFE_TO_CLOSE,
			safe_to_close: true,
			source_issue: 2113,
		});
		expect(report.summary.auto_close_planned).toBe(1);
		expect(report.summary.unsafe_escalated_issues).toBe(0);
	});

	it('does not safe-close #3462-shaped exceptions when #3069-shaped source is OPEN with terminal labels', () => {
		const report = buildBacklogReport({
			issues: [exceptionIssue({
				number: 3462,
				title: 'Post-merge closeout exception for PR #3461 / source #3069 / unresolved_exception_chain',
				body: [
					POST_MERGE_EXCEPTION_SIGNATURE,
					'',
					'- PR: #3461',
					'- Source issue: #3069',
					'- Validator status: pass',
					'- Remediation required: no',
					'',
					'## Detected failure condition',
					'- unresolved_exception_chain: original source-Issue terminal closeout is withheld while exception Issues remain open.',
				].join('\n'),
				labels: [{ name: 'post-merge-failure' }, { name: 'agent:cursor' }],
			})],
			sourceIssuesByNumber: {
				3069: {
					number: 3069,
					state: 'open',
					state_reason: null,
					labels: [{ name: 'status:complete' }, { name: 'pmo:closed' }, { name: 'agent:cursor' }],
				},
			},
			dryRun: true,
		});

		expect(report.classifications[0]).toMatchObject({
			disposition: BACKLOG_DISPOSITIONS.PRESERVE_SOURCE_STATE_RECONCILIATION,
			safe_to_close: false,
			source_issue: 3069,
		});
		expect(report.classifications[0].reason).toMatch(/OPEN while carrying terminal labels/);
		expect(report.summary.auto_close_planned).toBe(0);
		expect(report.summary.preserved_source_state_reconciliation_issues).toBe(1);
		expect(dispositionComment(report.classifications[0])).toContain('PMO/source-state reconciliation');
		expect(dispositionComment(report.classifications[0])).toContain('will apply `ops-pr-escalation`');
	});

	it('keeps unsafe operator evidence ahead of mixed open/terminal source-state reconciliation', () => {
		const report = buildBacklogReport({
			issues: [exceptionIssue({
				number: 3462,
				title: 'Post-merge closeout exception for PR #3461 / source #3069 / auth_token_secret_failure',
				body: [
					POST_MERGE_EXCEPTION_SIGNATURE,
					'',
					'- PR: #3461',
					'- Source issue: #3069',
					'## Detected failure condition',
					'- auth_token_secret_failure: missing token configuration blocks closeout',
				].join('\n'),
			})],
			sourceIssuesByNumber: {
				3069: {
					number: 3069,
					state: 'open',
					labels: [{ name: 'status:complete' }, { name: 'pmo:closed' }],
				},
			},
			dryRun: true,
		});

		expect(report.classifications[0]).toMatchObject({
			disposition: BACKLOG_DISPOSITIONS.UNSAFE_OPERATOR_REVIEW_REQUIRED,
			safe_to_close: false,
			source_issue: 3069,
		});
		expect(report.summary.unsafe_escalated_issues).toBe(1);
		expect(report.summary.preserved_source_state_reconciliation_issues).toBe(0);
	});

	it('safe-closes #3462-shaped exceptions after the source is genuinely closed-complete', () => {
		const report = buildBacklogReport({
			issues: [exceptionIssue({
				number: 3462,
				title: 'Post-merge closeout exception for PR #3461 / source #3069 / unresolved_exception_chain',
				body: [
					POST_MERGE_EXCEPTION_SIGNATURE,
					'',
					'- PR: #3461',
					'- Source issue: #3069',
					'- Validator status: pass',
					'- Remediation required: no',
				].join('\n'),
			})],
			sourceIssuesByNumber: {
				3069: {
					number: 3069,
					state: 'closed',
					state_reason: 'completed',
					labels: [{ name: 'status:complete' }, { name: 'pmo:closed' }],
				},
			},
			dryRun: true,
		});

		expect(report.classifications[0]).toMatchObject({
			disposition: BACKLOG_DISPOSITIONS.SAFE_TO_CLOSE,
			safe_to_close: true,
			source_issue: 3069,
		});
		expect(report.summary.auto_close_planned).toBe(1);
	});
});

describe('post-merge self-healing backlog execution', () => {
	it('closes only deterministic stale/duplicate issues and comments on preserved issues', async () => {
		const report = buildBacklogReport({
			issues: [
				exceptionIssue({
					number: 1900,
					created_at: '2026-06-20T00:00:00Z',
					body: [
						POST_MERGE_EXCEPTION_SIGNATURE,
						'',
						'- PR: #1888',
						'- Source issue: #1851',
						'- Validator status: pass',
						'- Remediation required: no',
						'Newer canonical issue: #1901',
					].join('\n'),
				}),
				exceptionIssue({ number: 1901, created_at: '2026-06-21T00:00:00Z' }),
				exceptionIssue({
					number: 1902,
					body: [
						POST_MERGE_EXCEPTION_SIGNATURE,
						'- PR: #1889',
						'- Source issue: #1852',
						'## Detected failure condition',
						'- missing_reviewer_disposition: reviewer evidence is ambiguous',
					].join('\n'),
				}),
			],
			sourceIssuesByNumber: {
				1851: { number: 1851, state: 'closed', state_reason: 'completed', labels: [{ name: 'status:complete' }] },
				1852: { number: 1852, state: 'closed', state_reason: 'completed', labels: [{ name: 'status:complete' }] },
			},
			dryRun: false,
		});
		const calls = [];
		const outcome = await executeBacklogReport(report, {
			dryRun: false,
			token: 'token',
			repository: 'owner/repo',
			requestFn: async (args) => {
				calls.push(args);
				return {};
			},
		});

		const patches = calls.filter((call) => call.method === 'PATCH');
		const comments = calls.filter((call) => call.path.endsWith('/comments'));
		const repoLabelCreates = calls.filter((call) => call.path === '/labels' && call.method === 'POST');
		const issueLabelAdds = calls.filter((call) => /^\/issues\/\d+\/labels$/.test(call.path) && call.method === 'POST');

		expect(outcome.summary.closed).toBe(2);
		expect(outcome.summary.ops_escalated).toBe(1);
		expect(patches.map((call) => call.path)).toEqual(['/issues/1900', '/issues/1901']);
		expect(comments).toHaveLength(3);
		expect(repoLabelCreates).toHaveLength(1);
		expect(issueLabelAdds).toHaveLength(1);
		expect(issueLabelAdds[0].path).toBe('/issues/1902/labels');
		expect(issueLabelAdds[0].body).toEqual({ labels: [OPS_PR_ESCALATION_LABEL] });
		expect(dispositionComment(report.classifications[2])).toContain('ops-pr-escalation');
	});
});
