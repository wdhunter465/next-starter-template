/**
 * Originating-delivery closeout cycle (#3069).
 * PMO process: docs/ops/pmo/github-issue-closeout-protocol.md
 * Dispatcher: docs/ops/pmo/queue-watch-and-dispatch-protocol.md
 */

export const EXCEPTION_LABEL = 'post-merge-failure';
export const EXCEPTION_TITLE_PREFIX = 'Post-merge closeout exception for ';
export const LEGACY_EXCEPTION_TITLE_PREFIX = 'Post-merge remediation required for ';

function labelNames(issue = {}) {
	return (Array.isArray(issue.labels) ? issue.labels : [])
		.map((label) => (typeof label === 'string' ? label : label?.name || ''))
		.filter(Boolean);
}

export function toIssueNumber(value) {
	const n = Number(value || 0);
	return Number.isInteger(n) && n > 0 ? n : null;
}

export function toLineageIssue(issue = {}) {
	return {
		number: issue.number,
		title: issue.title || '',
		state: issue.state || '',
		labels: labelNames(issue),
		body: issue.body || '',
		created_at: issue.created_at || issue.createdAt || '',
	};
}

export function isExceptionIssue(issue = {}) {
	const title = String(issue.title || '');
	return labelNames(issue).includes(EXCEPTION_LABEL)
		|| title.startsWith(EXCEPTION_TITLE_PREFIX)
		|| title.startsWith(LEGACY_EXCEPTION_TITLE_PREFIX);
}

export function parseExceptionLineage(issue = {}) {
	const body = String(issue.body || '');
	const originatingPr = Number(body.match(/^- PR: #(\d+)/m)?.[1] || 0) || null;
	const sourceIssue = Number(body.match(/^- Source issue: #(\d+)/m)?.[1] || 0) || null;
	const originalSource = Number(body.match(/^- Original source issue: #(\d+)/m)?.[1] || 0) || sourceIssue;
	const iteration = Number(body.match(/^- Cycle iteration: (\d+)/m)?.[1] || 0) || (isExceptionIssue(issue) ? 1 : 0);
	return {
		is_exception: isExceptionIssue(issue),
		originating_pr: originatingPr,
		source_issue: sourceIssue,
		original_source_issue: originalSource,
		cycle_iteration: iteration,
	};
}

export function openExceptionsForOriginalSource(openIssues = [], originalSourceIssue) {
	const original = Number(originalSourceIssue || 0);
	if (!original) return [];
	return (Array.isArray(openIssues) ? openIssues : []).filter((issue) => {
		if (!isExceptionIssue(issue)) return false;
		const parsed = parseExceptionLineage(issue);
		return Number(parsed.original_source_issue) === original;
	});
}

export function resolveDeliveryLineage({
	result = {},
	declaredSourceIssueMeta = null,
	openExceptionIssues = [],
} = {}) {
	const declared = Number(result.source_issue || 0) || null;
	const parsed = declaredSourceIssueMeta
		? parseExceptionLineage(declaredSourceIssueMeta)
		: { is_exception: false, original_source_issue: declared, originating_pr: null, cycle_iteration: 0 };
	const original = parsed.is_exception
		? (parsed.original_source_issue || parsed.source_issue || declared)
		: (result.original_source_issue || declared);
	const prior = openExceptionsForOriginalSource(openExceptionIssues, original);
	const nextIteration = parsed.is_exception
		? Math.max(Number(parsed.cycle_iteration) || 1, prior.length) + 1
		: prior.length + 1;

	return {
		declared_source_issue: declared,
		original_source_issue: original,
		originating_pr: parsed.originating_pr || result.pr || null,
		in_exception_cycle: Boolean(parsed.is_exception) || prior.length > 0,
		cycle_iteration: nextIteration,
	};
}

export function shouldWithholdOriginalSourceCloseout({
	sourceIssueNumber,
	originalSourceIssue,
	openExceptionIssues = [],
	issueMeta = null,
} = {}) {
	if (isExceptionIssue(issueMeta || {})) return false;
	const original = Number(originalSourceIssue || sourceIssueNumber || 0);
	const source = Number(sourceIssueNumber || 0);
	if (!original || !source || original !== source) return false;
	return openExceptionsForOriginalSource(openExceptionIssues, original).length > 0;
}

export function planSuccessorPause({
	agentLabel,
	openIssues = [],
	exceptionIssueNumbers = [],
} = {}) {
	if (!agentLabel) return { pause: false, issue: null, reason: 'missing_agent_label' };
	const excluded = new Set((exceptionIssueNumbers || []).map(Number));
	const candidates = (Array.isArray(openIssues) ? openIssues : [])
		.filter((issue) => {
			if (excluded.has(Number(issue.number))) return false;
			if (isExceptionIssue(issue)) return false;
			const labels = labelNames(issue);
			if (!labels.includes(agentLabel)) return false;
			return labels.includes('status:queued');
		})
		.sort((left, right) => Date.parse(left.created_at || 0) - Date.parse(right.created_at || 0));
	const next = candidates[0];
	if (!next) return { pause: false, issue: null, reason: 'no_successor' };
	return {
		pause: true,
		issue: next.number,
		addLabels: ['status:queued'],
		reason: 'originating_agent_successor_paused',
	};
}

export function planSuccessorResume({
	pausedIssueNumber,
	openExceptionIssues = [],
	originalSourceIssue,
} = {}) {
	const remaining = openExceptionsForOriginalSource(openExceptionIssues, originalSourceIssue);
	if (remaining.length > 0) {
		return { resume: false, issue: pausedIssueNumber || null, reason: 'exception_chain_open' };
	}
	if (!pausedIssueNumber) return { resume: false, issue: null, reason: 'no_paused_successor' };
	return { resume: true, issue: pausedIssueNumber, reason: 'clean_terminal_closeout' };
}

export function cycleIsComplete({
	originalSourceClosed = false,
	openExceptionIssues = [],
	originalSourceIssue,
} = {}) {
	return Boolean(originalSourceClosed)
		&& openExceptionsForOriginalSource(openExceptionIssues, originalSourceIssue).length === 0;
}
