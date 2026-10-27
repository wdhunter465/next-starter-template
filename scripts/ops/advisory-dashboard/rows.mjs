export const LOOKBACK_DAYS = 30;

export const REQUIRED_CHECK_NAMES = new Set([
	'quality',
	'gitleaks',
	'reviewer-response-completion',
]);

export const ADVISORY_MARKERS = [
	['diff-scope', '<!-- diff-scope-advisory -->'],
	['pr-hygiene', '<!-- pr-hygiene-advisory -->'],
	['diataxis-folder', '<!-- diataxis-folder-advisory -->'],
	['diataxis-migration-ratchet', '<!-- diataxis-migration-ratchet-advisory -->'],
];

const DAY_MS = 24 * 60 * 60 * 1000;

export function advisoryTypeFromBody(body) {
	const text = body || '';
	for (const [type, marker] of ADVISORY_MARKERS) {
		if (text.includes(marker)) return type;
	}
	return null;
}

export function firstFinding(body, marker) {
	const text = body || '';
	const start = marker ? text.indexOf(marker) : -1;
	const rest = start >= 0 ? text.slice(start + marker.length) : text;
	const line = rest
		.split('\n')
		.map((item) => item.trim())
		.find((item) => item && !item.startsWith('<!--'));
	return (line || '').replace(/[#*_`]/g, '').slice(0, 180);
}

function issueText(issue) {
	return [issue.title, issue.body, ...(issue.comments || []).map((comment) => comment.body)]
		.filter(Boolean)
		.join('\n');
}

export function matchingIssueNumber(issues, row) {
	const matches = [];
	for (const issue of issues) {
		const text = issueText(issue);
		if (row.url && text.includes(`Responds to advisory: ${row.url}`)) {
			matches.push(issue.number);
			continue;
		}
		const namesParent =
			text.includes(`#${row.parentNumber}`) || text.includes(`/pull/${row.parentNumber}`);
		const namesType =
			text.includes(row.type) || (row.checkName ? text.includes(row.checkName) : false);
		if (namesParent && namesType) matches.push(issue.number);
	}
	if (matches.length === 0) return null;
	return Math.min(...matches);
}

export function buildRows({
	comments = [],
	checks = [],
	issues = [],
	now = new Date(),
	lookbackDays = LOOKBACK_DAYS,
}) {
	const cutoff = now.getTime() - lookbackDays * DAY_MS;
	const rows = [];

	for (const comment of comments) {
		const type = advisoryTypeFromBody(comment.body);
		if (!type) continue;
		const time = comment.createdAt;
		if (!time || Date.parse(time) < cutoff) continue;
		const marker = ADVISORY_MARKERS.find(([name]) => name === type)[1];
		rows.push({
			time,
			type,
			parentKind: comment.prNumber ? 'PR' : 'Issue',
			parentNumber: comment.prNumber || comment.issueNumber,
			summary: firstFinding(comment.body, marker),
			url: comment.url,
		});
	}

	for (const check of checks) {
		if (check.conclusion !== 'failure') continue;
		if (check.required === true || REQUIRED_CHECK_NAMES.has(check.name)) continue;
		const time = check.completedAt;
		if (!time || Date.parse(time) < cutoff) continue;
		rows.push({
			time,
			type: 'failed-check',
			checkName: check.name,
			parentKind: 'PR',
			parentNumber: check.prNumber,
			summary: check.name,
			url: check.url,
		});
	}

	rows.sort(
		(a, b) => Date.parse(b.time) - Date.parse(a.time) || String(a.url).localeCompare(String(b.url)),
	);

	return rows.map((row) => ({
		...row,
		responseIssue: matchingIssueNumber(issues, row),
	}));
}
