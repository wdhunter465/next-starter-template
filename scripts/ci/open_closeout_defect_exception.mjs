#!/usr/bin/env node
// #5327: when post-merge closeout finds a defect and no post-merge-failure Issue
// exists, open exactly one team:operations ops-exception and assign an agent when known.

import { pathToFileURL } from 'node:url';

import {
	blockingCloseoutFailures,
	findCanonicalRemediationIssue,
	resolveOriginatingAgent,
	selfHealingCanResolve,
} from './post_merge_remediation_issue.mjs';
import { REMEDIATION_ISSUE_LABEL } from './post_merge_source_issue_closeout.mjs';
import { githubRepoRequest } from './github_issue_api.mjs';

export const CLOSEOUT_DEFECT_MARKER_PREFIX = 'ops-exception-closeout-defect:';
export const CLOSEOUT_DEFECT_EXCEPTION_LABELS = ['team:operations', 'ops-exception'];

export function closeoutDefectMarker(prNumber) {
	const pr = String(prNumber || '').trim() || 'unknown';
	return `<!-- ${CLOSEOUT_DEFECT_MARKER_PREFIX}pr-${pr} -->`;
}

export function hasCloseoutDefect(result = {}) {
	if (selfHealingCanResolve(result)) return false;
	if (result.status === 'skipped') return false;
	if (blockingCloseoutFailures(result).length > 0) return true;
	return Boolean(result.remediation_required) || result.status === 'fail';
}

export function closeoutDefectExceptionLabels(result = {}) {
	const labels = [...CLOSEOUT_DEFECT_EXCEPTION_LABELS];
	const owner = resolveOriginatingAgent(result);
	if (owner.determined && owner.label) {
		labels.push(owner.label);
		labels.push('status:active');
	}
	return [...new Set(labels)];
}

export function closeoutDefectTitle(result = {}) {
	const pr = result?.pr ? `PR #${result.pr}` : `merge ${String(result?.merge_sha || 'unknown').slice(0, 12)}`;
	const code = blockingCloseoutFailures(result)[0]?.code || 'closeout_defect';
	return `OPS EXCEPTION: closeout defect — ${pr} / ${code}`;
}

export function closeoutDefectBody(result = {}) {
	const failures = blockingCloseoutFailures(result);
	const failureLines = failures.length
		? failures.map((f) => `- \`${f.code || 'unknown'}\`: ${f.message || 'no message'}`).join('\n')
		: '- (no structured blocking failures; closeout reported fail / remediation required)';
	const owner = resolveOriginatingAgent(result);
	const ownerLine = owner.determined
		? `- Assigned agent: ${owner.display} (${owner.label})`
		: '- Assigned agent: none yet — Operations claims via normal queue';
	return [
		closeoutDefectMarker(result.pr),
		'',
		'## Exception: post-merge closeout defect without a post-merge-failure Issue',
		'',
		`- PR: ${result.pr ? `#${result.pr}` : 'unknown'}`,
		`- Merge SHA: ${result.merge_sha || 'unknown'}`,
		`- Source issue: ${result.source_issue ? `#${result.source_issue}` : 'none'}`,
		`- Workflow run: ${result.workflow_run_url || 'not recorded'}`,
		ownerLine,
		'',
		'## Blocking failures',
		'',
		failureLines,
		'',
		'## What this Issue is',
		'',
		'Automatic Operations exception (#5327). Opened because closeout found a defect and no open `post-merge-failure` Issue covered it (for example remediation was suppressed or skipped). A later closeout pass for the same PR comments here instead of opening a duplicate. Operations closes this when the defect is fixed or accepted.',
	].join('\n');
}

export function closeoutDefectComment(result = {}) {
	const code = blockingCloseoutFailures(result)[0]?.code || 'closeout_defect';
	return [
		`Another closeout defect for PR #${result.pr || 'unknown'}: \`${code}\`.`,
		'',
		`- Merge SHA: ${result.merge_sha || 'unknown'}`,
		`- Workflow run: ${result.workflow_run_url || 'not recorded'}`,
	].join('\n');
}

export function findOpenCloseoutDefectException(issues = [], prNumber) {
	const marker = closeoutDefectMarker(prNumber);
	return (issues || []).find((issue) => {
		if (issue.pull_request) return false;
		if (issue.state && issue.state !== 'open') return false;
		return typeof issue.body === 'string' && issue.body.includes(marker);
	}) || null;
}

async function listOpenLabeledIssues({ token, repository, label, requestFn }) {
	const issues = [];
	let page = 1;
	while (true) {
		const batch = await requestFn({
			token,
			repository,
			path: `/issues?state=open&labels=${encodeURIComponent(label)}&per_page=100&page=${page}`,
			userAgent: 'lgfc-closeout-defect-exception',
		});
		if (!Array.isArray(batch) || batch.length === 0) break;
		issues.push(...batch.filter((issue) => !issue.pull_request));
		if (batch.length < 100) break;
		page += 1;
	}
	return issues;
}

export function remediationAlreadyCoversDefect(remediationOutcome = null) {
	return remediationOutcome?.action === 'created' || remediationOutcome?.action === 'updated';
}

/**
 * Open (or comment on) a team:operations exception when closeout has a defect
 * and no post-merge-failure Issue exists for it.
 */
export async function ensureCloseoutDefectOpsException({
	token,
	repository,
	result,
	remediationOutcome = null,
	requestFn = githubRepoRequest,
}) {
	if (!hasCloseoutDefect(result)) {
		return { action: 'skipped', reason: 'no-closeout-defect' };
	}
	if (remediationAlreadyCoversDefect(remediationOutcome)) {
		return { action: 'skipped', reason: 'post-merge-failure-upserted' };
	}

	const openRemediation = await listOpenLabeledIssues({
		token,
		repository,
		label: REMEDIATION_ISSUE_LABEL,
		requestFn,
	});
	const existingRemediation = findCanonicalRemediationIssue(result, openRemediation)
		|| openRemediation.find((issue) => {
			const title = String(issue.title || '');
			return result?.pr && title.includes(`PR #${result.pr}`);
		});
	if (existingRemediation) {
		return {
			action: 'skipped',
			reason: 'post-merge-failure-exists',
			issue: existingRemediation.html_url || `#${existingRemediation.number}`,
		};
	}

	const openExceptions = await listOpenLabeledIssues({
		token,
		repository,
		label: 'ops-exception',
		requestFn,
	});
	const existingException = findOpenCloseoutDefectException(openExceptions, result.pr);
	if (existingException) {
		await requestFn({
			token,
			repository,
			path: `/issues/${existingException.number}/comments`,
			method: 'POST',
			body: { body: closeoutDefectComment(result) },
			userAgent: 'lgfc-closeout-defect-exception',
		});
		return {
			action: 'commented',
			number: existingException.number,
			issue: existingException.html_url || `#${existingException.number}`,
		};
	}

	const created = await requestFn({
		token,
		repository,
		path: '/issues',
		method: 'POST',
		body: {
			title: closeoutDefectTitle(result),
			body: closeoutDefectBody(result),
			labels: closeoutDefectExceptionLabels(result),
		},
		userAgent: 'lgfc-closeout-defect-exception',
	});
	return {
		action: 'created',
		number: created.number,
		issue: created.html_url || `#${created.number}`,
		labels: closeoutDefectExceptionLabels(result),
	};
}

async function main() {
	const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
	const repository = process.env.GITHUB_REPOSITORY;
	const resultPath = process.env.POST_MERGE_RESULT_PATH || 'post-merge-result.json';
	if (!token || !repository) {
		throw new Error('GITHUB_TOKEN and GITHUB_REPOSITORY are required.');
	}
	const fs = await import('node:fs');
	const result = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
	const outcome = await ensureCloseoutDefectOpsException({ token, repository, result });
	console.log(JSON.stringify(outcome));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	});
}
