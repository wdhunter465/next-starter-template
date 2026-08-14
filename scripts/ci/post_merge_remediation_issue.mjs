#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseRemediationIssue } from './close_duplicate_remediation_issues.mjs';
import { githubRepoRequest } from './github_issue_api.mjs';
import { REMEDIATION_ISSUE_LABEL, REMEDIATION_TITLE_PREFIX } from './post_merge_source_issue_closeout.mjs';

/** Keep aligned with HISTORICAL_PR_BODY_HYGIENE_FAILURE_CODES in post_merge_validator.mjs. */
const HISTORICAL_PR_BODY_HYGIENE_FAILURE_CODES = new Set([
	'missing_required_section',
	'missing_advisory_section',
]);

function isHistoricalPrBodyHygieneFailure(failure = {}) {
	return HISTORICAL_PR_BODY_HYGIENE_FAILURE_CODES.has(String(failure?.code || '').trim());
}

export const CLOSEOUT_RUNTIME_ERROR_CODE = 'closeout_runtime_error';
export const BATCH_CIRCUIT_BREAKER_THRESHOLD = 3;
export const BATCH_CIRCUIT_BREAKER_TITLE_PREFIX = 'Post-merge closeout batch circuit breaker';
export const BATCH_CIRCUIT_BREAKER_MARKER_PREFIX = 'batch_circuit_breaker:';

export function normalizeRuntimeErrorMessage(message = '') {
	return String(message || '')
		.trim()
		.toLowerCase()
		.replace(/\s+/g, ' ');
}

export function hashNormalizedRuntimeErrorMessage(message = '') {
	return crypto
		.createHash('sha256')
		.update(normalizeRuntimeErrorMessage(message))
		.digest('hex')
		.slice(0, 12);
}

export function buildRuntimeFailureSignature({ failureCode = CLOSEOUT_RUNTIME_ERROR_CODE, message = '' } = {}) {
	const code = String(failureCode || CLOSEOUT_RUNTIME_ERROR_CODE).trim() || CLOSEOUT_RUNTIME_ERROR_CODE;
	return `${code}:${hashNormalizedRuntimeErrorMessage(message)}`;
}

export function batchCircuitBreakerDedupeKey(signature) {
	return `${BATCH_CIRCUIT_BREAKER_MARKER_PREFIX}${signature}`;
}

export function batchCircuitBreakerMarker(signature) {
	return `<!-- ${batchCircuitBreakerDedupeKey(signature)} -->`;
}

export function extractCloseoutRuntimeFailure({ error = null, result = null, detail = null } = {}) {
	if (error) {
		return {
			failureCode: CLOSEOUT_RUNTIME_ERROR_CODE,
			message: error instanceof Error ? error.message : String(error),
		};
	}

	const metadataFailures = [
		...(result?.metadata_failures || []),
		...(detail?.metadata_failures || []),
	];
	const runtimeFailure = metadataFailures.find(
		(failure) => failure?.code === CLOSEOUT_RUNTIME_ERROR_CODE,
	);
	if (runtimeFailure) {
		return {
			failureCode: CLOSEOUT_RUNTIME_ERROR_CODE,
			message: runtimeFailure.message || 'Post-merge closeout failed.',
		};
	}

	if (result?.status === 'error' && result?.failure_reason) {
		return {
			failureCode: CLOSEOUT_RUNTIME_ERROR_CODE,
			message: result.failure_reason,
		};
	}

	return null;
}

export function runtimeFailureSignatureFromObservation(observation = {}) {
	const extracted = extractCloseoutRuntimeFailure(observation);
	if (!extracted) return null;
	return buildRuntimeFailureSignature(extracted);
}

export class BatchCircuitBreakerState {
	constructor(threshold = BATCH_CIRCUIT_BREAKER_THRESHOLD) {
		this.threshold = threshold;
		this.signature = null;
		this.count = 0;
		this.tripped = false;
		this.tripDetails = null;
	}

	reset() {
		this.signature = null;
		this.count = 0;
	}

	previewSuppress(signature) {
		if (!signature || this.tripped) return Boolean(this.tripped);
		const nextCount = signature === this.signature ? this.count + 1 : 1;
		return nextCount >= this.threshold;
	}

	record(signature) {
		if (!signature) return { tripped: false, count: this.count };
		if (signature === this.signature) {
			this.count += 1;
		} else {
			this.signature = signature;
			this.count = 1;
		}
		if (this.count >= this.threshold) {
			this.tripped = true;
			this.tripDetails = {
				signature,
				consecutive_count: this.count,
				failure_code: signature.split(':')[0] || CLOSEOUT_RUNTIME_ERROR_CODE,
			};
			return { tripped: true, count: this.count };
		}
		return { tripped: false, count: this.count };
	}

	onSuccess() {
		this.reset();
	}
}

export function formatAffectedPrs(affectedPrs = []) {
	const prs = Array.isArray(affectedPrs) ? affectedPrs : [];
	return prs.length ? prs.map((pr) => `#${pr}`).join(', ') : 'none recorded';
}

export function circuitBreakerIncidentTitle({ signature, failureCode = CLOSEOUT_RUNTIME_ERROR_CODE } = {}) {
	const shortHash = String(signature || '').split(':').slice(1).join(':') || 'unknown';
	return `${BATCH_CIRCUIT_BREAKER_TITLE_PREFIX} — ${failureCode} — ${shortHash}`;
}

export function circuitBreakerIncidentBody({
	signature,
	failureCode = CLOSEOUT_RUNTIME_ERROR_CODE,
	message = '',
	manifestPath = '',
	runId = '',
	repository = '',
	affectedPrs = [],
	consecutiveCount = BATCH_CIRCUIT_BREAKER_THRESHOLD,
	workflowRunUrl = '',
} = {}) {
	const lines = [
		batchCircuitBreakerMarker(signature),
		'Post-merge batch closeout circuit breaker tripped after repeated identical runtime failures.',
		'',
		`- Dedupe key: \`${batchCircuitBreakerDedupeKey(signature)}\``,
		`- Failure signature: \`${signature}\``,
		`- Failure code: ${failureCode}`,
		`- Consecutive identical runtime errors: ${consecutiveCount}`,
		`- Manifest path: ${manifestPath || 'not recorded'}`,
		`- Workflow run: ${workflowRunUrl || (runId && repository ? `https://github.com/${repository}/actions/runs/${runId}` : 'not recorded')}`,
		`- Affected PRs in batch: ${formatAffectedPrs(affectedPrs)}`,
		'',
		'## Normalized runtime error',
		'',
		'```text',
		normalizeRuntimeErrorMessage(message) || 'not recorded',
		'```',
		'',
		'## Operator action',
		'- Stop batch closeout replay until the shared runtime defect is fixed.',
		'- Per-target post-merge exception issues are suppressed while this circuit is open.',
		'- Resolve the root cause, then re-dispatch path-scoped manifests in small batches.',
	];

	return `${lines.join('\n')}\n`;
}

export function findCircuitBreakerIncident(issues = [], signature) {
	const marker = batchCircuitBreakerMarker(signature);
	return (Array.isArray(issues) ? issues : []).find(
		(issue) =>
			!issue.pull_request
			&& String(issue.state || 'open').toLowerCase() === 'open'
			&& String(issue.body || '').includes(marker),
	) || null;
}

export async function upsertCircuitBreakerIncident({
	token,
	repository,
	signature,
	failureCode = CLOSEOUT_RUNTIME_ERROR_CODE,
	message = '',
	manifestPath = '',
	runId = '',
	affectedPrs = [],
	consecutiveCount = BATCH_CIRCUIT_BREAKER_THRESHOLD,
	listOpenIssuesFn = paginateOpenIssues,
	requestFn = request,
} = {}) {
	const title = circuitBreakerIncidentTitle({ signature, failureCode });
	const body = circuitBreakerIncidentBody({
		signature,
		failureCode,
		message,
		manifestPath,
		runId,
		repository,
		affectedPrs,
		consecutiveCount,
	});
	const search = await listOpenIssuesFn({ token, repository });
	const existing = findCircuitBreakerIncident(search, signature)
		|| (Array.isArray(search)
			? search.find((issue) => issue.title === title && !issue.pull_request)
			: undefined);

	if (existing) {
		await requestFn({
			token,
			repository,
			path: `/issues/${existing.number}`,
			method: 'PATCH',
			body: { body },
		});
		await requestFn({
			token,
			repository,
			path: `/issues/${existing.number}/comments`,
			method: 'POST',
			body: {
				body: [
					'Batch closeout circuit breaker observed another identical runtime failure burst.',
					'',
					`- Consecutive identical runtime errors: ${consecutiveCount}`,
					`- Affected PRs in batch: ${formatAffectedPrs(affectedPrs)}`,
					`- Manifest path: ${manifestPath || 'not recorded'}`,
				].join('\n'),
			},
		});
		return {
			action: 'updated',
			issue: existing.html_url || `#${existing.number}`,
			dedupe_key: batchCircuitBreakerDedupeKey(signature),
		};
	}

	const created = await requestFn({
		token,
		repository,
		path: '/issues',
		method: 'POST',
		body: {
			title,
			body,
			labels: ['post-merge-failure', 'infra'],
		},
	});

	return {
		action: 'created',
		issue: created.html_url || `#${created.number}`,
		dedupe_key: batchCircuitBreakerDedupeKey(signature),
	};
}

export function blockingCloseoutFailures(result = {}) {
	const blockingMetadata = (result.metadata_failures || []).filter((failure) =>
		failure?.severity !== 'advisory' && !isHistoricalPrBodyHygieneFailure(failure));
	const blockingWorkflows = (result.workflow_failures || []).filter((failure) => failure?.required === true);

	return [
		...blockingMetadata,
		...(result.implementation_failures || []),
		...(result.diataxis_failures || []),
		...(result.reviewer_findings || []).map((finding) => ({
			code: 'late_reviewer_finding',
			message: `${finding?.reviewer || 'reviewer'}: ${finding?.body || finding?.url || 'finding recorded'}`,
		})),
		...(result.reviewer_disposition_failures || []),
		...blockingWorkflows.map((failure) => ({
			code: 'workflow_failure',
			message: `${failure?.workflow || 'workflow'} ${failure?.conclusion || ''} ${failure?.classification || ''}`.trim(),
		})),
	];
}

export function requiresGovernanceException(result = {}) {
	const governanceCodes = new Set([
		'undispositioned_reviewer_comment',
		'outdated_reviewer_thread_without_disposition',
		'closeout_blocker_declared',
		'unresolved_auto_repair_scaffold',
		'forbidden_placeholder_token',
		'missing_source_issue',
		'ambiguous_source_issue_candidates',
		'source_issue_authority_conflict',
		'active_alternate_program_lane',
		'implementation_evidence_failure',
		'diataxis_failure',
		'late_reviewer_finding',
		'workflow_failure',
	]);
	return blockingCloseoutFailures(result).some((failure) => governanceCodes.has(failure.code));
}

export const ORIGINATING_AGENT_CATALOG = {
	cursor: { id: 'cursor', label: 'agent:cursor', display: 'Cursor Local' },
	claude: { id: 'claude', label: 'agent:claude', display: 'Claude Code' },
	work: { id: 'work', label: 'agent:Work', display: 'WORK' },
	chatgpt: { id: 'chatgpt', label: 'agent:ChatGPT', display: 'ChatGPT' },
	codex: { id: 'codex', label: 'agent:codex', display: 'Codex' },
};

function ambiguousOriginatingAgent(reason) {
	return {
		determined: false,
		ambiguous: true,
		id: null,
		label: null,
		display: null,
		reason,
	};
}

function agentIdFromBranch(ref = '') {
	const name = String(ref || '').trim().toLowerCase();
	if (!name) return null;
	if (name.startsWith('cursor/') || name.startsWith('cursor-')) return 'cursor';
	if (name.startsWith('claude/') || name.startsWith('claude-')) return 'claude';
	if (name.startsWith('work/') || name.startsWith('work-')) return 'work';
	if (name.startsWith('codex/') || name.startsWith('codex-')) return 'codex';
	return null;
}

function agentIdFromImplementationLine(body = '') {
	const match = String(body || '').match(/^\s*-\s*Implementation agent:\s*(.+)$/im);
	if (!match) return null;
	const value = String(match[1] || '').trim().toLowerCase();
	if (!value || value === 'not-applicable' || value === 'n/a') return null;
	if (/\bcursor\b/.test(value)) return 'cursor';
	if (/\bclaude\b/.test(value)) return 'claude';
	if (/\bcodex\b/.test(value)) return 'codex';
	if (/\bwork\b/.test(value)) return 'work';
	if (/\bchatgpt\b/.test(value)) return 'chatgpt';
	return null;
}

function agentIdFromLabels(labels = []) {
	const names = (Array.isArray(labels) ? labels : [])
		.map((label) => (typeof label === 'string' ? label : label?.name || ''))
		.filter(Boolean);
	const hits = [];
	for (const [id, agent] of Object.entries(ORIGINATING_AGENT_CATALOG)) {
		if (names.includes(agent.label)) hits.push(id);
	}
	if (hits.length === 1) return hits[0];
	if (hits.length > 1) return 'conflict';
	return null;
}

function normalizeExplicitAgent(value) {
	const raw = String(value || '').trim().toLowerCase();
	if (!raw) return null;
	if (ORIGINATING_AGENT_CATALOG[raw]) return raw;
	if (raw.includes('cursor')) return 'cursor';
	if (raw.includes('claude')) return 'claude';
	if (raw.includes('codex')) return 'codex';
	if (raw.includes('work')) return 'work';
	if (raw.includes('chatgpt')) return 'chatgpt';
	return null;
}

export function resolveOriginatingAgent(result = {}) {
	const branchId = agentIdFromBranch(result.head_ref || result.headRefName || '');
	const bodyId = agentIdFromImplementationLine(result.pr_body || result.body || '');
	const labelId = agentIdFromLabels(result.source_issue_labels || []);
	const explicitId = normalizeExplicitAgent(result.originating_agent);
	const ids = [];

	for (const id of [explicitId, bodyId, branchId, labelId]) {
		if (!id) continue;
		if (id === 'conflict') {
			return ambiguousOriginatingAgent('conflicting_source_issue_agent_labels');
		}
		if (!ids.includes(id)) ids.push(id);
	}

	if (ids.length === 1) {
		return {
			determined: true,
			ambiguous: false,
			reason: 'originating_agent_determined',
			...ORIGINATING_AGENT_CATALOG[ids[0]],
		};
	}
	if (ids.length > 1) {
		return ambiguousOriginatingAgent('conflicting_originating_agent_evidence');
	}
	return ambiguousOriginatingAgent('originating_agent_not_determinable');
}

export function attachOriginatingAgentEvidence(result = {}, pr = {}) {
	const attached = { ...result };
	const headRef = String(pr?.head?.ref || pr?.headRefName || '').trim();
	if (!String(attached.head_ref || attached.headRefName || '').trim() && headRef) {
		attached.head_ref = headRef;
	}
	if (attached.pr_body == null && attached.body == null && pr && Object.prototype.hasOwnProperty.call(pr, 'body')) {
		attached.pr_body = String(pr.body || '');
	}
	return attached;
}

export function remediationIssueLabels(result = {}) {
	const labels = [REMEDIATION_ISSUE_LABEL];
	if (result?.self_healing_safe) {
		labels.push('ops-pr-escalation');
	}
	const owner = resolveOriginatingAgent(result);
	if (owner.determined && owner.label) {
		labels.push(owner.label);
		labels.push('status:active');
	}
	return labels;
}

export function mergeRemediationIssueLabels(existingLabels = [], result = {}) {
	const existing = (Array.isArray(existingLabels) ? existingLabels : [])
		.map((label) => (typeof label === 'string' ? label : label?.name || ''))
		.filter(Boolean);
	return [...new Set([...existing, ...remediationIssueLabels(result)])];
}

function failureConditions(result = {}) {
	return blockingCloseoutFailures(result);
}

function exceptionKey(result = {}) {
	const source = result.source_issue ? `source #${result.source_issue}` : 'source none';
	const condition = failureConditions(result)[0]?.code || 'closeout_exception';
	return `${source} / ${condition}`;
}

export function remediationTitle(result) {
	const pr = result?.pr ? `PR #${result.pr}` : `merge ${String(result?.merge_sha || 'unknown').slice(0, 12)}`;
	return `${REMEDIATION_TITLE_PREFIX}${pr} / ${exceptionKey(result)}`;
}

export function blockingFuturePrs(result = {}) {
	return blockingCloseoutFailures(result).length > 0
		? 'yes — queue advancement remains stopped until this Ops exception is resolved'
		: 'no — no blocking closeout failures recorded';
}

export function linkedRemediationIssue(result = {}) {
	return result.linked_remediation_issue || result.remediation_issue || result.remediationIssue || 'none recorded';
}

function requestedOwnerActionLine(owner) {
	if (owner.determined) {
		return `- Requested owner/action: ${owner.display} (${owner.label}) — immediate originating-delivery remediation; no new PMO dispatch`;
	}
	return '- Requested owner/action: ChatGPT/Bill review, then assign a bounded remediation owner before queue advancement resumes';
}

function queueAdvancementLine(result, owner) {
	if (owner.determined) {
		return '- Queue advancement status: stopped for the originating agent\'s successor only; unrelated lanes remain executable; resume automatically after independent acceptance/closeout';
	}
	return `- Queue advancement status: ${result.queue_advancement_status || 'stopped; ChatGPT/Bill review required'}`;
}

function requiredActionSection(owner) {
	if (owner.determined) {
		return [
			'## Required originating-agent action',
			`- This exception is an immediate originating-delivery obligation for ${owner.display}. It does not require a new PMO dispatch.`,
			'- Reconcile every reported reviewer comment/thread and validation defect on the originating PR record.',
			'- Open a bounded remediation PR only when repository content, code, workflow, or documentation must change.',
			'- Pause only this agent\'s next assigned successor (`status:queued`); unrelated agent lanes remain executable.',
			'- After independent WORK acceptance and exception closeout, the paused successor resumes automatically without a new dispatch.',
		];
	}
	return [
		'## Required ChatGPT/Bill decision',
		'- Originating ownership is ambiguous or protected; do not leave this exception without a deterministic owner and next action.',
		'- Decide whether the source issue may be closed, corrected, or kept open.',
		'- Authorize any corrective PR or issue mutation through a bounded follow-up issue/PR.',
		'- Queue advancement remains stopped until the exception is resolved.',
	];
}

export function remediationBody(result) {
	const owner = resolveOriginatingAgent(result);
	const conditions = failureConditions(result);
	const lines = [
		'Post-merge closeout exception detected. CI refused deterministic source issue closeout.',
		'',
		`- PR: ${result.pr ? `#${result.pr}` : 'none'}`,
		`- Merge SHA: ${result.merge_sha || 'unknown'}`,
		`- Source issue: ${result.source_issue ? `#${result.source_issue}` : 'none'}`,
		`- Source issue candidates: ${result.source_issue_candidates?.length ? result.source_issue_candidates.join(', ') : 'none'}`,
		`- Source issue closeout mode: ${result.source_issue_closeout_mode || 'not evaluated'}`,
		`- Validator status: ${result.status}`,
		`- Remediation required: ${result.remediation_required ? 'yes' : 'no'}`,
		`- Blocking future PRs: ${blockingFuturePrs(result)}`,
		`- Linked remediation issue: ${linkedRemediationIssue(result)}`,
		requestedOwnerActionLine(owner),
		`- Originating-agent determination: ${owner.reason}`,
		`- Canonical rule: docs/ops/as-built/post-merge-originating-agent-remediation-3069.md`,
		`- Workflow run URL: ${result.workflow_run_url || 'not recorded'}`,
		`- Terminal label result: ${result.terminal_label_result?.summary || 'not evaluated'}`,
		queueAdvancementLine(result, owner),
		'',
		'## Detected failure condition',
	];

	if (conditions.length) {
		for (const failure of conditions) {
			lines.push(`- ${failure.code}: ${failure.message}`);
		}
	} else {
		lines.push('- closeout_exception: Closeout was ambiguous or unsafe.');
	}

	lines.push(
		'',
		'## Action CI refused to take',
		'- CI did not close, relabel, or otherwise mutate the source issue.',
		'- CI did not advance the queue, launch Program 1, mutate Program 2, or create child issues.',
		'',
		...requiredActionSection(owner),
		'',
		'## Evidence collected by CI',
		'',
		'## Rollback recommendation',
		result.status === 'fail'
			? '- Consider reverting the merge commit if the merged change cannot be corrected quickly and production/orchestration risk remains.'
			: '- No rollback recommendation recorded.',
		'',
		'## Workflow failures',
	);

	if (result.workflow_failures?.length) {
		for (const failure of result.workflow_failures) {
			lines.push(
				`- ${failure.workflow} — ${failure.classification} — ${failure.required ? 'required' : 'optional'} — run ${failure.run_id || 'unknown'} — ${failure.url || 'no run URL'}`,
			);
			if (failure.jobs?.length) {
				for (const job of failure.jobs) {
					const steps = job.failed_steps?.length
						? `; failed steps: ${job.failed_steps.map((step) => `${step.name} (${step.conclusion || 'unknown'})`).join(', ')}`
						: '';
					lines.push(`  - Job ${job.id || 'unknown'}: ${job.name || 'unknown job'} (${job.conclusion || 'unknown'})${steps}${job.url ? ` — ${job.url}` : ''}`);
				}
			} else {
				lines.push('  - Job identifiers: not available from Actions API response');
			}
		}
	} else {
		lines.push('- none');
	}

	lines.push('', '## Metadata failures');
	if (result.metadata_failures?.length) {
		for (const failure of result.metadata_failures) {
			lines.push(`- ${failure.code}: ${failure.message}`);
		}
	} else {
		lines.push('- none');
	}

	lines.push('', '## Implementation evidence failures');
	if (result.implementation_failures?.length) {
		for (const failure of result.implementation_failures) {
			lines.push(`- ${failure.code}: ${failure.message}`);
		}
	} else {
		lines.push('- none');
	}

	lines.push('', '## DIATAXIS failures');
	if (result.diataxis_failures?.length) {
		for (const failure of result.diataxis_failures) {
			lines.push(`- ${failure.code}: ${failure.message}`);
		}
	} else {
		lines.push('- none');
	}

	lines.push('', '## Reviewer findings');
	if (result.reviewer_findings?.length) {
		for (const finding of result.reviewer_findings) {
			lines.push(`- ${finding.url} by ${finding.reviewer}: ${finding.body}`);
		}
	} else {
		lines.push('- none');
	}

	return `${lines.join('\n')}\n`;
}

function request(args) {
	return githubRepoRequest({ ...args, userAgent: 'lgfc-post-merge-remediation' });
}

async function paginateOpenIssues({ token, repository }) {
	const issues = [];
	let page = 1;
	while (true) {
		const batch = await request({
			token,
			repository,
			path: `/issues?state=open&per_page=100&page=${page}`,
		});
		if (!Array.isArray(batch) || batch.length === 0) break;
		issues.push(...batch);
		if (batch.length < 100) break;
		page += 1;
	}
	return issues;
}

export function shouldUpsertRemediationIssue(result = {}) {
	if (selfHealingCanResolve(result)) return false;
	if (result.source_issue_linkage_repair?.applied && !result.remediation_required && result.status === 'pass') {
		return false;
	}
	if (result.status === 'skipped') return false;
	return blockingCloseoutFailures(result).length > 0;
}

export function selfHealingCanResolve(result = {}) {
	const selfHealing = result.self_healing || result.selfHealing || {};
	if (result.source_issue_linkage_repair?.applied && result.status === 'pass' && !result.remediation_required) {
		return true;
	}
	return Boolean(result.self_healing_safe === true)
		|| (
			String(selfHealing.classification || '').toLowerCase() === 'safe_auto_fix'
			&& selfHealing.safe_to_close !== false
			&& selfHealing.ambiguous !== true
		);
}

export function findCanonicalRemediationIssue(result = {}, openIssues = []) {
	const candidate = parseRemediationIssue({
		number: 0,
		title: remediationTitle(result),
		body: remediationBody(result),
		created_at: new Date().toISOString(),
	});

	return (Array.isArray(openIssues) ? openIssues : [])
		.filter((issue) => !issue.pull_request && String(issue.state || 'open').toLowerCase() === 'open')
		.find((issue) => {
			const parsed = parseRemediationIssue(issue);
			return parsed.group_key === candidate.group_key;
		}) || null;
}

export function shouldSuppressRemediationForCircuitBreaker({
	suppressRemediationIssues = false,
	batchCircuitBreaker = null,
	result = null,
	error = null,
} = {}) {
	if (suppressRemediationIssues) return true;
	if (!batchCircuitBreaker) return false;
	const signature = runtimeFailureSignatureFromObservation({ result, error });
	if (!signature) return false;
	return batchCircuitBreaker.previewSuppress(signature);
}

export async function upsertRemediationIssue({ token, repository, result }) {
	if (!shouldUpsertRemediationIssue(result)) {
		return {
			action: 'skipped',
			issue: null,
			reason: selfHealingCanResolve(result)
				? 'self-healing-safe-resolution'
				: 'validation-passed-or-skipped',
		};
	}

	let enriched = result;
	if (!String(result.head_ref || result.headRefName || '').trim() && result.pr) {
		try {
			const pr = await request({
				token,
				repository,
				path: `/pulls/${result.pr}`,
			});
			enriched = attachOriginatingAgentEvidence(result, pr);
		} catch {
			enriched = result;
		}
	}

	const title = remediationTitle(enriched);
	const body = remediationBody(enriched);
	const search = await paginateOpenIssues({ token, repository });
	const existing = Array.isArray(search)
		? search.find((issue) => issue.title === title && !issue.pull_request)
			|| findCanonicalRemediationIssue(enriched, search)
		: undefined;

	if (existing) {
		await request({
			token,
			repository,
			path: `/issues/${existing.number}`,
			method: 'PATCH',
			body: {
				body,
				labels: mergeRemediationIssueLabels(existing.labels, enriched),
			},
		});
		return { action: 'updated', issue: existing.html_url || `#${existing.number}` };
	}

	const created = await request({
		token,
		repository,
		path: '/issues',
		method: 'POST',
		body: { title, body, labels: remediationIssueLabels(enriched) },
	});

	return { action: 'created', issue: created.html_url || `#${created.number}` };
}

export async function main() {
	const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
	const repository = process.env.GITHUB_REPOSITORY;
	const resultPath = process.env.POST_MERGE_RESULT_PATH || process.argv[2] || 'post-merge-result.json';

	if (!token || !repository) throw new Error('GITHUB_TOKEN/GH_TOKEN and GITHUB_REPOSITORY are required.');
	const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
	const outcome = await upsertRemediationIssue({ token, repository, result });
	console.log(JSON.stringify(outcome, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		console.error(error);
		process.exit(1);
	});
}
