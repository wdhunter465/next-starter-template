/**
 * Bounded retry for transient GitHub API infrastructure failures.
 *
 * Distinguishes:
 * - transient-infrastructure: 5xx / retryable network errors (retry, then fail closed)
 * - rate-limit: 429 / secondary rate-limit 403 (retry, then fail closed as rate-limit)
 * - repository-policy / client: deterministic 4xx and other non-retryable failures (no retry)
 */

export class GitHubInfrastructureError extends Error {
	constructor({
		method = 'GET',
		path = '',
		status = 0,
		body = '',
		attempts = 1,
		attemptLog = [],
		classification = 'transient-infrastructure',
	} = {}) {
		const attemptSummary = attemptLog.length
			? ` attempts=[${attemptLog.map((entry) => `${entry.attempt}:${entry.status || entry.error || 'n/a'}`).join(',')}]`
			: '';
		super(
			`${classification}: ${method} ${path} failed after ${attempts} attempt(s): ${status} ${String(body || '').trim()}${attemptSummary}`.trim(),
		);
		this.name = 'GitHubInfrastructureError';
		this.method = method;
		this.path = path;
		this.status = status;
		this.body = body;
		this.attempts = attempts;
		this.attemptLog = attemptLog;
		this.classification = classification;
	}
}

export function isTransientGitHubStatus(status) {
	return status === 500 || status === 502 || status === 503 || status === 504;
}

export function isGitHubRateLimitResponse(status, body = '') {
	const text = String(body || '');
	if (status === 429) return true;
	if (status === 403 && /rate limit|secondary rate limit/i.test(text)) return true;
	return false;
}

export function isRetryableNetworkError(error) {
	if (!error || error instanceof GitHubInfrastructureError) return false;
	if (error.name === 'AbortError') return true;
	const message = String(error.message || '');
	const code = String(error.code || '');
	return /fetch failed|network|econnreset|econnrefused|etimedout|enotfound|socket|tls|UND_ERR/i.test(
		`${message} ${code}`,
	);
}

export function computeBackoffDelayMs(attempt, initialBackoffMs = 1000, maxBackoffMs = 30000) {
	return Math.min(initialBackoffMs * 2 ** Math.max(attempt - 1, 0), maxBackoffMs);
}

export async function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyRetryableFailure(status, body = '', networkError = null) {
	if (networkError) {
		return 'transient-infrastructure';
	}
	if (isGitHubRateLimitResponse(status, body)) {
		return 'rate-limit';
	}
	if (isTransientGitHubStatus(status)) {
		return 'transient-infrastructure';
	}
	return null;
}

/**
 * Perform a GitHub API fetch with bounded retry/backoff for transient failures.
 *
 * @returns {Promise<{ response: Response, bodyText: string|null, attempts: number, attemptLog: object[] }>}
 *   On HTTP success, `bodyText` is null (caller reads response). On exhausted retry,
 *   throws GitHubInfrastructureError. On non-retryable HTTP failure, returns the
 *   failed response with bodyText already consumed so callers can throw policy errors.
 */
export async function githubApiFetch({
	url,
	method = 'GET',
	headers = {},
	body,
	maxRetries = 3,
	initialBackoffMs = 1000,
	maxBackoffMs = 30000,
	sleepFn = sleep,
	fetchFn = fetch,
	pathLabel = '',
} = {}) {
	const attemptLog = [];
	let attempt = 0;
	const path = pathLabel || String(url || '');

	while (true) {
		try {
			const response = await fetchFn(url, {
				method,
				headers,
				...(body !== undefined ? { body } : {}),
			});

			if (response.ok) {
				return {
					response,
					bodyText: null,
					attempts: attempt + 1,
					attemptLog,
				};
			}

			const bodyText = await response.text();
			const classification = classifyRetryableFailure(response.status, bodyText);

			if (classification && attempt < maxRetries) {
				attempt += 1;
				const delayMs = computeBackoffDelayMs(attempt, initialBackoffMs, maxBackoffMs);
				attemptLog.push({
					attempt,
					status: response.status,
					classification,
					delayMs,
				});
				await sleepFn(delayMs);
				continue;
			}

			if (classification) {
				throw new GitHubInfrastructureError({
					method,
					path,
					status: response.status,
					body: bodyText,
					attempts: attempt + 1,
					attemptLog,
					classification,
				});
			}

			return {
				response,
				bodyText,
				attempts: attempt + 1,
				attemptLog,
			};
		} catch (error) {
			if (error instanceof GitHubInfrastructureError) {
				throw error;
			}

			if (isRetryableNetworkError(error) && attempt < maxRetries) {
				attempt += 1;
				const delayMs = computeBackoffDelayMs(attempt, initialBackoffMs, maxBackoffMs);
				attemptLog.push({
					attempt,
					error: error.message || String(error),
					classification: 'transient-infrastructure',
					delayMs,
				});
				await sleepFn(delayMs);
				continue;
			}

			if (isRetryableNetworkError(error)) {
				throw new GitHubInfrastructureError({
					method,
					path,
					status: 0,
					body: error.message || String(error),
					attempts: attempt + 1,
					attemptLog,
					classification: 'transient-infrastructure',
				});
			}

			throw error;
		}
	}
}

export function formatAttemptEvidence(attemptLog = []) {
	if (!attemptLog.length) return 'No retries.';
	return attemptLog
		.map((entry) => {
			const status = entry.status != null ? `status=${entry.status}` : `error=${entry.error || 'unknown'}`;
			return `attempt ${entry.attempt}: ${entry.classification}; ${status}; backoff=${entry.delayMs}ms`;
		})
		.join('\n');
}
