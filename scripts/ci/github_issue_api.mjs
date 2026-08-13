import {
	GitHubInfrastructureError,
	githubApiFetch,
	sleep,
} from './github_api_retry.mjs';

export {
	GitHubInfrastructureError,
	computeBackoffDelayMs,
	isGitHubRateLimitResponse,
	sleep,
} from './github_api_retry.mjs';

export class GitHubRateLimitError extends Error {
	constructor(method, path, status, body = '') {
		super(`${method} ${path} failed: ${status} ${body}`.trim());
		this.name = 'GitHubRateLimitError';
		this.method = method;
		this.path = path;
		this.status = status;
		this.body = body;
		this.classification = 'rate-limit';
	}
}

export function isGitHubRateLimitError(error) {
	return error instanceof GitHubRateLimitError
		|| (error instanceof GitHubInfrastructureError && error.classification === 'rate-limit');
}

export async function githubRepoRequest({
	token,
	repository,
	path,
	method = 'GET',
	body,
	userAgent = 'lgfc-ci-github-issue-api',
	maxRetries = 3,
	initialBackoffMs = 1000,
	maxBackoffMs = 30000,
	sleepFn = sleep,
	fetchFn = fetch,
} = {}) {
	try {
		const { response, bodyText } = await githubApiFetch({
			url: `https://api.github.com/repos/${repository}${path}`,
			method,
			headers: {
				Authorization: `Bearer ${token}`,
				Accept: 'application/vnd.github+json',
				'X-GitHub-Api-Version': '2022-11-28',
				'User-Agent': userAgent,
				...(body ? { 'Content-Type': 'application/json' } : {}),
			},
			body: body ? JSON.stringify(body) : undefined,
			maxRetries,
			initialBackoffMs,
			maxBackoffMs,
			sleepFn,
			fetchFn,
			pathLabel: path,
		});

		if (response.ok) {
			return response.status === 204 ? null : response.json();
		}

		throw new Error(`${method} ${path} failed: ${response.status} ${bodyText || ''}`.trim());
	} catch (error) {
		if (error instanceof GitHubInfrastructureError && error.classification === 'rate-limit') {
			throw new GitHubRateLimitError(method, path, error.status, error.body);
		}
		throw error;
	}
}
