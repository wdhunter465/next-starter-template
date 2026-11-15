#!/usr/bin/env node

import { pathToFileURL } from 'node:url';
import { githubRepoRequest } from './github_issue_api.mjs';
import {
	applyTerminalLabelReconciliation,
	FAILURE_SOURCE_ISSUE_LABEL,
	isRemediationIssue,
	issueLabelNameList,
	LEGACY_REMEDIATION_TITLE_PREFIX,
	planActiveSourceIssueRelabel,
	REMEDIATION_ISSUE_LABEL,
	REMEDIATION_TITLE_PREFIX,
} from './post_merge_source_issue_closeout.mjs';
import {
	isExceptionIssue,
	openExceptionsForOriginalSource,
	parseExceptionLineage,
} from './post_merge_delivery_lineage.mjs';
import { parseRemediationIssue } from './close_duplicate_remediation_issues.mjs';

function request(args) {
	return githubRepoRequest({ ...args, userAgent: 'lgfc-close-remediation-for-pr' });
}

export function isOpenRemediationIssue(issue) {
	if (issue?.pull_request) return false;
	return isRemediationIssue({ title: issue?.title, labels: issue?.labels });
}

function addRemediationIssues(issuesByNumber, batch) {
	if (!Array.isArray(batch)) return;
	for (const issue of batch) {
		if (!isOpenRemediationIssue(issue)) continue;
		issuesByNumber.set(issue.number, issue);
	}
}

export const REMEDIATION_TITLE_SEARCH_QUERIES = [
	'Post-merge closeout exception',
	'Post-merge remediation required',
];

export async function searchOpenRemediationIssues({
	token,
	repository,
	searchQueries = REMEDIATION_TITLE_SEARCH_QUERIES,
	fetchFn = fetch,
}) {
	const issuesByNumber = new Map();

	for (const titleFragment of searchQueries) {
		const q = `repo:${repository} is:issue is:open in:title "${titleFragment}"`;
		try {
			const response = await fetchFn(
				`https://api.github.com/search/issues?q=${encodeURIComponent(q)}&per_page=100`,
				{
					headers: {
						Authorization: `Bearer ${token}`,
						Accept: 'application/vnd.github+json',
						'X-GitHub-Api-Version': '2022-11-28',
						'User-Agent': 'lgfc-close-remediation-for-pr',
					},
				},
			);
			if (!response.ok) {
				console.error(`Remediation issue search failed (${response.status}): ${q}`);
				continue;
			}
			const data = await response.json();
			addRemediationIssues(issuesByNumber, data.items);
		} catch (error) {
			console.error(`Remediation issue search error for ${q}:`, error);
		}
	}

	return [...issuesByNumber.values()];
}

async function paginateOpenRemediationIssues({ token, repository }) {
	const issuesByNumber = new Map();
	let page = 1;

	while (true) {
		const batch = await request({
			token,
			repository,
			path: `/issues?state=open&labels=${encodeURIComponent(REMEDIATION_ISSUE_LABEL)}&per_page=100&page=${page}`,
		});
		if (!Array.isArray(batch) || batch.length === 0) break;
		addRemediationIssues(issuesByNumber, batch);
		if (batch.length < 100) break;
		page += 1;
	}

	// Relabeled remediation exceptions can lose post-merge-failure while staying open (#1601).
	for (const issue of await searchOpenRemediationIssues({ token, repository })) {
		issuesByNumber.set(issue.number, issue);
	}

	return [...issuesByNumber.values()];
}

export function remediationIssuesForPr(issues, prNumber) {
	const target = String(prNumber);
	return issues.filter((issue) => {
		const parsed = parseRemediationIssue(issue);
		return parsed.pr === target;
	});
}

export function remediationCloseComment({ prNumber, mergeSha, sourceIssue }) {
	return [
		'Closing remediation issue after successful post-merge closeout.',
		'',
		`- PR: #${prNumber}`,
		`- Merge SHA: ${mergeSha || 'unknown'}`,
		`- Source issue: ${sourceIssue ? `#${sourceIssue}` : 'none'}`,
		'- Validator status: pass',
		'- Remediation required: no',
	].join('\n');
}

export async function closeRemediationIssuesForPr({
	token,
	repository,
	prNumber,
	mergeSha = '',
	sourceIssue = '',
	dryRun = false,
	listOpenIssues,
	requestFn = request,
}) {
	const openIssues = listOpenIssues
		? await listOpenIssues({ token, repository })
		: await paginateOpenRemediationIssues({ token, repository });
	const matches = remediationIssuesForPr(openIssues, prNumber);
	const closed = [];
	const failed = [];
	const closedNumbers = new Set();

	for (const issue of matches) {
		if (dryRun) {
			closed.push({ number: issue.number, dry_run: true });
			continue;
		}

		try {
			await requestFn({
				token,
				repository,
				path: `/issues/${issue.number}/comments`,
				method: 'POST',
				body: {
					body: remediationCloseComment({ prNumber, mergeSha, sourceIssue }),
				},
			});

			await requestFn({
				token,
				repository,
				path: `/issues/${issue.number}`,
				method: 'PATCH',
				body: { state: 'closed', state_reason: 'completed' },
			});

			closed.push({ number: issue.number });
			closedNumbers.add(issue.number);
		} catch (error) {
			console.error(`Failed to close remediation issue #${issue.number} for PR #${prNumber}:`, error);
			failed.push({
				number: issue.number,
				message: error instanceof Error ? error.message : String(error),
			});
		}
	}

	const sourceIssueNumber = Number(sourceIssue);
	if (
		Number.isInteger(sourceIssueNumber) &&
		!closedNumbers.has(sourceIssueNumber) &&
		!dryRun
	) {
		const linkedRemediationSource = openIssues.find((issue) => issue.number === sourceIssueNumber);
		if (linkedRemediationSource && isRemediationIssue(linkedRemediationSource)) {
			try {
				await requestFn({
					token,
					repository,
					path: `/issues/${sourceIssueNumber}/comments`,
					method: 'POST',
					body: {
						body: remediationCloseComment({ prNumber, mergeSha, sourceIssue }),
					},
				});

				await requestFn({
					token,
					repository,
					path: `/issues/${sourceIssueNumber}`,
					method: 'PATCH',
					body: { state: 'closed', state_reason: 'completed' },
				});

				closed.push({ number: sourceIssueNumber, linked_source: true });
			} catch (error) {
				console.error(
					`Failed to close linked remediation source issue #${sourceIssueNumber} for PR #${prNumber}:`,
					error,
				);
				failed.push({
					number: sourceIssueNumber,
					message: error instanceof Error ? error.message : String(error),
				});
			}
		}
	}

	// #5246: the original source issues of the exceptions just closed, and the exceptions still open, so the
	// caller can clear a stale status:failed once the whole chain is resolved.
	const closedIssueObjects = openIssues.filter((issue) => closedNumbers.has(issue.number));
	const originalSources = [
		...new Set(
			closedIssueObjects
				.map((issue) => parseExceptionLineage(issue).original_source_issue)
				.filter((n) => Number.isInteger(n) && n > 0)
				.filter((n) => !openIssues.some((issue) => issue.number === n && isExceptionIssue(issue))),
		),
	];

	return {
		prNumber: String(prNumber),
		scanned: openIssues.length,
		matched: matches.length,
		closed,
		failed,
		originalSources,
		remainingOpenIssues: openIssues.filter((issue) => !closedNumbers.has(issue.number)),
	};
}

export function failedSourceClearedComment({ prNumber, mergeSha, removedLabels }) {
	return [
		'Post-merge remediation is complete: the remediation pull request merged and re-verification on `main` passed.',
		'',
		`- Remediation PR: #${prNumber}`,
		`- Merge SHA: ${mergeSha || 'unknown'}`,
		`- Validator status: pass`,
		`- Labels removed: ${removedLabels.length ? removedLabels.join(', ') : 'none'}`,
		'- This issue stays open. Closing it is a separate step for its owner.',
	].join('\n');
}

/**
 * #5246: when a remediation PR merges and its re-verification passes, the original source issue leaves
 * `status:failed`. It is only touched when every exception in its chain is closed, it is still open, and
 * it still carries `status:failed`. A failing re-verification never reaches this function (the caller runs
 * it only on `post_merge_success`), so a failing result changes nothing. The issue is left open.
 */
export async function clearFailedLabelAfterRemediation({
	token,
	repository,
	prNumber,
	mergeSha = '',
	originalSources = [],
	remainingOpenIssues = [],
	dryRun = false,
	requestFn = request,
}) {
	const cleared = [];
	const skipped = [];
	const failed = [];

	for (const original of originalSources) {
		if (openExceptionsForOriginalSource(remainingOpenIssues, original).length > 0) {
			skipped.push({ number: original, reason: 'exception_chain_open' });
			continue;
		}
		try {
			const issue = await requestFn({ token, repository, path: `/issues/${original}` });
			if (!issue || String(issue.state || '').toLowerCase() !== 'open') {
				skipped.push({ number: original, reason: 'source_not_open' });
				continue;
			}
			if (!issueLabelNameList(issue).includes(FAILURE_SOURCE_ISSUE_LABEL)) {
				skipped.push({ number: original, reason: 'no_failed_label' });
				continue;
			}
			const plan = planActiveSourceIssueRelabel({ issueLabels: issue.labels || [] });
			if (dryRun) {
				cleared.push({ number: original, dry_run: true, removeLabels: plan.removeLabels });
				continue;
			}
			await applyTerminalLabelReconciliation({
				token,
				repository,
				issueNumber: original,
				plan,
				requestFn,
			});
			await requestFn({
				token,
				repository,
				path: `/issues/${original}/comments`,
				method: 'POST',
				body: {
					body: failedSourceClearedComment({
						prNumber,
						mergeSha,
						removedLabels: plan.removeLabels,
					}),
				},
			});
			cleared.push({ number: original, removeLabels: plan.removeLabels });
		} catch (error) {
			console.error(`Failed to clear ${FAILURE_SOURCE_ISSUE_LABEL} on #${original} after PR #${prNumber}:`, error);
			failed.push({ number: original, message: error instanceof Error ? error.message : String(error) });
		}
	}

	return { cleared, skipped, failed };
}

export async function main() {
	const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
	const repository = process.env.GITHUB_REPOSITORY;
	const prNumber = process.env.PR_NUMBER;
	const mergeSha = process.env.MERGE_SHA || '';
	const sourceIssue = process.env.SOURCE_ISSUE || '';
	const dryRun = ['1', 'true', 'yes'].includes(String(process.env.DRY_RUN || '').toLowerCase());

	if (!token || !repository || !prNumber) {
		throw new Error('GITHUB_TOKEN/GH_TOKEN, GITHUB_REPOSITORY, and PR_NUMBER are required.');
	}

	const outcome = await closeRemediationIssuesForPr({
		token,
		repository,
		prNumber,
		mergeSha,
		sourceIssue,
		dryRun,
	});
	const failedLabel = await clearFailedLabelAfterRemediation({
		token,
		repository,
		prNumber,
		mergeSha,
		originalSources: outcome.originalSources,
		remainingOpenIssues: outcome.remainingOpenIssues,
		dryRun,
	});
	const printable = { ...outcome, failedLabel };
	delete printable.remainingOpenIssues;
	console.log(JSON.stringify(printable, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		console.error(error);
		process.exit(1);
	});
}
