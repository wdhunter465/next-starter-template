#!/usr/bin/env node

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

import { applyMergedPrBody } from './apply_merged_pr_body.mjs';
import { readPostMergeResult, syncPrState } from '../orchestrator/sync-pr-state.mjs';
import { closeDuplicateRemediationIssues } from './close_duplicate_remediation_issues.mjs';
import { closeRemediationIssuesForPr } from './close_remediation_issues_for_pr.mjs';
import {
	shouldUpsertRemediationIssue,
	shouldSuppressRemediationForCircuitBreaker,
	upsertRemediationIssue,
	attachOriginatingAgentEvidence,
} from './post_merge_remediation_issue.mjs';
import { runValidator, WORKFLOW_RUN_SCOPE_MERGE_AND_HEAD } from './post_merge_validator.mjs';
import { githubRepoRequest } from './github_issue_api.mjs';
import {
	applyTerminalLabelReconciliation,
	canDeterministicallyRepairTerminalLabels,
	planActiveSourceIssueRelabel,
	planTerminalLabelReconciliation,
	terminalSourceIssueCloseoutModeFromSync,
	terminalSourceIssueLabelIntegrityFailures,
} from './post_merge_source_issue_closeout.mjs';
import {
	resolveCloseoutBodyApply,
	shouldRunAutomaticCloseout,
} from './post_merge_closeout_trigger.mjs';

export const POST_MERGE_RESULT_PATH = 'post-merge-result.json';
export const POST_MERGE_RESULT_MD_PATH = 'post-merge-result.md';

function writeCloseoutOutput(name, value) {
	const outputPath = process.env.GITHUB_OUTPUT;
	if (outputPath) fs.appendFileSync(outputPath, `${name}=${value}\n`);
}

export function toSyncPr({ pr } = {}) {
	return {
		body: pr?.body || '',
		title: pr?.title || '',
		headRefName: pr?.head?.ref || pr?.headRefName || '',
		url: pr?.html_url || pr?.url || '',
		mergedAt: pr?.merged_at || pr?.mergedAt || '',
		state: pr?.merged_at || pr?.mergedAt ? 'MERGED' : pr?.state || '',
		mergeCommit: { oid: pr?.merge_commit_sha || pr?.mergeCommit?.oid || '' },
	};
}

export function isSuccessfulSourceIssueCloseout(syncResult) {
	return (
		syncResult === 'complete' ||
		syncResult === 'active_relabeled' ||
		syncResult === 'remediation_issue'
	);
}

export function isFailureRelabelHalted(syncResult) {
	return syncResult === 'failure_relabel_halted';
}

export function runSync({ repository, prNumber, syncAction, pr, resultPath = POST_MERGE_RESULT_PATH }) {
	return syncPrState({
		pr: toSyncPr({ pr }),
		prNumber: String(prNumber),
		action: syncAction,
		postMergeResult: readPostMergeResult(resultPath),
	});
}

export async function resolveCloseoutSyncPr({
	token,
	repository,
	prNumber,
	pr,
	bodyFile,
	skipBodyApply = false,
	fetchMergedPrFn = fetchMergedPr,
}) {
	if (!skipBodyApply && bodyFile) {
		return fetchMergedPrFn({ token, repository, prNumber });
	}
	return pr;
}

export async function fetchMergedPr({ token, repository, prNumber }) {
	return githubRepoRequest({
		token,
		repository,
		path: `/pulls/${prNumber}`,
		userAgent: 'lgfc-post-merge-closeout',
	});
}

/**
 * Production closeout may only run for PRs already merged into main.
 */
export function assertProductionCloseoutPr({ pr = null, prNumber = '' } = {}) {
	const number = String(prNumber || pr?.number || 'unknown');
	if (!pr?.merged_at && !pr?.mergedAt) {
		throw new Error(`PR #${number} is not merged; refusing post-merge closeout.`);
	}
	const baseRef = String(pr?.base?.ref || '').trim();
	if (baseRef !== 'main') {
		throw new Error(
			`PR #${number} base is '${baseRef || 'unknown'}', not main; refusing production closeout path.`,
		);
	}
	const mergeCommitSha = String(pr?.merge_commit_sha || pr?.mergeCommit?.oid || '').trim();
	if (!mergeCommitSha) {
		throw new Error(`PR #${number} is missing merge_commit_sha; refusing post-merge closeout.`);
	}
}

/**
 * Resolve the evidence SHA used by closeout validation.
 *
 * Manual workflow_dispatch replay must always use the target PR's merge_commit_sha.
 * Workflow checkout SHAs (current main tip) must never override that value.
 * Automatic pull_request_target closeout preserves the prior supplied-SHA preference
 * (workflows already pass merge_commit_sha as GITHUB_SHA).
 */
export function resolveCloseoutEvidenceMergeSha({
	eventName = '',
	suppliedSha = '',
	pr = null,
} = {}) {
	const mergeCommitSha = String(pr?.merge_commit_sha || pr?.mergeCommit?.oid || '').trim();
	const supplied = String(suppliedSha || '').trim();
	const isManualReplay = String(eventName || '') === 'workflow_dispatch';

	if (isManualReplay) {
		if (!mergeCommitSha) {
			throw new Error('Merged PR is missing merge_commit_sha; refusing manual closeout replay.');
		}
		return mergeCommitSha;
	}

	return supplied || mergeCommitSha;
}

/**
 * Error artifacts may only report a PR merge SHA after production closeout
 * eligibility is proven. Provisional GitHub merge_commit_sha values on
 * unmerged/non-main PRs must not appear as closeout evidence.
 */
export function resolveErrorArtifactMergeSha({
	eventName = '',
	suppliedSha = '',
	pr = null,
	prNumber = '',
} = {}) {
	const fallback = String(suppliedSha || '').trim();
	if (!pr) return fallback;
	try {
		assertProductionCloseoutPr({ pr, prNumber });
		return resolveCloseoutEvidenceMergeSha({ eventName, suppliedSha, pr });
	} catch {
		return fallback;
	}
}

export async function resolveCloseoutEvidenceMergeShaForPr({
	token,
	repository,
	prNumber,
	eventName = '',
	suppliedSha = '',
	fetchMergedPrFn = fetchMergedPr,
} = {}) {
	const pr = await fetchMergedPrFn({ token, repository, prNumber });
	assertProductionCloseoutPr({ pr, prNumber });
	return {
		pr,
		mergeSha: resolveCloseoutEvidenceMergeSha({ eventName, suppliedSha, pr }),
	};
}

export function resolveCloseoutEventContext({
	eventName = process.env.GITHUB_EVENT_NAME || '',
	inputPrNumber = process.env.PR_NUMBER || '',
	eventPrNumber = process.env.EVENT_PR_NUMBER || '',
	eventPrMerged = process.env.EVENT_PR_MERGED || '',
	eventPrBaseRef = process.env.EVENT_PR_BASE_REF || '',
	skipBodyApply = process.env.SKIP_BODY_APPLY || '',
	bodyFile = process.env.BODY_FILE || '',
} = {}) {
	const automatic = shouldRunAutomaticCloseout({
		eventName,
		merged: eventPrMerged,
		baseRef: eventPrBaseRef,
	});
	const prNumber = String(inputPrNumber || eventPrNumber || '');
	const bodyApply = resolveCloseoutBodyApply({
		prNumber,
		automatic,
		bodyFile,
		skipBodyApply: skipBodyApply === 'true',
	});

	return {
		eventName,
		prNumber,
		automatic,
		skipBodyApply: bodyApply.skipBodyApply,
		bodyFile: bodyApply.bodyFile,
		eventPrMerged,
		eventPrBaseRef,
	};
}

export async function writePostMergeResultArtifactsAsync(result) {
	const { commentBody } = await import('./post_merge_validator.mjs');
	fs.writeFileSync(POST_MERGE_RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`);
	fs.writeFileSync(POST_MERGE_RESULT_MD_PATH, commentBody(result));
}

export function buildCloseoutErrorResult({ prNumber, mergeSha = '', message = '' } = {}) {
	return {
		status: 'fail',
		pr: prNumber ? Number(prNumber) : null,
		merge_sha: mergeSha,
		source_issue: null,
		late_findings: 0,
		workflow_failures: [],
		metadata_failures: [{ code: 'closeout_runtime_error', message: message || 'Post-merge closeout failed.' }],
		implementation_failures: [],
		diataxis_failures: [],
		reviewer_findings: [],
		remediation_required: true,
		sync_action: 'post_merge_failure',
	};
}

export async function fetchSourceIssueMeta({ token, repository, issueNumber }) {
	return githubRepoRequest({
		token,
		repository,
		path: `/issues/${issueNumber}`,
		userAgent: 'lgfc-post-merge-closeout',
	});
}

export async function fetchRepoLabels({ token, repository }) {
	const labels = [];
	let page = 1;
	while (true) {
		const batch = await githubRepoRequest({
			token,
			repository,
			path: `/labels?per_page=100&page=${page}`,
			userAgent: 'lgfc-post-merge-closeout',
		});
		if (!Array.isArray(batch) || batch.length === 0) break;
		labels.push(...batch);
		if (batch.length < 100) break;
		page += 1;
	}
	return labels;
}

export async function verifyTerminalLabelIntegrityAfterCloseout({
	token,
	repository,
	sourceIssueNumber,
	syncResult,
	applyRepair = true,
	fetchIssueFn = fetchSourceIssueMeta,
	fetchLabelsFn = fetchRepoLabels,
	applyRepairFn = applyTerminalLabelReconciliation,
} = {}) {
	if (!sourceIssueNumber || !isSuccessfulSourceIssueCloseout(syncResult)) {
		return { ok: true, failures: [], repaired: false, closeout_mode: 'not_evaluated' };
	}

	const closeoutMode = terminalSourceIssueCloseoutModeFromSync(syncResult);
	let issueMeta = await fetchIssueFn({ token, repository, issueNumber: sourceIssueNumber });
	let failures = terminalSourceIssueLabelIntegrityFailures({ issueMeta, closeoutMode });

	if (failures.length === 0) {
		return { ok: true, failures: [], repaired: false, closeout_mode: closeoutMode };
	}

	if (!issueMeta) {
		return {
			ok: false,
			failures,
			repaired: false,
			closeout_mode: closeoutMode,
			terminal_label_plan: { ok: false, reason: 'source_issue_unreadable' },
		};
	}

	const repoLabels = await fetchLabelsFn({ token, repository });
	const plan = closeoutMode === 'preserve_open'
		? planActiveSourceIssueRelabel({ issueLabels: issueMeta.labels || [] })
		: planTerminalLabelReconciliation({ issueLabels: issueMeta.labels || [], repoLabels });

	let repaired = false;
	if (applyRepair && canDeterministicallyRepairTerminalLabels({ failures, plan })) {
		await applyRepairFn({
			token,
			repository,
			issueNumber: sourceIssueNumber,
			plan,
		});
		repaired = true;
		issueMeta = await fetchIssueFn({ token, repository, issueNumber: sourceIssueNumber });
		failures = terminalSourceIssueLabelIntegrityFailures({ issueMeta, closeoutMode });
	}

	return {
		ok: failures.length === 0,
		failures,
		repaired,
		closeout_mode: closeoutMode,
		terminal_label_plan: plan,
	};
}

export async function ensureCloseoutRemediationEvidence({
	token,
	repository,
	result,
	suppressRemediationIssues = false,
	batchCircuitBreaker = null,
	error = null,
}) {
	if (
		shouldSuppressRemediationForCircuitBreaker({
			suppressRemediationIssues,
			batchCircuitBreaker,
			result,
			error,
		})
	) {
		return {
			action: 'skipped',
			issue: null,
			reason: batchCircuitBreaker?.tripped ? 'circuit-breaker-open' : 'circuit-breaker-threshold',
		};
	}
	if (!shouldUpsertRemediationIssue(result)) {
		return { action: 'skipped', issue: null, reason: 'no-remediation-required' };
	}
	return upsertRemediationIssue({ token, repository, result });
}

export async function runPostMergeCloseout({
	token,
	repository,
	prNumber,
	bodyFile,
	sha = '',
	runId = '',
	skipBodyApply = false,
	workflowRunScope = WORKFLOW_RUN_SCOPE_MERGE_AND_HEAD,
	eventName = 'workflow_dispatch',
	eventPrMerged = '',
	eventPrBaseRef = '',
	suppressRemediationIssues = false,
	batchCircuitBreaker = null,
	fetchMergedPrFn = fetchMergedPr,
} = {}) {
	const pr = await fetchMergedPrFn({ token, repository, prNumber });
	assertProductionCloseoutPr({ pr, prNumber });

	const mergeSha = resolveCloseoutEvidenceMergeSha({
		eventName,
		suppliedSha: sha,
		pr,
	});

	if (!skipBodyApply) {
		if (!bodyFile) {
			throw new Error('BODY_FILE is required unless SKIP_BODY_APPLY=true.');
		}
		await applyMergedPrBody({ token, repository, prNumber, bodyFile });
	}

	const result = await runValidator({
		token,
		repository,
		eventName,
		inputPrNumber: String(prNumber),
		eventPrNumber: String(prNumber),
		eventPrMerged: eventPrMerged || 'true',
		eventPrBaseRef: eventPrBaseRef || pr.base?.ref || 'main',
		sha: mergeSha,
		runId,
		workflowRunScope,
	});

	if (runId) {
		result.workflow_run_url = `https://github.com/${repository}/actions/runs/${runId}`;
	}

	await writePostMergeResultArtifactsAsync(result);

	const syncPr = await resolveCloseoutSyncPr({
		token,
		repository,
		prNumber,
		pr,
		bodyFile,
		skipBodyApply,
	});

	let syncResult = null;
	if (result.sync_action && result.sync_action !== 'skipped') {
		syncResult = runSync({ repository, prNumber, syncAction: result.sync_action, pr: syncPr });
	}

	if (result.sync_action === 'post_merge_success' && !isSuccessfulSourceIssueCloseout(syncResult)) {
		result.status = 'fail';
		result.remediation_required = true;
		result.sync_action = 'post_merge_failure';
		result.metadata_failures = [
			...(result.metadata_failures || []),
			{
				code: 'source_issue_closeout_skipped',
				message: `Post-merge validation passed but source issue closeout was skipped: ${syncResult || 'unknown'}.`,
			},
		];
		await writePostMergeResultArtifactsAsync(result);
		syncResult = runSync({ repository, prNumber, syncAction: 'post_merge_failure', pr: syncPr });
	}

	if (
		(result.sync_action === 'post_merge_remediation' || result.sync_action === 'post_merge_failure') &&
		isFailureRelabelHalted(syncResult)
	) {
		result.status = 'fail';
		result.remediation_required = true;
		result.metadata_failures = [
			...(result.metadata_failures || []),
			{
				code: 'failure_relabel_halted',
				message: `Failure-path source issue relabel halted (${syncResult}); stale labels preserved.`,
			},
		];
		await writePostMergeResultArtifactsAsync(result);
	}

	if (result.sync_action === 'post_merge_success') {
		await closeRemediationIssuesForPr({
			token,
			repository,
			prNumber,
			mergeSha: result.merge_sha || mergeSha,
			sourceIssue: result.source_issue || '',
		});
		await closeDuplicateRemediationIssues({ token, repository, dryRun: false });
	}

	if (result.source_issue && syncResult) {
		const terminalIntegrity = await verifyTerminalLabelIntegrityAfterCloseout({
			token,
			repository,
			sourceIssueNumber: result.source_issue,
			syncResult,
		});
		result.terminal_label_integrity = terminalIntegrity;
		if (!terminalIntegrity.ok) {
			result.status = 'fail';
			result.remediation_required = true;
			result.sync_action = 'post_merge_failure';
			result.metadata_failures = [
				...(result.metadata_failures || []),
				...terminalIntegrity.failures,
			];
			result.self_healing = {
				classification: canDeterministicallyRepairTerminalLabels({
					failures: terminalIntegrity.failures,
					plan: terminalIntegrity.terminal_label_plan,
				}) ? 'safe_auto_fix' : 'cursor_remediation_required',
				safe_to_close: false,
				ambiguous: !canDeterministicallyRepairTerminalLabels({
					failures: terminalIntegrity.failures,
					plan: terminalIntegrity.terminal_label_plan,
				}),
			};
			result.self_healing_safe = canDeterministicallyRepairTerminalLabels({
				failures: terminalIntegrity.failures,
				plan: terminalIntegrity.terminal_label_plan,
			});
			await writePostMergeResultArtifactsAsync(result);
			if (result.sync_action === 'post_merge_failure' && syncResult !== 'complete') {
				syncResult = runSync({ repository, prNumber, syncAction: 'post_merge_failure', pr: syncPr });
			}
		}
	}

	Object.assign(result, attachOriginatingAgentEvidence(result, pr));
	if (syncPr) {
		Object.assign(result, attachOriginatingAgentEvidence(result, syncPr));
	}

	await ensureCloseoutRemediationEvidence({
		token,
		repository,
		result,
		suppressRemediationIssues,
		batchCircuitBreaker,
	});

	return result;
}

export async function main() {
	const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
	const repository = process.env.GITHUB_REPOSITORY;
	const context = resolveCloseoutEventContext();

	if (!token || !repository) {
		throw new Error('GITHUB_TOKEN, GITHUB_REPOSITORY, and PR_NUMBER are required.');
	}

	if (!context.prNumber) {
		console.log(
			JSON.stringify({
				status: 'skipped',
				reason: 'closeout_not_applicable',
				event: context.eventName,
			}),
		);
		return;
	}

	let result;
	try {
		result = await runPostMergeCloseout({
			token,
			repository,
			prNumber: context.prNumber,
			bodyFile: context.bodyFile,
			sha: process.env.GITHUB_SHA || '',
			runId: process.env.GITHUB_RUN_ID || '',
			skipBodyApply: context.skipBodyApply,
			eventName: context.eventName,
			eventPrMerged: context.eventPrMerged,
			eventPrBaseRef: context.eventPrBaseRef,
		});
	} catch (error) {
		console.error(error);
		let evidenceSha = process.env.GITHUB_SHA || '';
		let errorPr = null;
		try {
			errorPr = await fetchMergedPr({ token, repository, prNumber: context.prNumber });
			evidenceSha = resolveErrorArtifactMergeSha({
				eventName: context.eventName,
				suppliedSha: process.env.GITHUB_SHA || '',
				pr: errorPr,
				prNumber: context.prNumber,
			});
		} catch {
			// Keep checkout SHA only when PR metadata cannot be fetched.
		}
		result = buildCloseoutErrorResult({
			prNumber: context.prNumber,
			mergeSha: evidenceSha,
			message: error instanceof Error ? error.message : String(error),
		});
		if (errorPr) {
			Object.assign(result, attachOriginatingAgentEvidence(result, errorPr));
		}
		await writePostMergeResultArtifactsAsync(result);
		await ensureCloseoutRemediationEvidence({
			token,
			repository,
			result,
			error,
		});
		writeCloseoutOutput('status', result.status);
		writeCloseoutOutput('pr_number', result.pr || context.prNumber || '');
		writeCloseoutOutput('sync_action', result.sync_action || 'post_merge_failure');
		writeCloseoutOutput('remediation_required', 'true');
		process.exitCode = 1;
		return;
	}

	writeCloseoutOutput('status', result.status || 'fail');
	writeCloseoutOutput('pr_number', result.pr || context.prNumber || '');
	writeCloseoutOutput('sync_action', result.sync_action || 'skipped');
	writeCloseoutOutput('remediation_required', result.remediation_required ? 'true' : 'false');

	console.log(JSON.stringify(result, null, 2));
	if (result.status === 'fail') process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch(async (error) => {
		console.error(error);
		const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
		const repository = process.env.GITHUB_REPOSITORY;
		const prNumber = process.env.PR_NUMBER || process.env.EVENT_PR_NUMBER || '';
		const eventName = process.env.GITHUB_EVENT_NAME || '';
		let evidenceSha = process.env.GITHUB_SHA || '';
		let errorPr = null;
		if (token && repository && prNumber) {
			try {
				errorPr = await fetchMergedPr({ token, repository, prNumber });
				evidenceSha = resolveErrorArtifactMergeSha({
					eventName,
					suppliedSha: process.env.GITHUB_SHA || '',
					pr: errorPr,
					prNumber,
				});
			} catch {
				// Keep checkout SHA only when PR metadata cannot be fetched.
			}
		}
		const result = buildCloseoutErrorResult({
			prNumber,
			mergeSha: evidenceSha,
			message: error instanceof Error ? error.message : String(error),
		});
		if (errorPr) {
			Object.assign(result, attachOriginatingAgentEvidence(result, errorPr));
		}
		try {
			await writePostMergeResultArtifactsAsync(result);
			if (token && repository) {
				await ensureCloseoutRemediationEvidence({ token, repository, result });
			}
		} catch (writeError) {
			console.error(writeError);
		}
		process.exit(1);
	});
}
