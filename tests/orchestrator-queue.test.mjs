import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';

process.env.GITHUB_REPOSITORY = 'owner/repo';
process.env.PR_NUMBER = '42';
process.env.SYNC_ACTION = 'closed';

const createIssues = await import('../scripts/orchestrator/create-issues.mjs');
const createDraftPr = await import('../scripts/orchestrator/create-draft-pr.mjs');
const advanceQueue = await import('../scripts/orchestrator/advance-queue.mjs');
const syncPrState = await import('../scripts/orchestrator/sync-pr-state.mjs');

function issue(number, status, createdAt) {
	return {
		number,
		title: `Task ${number}`,
		createdAt,
		labels: [{ name: 'orchestrator' }, { name: status }],
	};
}

function queryFor(statuses) {
	return vi.fn(() => Object.values(statuses).flat());
}

describe('orchestrator issue creation queue model', () => {
	it('labels the first produced task as queued and subsequent tasks as blocked', () => {
		const tasks = [
			{ type: 'repository', agent: 'cursor' },
			{ type: 'website', agent: 'cursor' },
			{ type: 'docs', agent: 'cursor' },
		];

		const labels = tasks.map((task, index) =>
			createIssues.labelsForTask(task, createIssues.statusLabelForCreatedTask(index)),
		);

		expect(labels[0]).toContain('status:queued');
		expect(labels[1]).toContain('status:blocked');
		expect(labels[2]).toContain('status:blocked');
	});

	it('labels every produced task as blocked when an orchestrator issue is already open', () => {
		const tasks = [
			{ type: 'repository', agent: 'cursor' },
			{ type: 'website', agent: 'cursor' },
		];

		const labels = tasks.map((task, index) =>
			createIssues.labelsForTask(task, createIssues.statusLabelForCreatedTask(index, true)),
		);

		expect(labels[0]).toContain('status:blocked');
		expect(labels[1]).toContain('status:blocked');
	});

	it('does not count skipped existing tasks when assigning the first new task status', () => {
		const taskAlreadyHasIssue = [true, true, true, false];
		const producedStatuses = [];
		let createdIssueCount = 0;

		for (const exists of taskAlreadyHasIssue) {
			if (exists) continue;
			producedStatuses.push(createIssues.statusLabelForCreatedTask(createdIssueCount));
			createdIssueCount += 1;
		}

		expect(producedStatuses).toEqual(['status:queued']);
	});

	it('routes CI implementation issues to Cursor with CI labels', () => {
		const labels = createIssues.labelsForTask({ type: 'ci', agent: 'cursor' });

		expect(labels).toContain('orchestrator');
		expect(labels).toContain('status:queued');
		expect(labels).toContain('type:ci');
		expect(labels).toContain('agent:cursor');
	});

	it('detects missing orchestrator labels before issue creation', () => {
		expect(
			createIssues.missingRequiredLabels(
				['orchestrator', 'status:queued', 'agent:cursor'],
				['orchestrator', 'status:queued', 'status:blocked', 'type:ci', 'agent:cursor'],
			),
		).toEqual(['status:blocked', 'type:ci']);
	});

	it('skips task issue creation for terminal task statuses', () => {
		expect(createIssues.shouldCreateIssueForTask({ status: 'completed' })).toBe(false);
		expect(createIssues.shouldCreateIssueForTask({ status: 'closed' })).toBe(false);
		expect(createIssues.shouldCreateIssueForTask({ status: 'issues-created' })).toBe(false);
		expect(createIssues.shouldCreateIssueForTask({ status: 'active' })).toBe(true);
		expect(createIssues.shouldCreateIssueForTask({})).toBe(true);
	});
});

describe('orchestrator draft PR preflight model', () => {
	it('recognizes standard duplicate issue markers', () => {
		expect(createDraftPr.isDuplicateIssueBody('Duplicate of #973')).toBe(true);
		expect(createDraftPr.isDuplicateIssueBody('Duplicate of Issue #973')).toBe(true);
		expect(createDraftPr.isDuplicateIssueBody('This was closed as duplicate during triage.')).toBe(true);
		expect(createDraftPr.isDuplicateIssueBody('Related to #973 but still active.')).toBe(false);
	});

	it('uses focused source markers for existing implementation PRs', () => {
		const query = createDraftPr.issuePrSearchQuery(981);
		expect(query).toContain('orchestrator-source-issue: 981');
		expect(query).toContain('- **Issue:** #981');
		expect(query).not.toContain('issues/981');
	});
});

describe('orchestrator queue advancement', () => {
	it('keeps a three-task queue serial until merge verification completes, then queues the next task', () => {
		const tasks = [
			{ type: 'repository', agent: 'cursor' },
			{ type: 'website', agent: 'cursor' },
			{ type: 'docs', agent: 'cursor' },
		];
		const producedStatuses = tasks.map((task, index) =>
			createIssues
				.labelsForTask(task, createIssues.statusLabelForCreatedTask(index))
				.find((label) => label.startsWith('status:')),
		);

		expect(producedStatuses).toEqual(['status:queued', 'status:blocked', 'status:blocked']);

		const blockedOlder = issue(2, 'status:blocked', '2026-05-05T19:01:00Z');
		const blockedNewer = issue(3, 'status:blocked', '2026-05-05T19:02:00Z');
		const pipelineStates = [
			'status:queued',
			'status:pr-draft',
			'status:implementation',
			'status:review',
			'status:post-merge-verify',
		];

		for (const state of pipelineStates) {
			expect(
				advanceQueue.queueAdvanceDecision(
					queryFor({
						[state]: [issue(1, state, '2026-05-05T19:00:00Z')],
						'status:blocked': [blockedOlder, blockedNewer],
					}),
				),
			).not.toMatchObject({ action: 'advance' });
		}

		const transitions = [];
		const merged = syncPrState.syncPrState({
			prNumber: '42',
			action: 'merged',
			pr: {
				body: '**Issue:** #1',
				mergedAt: '2026-05-05T19:05:00Z',
				state: 'MERGED',
				url: 'https://example.test/pr/42',
			},
			setStatusFn: (...args) => transitions.push(args),
		});
		const complete = syncPrState.syncPrState({
			prNumber: '42',
			action: 'post_merge_success',
			pr: {
				body: '**Issue:** #1',
				mergedAt: '2026-05-05T19:05:00Z',
				state: 'MERGED',
				url: 'https://example.test/pr/42',
			},
			postMergeResult: { status: 'pass', remediation_required: false, merge_sha: 'abc123' },
			getIssueMeta: () => ({
				title: 'Task 1',
				labels: ['orchestrator', 'status:post-merge-verify'],
				state: 'OPEN',
			}),
			setStatusFn: (...args) => transitions.push(args),
			reconcileTerminalLabelsFn: vi.fn(),
			getRepoLabels: () => ['status:complete'],
			run: vi.fn(),
		});

		expect(merged).toBe('post_merge_verify');
		expect(complete).toBe('complete');
		expect(transitions.map((transition) => transition.slice(1, 3))).toEqual([
			['status:review', 'status:post-merge-verify'],
		]);
		expect(
			advanceQueue.queueAdvanceDecision(
				queryFor({ 'status:blocked': [blockedNewer, blockedOlder] }),
			),
		).toMatchObject({
			action: 'advance',
			issue: { number: 2 },
		});
	});

	it('relabels source issue without closing when post-merge remediation remains required', () => {
		const run = vi.fn();
		const reconciliations = [];

		const result = syncPrState.syncPrState({
			prNumber: '42',
			action: 'post_merge_remediation',
			pr: {
				body: '**Issue:** #1',
				mergedAt: '2026-05-05T19:05:00Z',
				state: 'MERGED',
				url: 'https://example.test/pr/42',
			},
			reconcileTerminalLabelsFn: (...args) => reconciliations.push(args),
			getIssueMeta: () => ({ labels: ['status:post-merge-verify'], state: 'OPEN' }),
			getRepoLabels: () => ['status:failed', 'status:complete'],
			run,
		});

		expect(result).toBe('remediation_relabeled');
		expect(reconciliations[0][1]).toMatchObject({
			removeLabels: ['status:post-merge-verify'],
			addLabel: 'status:failed',
		});
		expect(run).toHaveBeenCalledWith(expect.arrayContaining(['issue', 'comment', '1']));
	});

	it('advances the oldest blocked task only after the active pipeline completes', () => {
		const queued = issue(1, 'status:queued', '2026-05-05T19:00:00Z');
		const blockedOlder = issue(2, 'status:blocked', '2026-05-05T19:01:00Z');
		const blockedNewer = issue(3, 'status:blocked', '2026-05-05T19:02:00Z');
		const pipelineStates = [
			'status:queued',
			'status:pr-draft',
			'status:implementation',
			'status:review',
			'status:post-merge-verify',
		];

		for (const state of pipelineStates) {
			const activeIssue = { ...queued, labels: [{ name: 'orchestrator' }, { name: state }] };
			expect(
				advanceQueue.queueAdvanceDecision(
					queryFor({ [state]: [activeIssue], 'status:blocked': [blockedOlder, blockedNewer] }),
				),
			).not.toMatchObject({ action: 'advance' });
		}

		expect(
			advanceQueue.queueAdvanceDecision(
				queryFor({ 'status:blocked': [blockedNewer, blockedOlder] }),
			),
		).toMatchObject({ action: 'advance', issue: { number: 2 } });
	});

	it('relabels the next blocked task and leaves a traceability comment', () => {
		const run = vi.fn();
		advanceQueue.advanceIssue(issue(2, 'status:blocked', '2026-05-05T19:01:00Z'), run);

		expect(run).toHaveBeenNthCalledWith(1, [
			'issue',
			'edit',
			'2',
			'--repo',
			'owner/repo',
			'--remove-label',
			'status:blocked',
			'--add-label',
			'status:queued',
		]);
		expect(run).toHaveBeenNthCalledWith(2, [
			'issue',
			'comment',
			'2',
			'--repo',
			'owner/repo',
			'--body',
			'Queue advance: blocked → queued',
		]);
	});

	it('relabels failed source issues and halts queue advancement', () => {
		const blocked = issue(3, 'status:blocked', '2026-05-05T19:02:00Z');
		const failed = issue(1, 'status:failed', '2026-05-05T19:00:00Z');
		const query = queryFor({ 'status:failed': [failed], 'status:blocked': [blocked] });
		const logs = [];
		const reconciliations = [];
		const run = vi.fn();

		const failedTransition = syncPrState.syncPrState({
			prNumber: '42',
			action: 'post_merge_failure',
			pr: {
				body: '**Issue:** #1',
				mergedAt: '2026-05-05T19:05:00Z',
				state: 'MERGED',
				url: 'https://example.test/pr/42',
			},
			reconcileTerminalLabelsFn: (...args) => reconciliations.push(args),
			getIssueMeta: () => ({ labels: ['status:post-merge-verify'], state: 'OPEN' }),
			getRepoLabels: () => ['status:failed', 'status:complete'],
			run,
		});

		const decision = advanceQueue.queueAdvanceDecision(query);
		advanceQueue.logDecision(decision, (message) => logs.push(message));

		expect(failedTransition).toBe('failure_relabeled');
		expect(reconciliations[0][1]).toMatchObject({
			removeLabels: ['status:post-merge-verify'],
			addLabel: 'status:failed',
		});
		expect(run).toHaveBeenCalledWith(expect.arrayContaining(['issue', 'comment', '1']));
		expect(decision).toEqual({ action: 'halt_failed' });
		expect(logs).toEqual(['halt: failed']);
	});
});

describe('sync-pr-state issueMeta REST lookup', () => {
	it('calls the repository issue endpoint through the injected runner', () => {
		const run = vi.fn(() => JSON.stringify({
			title: 'Source task',
			labels: [{ name: 'orchestrator' }, { name: 'status:post-merge-verify' }],
			state: 'open',
			state_reason: 'completed',
		}));

		syncPrState.issueMeta(123, { run });
		expect(run).toHaveBeenCalledWith(['api', 'repos/owner/repo/issues/123']);
	});

	it('maps REST issue fields into the internal issueMeta shape', () => {
		const run = vi.fn(() => JSON.stringify({
			title: 'Fan Club task',
			labels: [{ name: 'feature' }, { name: 'status:review' }],
			state: 'closed',
			state_reason: 'not_planned',
		}));

		expect(syncPrState.issueMeta(456, { run })).toEqual({
			title: 'Fan Club task',
			labels: ['feature', 'status:review'],
			state: 'closed',
			state_reason: 'not_planned',
		});
	});

	it('preserves successful closeout when issue metadata includes state_reason', () => {
		const run = vi.fn();
		const reconciliations = [];
		const result = syncPrState.syncPrState({
			prNumber: '1239',
			action: 'post_merge_success',
			pr: {
				body: '- **Issue:** #1196\n\nTask body.',
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
			getIssueMeta: () => ({
				title: 'CI corrective task',
				labels: ['orchestrator', 'status:post-merge-verify'],
				state: 'OPEN',
				state_reason: 'completed',
			}),
			reconcileTerminalLabelsFn: (...args) => reconciliations.push(args),
			run,
		});

		expect(result).toBe('complete');
		expect(reconciliations[0][1]).toMatchObject({ addLabel: 'status:complete' });
		expect(run).toHaveBeenCalledWith(expect.arrayContaining(['issue', 'close', '1196']));
	});
});

describe('orchestrator workflow trigger compatibility', () => {
	it('keeps the generic issue-factory and queue handoff wiring intact', () => {
		const issueFactoryWorkflow = fs.readFileSync('.github/workflows/orchestrator-issue-factory.yml', 'utf8');
		const draftWorkflow = fs.readFileSync('.github/workflows/orchestrator-draft-pr.yml', 'utf8');
		const queueWorkflow = fs.readFileSync('.github/workflows/orchestrator-queue-advance.yml', 'utf8');
		const postMergeWorkflow = fs.readFileSync('.github/workflows/post-merge-closeout.yml', 'utf8');
		const createIssuesScript = fs.readFileSync('scripts/orchestrator/create-issues.mjs', 'utf8');
		const createDraftPrScript = fs.readFileSync('scripts/orchestrator/create-draft-pr.mjs', 'utf8');

		expect(issueFactoryWorkflow).toContain('run: node scripts/orchestrator/create-issues.mjs');
		expect(draftWorkflow).toContain('types: [opened, labeled]');
		expect(draftWorkflow).toContain("contains(github.event.issue.labels.*.name, 'status:queued')");
		expect(queueWorkflow).toContain('types: [labeled]');
		expect(queueWorkflow).toContain("github.event.label.name == 'status:complete'");
		expect(queueWorkflow).toContain("github.event.label.name == 'status:failed'");
		expect(postMergeWorkflow).toContain('node scripts/ci/run_post_merge_closeout.mjs');
		expect(postMergeWorkflow).not.toContain('sync-pr-state.mjs');
		expect(createIssuesScript).toContain('ensureLabels();');
		expect(createIssuesScript).toMatch(/['\"]--state['\"],\s*['\"]all['\"]/s);
		expect(createDraftPrScript).toContain('existingOpenPrForIssue(repo, issue.number)');
		expect(createDraftPrScript).toContain("issue.state !== 'OPEN'");
		expect(createDraftPrScript).not.toContain('orchestrator-placeholder-pr: true');
		expect(createDraftPrScript).not.toContain('commit --allow-empty');
	});
});
