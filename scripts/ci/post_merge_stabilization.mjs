import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const INITIAL_DELAY_MS = 60_000;
export const RETRY_INTERVAL_MS = 15_000;
export const MAX_RETRY_WINDOW_MS = 60_000;
/**
 * `pr-issue-accounting` (ops-pr-issue-accounting.yml) is deliberately excluded here:
 * that workflow is `workflow_dispatch`-only ("manual-only while paused" per
 * CI_GUARDRAILS_MAP.md) and never produces a check-run on a `pull_request`/`push`
 * event. Requiring its presence made `requiredChecksLoaded` permanently false —
 * every post-merge stabilization run times out at `post_merge_stabilization_timeout`
 * regardless of how long it waits, because the check-run this list expects can never
 * appear. Re-add it here only once that workflow is switched to an automatic trigger.
 */
export const REQUIRED_CHECK_NAMES = ['quality', 'gitleaks'];

/**
 * Deploys the merge itself triggers (#4445). The closeout must not run before they finish, or it can
 * mark an Issue verified before a migration has applied or the site has redeployed.
 */
export const DEPLOY_WAIT_MAX_MS = 20 * 60_000;
export const DEPLOY_POLL_MS = 30_000;
/** How long an expected deploy may stay absent before it is treated as not triggered. */
export const DEPLOY_APPEAR_GRACE_MS = 3 * 60_000;
export const D1_MIGRATIONS_WORKFLOW_NAME = 'D1 Migrations';
export const PAGES_CHECK_NAME = 'Cloudflare Pages';

const D1_MIGRATION_PATHS = [
	/^migrations\//,
	/^wrangler\.toml$/,
	/^\.github\/workflows\/d1-migrations\.yml$/,
	/^scripts\/ci\/d1_prod_dev_identity_check\.mjs$/,
];
const PAGES_BUILD_PATHS = [
	/^src\//,
	/^functions\//,
	/^public\//,
	/^package(?:-lock)?\.json$/,
	/^next\.config\./,
	/^wrangler\.toml$/,
	/^tsconfig\.json$/,
];

export function expectedMergeDeploys(changedFiles = []) {
	const files = Array.isArray(changedFiles) ? changedFiles : [];
	return {
		d1Migrations: files.some((file) => D1_MIGRATION_PATHS.some((pattern) => pattern.test(file))),
		pagesBuild: files.some((file) => PAGES_BUILD_PATHS.some((pattern) => pattern.test(file))),
	};
}

/**
 * Pure evaluation of the deploys a merge triggered.
 * - A deploy that is running or queued keeps the closeout waiting.
 * - A deploy that finished without success blocks the closeout (`failed`).
 * - A D1 Migrations run that never appears is a failure once the grace period passes.
 * - A Pages check that never appears is treated as not triggered once the grace period passes.
 */
export function evaluateMergeDeploys({ expected, d1Run = null, pagesCheck = null, elapsedMs = 0, graceMs = DEPLOY_APPEAR_GRACE_MS } = {}) {
	const waiting = [];
	const failed = [];
	const done = [];

	if (expected?.d1Migrations) {
		if (!d1Run) {
			if (elapsedMs >= graceMs) failed.push('d1_migrations_not_triggered');
			else waiting.push('d1_migrations');
		} else if (String(d1Run.status || '').toLowerCase() !== 'completed') {
			waiting.push('d1_migrations');
		} else if (d1Run.conclusion === 'success') {
			done.push('d1_migrations');
		} else {
			failed.push(`d1_migrations_${d1Run.conclusion || 'failed'}`);
		}
	}

	if (expected?.pagesBuild) {
		if (!pagesCheck) {
			if (elapsedMs < graceMs) waiting.push('pages_build');
		} else if (String(pagesCheck.status || '').toLowerCase() !== 'completed') {
			waiting.push('pages_build');
		} else if (['success', 'neutral', 'skipped'].includes(pagesCheck.conclusion)) {
			done.push('pages_build');
		} else {
			failed.push(`pages_build_${pagesCheck.conclusion || 'failed'}`);
		}
	}

	if (failed.length) return { settled: false, terminal: true, classification: 'merge_deploy_failed', reasons: failed };
	if (waiting.length) return { settled: false, classification: 'merge_deploy_pending', reasons: waiting };
	return { settled: true, classification: 'settled', reasons: [], done };
}

export async function waitForMergeDeploys({
	expected,
	loadDeployState,
	sleep = delay,
	pollMs = DEPLOY_POLL_MS,
	maxWaitMs = DEPLOY_WAIT_MAX_MS,
	graceMs = DEPLOY_APPEAR_GRACE_MS,
} = {}) {
	if (!expected?.d1Migrations && !expected?.pagesBuild) {
		return { status: 'settled', attempts: 0, elapsedMs: 0, reasons: [], waitedFor: [] };
	}
	let elapsedMs = 0;
	let attempts = 0;
	while (true) {
		attempts += 1;
		const state = await loadDeployState();
		const evaluation = evaluateMergeDeploys({ expected, ...state, elapsedMs, graceMs });
		if (evaluation.settled) {
			return { status: 'settled', attempts, elapsedMs, reasons: [], waitedFor: evaluation.done };
		}
		if (evaluation.terminal) {
			return { status: 'failed', classification: evaluation.classification, reasons: evaluation.reasons, attempts, elapsedMs };
		}
		if (elapsedMs >= maxWaitMs) {
			return { status: 'failed', classification: 'merge_deploy_timeout', reasons: evaluation.reasons, attempts, elapsedMs };
		}
		await sleep(pollMs);
		elapsedMs += pollMs;
	}
}

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

	if (snapshot.reviewThreadsPaginationOverflow) {
		return {
			settled: false,
			terminal: true,
			classification: 'review_thread_pagination_unsupported',
			reasons: ['review_thread_pagination_unsupported'],
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
		reviewThreadsPaginationOverflow: threads?.pageInfo?.hasNextPage === true,
		reviewStateSettled:
			reviewsResult.status === 'fulfilled' &&
			Boolean(threads) &&
			threads.pageInfo?.hasNextPage === false &&
			Array.isArray(threads.nodes) &&
			threads.nodes.every((thread) => typeof thread?.isResolved === 'boolean'),
	};
}

export async function loadGitHubMergeDeployState({ token, repository, prNumber, expectedMergeSha }) {
	const [runs, checks, files] = await Promise.allSettled([
		githubJson(`/actions/runs?head_sha=${expectedMergeSha}&event=push&per_page=50`, { token, repository }),
		githubJson(`/commits/${expectedMergeSha}/check-runs?per_page=100`, { token, repository }),
		githubJson(`/pulls/${prNumber}/files?per_page=100`, { token, repository }),
	]);
	const workflowRuns = runs.status === 'fulfilled' ? runs.value.workflow_runs || [] : [];
	const checkRuns = checks.status === 'fulfilled' ? checks.value.check_runs || [] : [];
	return {
		changedFiles: files.status === 'fulfilled' ? files.value.map((file) => file.filename) : null,
		d1Run: workflowRuns.find((run) => run.name === D1_MIGRATIONS_WORKFLOW_NAME) || null,
		pagesCheck: checkRuns.find((check) => check.name === PAGES_CHECK_NAME) || null,
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

	let result = await stabilizePostMergeState({
		expectedMergeSha,
		loadSnapshot: () => loadGitHubPostMergeSnapshot({ token, repository, prNumber, expectedMergeSha }),
	});
	if (result.status === 'settled') {
		const first = await loadGitHubMergeDeployState({ token, repository, prNumber, expectedMergeSha });
		const expected = expectedMergeDeploys(first.changedFiles || []);
		const deploys = await waitForMergeDeploys({
			expected,
			loadDeployState: () => loadGitHubMergeDeployState({ token, repository, prNumber, expectedMergeSha }),
		});
		if (deploys.status === 'failed') {
			result = { ...deploys, attempts: result.attempts + deploys.attempts, elapsedMs: result.elapsedMs + deploys.elapsedMs };
		}
	}
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
