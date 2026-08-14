import { shouldWithholdOriginalSourceCloseout } from './post_merge_delivery_lineage.mjs';

export const INTERMEDIATE_SOURCE_ISSUE_LABELS = [
	'status:changes-requested',
	'status:in-progress',
];

export const STALE_SOURCE_ISSUE_LABELS = [
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
	...INTERMEDIATE_SOURCE_ISSUE_LABELS,
];

export const REMEDIATION_ISSUE_LABEL = 'post-merge-failure';
export const PREFERRED_REMEDIATION_ISSUE_LABEL = 'post-merge:failed';
export const REMEDIATION_TITLE_PREFIX = 'Post-merge closeout exception for ';
export const LEGACY_REMEDIATION_TITLE_PREFIX = 'Post-merge remediation required for ';
export const TERMINAL_SOURCE_ISSUE_LABEL = 'status:complete';
export const FAILURE_SOURCE_ISSUE_LABEL = 'status:failed';
export const ACTIVE_SOURCE_ISSUE_LABEL = 'status:active';

export function issueLabelNameList(issueMeta = {}) {
	return (issueMeta?.labels || [])
		.map((label) => (typeof label === 'string' ? label : label?.name))
		.filter(Boolean);
}

export function isClosedCompletedSourceIssue(sourceIssue = null) {
	if (!sourceIssue) return false;
	if (String(sourceIssue.state || '').toLowerCase() !== 'closed') return false;
	const reason = String(sourceIssue.state_reason || sourceIssue.stateReason || '').toLowerCase();
	return reason === 'completed';
}

export function resolveSourceIssueCloseoutMode({
	sourceIssue = null,
	prBody = '',
	preserveSourceIssueOpen = false,
} = {}) {
	if (!sourceIssue) return 'not_evaluated';
	if (isPermittedClosedSourceIssueFollowup({ body: prBody, sourceIssue })) {
		return 'closed_remediation_followup';
	}
	if (preserveSourceIssueOpen) return 'source_issue_preserved_open';
	if (String(sourceIssue.state || '').toLowerCase() === 'open') return 'source_issue_open_at_validation';
	if (isClosedCompletedSourceIssue(sourceIssue)) return 'closed_completed_idempotent_normalize';
	return 'exception_required';
}

export function canIdempotentlyNormalizeClosedCompletedSourceIssue({
	sourceIssue = null,
	postMergeResult = null,
	terminalLabelResult = null,
} = {}) {
	if (!isClosedCompletedSourceIssue(sourceIssue)) return false;
	if (!postMergeResult || postMergeResult.status !== 'pass') return false;
	if (postMergeResult.remediation_required) return false;
	if ((postMergeResult.reviewer_disposition_failures || []).length > 0) return false;
	if ((postMergeResult.implementation_failures || []).length > 0) return false;
	if ((postMergeResult.diataxis_failures || []).length > 0) return false;
	if ((postMergeResult.reviewer_findings || []).length > 0) return false;
	return Boolean(terminalLabelResult?.ok);
}

export function terminalSourceIssueCloseoutModeFromSync(syncResult = '') {
	if (syncResult === 'complete') return 'terminal_close';
	if (
		syncResult === 'active_relabeled'
		|| syncResult === 'remediation_issue'
		|| syncResult === 'unresolved_exception_chain'
	) {
		return 'preserve_open';
	}
	return 'not_evaluated';
}

export function terminalSourceIssueLabelIntegrityFailures({
	issueMeta = null,
	closeoutMode = 'terminal_close',
} = {}) {
	if (!issueMeta) {
		return [{
			code: 'source_issue_unreadable',
			message: 'Source issue could not be re-fetched for terminal label integrity validation.',
			repairable: false,
		}];
	}

	const labels = new Set(issueLabelNameList(issueMeta));
	const state = String(issueMeta.state || '').toLowerCase();
	const failures = [];
	const stalePresent = STALE_SOURCE_ISSUE_LABELS.filter((label) => labels.has(label));

	if (stalePresent.length > 0) {
		failures.push({
			code: 'stale_terminal_source_issue_labels',
			message: `Source issue retains stale workflow labels after closeout: ${stalePresent.join(', ')}.`,
			stale_labels: stalePresent,
			repairable: true,
		});
	}

	if (closeoutMode === 'terminal_close' && state === 'closed' && !labels.has(TERMINAL_SOURCE_ISSUE_LABEL)) {
		failures.push({
			code: 'missing_terminal_complete_label',
			message: 'Closed source issue is missing status:complete after closeout.',
			repairable: true,
		});
	}

	return failures;
}

export function canDeterministicallyRepairTerminalLabels({
	failures = [],
	plan = null,
} = {}) {
	if (!failures.length) return false;
	if (!plan?.ok) return false;
	return failures.every((failure) => failure.repairable !== false);
}

export async function applyTerminalLabelReconciliation({
	token,
	repository,
	issueNumber,
	plan,
	requestFn,
} = {}) {
	if (!token || !repository || !issueNumber || !plan?.ok) {
		throw new Error('token, repository, issueNumber, and a valid terminal label plan are required.');
	}

	const request = requestFn || (async (args) => {
		const { githubRepoRequest } = await import('./github_issue_api.mjs');
		return githubRepoRequest({ ...args, userAgent: 'lgfc-terminal-label-reconciliation' });
	});

	const issue = await request({
		token,
		repository,
		path: `/issues/${issueNumber}`,
	});

	const currentLabels = new Set(issueLabelNameList(issue));
	const nextLabels = [...currentLabels];
	for (const label of plan.removeLabels || []) {
		const index = nextLabels.indexOf(label);
		if (index >= 0) nextLabels.splice(index, 1);
	}
	if (plan.addLabel && !nextLabels.includes(plan.addLabel)) {
		nextLabels.push(plan.addLabel);
	}

	await request({
		token,
		repository,
		path: `/issues/${issueNumber}`,
		method: 'PATCH',
		body: { labels: nextLabels },
	});

	return {
		ok: true,
		issue_number: issueNumber,
		removeLabels: plan.removeLabels || [],
		addLabel: plan.addLabel || '',
		summary: plan.summary || '',
	};
}

const FOLLOWUP_CLOSEOUT_PATTERN =
	/\b(remediation|follow[- ]up|clarification|post[- ]merge evidence|closeout reconciliation|post[- ]merge closeout)\b/i;
const PRIOR_CLOSEOUT_REF_PATTERN =
	/\b(?:prior|previous|triggering|related|after|from)?\s*(?:PR|pull request|issue)\s+#\d+\b/i;

export function isPermittedClosedSourceIssueFollowup({ body = '', sourceIssue = null } = {}) {
	if (String(sourceIssue?.state || '').toLowerCase() !== 'closed') return false;
	if (String(sourceIssue?.state_reason || '').toLowerCase() !== 'completed') return false;
	return FOLLOWUP_CLOSEOUT_PATTERN.test(body) && PRIOR_CLOSEOUT_REF_PATTERN.test(body);
}

export function postMergeIssueDispositionSection(body = '') {
	const match = String(body || '').match(/## POST-MERGE ISSUE DISPOSITION[\s\S]*?(?=\n## [A-Z]|\n<!--|$)/i);
	return match ? match[0] : '';
}

export function postMergeCloseoutChecklistSection(body = '') {
	const match = String(body || '').match(/## POST-MERGE CLOSEOUT CHECKLIST[\s\S]*?(?=\n## [A-Z]|\n<!--|$)/i);
	return match ? match[0] : '';
}

export function postMergeKeepOpenSections(body = '') {
	return [postMergeIssueDispositionSection(body), postMergeCloseoutChecklistSection(body)]
		.filter(Boolean)
		.join('\n');
}

function shouldKeepActiveSourceIssueOpenFromSection(section = '') {
	if (
		/\bremains?\b/i.test(section) &&
		/\bopen\b/i.test(section) &&
		/\bdo not (?:close|apply terminal close)\b/i.test(section) &&
		/\bstatus:active\b/i.test(section)
	) {
		return true;
	}

	return (
		/\bdo not close\b/i.test(section) &&
		(/\bremains?\b/i.test(section) || /\bmust remain\b/i.test(section)) &&
		/\bopen\b/i.test(section)
	);
}

export function shouldKeepActiveSourceIssueOpen(body = '') {
	return shouldKeepActiveSourceIssueOpenFromSection(postMergeKeepOpenSections(body));
}

export function isUmbrellaSourceIssue(issueMeta = null) {
	const title = String(issueMeta?.title || '').trim();
	return /^(PROJECT|PROGRAM):/i.test(title);
}

export function requestsSourceIssueTerminalClose(body = '', issueNumber = '') {
	const disposition = postMergeIssueDispositionSection(body);
	if (!disposition) return false;
	if (/\bdo not (?:close|apply terminal close)\b/i.test(disposition)) return false;

	const normalizedIssueNumber = String(issueNumber || '').replace(/^#/, '');
	const issueRef = normalizedIssueNumber ? `#${normalizedIssueNumber}` : '';

	if (/\b(?:close|apply terminal close to) source issue\b/i.test(disposition)) {
		return !issueRef || disposition.includes(issueRef);
	}

	if (issueRef) {
		return new RegExp(`\\bclose\\s+#?${normalizedIssueNumber}\\b`, 'i').test(disposition);
	}

	return false;
}

export function shouldKeepUmbrellaSourceIssueOpen({ issueMeta = null, prBody = '', issueNumber = '' } = {}) {
	if (!isUmbrellaSourceIssue(issueMeta)) return false;
	return !requestsSourceIssueTerminalClose(prBody, issueNumber);
}

export function shouldPreserveSourceIssueOpen({ body = '', issueMeta = null, issueNumber = '' } = {}) {
	return (
		shouldKeepActiveSourceIssueOpen(body) ||
		shouldKeepUmbrellaSourceIssueOpen({ issueMeta, prBody: body, issueNumber })
	);
}

export function shouldReopenActiveSourceIssue(body = '') {
	const section = postMergeKeepOpenSections(body);
	return shouldKeepActiveSourceIssueOpenFromSection(section) && /\breopen\b/i.test(section);
}

export function shouldReopenUmbrellaSourceIssue({ issueMeta = null, prBody = '', issueNumber = '' } = {}) {
	return shouldKeepUmbrellaSourceIssueOpen({ issueMeta, prBody, issueNumber });
}

export function planFailureSourceIssueRelabel({ issueLabels = [], repoLabels = [] } = {}) {
	const labels = new Set(
		Array.from(issueLabels || [])
			.map((label) => (typeof label === 'string' ? label : label?.name))
			.filter(Boolean),
	);
	const availableLabels = new Set(
		Array.from(repoLabels || [])
			.map((label) => (typeof label === 'string' ? label : label?.name))
			.filter(Boolean),
	);

	const hasFailureLabel = labels.has(FAILURE_SOURCE_ISSUE_LABEL);
	const canApplyFailureLabel = availableLabels.has(FAILURE_SOURCE_ISSUE_LABEL);

	if (!hasFailureLabel && !canApplyFailureLabel) {
		return {
			ok: false,
			reason: 'failure_label_unavailable',
			removeLabels: [],
			addLabel: '',
			summary:
				'halt — stale status labels preserved; status:failed label unavailable in repository',
		};
	}

	const removeLabels = STALE_SOURCE_ISSUE_LABELS.filter(
		(label) => label !== FAILURE_SOURCE_ISSUE_LABEL && labels.has(label),
	);
	const addLabel =
		canApplyFailureLabel && !hasFailureLabel ? FAILURE_SOURCE_ISSUE_LABEL : '';

	return {
		ok: true,
		reason: 'failure_source_issue_relabel_ready',
		removeLabels,
		addLabel,
		summary: `remove ${removeLabels.length ? removeLabels.join(', ') : 'none'}; add ${addLabel || 'none'}; preserve open source issue`,
	};
}

export function planActiveSourceIssueRelabel({ issueLabels = [] } = {}) {
	const labels = new Set(
		Array.from(issueLabels || [])
			.map((label) => (typeof label === 'string' ? label : label?.name))
			.filter(Boolean),
	);
	const removeLabels = STALE_SOURCE_ISSUE_LABELS.filter((label) => labels.has(label));

	return {
		ok: true,
		reason: 'active_source_issue_relabel_ready',
		removeLabels,
		addLabel: '',
		summary: `remove ${removeLabels.length ? removeLabels.join(', ') : 'none'}; preserve ${ACTIVE_SOURCE_ISSUE_LABEL}; source issue remains open`,
	};
}

export function isRemediationIssue({ title = '', labels = [] } = {}) {
	const labelNames = new Set(
		(labels || []).map((label) => (typeof label === 'string' ? label : label?.name)).filter(Boolean),
	);
	if (labelNames.has(REMEDIATION_ISSUE_LABEL)) return true;
	const issueTitle = String(title || '');
	return issueTitle.startsWith(REMEDIATION_TITLE_PREFIX) || issueTitle.startsWith(LEGACY_REMEDIATION_TITLE_PREFIX);
}

export function planTerminalLabelReconciliation({ issueLabels = [], repoLabels = [] } = {}) {
	const labels = new Set(
		Array.from(issueLabels || [])
			.map((label) => (typeof label === 'string' ? label : label?.name))
			.filter(Boolean),
	);
	const availableLabels = new Set(
		Array.from(repoLabels || [])
			.map((label) => (typeof label === 'string' ? label : label?.name))
			.filter(Boolean),
	);

	if (!availableLabels.has(TERMINAL_SOURCE_ISSUE_LABEL)) {
		return {
			ok: false,
			reason: 'missing_status_complete_label',
			summary: '`status:complete` label is unavailable; source issue was not relabeled or closed.',
		};
	}

	const knownTerminalStatusLabels = new Set([
		...STALE_SOURCE_ISSUE_LABELS,
		TERMINAL_SOURCE_ISSUE_LABEL,
		ACTIVE_SOURCE_ISSUE_LABEL,
	]);
	const unknownStatusLabels = [...labels].filter(
		(label) => label.startsWith('status:') && !knownTerminalStatusLabels.has(label),
	);
	if (unknownStatusLabels.length) {
		return {
			ok: false,
			reason: 'terminal_label_conflict',
			summary: `Unrecognized terminal status label(s): ${unknownStatusLabels.join(', ')}.`,
			conflictingLabels: unknownStatusLabels,
		};
	}

	const removeLabels = [...labels].filter(
		(label) =>
			(label.startsWith('status:') && label !== TERMINAL_SOURCE_ISSUE_LABEL) ||
			label === REMEDIATION_ISSUE_LABEL,
	);
	const addLabel = labels.has(TERMINAL_SOURCE_ISSUE_LABEL) ? '' : TERMINAL_SOURCE_ISSUE_LABEL;
	const terminalLabels = [...labels].filter((label) => !label.startsWith('status:') && label !== REMEDIATION_ISSUE_LABEL);
	if (!terminalLabels.includes(TERMINAL_SOURCE_ISSUE_LABEL)) terminalLabels.push(TERMINAL_SOURCE_ISSUE_LABEL);

	return {
		ok: true,
		reason: 'terminal_label_reconciliation_ready',
		removeLabels,
		addLabel,
		terminalLabels,
		summary: `remove ${removeLabels.length ? removeLabels.join(', ') : 'none'}; add ${addLabel || 'none'}; terminal ${TERMINAL_SOURCE_ISSUE_LABEL}`,
	};
}

export function buildFailureCloseoutComment({
	prNumber,
	mergeSha,
	sourceIssueNumber,
	syncAction,
	validatorStatus,
	verificationResult,
	validationSummary = '',
	terminalLabelResult = '',
	remediationIssueUrl = '',
}) {
	return [
		'Post-merge source issue closeout did not complete.',
		'',
		`- PR: #${prNumber}`,
		`- Merge SHA: ${mergeSha || 'unknown'}`,
		`- Source issue: ${sourceIssueNumber ? `#${sourceIssueNumber}` : 'unknown'}`,
		`- Sync action: ${syncAction}`,
		`- Validator status: ${validatorStatus}`,
		`- Post-merge verification result: ${verificationResult}`,
		`- Validation summary: ${validationSummary || 'no validation summary recorded'}`,
		`- Terminal label result: ${terminalLabelResult || 'failure labels applied; source issue remains open'}`,
		`- Remediation issue: ${remediationIssueUrl || 'see post-merge remediation workflow output'}`,
		'- Source issue was not closed; queue advancement remains stopped until remediation resolves.',
	].join('\n');
}

export function buildSourceIssueCloseoutComment({
	prNumber,
	mergeSha,
	sourceIssueNumber,
	validatorStatus,
	verificationResult,
	closeoutReason,
	validationSummary = '',
	terminalLabelResult = '',
	sourceIssueCloseoutMode = '',
	queueAdvancementStatus = 'no queue action; Program 1 launch, Program 2 mutation, and child issue creation remain stopped',
}) {
	return [
		'Post-merge source issue closeout completed.',
		'',
		`- PR: #${prNumber}`,
		`- Merge SHA: ${mergeSha || 'unknown'}`,
		`- Source issue: ${sourceIssueNumber ? `#${sourceIssueNumber}` : 'unknown'}`,
		`- Source issue closeout mode: ${sourceIssueCloseoutMode || 'open_source_issue'}`,
		`- Validator status: ${validatorStatus}`,
		`- Post-merge verification result: ${verificationResult}`,
		`- Validation summary: ${validationSummary || 'no validation summary recorded'}`,
		`- Terminal label result: ${terminalLabelResult || 'status:complete applied; stale workflow labels removed'}`,
		`- Queue advancement status: ${queueAdvancementStatus}`,
		`- Closeout reason: ${closeoutReason}`,
	].join('\n');
}

export function postMergeVerificationResult(postMergeResult) {
	if (!postMergeResult) return 'not recorded';
	if (postMergeResult.status === 'pass' && !postMergeResult.remediation_required) return 'pass';
	if (postMergeResult.status === 'pass' && postMergeResult.remediation_required) return 'pass-with-remediation';
	if (postMergeResult.status === 'fail') return 'fail';
	return String(postMergeResult.status || 'unknown');
}

export function shouldCloseSourceIssue({
	action,
	issueNumber,
	isMerged,
	issueMeta = null,
	postMergeResult = null,
	terminalLabelResult = null,
	prBody = '',
	openExceptionIssues = [],
	originalSourceIssue = null,
} = {}) {
	if (!issueNumber) return { close: false, reason: 'missing_source_issue' };
	if (!isMerged) return { close: false, reason: 'pr_not_merged' };
	if (action !== 'post_merge_success') return { close: false, reason: `action_${action}` };
	if (shouldWithholdOriginalSourceCloseout({
		sourceIssueNumber: issueNumber,
		originalSourceIssue: originalSourceIssue || postMergeResult?.original_source_issue || issueNumber,
		openExceptionIssues,
		issueMeta,
	})) {
		return { close: false, reason: 'unresolved_exception_chain' };
	}
	if (shouldKeepActiveSourceIssueOpen(prBody)) {
		return { close: false, reason: 'active_source_issue_remains_open' };
	}
	if (shouldKeepUmbrellaSourceIssueOpen({ issueMeta, prBody, issueNumber })) {
		return { close: false, reason: 'umbrella_source_issue_remains_open' };
	}
	const closedFollowupAllowed =
		String(issueMeta?.state || '').toUpperCase() === 'CLOSED' &&
		(postMergeResult?.source_issue_closeout_mode === 'closed_remediation_followup' ||
			isPermittedClosedSourceIssueFollowup({
				body: prBody,
				sourceIssue: issueMeta
					? { state: issueMeta.state, state_reason: issueMeta.state_reason || 'completed' }
					: null,
			}));
	if (issueMeta?.state && String(issueMeta.state).toUpperCase() !== 'OPEN' && !closedFollowupAllowed) {
		if (
			canIdempotentlyNormalizeClosedCompletedSourceIssue({
				sourceIssue: issueMeta,
				postMergeResult,
				terminalLabelResult,
			})
		) {
			return { close: true, reason: 'closed_completed_idempotent_normalize' };
		}
		return { close: false, reason: 'source_issue_not_open' };
	}
	if (postMergeResult && postMergeResult.status !== 'pass') {
		return { close: false, reason: 'validator_not_pass' };
	}
	if (postMergeResult?.remediation_required) {
		return { close: false, reason: 'remediation_required' };
	}
	if ((postMergeResult?.reviewer_disposition_failures || []).length > 0) {
		return { close: false, reason: 'undispositioned_reviewer_findings' };
	}
	if (issueMeta && isRemediationIssue(issueMeta) && !closedFollowupAllowed) {
		return { close: false, reason: 'remediation_issue' };
	}
	if (terminalLabelResult && !terminalLabelResult.ok) {
		return { close: false, reason: terminalLabelResult.reason || 'terminal_label_reconciliation_failed' };
	}
	return { close: true, reason: 'post_merge_validation_success' };
}
