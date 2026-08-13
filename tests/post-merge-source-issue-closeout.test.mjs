import { describe, expect, it, vi } from 'vitest';

import { linkedIssueNumber, branchIssueTokens, resolveSourceIssueFromPr, sourceIssueAccounting } from '../scripts/ci/issue_accounting.mjs';
import {
	buildFailureCloseoutComment,
	buildSourceIssueCloseoutComment,
	canIdempotentlyNormalizeClosedCompletedSourceIssue,
	isClosedCompletedSourceIssue,
	isRemediationIssue,
	isUmbrellaSourceIssue,
	planActiveSourceIssueRelabel,
	planFailureSourceIssueRelabel,
	planTerminalLabelReconciliation,
	postMergeVerificationResult,
	requestsSourceIssueTerminalClose,
	resolveSourceIssueCloseoutMode,
	shouldCloseSourceIssue,
	shouldKeepActiveSourceIssueOpen,
	shouldPreserveSourceIssueOpen,
	shouldReopenActiveSourceIssue,
	shouldReopenUmbrellaSourceIssue,
	STALE_SOURCE_ISSUE_LABELS,
} from '../scripts/ci/post_merge_source_issue_closeout.mjs';
import {
	applyClericalSourceIssueCorrection,
	blockingMetadataFailures,
	buildResult,
	correctPrimaryIssueLineInBody,
	evaluateClericalSourceIssueLinkage,
	metadataFailures,
	parseClericalSourceIssueReconciliation,
	sourceIssueStateFailures,
} from '../scripts/ci/post_merge_validator.mjs';
import {
	selfHealingCanResolve,
	shouldUpsertRemediationIssue,
} from '../scripts/ci/post_merge_remediation_issue.mjs';
import {
	duplicateCloseComment,
	groupRemediationIssues,
	planDuplicateClosures,
	parseRemediationIssue,
} from '../scripts/ci/close_duplicate_remediation_issues.mjs';

const baseBody = [
	'- **Issue:** #1196',
	'',
	'## CHANGE SUMMARY',
	'- change',
	'',
	'## BUILD / TEST / VERIFICATION',
	'- PASS',
	'',
	'## ACCEPTANCE CRITERIA',
	'- pass',
	'',
	'## REQUIRED PRE-REVIEW SELF-CHECK',
	'- done',
].join('\n');

function remediationIssue({ number, createdAt, pr = '1239', mergeSha = 'abc123', sourceIssue = '1196' }) {
	return {
		number,
		html_url: `https://github.test/repo/issues/${number}`,
		created_at: createdAt,
		title: `Post-merge remediation required for PR #${pr}`,
		body: [
			'Post-merge validation detected follow-up work.',
			'',
			`- PR: #${pr}`,
			`- Merge SHA: ${mergeSha}`,
			`- Source issue: #${sourceIssue}`,
			'- Validator status: fail',
			'- Remediation required: yes',
		].join('\n'),
	};
}

describe('issue accounting formats', () => {
	it('parses canonical and orchestrator source issue markers', () => {
		expect(linkedIssueNumber('- **Issue:** #1196')).toBe('1196');
		expect(linkedIssueNumber('Issue: https://github.com/org/repo/issues/1196')).toBe('1196');
		expect(linkedIssueNumber('<!-- orchestrator-source-issue: 1196 -->')).toBe('1196');
	});

	it('resolves post-merge source issues by deterministic metadata precedence', () => {
		expect(resolveSourceIssueFromPr({ body: '- **Issue:** #1196', title: 'fix(#1196): same issue', headRefName: 'codex/1196-same-issue' }).issueNumber).toBe('1196');
		expect(resolveSourceIssueFromPr({ body: '', title: 'fix(#1197): closeout hardening', headRefName: 'codex/closeout-hardening' }).issueNumber).toBe('1197');
		expect(resolveSourceIssueFromPr({ body: '', title: 'closeout hardening', headRefName: 'codex/1198-closeout-hardening' }).issueNumber).toBe('1198');
		expect(resolveSourceIssueFromPr({ body: '<!-- orchestrator-source-issue: 1199 -->', title: 'closeout hardening', headRefName: 'codex/closeout-hardening' }).issueNumber).toBe('1199');
	});

	it('trusts authoritative closeout body lines over conflicting title and branch tokens', () => {
		expect(resolveSourceIssueFromPr({
			body: '- **Issue:** #1787',
			title: 'ops(#1787): remediate PR #1786 closeout body and reconcile #1777 labels',
			headRefName: 'cursor/closeout-1786-remediation-ff39',
		})).toMatchObject({
			issueNumber: '1787',
			source: 'primary-body-line',
			failures: [],
		});
		expect(resolveSourceIssueFromPr({
			body: '- **Issue:** #2345',
			title: 'ops(#2345): remediate #2340 post-merge closeout for #2286',
			headRefName: 'cursor/2286-closeout-housekeeping-2e48',
		})).toMatchObject({
			issueNumber: '2345',
			source: 'primary-body-line',
			failures: [],
		});
	});

	it('fails closed when source issue metadata is missing or ambiguous', () => {
		expect(resolveSourceIssueFromPr({ body: '', title: 'closeout hardening', headRefName: 'codex/closeout-hardening' }).failures).toContainEqual(
			expect.objectContaining({ code: 'missing_source_issue' }),
		);
		expect(resolveSourceIssueFromPr({ body: '', title: 'fix(#1197): closeout', headRefName: 'codex/1198-closeout' }).failures).toContainEqual(
			expect.objectContaining({ code: 'ambiguous_source_issue_candidates' }),
		);
	});

	it('fails deterministically on invalid or external title issue references', () => {
		expect(
			resolveSourceIssueFromPr({
				body: '',
				title: 'fix(https://github.com/other/repo/issues/1200): closeout hardening',
				headRefName: 'codex/1201-closeout-hardening',
			}, { repository: 'owner/repo' }).failures,
		).toContainEqual(expect.objectContaining({ code: 'invalid_source_issue_reference' }));
	});

	it('extracts intentional branch issue tokens without semver or suffix noise', () => {
		expect(branchIssueTokens('codex/2323-post-merge-closeout-hardening').issueNumbers).toEqual(['2323']);
		expect(branchIssueTokens('cursor/2334-post-merge-source-issue-resolver').issueNumbers).toEqual(['2334']);
		expect(branchIssueTokens('feature/#2334-closeout').issueNumbers).toEqual(['2334']);
		expect(branchIssueTokens('dependabot/npm_and_yarn/pkg-1.2.3').issueNumbers).toEqual([]);
		expect(branchIssueTokens('codex/2323-task-2').issueNumbers).toEqual(['2323']);
	});

	it('does not treat version or suffix digits as conflicting branch candidates when body resolves', () => {
		const dependabotResolution = resolveSourceIssueFromPr({
			body: '- **Issue:** #2334',
			title: 'fix(ci): dependency bump',
			headRefName: 'dependabot/npm_and_yarn/pkg-1.2.3',
		});
		expect(dependabotResolution.issueNumber).toBe('2334');
		expect(dependabotResolution.failures).toEqual([]);

		const suffixResolution = resolveSourceIssueFromPr({
			body: '- **Issue:** #2323',
			title: 'fix(ci): closeout hardening',
			headRefName: 'codex/2323-task-2',
		});
		expect(suffixResolution.issueNumber).toBe('2323');
		expect(suffixResolution.failures).toEqual([]);
	});

	it('rejects ambiguous and external post-merge source issue accounting', () => {
		expect(sourceIssueAccounting('- **Issue:** #1196\n- Issue: #1197').failures).toContainEqual(
			expect.objectContaining({ code: 'multiple_source_issues' }),
		);
		expect(
			sourceIssueAccounting('- **Issue:** https://github.com/other/repo/issues/1196', {
				repository: 'owner/repo',
			}).failures,
		).toContainEqual(expect.objectContaining({ code: 'invalid_source_issue_reference' }));
	});
});

describe('source issue closeout decision', () => {
	it('closes only after successful post-merge validation without remediation', () => {
		const result = buildResult({ pr: { body: baseBody }, resolution: { pr: '1239' }, mergeSha: 'deadbeef' });

		expect(result).toMatchObject({ status: 'pass', sync_action: 'post_merge_success', remediation_required: false });
		expect(
			shouldCloseSourceIssue({
				action: 'post_merge_success',
				issueNumber: '1196',
				isMerged: true,
				postMergeResult: result,
				issueMeta: { title: 'CI task', labels: ['orchestrator', 'status:post-merge-verify'] },
			}),
		).toEqual({ close: true, reason: 'post_merge_validation_success' });
	});

	it('does not close on failed validation', () => {
		const result = buildResult({
			pr: { body: baseBody },
			resolution: { pr: '1239' },
			metadata: [{ code: 'closeout_blocker_declared', message: 'blocked scaffold' }],
		});

		expect(result.sync_action).toBe('post_merge_failure');
		expect(
			shouldCloseSourceIssue({
				action: 'post_merge_failure',
				issueNumber: '1196',
				isMerged: true,
				postMergeResult: result,
			}),
		).toMatchObject({ close: false });
	});

	it('does not close when undispositioned reviewer findings remain', () => {
		expect(
			shouldCloseSourceIssue({
				action: 'post_merge_success',
				issueNumber: '1196',
				isMerged: true,
				postMergeResult: {
					status: 'pass',
					remediation_required: false,
					reviewer_disposition_failures: [{
						code: 'undispositioned_reviewer_comment',
						message: 'Trusted reviewer comment 9001 lacks required PR-body disposition.',
					}],
				},
			}),
		).toMatchObject({ close: false, reason: 'undispositioned_reviewer_findings' });
	});

	it('does not close when remediation remains required', () => {
		const result = buildResult({
			pr: { body: baseBody },
			resolution: { pr: '1239' },
			failures: [
				{
					workflow: 'GATE — Reviewer Response Completion',
					classification: 'optional-remediation-failure',
					required: true,
					conclusion: 'failure',
				},
			],
		});

		expect(result).toMatchObject({ status: 'fail', sync_action: 'post_merge_failure', remediation_required: true });
		expect(
			shouldCloseSourceIssue({
				action: 'post_merge_failure',
				issueNumber: '1196',
				isMerged: true,
				postMergeResult: result,
			}),
		).toMatchObject({ close: false, reason: 'action_post_merge_failure' });
	});

	it('does not close when the linked issue cannot be identified', () => {
		expect(
			shouldCloseSourceIssue({
				action: 'post_merge_success',
				issueNumber: '',
				isMerged: true,
				postMergeResult: { status: 'pass', remediation_required: false },
			}),
		).toMatchObject({ close: false, reason: 'missing_source_issue' });
	});

	it('keeps active child project issues open when disposition requires status:active', () => {
		const body = [
			baseBody,
			'',
			'## POST-MERGE ISSUE DISPOSITION',
			'- Source issue **#1258** remains **open** with `status:active`; remove only `status:post-merge-verify`; **do not close** #1258',
		].join('\n');

		expect(shouldKeepActiveSourceIssueOpen(body)).toBe(true);
		expect(
			shouldCloseSourceIssue({
				action: 'post_merge_success',
				issueNumber: '1258',
				isMerged: true,
				postMergeResult: { status: 'pass', remediation_required: false },
				issueMeta: {
					title: 'PROJECT: Website Operations Admin',
					labels: ['type:website', 'status:active', 'status:post-merge-verify', 'website'],
				},
				prBody: body,
			}),
		).toEqual({ close: false, reason: 'active_source_issue_remains_open' });
		expect(
			planActiveSourceIssueRelabel({
				issueLabels: ['type:website', 'status:active', 'status:post-merge-verify', 'website'],
			}),
		).toMatchObject({
			ok: true,
			removeLabels: ['status:post-merge-verify'],
			summary: expect.stringContaining('preserve status:active'),
		});
	});

	it('recognizes active-source disposition with do-not-apply-terminal-close phrasing', () => {
		const body = [
			baseBody,
			'',
			'## POST-MERGE ISSUE DISPOSITION',
			'- Source issue **#1258** remains **open** with `status:active`; **reopen #1258** if incorrectly closed; **do not apply terminal close**',
		].join('\n');

		expect(shouldKeepActiveSourceIssueOpen(body)).toBe(true);
		expect(shouldReopenActiveSourceIssue(body)).toBe(true);
	});

	it('allows closed active child project issues during closeout metadata validation', () => {
		const body = [
			baseBody,
			'',
			'## POST-MERGE ISSUE DISPOSITION',
			'- Source issue **#1258** remains **open** with `status:active`; **reopen #1258** if incorrectly closed; **do not close** #1258',
		].join('\n');
		const failures = blockingMetadataFailures(
			metadataFailures(
				{ body, mergedAt: '2026-06-01T00:00:00Z', baseRefName: 'main', isDraft: false, files: [] },
				() => true,
				{
					repository: 'owner/repo',
					sourceIssue: {
						state: 'CLOSED',
						state_reason: 'completed',
						labels: [{ name: 'status:active' }, { name: 'status:failed' }],
					},
					repoLabels: ['status:complete', 'status:active', 'status:failed'],
				},
			),
		);

		expect(failures).toEqual([]);
	});

	it('treats status:active as a known terminal label during reconciliation', () => {
		expect(
			planTerminalLabelReconciliation({
				issueLabels: ['type:website', 'status:active', 'status:failed', 'website'],
				repoLabels: ['status:complete', 'status:active', 'status:failed'],
			}),
		).toMatchObject({
			ok: true,
			removeLabels: expect.arrayContaining(['status:failed']),
		});
	});

	it('recognizes keep-open language in POST-MERGE CLOSEOUT CHECKLIST', () => {
		const body = [
			baseBody,
			'',
			'## POST-MERGE CLOSEOUT CHECKLIST',
			'- [ ] Source issue `#1259` state inspected after merge — **must remain OPEN** (child project through Phase 4)',
			'- [ ] **Do NOT close `#1259`** — task PR; post-merge automation must not close the project issue',
		].join('\n');

		expect(shouldKeepActiveSourceIssueOpen(body)).toBe(true);
		expect(
			shouldCloseSourceIssue({
				action: 'post_merge_success',
				issueNumber: '1259',
				isMerged: true,
				postMergeResult: { status: 'pass', remediation_required: false },
				issueMeta: {
					title: 'PROJECT: Website QA and Production Validation',
					labels: ['type:website', 'status:active', 'status:post-merge-verify', 'website'],
				},
				prBody: body,
			}),
		).toEqual({ close: false, reason: 'active_source_issue_remains_open' });
	});

	it('keeps PROJECT and PROGRAM umbrella source issues open without explicit terminal close', () => {
		expect(isUmbrellaSourceIssue({ title: 'PROJECT: Website QA and Production Validation' })).toBe(true);
		expect(isUmbrellaSourceIssue({ title: 'PROGRAM: Website Implementation and Content Operations' })).toBe(true);
		expect(isUmbrellaSourceIssue({ title: 'Task 005 fan club work' })).toBe(false);

		expect(
			shouldCloseSourceIssue({
				action: 'post_merge_success',
				issueNumber: '1259',
				isMerged: true,
				postMergeResult: { status: 'pass', remediation_required: false },
				issueMeta: {
					title: 'PROJECT: Website QA and Production Validation',
					labels: ['type:website', 'status:active', 'website'],
				},
				prBody: baseBody,
			}),
		).toEqual({ close: false, reason: 'umbrella_source_issue_remains_open' });
		expect(shouldReopenUmbrellaSourceIssue({
			issueMeta: { title: 'PROJECT: Website QA and Production Validation' },
			prBody: baseBody,
			issueNumber: '1259',
		})).toBe(true);
	});

	it('allows umbrella terminal close only when POST-MERGE ISSUE DISPOSITION authorizes it', () => {
		const body = [
			baseBody,
			'',
			'## POST-MERGE ISSUE DISPOSITION',
			'- Close source issue #1259 after final Phase 4 task; apply terminal close',
		].join('\n');

		expect(requestsSourceIssueTerminalClose(body, '1259')).toBe(true);
		expect(
			shouldCloseSourceIssue({
				action: 'post_merge_success',
				issueNumber: '1259',
				isMerged: true,
				postMergeResult: { status: 'pass', remediation_required: false },
				issueMeta: {
					title: 'PROJECT: Website QA and Production Validation',
					labels: ['type:website', 'status:active', 'website'],
				},
				prBody: body,
			}),
		).toEqual({ close: true, reason: 'post_merge_validation_success' });
	});

	it('does not close remediation issues mis-linked as source issues', () => {
		expect(
			shouldCloseSourceIssue({
				action: 'post_merge_success',
				issueNumber: '1300',
				isMerged: true,
				postMergeResult: { status: 'pass', remediation_required: false },
				issueMeta: {
					title: 'Post-merge remediation required for PR #1239',
					labels: ['post-merge-failure'],
				},
			}),
		).toMatchObject({ close: false, reason: 'remediation_issue' });
		expect(isRemediationIssue({ title: 'Post-merge remediation required for PR #1', labels: [] })).toBe(true);
		expect(isRemediationIssue({ title: 'Post-merge closeout exception for PR #1 / source #2 / missing_source_issue', labels: [] })).toBe(true);
	});
});

describe('source issue closeout evidence', () => {
	it('renders closeout evidence with PR, merge SHA, validator status, and reason', () => {
		const comment = buildSourceIssueCloseoutComment({
			prNumber: '1239',
			mergeSha: 'abc123def456',
			sourceIssueNumber: '1196',
			validatorStatus: 'pass',
			verificationResult: postMergeVerificationResult({ status: 'pass', remediation_required: false }),
			closeoutReason: 'post_merge_validation_success',
			terminalLabelResult: 'remove status:post-merge-verify; add status:complete',
		});

		expect(comment).toContain('PR: #1239');
		expect(comment).toContain('Merge SHA: abc123def456');
		expect(comment).toContain('Source issue: #1196');
		expect(comment).toContain('Validator status: pass');
		expect(comment).toContain('Post-merge verification result: pass');
		expect(comment).toContain('Terminal label result: remove status:post-merge-verify; add status:complete');
		expect(comment).toContain('Closeout reason: post_merge_validation_success');
	});

	it('plans failure-path relabel without closing the source issue', () => {
		const plan = planFailureSourceIssueRelabel({
			issueLabels: ['orchestrator', 'status:post-merge-verify'],
			repoLabels: ['status:failed', 'status:complete'],
		});

		expect(plan).toMatchObject({
			ok: true,
			removeLabels: ['status:post-merge-verify'],
			addLabel: 'status:failed',
		});
	});

	it('preserves status:failed when already present on the source issue', () => {
		const plan = planFailureSourceIssueRelabel({
			issueLabels: ['orchestrator', 'status:post-merge-verify', 'status:failed'],
			repoLabels: ['status:failed', 'status:complete'],
		});

		expect(plan).toMatchObject({
			ok: true,
			removeLabels: ['status:post-merge-verify'],
			addLabel: '',
		});
	});

	it('halts failure-path relabel when status:failed is unavailable in the repository', () => {
		const plan = planFailureSourceIssueRelabel({
			issueLabels: ['orchestrator', 'status:post-merge-verify'],
			repoLabels: ['status:complete'],
		});

		expect(plan).toMatchObject({
			ok: false,
			reason: 'failure_label_unavailable',
			removeLabels: [],
			addLabel: '',
		});
	});

	it('renders failure closeout evidence without claiming success', () => {
		const comment = buildFailureCloseoutComment({
			prNumber: '1567',
			mergeSha: '314c236c986c',
			sourceIssueNumber: '1545',
			syncAction: 'post_merge_failure',
			validatorStatus: 'fail',
			verificationResult: 'fail',
			validationSummary: 'implementation=1; reviewer_disposition=1',
			terminalLabelResult: 'remove status:post-merge-verify; add status:failed',
			remediationIssueUrl: 'https://github.test/repo/issues/1575',
		});

		expect(comment).toContain('did not complete');
		expect(comment).toContain('PR: #1567');
		expect(comment).toContain('Source issue: #1545');
		expect(comment).toContain('Sync action: post_merge_failure');
		expect(comment).toContain('Remediation issue: https://github.test/repo/issues/1575');
	});

	it('lists stale active-state labels cleared on successful closeout', () => {
		expect(STALE_SOURCE_ISSUE_LABELS).toEqual([
			'status:blocked',
			'status:queued',
			'status:assigned',
			'status:failed',
			'status:post-merge-verify',
			'status:pr-draft',
			'status:review',
			'status:implementation',
			'status:implementation-ready',
			'status:ready-for-cursor',
			'status:changes-requested',
			'status:in-progress',
		]);
	});

	it('treats intermediate review labels as removable during terminal reconciliation', () => {
		const plan = planTerminalLabelReconciliation({
			issueLabels: ['agent:cursor', 'status:changes-requested', 'status:in-progress'],
			repoLabels: ['status:complete'],
		});

		expect(plan).toMatchObject({
			ok: true,
			removeLabels: ['status:changes-requested', 'status:in-progress'],
			addLabel: 'status:complete',
		});
	});

	it('recognizes closed completed source issues for idempotent normalization', () => {
		expect(isClosedCompletedSourceIssue({ state: 'closed', state_reason: 'completed' })).toBe(true);
		expect(isClosedCompletedSourceIssue({ state: 'closed', state_reason: 'COMPLETED' })).toBe(true);
		expect(resolveSourceIssueCloseoutMode({
			sourceIssue: { state: 'closed', state_reason: 'completed' },
		})).toBe('closed_completed_idempotent_normalize');
	});

	it('does not treat closed issues with missing or non-completed close reasons as idempotent targets', () => {
		expect(isClosedCompletedSourceIssue({ state: 'closed' })).toBe(false);
		expect(isClosedCompletedSourceIssue({ state: 'closed', state_reason: '' })).toBe(false);
		expect(isClosedCompletedSourceIssue({ state: 'closed', state_reason: 'not_planned' })).toBe(false);
		expect(resolveSourceIssueCloseoutMode({
			sourceIssue: { state: 'closed' },
		})).toBe('exception_required');
	});

	it('does not emit source_issue_not_open for closed completed issues during validation', () => {
		const failures = sourceIssueStateFailures({
			body: baseBody,
			sourceIssue: {
				state: 'closed',
				state_reason: 'completed',
				labels: [{ name: 'status:changes-requested' }],
			},
			repoLabels: [{ name: 'status:complete' }],
		});

		expect(failures).not.toContainEqual(expect.objectContaining({ code: 'source_issue_not_open' }));
		expect(failures).toEqual([]);
	});

	it('allows idempotent label normalization when the source issue is already closed completed', () => {
		const postMergeResult = {
			status: 'pass',
			remediation_required: false,
			reviewer_disposition_failures: [],
		};
		const terminalLabelResult = planTerminalLabelReconciliation({
			issueLabels: ['status:changes-requested'],
			repoLabels: ['status:complete'],
		});

		expect(
			shouldCloseSourceIssue({
				action: 'post_merge_success',
				issueNumber: '2363',
				isMerged: true,
				postMergeResult,
				terminalLabelResult,
				issueMeta: { state: 'closed', state_reason: 'completed', labels: [{ name: 'status:changes-requested' }] },
			}),
		).toEqual({ close: true, reason: 'closed_completed_idempotent_normalize' });
	});

	it('still blocks idempotent normalization when reviewer disposition failures remain', () => {
		expect(
			canIdempotentlyNormalizeClosedCompletedSourceIssue({
				sourceIssue: { state: 'closed', state_reason: 'completed' },
				postMergeResult: {
					status: 'pass',
					remediation_required: false,
					reviewer_disposition_failures: [{ code: 'undispositioned_reviewer_comment' }],
				},
				terminalLabelResult: { ok: true },
			}),
		).toBe(false);
	});

	it('plans terminal label reconciliation including stale failure labels', () => {
		const plan = planTerminalLabelReconciliation({
			issueLabels: ['orchestrator', 'status:post-merge-verify', 'post-merge-failure'],
			repoLabels: ['status:complete'],
		});

		expect(plan).toMatchObject({
			ok: true,
			removeLabels: ['status:post-merge-verify', 'post-merge-failure'],
			addLabel: 'status:complete',
			terminalLabels: ['orchestrator', 'status:complete'],
		});
	});

	it('accepts Set inputs when planning terminal label reconciliation', () => {
		const plan = planTerminalLabelReconciliation({
			issueLabels: new Set(['status:post-merge-verify']),
			repoLabels: new Set(['status:complete']),
		});

		expect(plan).toMatchObject({
			ok: true,
			removeLabels: ['status:post-merge-verify'],
			addLabel: 'status:complete',
		});
	});
});

describe('duplicate remediation issue governance', () => {
	it('still closes only duplicate remediation issues and protects linked source issues', () => {
		const issues = [
			remediationIssue({ number: 1300, createdAt: '2026-06-01T10:00:00Z' }),
			remediationIssue({ number: 1301, createdAt: '2026-06-01T11:00:00Z' }),
		];
		const actions = planDuplicateClosures(groupRemediationIssues(issues));

		expect(actions).toHaveLength(1);
		expect(actions[0].canonical.number).toBe(1300);
		expect(duplicateCloseComment(actions[0])).toContain('Canonical remediation issue: #1300');
	});
});

describe('sync-pr-state successful closeout', () => {
	it('closes the linked source issue with evidence comment and clears stale labels', async () => {
		process.env.GITHUB_REPOSITORY = 'owner/repo';
		const syncPrState = await import('../scripts/orchestrator/sync-pr-state.mjs');
		const run = vi.fn();
		const reconciliations = [];

		const result = syncPrState.syncPrState({
			prNumber: '1239',
			action: 'post_merge_success',
			pr: {
				body: baseBody,
				mergedAt: '2026-06-02T17:21:10Z',
				state: 'MERGED',
				url: 'https://example.test/pr/1239',
				mergeCommit: { oid: 'abc123def456' },
			},
			postMergeResult: {
				status: 'pass',
				remediation_required: false,
				merge_sha: 'abc123def456',
				pr: 1239,
				source_issue: '1196',
				terminal_label_result: {
					ok: true,
					removeLabels: ['status:post-merge-verify', 'post-merge-failure'],
					addLabel: 'status:complete',
					summary: 'remove status:post-merge-verify, post-merge-failure; add status:complete',
				},
			},
			getIssueMeta: () => ({ title: 'CI corrective task', labels: ['orchestrator', 'status:post-merge-verify'], state: 'OPEN' }),
			reconcileTerminalLabelsFn: (...args) => reconciliations.push(args),
			run,
		});

		expect(result).toBe('complete');
		expect(reconciliations).toEqual([[
			'1196',
			expect.objectContaining({
				removeLabels: ['status:post-merge-verify', 'post-merge-failure'],
				addLabel: 'status:complete',
			}),
		]]);
		expect(run).toHaveBeenCalledWith(
			expect.arrayContaining(['issue', 'comment', '1196', '--repo', 'owner/repo', '--body', expect.stringContaining('PR: #1239')]),
		);
		expect(run).toHaveBeenCalledWith(
			expect.arrayContaining(['issue', 'close', '1196', '--repo', 'owner/repo', '--reason', 'completed']),
		);
	});

	it('normalizes labels on already-closed completed source issues without reopening', async () => {
		process.env.GITHUB_REPOSITORY = 'owner/repo';
		const syncPrState = await import('../scripts/orchestrator/sync-pr-state.mjs');
		const run = vi.fn();
		const reconciliations = [];

		const result = syncPrState.syncPrState({
			prNumber: '2420',
			action: 'post_merge_success',
			pr: {
				body: baseBody,
				mergedAt: '2026-07-10T12:58:41Z',
				state: 'MERGED',
				url: 'https://example.test/pr/2420',
				mergeCommit: { oid: '50ca674b2817' },
			},
			postMergeResult: {
				status: 'pass',
				remediation_required: false,
				merge_sha: '50ca674b2817',
				source_issue_closeout_mode: 'closed_completed_idempotent_normalize',
				terminal_label_result: {
					ok: true,
					removeLabels: ['status:changes-requested'],
					addLabel: 'status:complete',
					summary: 'remove status:changes-requested; add status:complete',
				},
			},
			getIssueMeta: () => ({
				title: 'Docs task',
				labels: ['agent:cursor', 'status:changes-requested'],
				state: 'CLOSED',
				state_reason: 'completed',
			}),
			reconcileTerminalLabelsFn: (...args) => reconciliations.push(args),
			run,
		});

		expect(result).toBe('complete');
		expect(reconciliations).toHaveLength(1);
		expect(run).not.toHaveBeenCalledWith(
			expect.arrayContaining(['issue', 'close', '1196']),
		);
		expect(run).toHaveBeenCalledWith(
			expect.arrayContaining(['issue', 'comment', '1196', '--repo', 'owner/repo', '--body', expect.stringContaining('PR: #2420')]),
		);
	});

	it('closes source issues resolved from PR title metadata when the body lacks accounting', async () => {
		process.env.GITHUB_REPOSITORY = 'owner/repo';
		const syncPrState = await import('../scripts/orchestrator/sync-pr-state.mjs');
		const run = vi.fn();

		const result = syncPrState.syncPrState({
			prNumber: '1240',
			action: 'post_merge_success',
			pr: {
				body: baseBody.replace('- **Issue:** #1196', ''),
				title: 'fix(#1240): close title resolved source',
				headRefName: 'codex/title-resolved-source',
				mergedAt: '2026-06-02T17:21:10Z',
				state: 'MERGED',
				url: 'https://example.test/pr/1240',
			},
			postMergeResult: { status: 'pass', remediation_required: false },
			getRepoLabels: () => new Set(['status:complete', 'status:post-merge-verify']),
			getIssueMeta: () => ({ title: 'Title sourced task', labels: ['status:post-merge-verify'], state: 'OPEN' }),
			reconcileTerminalLabelsFn: vi.fn(),
			run,
		});

		expect(result).toBe('complete');
		expect(run).toHaveBeenCalledWith(
			expect.arrayContaining(['issue', 'close', '1240', '--repo', 'owner/repo', '--reason', 'completed']),
		);
	});

	it('blocks alternate-program lane issues resolved from PR title metadata', () => {
		const failures = blockingMetadataFailures(
			metadataFailures(
				{
					body: baseBody.replace('- **Issue:** #1196', ''),
					title: 'fix(#1255): alternate program lane',
					headRefName: 'codex/alternate-program-lane',
					mergedAt: '2026-06-01T00:00:00Z',
					baseRefName: 'main',
					isDraft: false,
					files: [],
				},
				() => true,
				{ repository: 'owner/repo' },
			),
		);

		expect(failures).toContainEqual(expect.objectContaining({ code: 'active_alternate_program_lane' }));
	});

	it('blocks alternate-program lane issues resolved from branch metadata', () => {
		const failures = blockingMetadataFailures(
			metadataFailures(
				{
					body: baseBody.replace('- **Issue:** #1196', ''),
					title: 'closeout hardening',
					headRefName: 'codex/1255-closeout-hardening',
					mergedAt: '2026-06-01T00:00:00Z',
					baseRefName: 'main',
					isDraft: false,
					files: [],
				},
				() => true,
				{ repository: 'owner/repo' },
			),
		);

		expect(failures).toContainEqual(expect.objectContaining({ code: 'active_alternate_program_lane' }));
	});

	it('allows closed-source reconciliation when PR body matches follow-up language even without closeout mode metadata', () => {
		expect(
			shouldCloseSourceIssue({
				action: 'post_merge_success',
				issueNumber: '1411',
				isMerged: true,
				prBody: 'Post-merge closeout reconciliation follow-up for prior PR #1472.',
				postMergeResult: { status: 'pass', remediation_required: false },
				issueMeta: {
					title: 'PMO task',
					labels: ['status:post-merge-verify'],
					state: 'CLOSED',
					state_reason: 'COMPLETED',
				},
				terminalLabelResult: {
					ok: true,
					removeLabels: ['status:post-merge-verify'],
					addLabel: 'status:complete',
				},
			}),
		).toEqual({ close: true, reason: 'post_merge_validation_success' });
	});

	it('reconciles permitted already-closed remediation follow-ups without closing again', async () => {
		process.env.GITHUB_REPOSITORY = 'owner/repo';
		const syncPrState = await import('../scripts/orchestrator/sync-pr-state.mjs');
		const run = vi.fn();
		const reconciliations = [];

		const result = syncPrState.syncPrState({
			prNumber: '1413',
			action: 'post_merge_success',
			pr: {
				body: '- **Issue:** #1410\n\nRemediation follow-up for PR #1412.',
				mergedAt: '2026-06-07T17:21:10Z',
				state: 'MERGED',
				url: 'https://example.test/pr/1413',
			},
			postMergeResult: {
				status: 'pass',
				remediation_required: false,
				source_issue_closeout_mode: 'closed_remediation_followup',
				terminal_label_result: {
					ok: true,
					removeLabels: ['status:post-merge-verify', 'post-merge-failure'],
					addLabel: 'status:complete',
					summary: 'remove status:post-merge-verify, post-merge-failure; add status:complete',
				},
			},
			getIssueMeta: () => ({ title: 'Remediation source', labels: ['status:post-merge-verify', 'post-merge-failure'], state: 'CLOSED' }),
			reconcileTerminalLabelsFn: (...args) => reconciliations.push(args),
			run,
		});

		expect(result).toBe('complete');
		expect(reconciliations).toHaveLength(1);
		expect(run).toHaveBeenCalledWith(
			expect.arrayContaining(['issue', 'comment', '1410', '--repo', 'owner/repo', '--body', expect.stringContaining('closed_remediation_followup')]),
		);
		expect(run).not.toHaveBeenCalledWith(expect.arrayContaining(['issue', 'close', '1410']));
	});

	it('reopens incorrectly closed active child project issues during active closeout', async () => {
		process.env.GITHUB_REPOSITORY = 'owner/repo';
		const syncPrState = await import('../scripts/orchestrator/sync-pr-state.mjs');
		const run = vi.fn();
		const reconciliations = [];
		let metaReads = 0;

		const result = syncPrState.syncPrState({
			prNumber: '1536',
			action: 'post_merge_success',
			pr: {
				body: [
					'- **Issue:** #1258',
					'## POST-MERGE ISSUE DISPOSITION',
					'- Source issue **#1258** remains **open** with `status:active`; **reopen #1258** if incorrectly closed; **do not close** #1258',
				].join('\n'),
				mergedAt: '2026-06-10T14:15:36Z',
				state: 'MERGED',
				url: 'https://example.test/pr/1536',
				mergeCommit: { oid: '62ca227c5939f9a852bd8268d2bcdf406a35d1ba' },
			},
			postMergeResult: {
				status: 'pass',
				remediation_required: false,
				merge_sha: '62ca227c5939f9a852bd8268d2bcdf406a35d1ba',
				source_issue: '1258',
				source_issue_closeout_mode: 'open_source_issue',
				terminal_label_result: {
					ok: true,
					removeLabels: ['status:failed'],
					addLabel: '',
					summary: 'remove status:failed; preserve status:active',
				},
			},
			getRepoLabels: () => new Set(['status:active', 'status:failed', 'status:complete']),
			getIssueMeta: () => {
				metaReads += 1;
				return metaReads === 1
					? { title: 'PROJECT: Website Operations Admin', labels: ['status:active', 'status:failed'], state: 'CLOSED' }
					: { title: 'PROJECT: Website Operations Admin', labels: ['status:active'], state: 'OPEN' };
			},
			reconcileTerminalLabelsFn: (...args) => reconciliations.push(args),
			run,
		});

		expect(result).toBe('active_relabeled');
		expect(run).toHaveBeenCalledWith(['issue', 'reopen', '1258', '--repo', 'owner/repo']);
		expect(run).not.toHaveBeenCalledWith(expect.arrayContaining(['issue', 'close', '1258']));
	});

	it('reconciles terminal labels without closing open remediation source issues on success', async () => {
		process.env.GITHUB_REPOSITORY = 'owner/repo';
		const syncPrState = await import('../scripts/orchestrator/sync-pr-state.mjs');
		const run = vi.fn();
		const reconciliations = [];

		const result = syncPrState.syncPrState({
			prNumber: '1586',
			action: 'post_merge_success',
			pr: {
				body: '- **Issue:** #1576\n\nRemediation follow-up for PR #1572.',
				mergedAt: '2026-06-11T17:21:10Z',
				state: 'MERGED',
				url: 'https://example.test/pr/1586',
			},
			postMergeResult: {
				status: 'pass',
				remediation_required: false,
				source_issue_closeout_mode: 'open_source_issue',
				terminal_label_result: {
					ok: true,
					removeLabels: ['status:post-merge-verify', 'post-merge-failure', 'status:failed'],
					addLabel: 'status:complete',
					summary: 'remove stale labels; add status:complete',
				},
			},
			getIssueMeta: () => ({
				title: 'Post-merge closeout exception for PR #1572 / source #1558 / workflow_failure',
				labels: ['post-merge-failure', 'status:post-merge-verify', 'status:failed'],
				state: 'OPEN',
			}),
			reconcileTerminalLabelsFn: (...args) => reconciliations.push(args),
			run,
		});

		expect(result).toBe('remediation_issue');
		expect(reconciliations).toHaveLength(1);
		expect(run).toHaveBeenCalledWith(
			expect.arrayContaining(['issue', 'comment', '1576', '--repo', 'owner/repo', '--body', expect.stringContaining('remediation_issue')]),
		);
		expect(run).not.toHaveBeenCalledWith(expect.arrayContaining(['issue', 'close', '1576']));
	});

	it('relabels without closing when post-merge validation failed', async () => {
		const syncPrState = await import('../scripts/orchestrator/sync-pr-state.mjs');
		const run = vi.fn();
		const reconciliations = [];

		const result = syncPrState.syncPrState({
			prNumber: '1239',
			action: 'post_merge_failure',
			pr: { body: baseBody, mergedAt: '2026-06-02T17:21:10Z', state: 'MERGED', url: 'https://example.test/pr/1239' },
			reconcileTerminalLabelsFn: (...args) => reconciliations.push(args),
			getIssueMeta: () => ({ labels: ['status:post-merge-verify'], state: 'OPEN' }),
			getRepoLabels: () => ['status:failed', 'status:complete'],
			run,
		});

		expect(result).toBe('failure_relabeled');
		expect(reconciliations[0][1]).toMatchObject({
			removeLabels: ['status:post-merge-verify'],
			addLabel: 'status:failed',
		});
		expect(run).toHaveBeenCalledWith(expect.arrayContaining(['issue', 'comment', '1196']));
	});

	it('halts failure-path sync when status:failed is unavailable in the repository', async () => {
		const syncPrState = await import('../scripts/orchestrator/sync-pr-state.mjs');
		const run = vi.fn();
		const reconciliations = [];

		const result = syncPrState.syncPrState({
			prNumber: '1583',
			action: 'post_merge_remediation',
			pr: { body: baseBody, mergedAt: '2026-06-12T14:00:00Z', state: 'MERGED', url: 'https://example.test/pr/1583' },
			reconcileTerminalLabelsFn: (...args) => reconciliations.push(args),
			getIssueMeta: () => ({ labels: ['status:post-merge-verify'], state: 'OPEN' }),
			getRepoLabels: () => ['status:complete'],
			run,
		});

		expect(result).toBe('failure_relabel_halted');
		expect(reconciliations).toHaveLength(0);
		expect(run).not.toHaveBeenCalled();
	});
});


describe('clerical source-issue linkage repair (#2532)', () => {
	const pr2518Title = 'DOCS: Rename PMO V4 to PMO July 2026 and define the PMO issue contract';
	const issue2516 = {
		number: 2516,
		title: 'BUG: PMO dashboard data is incomplete, stale, and misclassified',
		body: '## Purpose\n\nCorrect the PMO dashboard data model.\n',
		state: 'open',
	};
	const issue2517 = {
		number: 2517,
		title: pr2518Title,
		body: [
			'## Purpose',
			'',
			'Rename PMO V4 naming.',
			'',
			'Allowed paths:',
			'- `docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md`',
			'- `docs/how-to/pmo/pmo-dashboard.md`',
		].join('\n'),
		state: 'open',
	};
	const pr2518 = {
		title: pr2518Title,
		headRefName: 'cursor/pmo-july-2026-docs-ccda',
		body: [
			'- **Issue:** #2516',
			'',
			'## CHANGE SUMMARY',
			'- Renamed PMO docs.',
			'',
			'## BUILD / TEST / VERIFICATION',
			'- PASS',
			'',
			'## ACCEPTANCE CRITERIA',
			'- [x] Criteria complete',
			'',
			'## REQUIRED PRE-REVIEW SELF-CHECK',
			'- done',
		].join('\n'),
		files: [
			{ filename: 'docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md' },
			{ filename: 'docs/how-to/pmo/pmo-dashboard.md' },
		],
	};
	const evidence2518 = [
		'Correct the primary source issue. This documentation migration is authorized by **#2517**. The PR body currently states `Issue: #2516`.',
	];

	it('does not mutate when the declared issue already owns the title', () => {
		const evaluation = evaluateClericalSourceIssueLinkage({
			declaredIssueNumber: '2517',
			declaredIssue: issue2517,
			pr: { ...pr2518, body: pr2518.body.replace('#2516', '#2517') },
			candidateIssues: [issue2516],
			evidenceTexts: evidence2518,
		});
		expect(evaluation.status).toBe('declared_correct');
	});

	it('auto-selects #2517 for the PR #2518 / #2516 regression fixture', () => {
		const evaluation = evaluateClericalSourceIssueLinkage({
			declaredIssueNumber: '2516',
			declaredIssue: issue2516,
			pr: pr2518,
			candidateIssues: [issue2517],
			evidenceTexts: evidence2518,
		});
		expect(evaluation).toMatchObject({
			status: 'clerical_mismatch',
			declaredIssueNumber: '2516',
			correctedIssueNumber: '2517',
			classification: 'clerical_linkage_mismatch',
		});
	});

	it('stops when multiple authoritative candidates remain', () => {
		const twin = {
			number: 2599,
			title: pr2518Title,
			body: issue2517.body,
			state: 'open',
		};
		const evaluation = evaluateClericalSourceIssueLinkage({
			declaredIssueNumber: '2516',
			declaredIssue: issue2516,
			pr: pr2518,
			candidateIssues: [issue2517, twin],
			evidenceTexts: evidence2518,
		});
		expect(evaluation.status).toBe('ambiguous');
		expect(evaluation.failures[0].code).toBe('ambiguous_source_issue_candidates');
	});

	it('stops when the unique candidate does not authorize changed files', () => {
		const limited = {
			...issue2517,
			body: [
				'Allowed paths:',
				'- `docs/ops/pmo/unrelated.md`',
			].join('\n'),
		};
		const evaluation = evaluateClericalSourceIssueLinkage({
			declaredIssueNumber: '2516',
			declaredIssue: issue2516,
			pr: pr2518,
			candidateIssues: [limited],
			evidenceTexts: evidence2518,
		});
		expect(evaluation.status).toBe('authority_conflict');
		expect(evaluation.failures[0].code).toBe('source_issue_authority_conflict');
	});

	it('corrects the primary issue line and records an auditable reconciliation comment', async () => {
		const patches = [];
		const comments = [];
		const repair = await applyClericalSourceIssueCorrection({
			token: 'test',
			repository: 'wdhunter645/next-starter-template',
			prNumber: 2518,
			body: pr2518.body,
			declaredIssueNumber: '2516',
			correctedIssueNumber: '2517',
			evidence: ['exact_title_match', 'authority_phrase'],
			applyPullRequestBodyFn: async (args) => {
				patches.push(args);
				return {};
			},
			postIssueCommentFn: async (args) => {
				comments.push(args);
				return {};
			},
		});

		expect(repair.applied).toBe(true);
		expect(repair.action).toBe('body_patched');
		expect(patches[0].body).toContain('- **Issue:** #2517');
		expect(patches[0].body).not.toMatch(/^\s*-\s*\*\*Issue:\*\*\s*#2516\s*$/m);
		expect(comments[0].body).toContain('clerical_linkage_mismatch');
		expect(parseClericalSourceIssueReconciliation(comments[0].body)).toEqual({
			declaredIssueNumber: '2516',
			correctedIssueNumber: '2517',
		});
	});

	it('is idempotent when reconciliation already points at the corrected issue', () => {
		const correctedBody = correctPrimaryIssueLineInBody(pr2518.body, {
			fromIssue: '2516',
			toIssue: '2517',
		});
		const comment = [
			'<!-- post-merge-clerical-source-issue-reconciliation -->',
			'- Declared primary issue: #2516',
			'- Corrected primary issue: #2517',
		].join('\n');
		const evaluation = evaluateClericalSourceIssueLinkage({
			declaredIssueNumber: '2517',
			declaredIssue: issue2517,
			pr: { ...pr2518, body: correctedBody },
			candidateIssues: [issue2516],
			evidenceTexts: [...evidence2518, comment],
		});
		expect(evaluation.status).toBe('already_reconciled');
	});

	it('does not create a remediation issue for a successful clerical repair', () => {
		const result = buildResult({
			pr: { ...pr2518, body: correctPrimaryIssueLineInBody(pr2518.body, { fromIssue: '2516', toIssue: '2517' }), isDraft: false, mergedAt: '2026-07-15T10:41:38Z', baseRefName: 'main' },
			resolution: { pr: 2518 },
			metadata: [],
			implementation: [],
			diataxis: [],
			findings: [],
			reviewerDispositionFailures: [],
			failures: [],
			mergeSha: 'abc',
			sourceIssueOverride: '2517',
			sourceIssueLinkageRepair: {
				applied: true,
				declared_issue: '2516',
				corrected_issue: '2517',
				action: 'body_patched',
			},
		});
		expect(result.status).toBe('pass');
		expect(result.sync_action).toBe('post_merge_success');
		expect(result.source_issue).toBe('2517');
		expect(result.self_healing_safe).toBe(true);
		expect(selfHealingCanResolve(result)).toBe(true);
		expect(shouldUpsertRemediationIssue(result)).toBe(false);
	});

	it('exports a finite clerical candidate fetch cap for fail-closed human review', async () => {
		const { MAX_CLERICAL_SOURCE_ISSUE_CANDIDATES } = await import('../scripts/ci/post_merge_validator.mjs');
		expect(MAX_CLERICAL_SOURCE_ISSUE_CANDIDATES).toBeGreaterThan(0);
		expect(MAX_CLERICAL_SOURCE_ISSUE_CANDIDATES).toBeLessThanOrEqual(50);
	});

	it('bounds clerical fetch candidates to PR title/branch/body, not comment evidence storms', async () => {
		const { collectClericalSourceIssueCandidateNumbers } = await import('../scripts/ci/post_merge_validator.mjs');
		const pr = {
			title: 'promotion(#3018): example',
			headRefName: 'promote/3018-example',
			body: [
				'- **Issue:** #3018',
				'Component master: #1719',
				'Related history cites #2775 and #2647.',
			].join('\n'),
		};
		const commentStorm = Array.from({ length: 40 }, (_, i) => `#${2000 + i} note`).join(' ');
		const bodyOnly = collectClericalSourceIssueCandidateNumbers({
			pr,
			evidenceTexts: [],
			repository: 'wdhunter465/next-starter-template',
		});
		const withStorm = collectClericalSourceIssueCandidateNumbers({
			pr,
			evidenceTexts: [commentStorm],
			repository: 'wdhunter465/next-starter-template',
		});
		expect(bodyOnly.filter((n) => n !== '3018').length).toBeLessThanOrEqual(15);
		expect(withStorm.length).toBeGreaterThan(bodyOnly.length);
		// Cap path under test: fetch set must remain body-scoped even when evidence is noisy.
		expect(bodyOnly.sort()).toEqual(['1719', '2647', '2775', '3018'].sort());
	});

	it('does not clerical-auto-repair to evidence-only authority_phrase placeholders', async () => {
		const { evaluateClericalSourceIssueLinkage } = await import('../scripts/ci/post_merge_validator.mjs');
		const pr = {
			title: 'fix(#3042): example',
			headRefName: 'cursor/3042-example',
			body: '- **Issue:** #3042\nAllowed paths:\n- `scripts/ci/post_merge_validator.mjs`',
			files: [{ filename: 'scripts/ci/post_merge_validator.mjs', status: 'modified' }],
		};
		const declared = {
			number: 3042,
			title: 'Post-merge closeout exception for PR #3040',
			body: 'Allowed paths:\n- `scripts/ci/post_merge_validator.mjs`',
			state: 'open',
		};
		const evaluation = evaluateClericalSourceIssueLinkage({
			declaredIssueNumber: '3042',
			declaredIssue: declared,
			pr,
			candidateIssues: [declared],
			evidenceTexts: [
				'However, evaluateClericalSourceIssueLinkage can still score issue numbers; for example use #1234 as a placeholder.',
			],
			repository: 'wdhunter465/next-starter-template',
		});
		expect(evaluation.status).toBe('declared_correct');
		expect(evaluation.correctedIssueNumber).toBe('3042');
	});
});
