const PR_CAP = 30;
const ISSUE_CAP = 30;

function isoDate(date) {
	return date.toISOString().slice(0, 10);
}

async function githubJson(url, token) {
	const response = await fetch(url, {
		headers: {
			Accept: 'application/vnd.github+json',
			Authorization: `Bearer ${token}`,
			'X-GitHub-Api-Version': '2022-11-28',
			'User-Agent': 'lgfc-advisory-dashboard',
		},
	});
	if (!response.ok) {
		const body = await response.text();
		throw new Error(`GitHub ${response.status} for ${url}: ${body.slice(0, 180)}`);
	}
	return response.json();
}

async function searchUpdated(repository, token, qualifier, since) {
	const query = encodeURIComponent(`repo:${repository} ${qualifier} updated:>=${since}`);
	const url = `https://api.github.com/search/issues?q=${query}&sort=updated&order=desc&per_page=${PR_CAP}`;
	return githubJson(url, token);
}

export async function collectAdvisories({
	token,
	repository,
	now = new Date(),
	lookbackDays = 30,
}) {
	const since = isoDate(new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000));
	const [pullSearch, issueSearch] = await Promise.all([
		searchUpdated(repository, token, 'is:pr', since),
		searchUpdated(repository, token, 'is:issue', since),
	]);

	const [owner, repo] = repository.split('/');
	const comments = [];
	const checks = [];
	const notes = [];

	if (pullSearch.total_count > PR_CAP) {
		notes.push(`Pull request scan capped at the ${PR_CAP} most recently updated in the window.`);
	}
	if (issueSearch.total_count > ISSUE_CAP) {
		notes.push(`Issue scan capped at the ${ISSUE_CAP} most recently updated in the window.`);
	}

	for (const item of pullSearch.items || []) {
		const commentPage = await githubJson(
			`https://api.github.com/repos/${owner}/${repo}/issues/${item.number}/comments?since=${since}T00:00:00Z&per_page=100`,
			token,
		);
		for (const comment of commentPage) {
			comments.push({
				body: comment.body,
				url: comment.html_url,
				createdAt: comment.created_at,
				prNumber: item.number,
			});
		}

		const pull = await githubJson(
			`https://api.github.com/repos/${owner}/${repo}/pulls/${item.number}`,
			token,
		);
		const sha = pull.head && pull.head.sha;
		if (!sha) continue;
		const runPage = await githubJson(
			`https://api.github.com/repos/${owner}/${repo}/commits/${sha}/check-runs?per_page=100`,
			token,
		);
		for (const run of runPage.check_runs || []) {
			checks.push({
				name: run.name,
				conclusion: run.conclusion,
				completedAt: run.completed_at,
				url: run.html_url,
				prNumber: item.number,
			});
		}
	}

	const issues = [];
	for (const item of issueSearch.items || []) {
		if (item.pull_request) continue;
		const commentPage = await githubJson(
			`https://api.github.com/repos/${owner}/${repo}/issues/${item.number}/comments?since=${since}T00:00:00Z&per_page=100`,
			token,
		);
		issues.push({
			number: item.number,
			title: item.title,
			body: item.body,
			comments: commentPage.map((comment) => ({ body: comment.body })),
		});
	}

	return { comments, checks, issues, note: notes.join(' ') };
}
