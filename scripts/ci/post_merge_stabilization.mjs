import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const INITIAL_DELAY_MS = 60_000;
export const RETRY_INTERVAL_MS = 15_000;
export const MAX_RETRY_WINDOW_MS = 60_000;
export const REQUIRED_CHECK_NAMES = ['quality', 'gitleaks'];

const delay = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function terminalCheck(check = {}) {
	return String(check.status || '').toLowerCase() === 'completed' && Boolean(check.conclusion);
}

export function evaluatePostMergeSnapshot(snapshot = {}, { expectedMergeSha = '' } = {}) {
	const actualMergeSha = String(snapshot.pr?.merge_commit_sha || '');
	if (actualMergeSha && expectedMergeSha && actualMergeSha !== expectedMergeSha) {
		return {
			settled: false,
			terminal: true,
			classification: 'merge_sha_mismatch',
			reasons: ['merge_sha_mismatch'],
		};
	}

	const reasons = [];
	if (!snapshot.pr?.merged_at) reasons.push('pr_merge_metadata_unsettled');
	if (!actualMergeSha) reasons.push('merge_sha_unavailable');
	if (!snapshot.mainContainsMerge) reasons.push('merge_sha_not_visible_on_main');
	if (
		!snapshot.requiredChecksLoaded ||
		!Array.isArray(snapshot.requiredChecks) ||
		snapshot.requiredChecks.length === 0 ||
		snapshot.requiredChecks.some((check) => !terminalCheck(check))
	) {
		reasons.push('required_checks_unsettled');
	}
	if (!snapshot.reviewStateSettled) reasons.push('review_state_unsettled');

	return reasons.length
		? { settled: false, classification: 'post_merge_state_unsettled', reasons }
		: { settled: true, classification: 'settled', reasons: [] };
}

export async function stabilizePostMergeState({
	expectedMergeSha,
	loadSnapshot,
	sleep = delay,
	initialDelayMs = INITIAL_DELAY_MS,
	retryIntervalMs = RETRY_INTERVAL_MS,
	maxRetryWindowMs = MAX_RETRY_WINDOW_MS,
} = {}) {
	await sleep(initialDelayMs);
	let elapsedMs = initialDelayMs;
	let attempts = 0;
	let evaluation;

	while (true) {
		attempts += 1;
		evaluation = evaluatePostMergeSnapshot(await loadSnapshot(), { expectedMergeSha });
		if (evaluation.settled) {
			return { status: 'settled', attempts, elapsedMs };
		}
		if (evaluation.terminal) {
			return {
				status: 'failed',
				classification: evaluation.classification,
				reasons: evaluation.reasons,
				attempts,
				elapsedMs,
			};
		}
		if (elapsedMs - initialDelayMs >= maxRetryWindowMs) {
			return {
				status: 'failed',
				classification: 'post_merge_stabilization_timeout',
				reasons: evaluation.reasons,
				attempts,
				elapsedMs,
			};
		}
		await sleep(retryIntervalMs);
		elapsedMs += retryIntervalMs;
	}
}

async function githubJson(path, { token, repository, method = 'GET', body } = {}) {
	const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
		method,
		headers: {
			Accept: 'application/vnd.github+json',
			Authorization: `Bearer ${token}`,
			'X-GitHub-Api-Version': '2022-11-28',
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	if (!response.ok) throw new Error(`GitHub API ${method} ${path} returned ${response.status}`);
	return response.json();
}

async function githubGraphql(query, variables, { token } = {}) {
	const response = await fetch('https://api.github.com/graphql', {
		method: 'POST',
		headers: {
			Accept: 'application/vnd.github+json',
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ query, variables }),
	});
	if (!response.ok) throw new Error(`GitHub GraphQL API returned ${response.status}`);
	const payload = await response.json();
	if (payload.errors?.length) throw new Error(`GitHub GraphQL error: ${payload.errors[0].message}`);
	return payload.data;
}

export async function loadGitHubPostMergeSnapshot({ token, repository, prNumber, expectedMergeSha }) {
	const [owner, repo] = repository.split('/');
	let pr = null;
	try {
		pr = await githubJson(`/pulls/${prNumber}`, { token, repository });
	} catch {
		// The evaluation below treats unavailable merge metadata as unsettled.
	}
	const checkSha = pr?.head?.sha || expectedMergeSha;
	const reviewQuery = `
		query($owner: String!, $repo: String!, $pr: Int!) {
			repository(owner: $owner, name: $repo) {
				pullRequest(number: $pr) {
					reviewThreads(first: 100) {
						pageInfo { hasNextPage }
						nodes { isResolved }
					}
				}
			}
		}`;

	const results = await Promise.allSettled([
		githubJson(`/compare/${expectedMergeSha}...main`, { token, repository }),
		githubJson(`/commits/${checkSha}/check-runs?per_page=100`, { token, repository }),
		githubJson(`/pulls/${prNumber}/reviews?per_page=100`, { token, repository }),
		githubGraphql(reviewQuery, { owner, repo, pr: Number(prNumber) }, { token }),
	]);

	const [compareResult, checksResult, reviewsResult, threadsResult] = results;
	const allChecks = checksResult.status === 'fulfilled' ? checksResult.value.check_runs || [] : [];
	const requiredChecks = REQUIRED_CHECK_NAMES.map((name) =>
		allChecks.find((check) => String(check.name || '').toLowerCase() === name),
	).filter(Boolean);
	const threads = threadsResult.status === 'fulfilled' ? threadsResult.value.repository?.pullRequest?.reviewThreads : null;

	return {
		pr,
		mainContainsMerge: compareResult.status === 'fulfilled' && ['ahead', 'identical'].includes(compareResult.value.status),
		requiredChecks,
		requiredChecksLoaded: checksResult.status === 'fulfilled' && requiredChecks.length === REQUIRED_CHECK_NAMES.length,
		reviewStateSettled:
			reviewsResult.status === 'fulfilled' &&
			Boolean(threads) &&
			threads.pageInfo?.hasNextPage === false &&
			Array.isArray(threads.nodes) &&
			threads.nodes.every((thread) => typeof thread?.isResolved === 'boolean'),
	};
}

function reportMarkdown(result, { prNumber, expectedMergeSha }) {
	return [
		'# Post-Merge Stabilization',
		'',
		`- Status: **${result.status}**`,
		`- Classification: \`${result.classification || 'settled'}\``,
		`- PR: #${prNumber}`,
		`- Event merge SHA: \`${expectedMergeSha}\``,
		`- Attempts: ${result.attempts}`,
		`- Elapsed: ${result.elapsedMs / 1000}s`,
		`- Unsettled evidence: ${result.reasons?.length ? result.reasons.map((reason) => `\`${reason}\``).join(', ') : 'none'}`,
		'',
		result.status === 'failed'
			? 'Normal post-merge validation was not started, preventing speculative downstream exception families.'
			: 'GitHub merge, main, check, and review state is settled; normal post-merge validation may proceed.',
		'',
	].join('\n');
}

function appendOutput(name, value) {
	if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

export async function main(env = process.env) {
	const token = env.GITHUB_TOKEN;
	const repository = env.GITHUB_REPOSITORY;
	const prNumber = env.PR_NUMBER;
	const expectedMergeSha = env.GITHUB_SHA;
	if (!token || !repository || !prNumber || !expectedMergeSha) {
		throw new Error('GITHUB_TOKEN, GITHUB_REPOSITORY, PR_NUMBER, and GITHUB_SHA are required');
	}

	const result = await stabilizePostMergeState({
		expectedMergeSha,
		loadSnapshot: () => loadGitHubPostMergeSnapshot({ token, repository, prNumber, expectedMergeSha }),
	});
	appendOutput('status', result.status);
	appendOutput('pr_number', prNumber);
	appendOutput('classification', result.classification || 'settled');

	if (result.status === 'failed') {
		fs.writeFileSync(
			'post-merge-result.json',
			`${JSON.stringify({ ...result, pr: Number(prNumber), merge_sha: expectedMergeSha }, null, 2)}\n`,
		);
		fs.writeFileSync('post-merge-result.md', reportMarkdown(result, { prNumber, expectedMergeSha }));
	}
	return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
