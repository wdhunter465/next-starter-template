/**
 * Shared parsers for accepted repository source-issue accounting formats.
 */

export function repositoryParts(repository = '') {
	const repoStr = repository === null ? '' : repository || process.env.GITHUB_REPOSITORY || '';
	const [owner = '', repo = ''] = String(repoStr).split('/');
	return { owner, repo };
}

export function normalizeIssueReferenceLine(line = '') {
	return String(line || '')
		.trim()
		.replace(/^[>\s]*[-*+]\s+/, '')
		.replace(/[`*_]+/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

export function issueRefTokens(value = '') {
	const tokenPattern = /#\d+|https:\/\/github\.com\/[^\s)]+\/[^\s)]+\/issues\/\d+\/?/gi;
	return String(value || '').match(tokenPattern) || [];
}

export function issueReferenceFromToken(token = '', { repository = '' } = {}) {
	const value = String(token || '').trim().replace(/[).,;]+$/g, '');
	const local = value.match(/^#(\d+)$/);
	if (local) {
		return { issueNumber: local[1], ref: value, sameRepository: true, external: false };
	}

	try {
		const { owner, repo } = repositoryParts(repository);
		const url = new URL(value);
		const parts = url.pathname.split('/').filter(Boolean);
		const issueNumber = parts.length === 4 && parts[2] === 'issues' && /^\d+$/.test(parts[3])
			? parts[3]
			: '';
		const sameRepository = Boolean(
			issueNumber &&
			url.hostname.toLowerCase() === 'github.com' &&
			(!owner || !repo || (parts[0].toLowerCase() === owner.toLowerCase() && parts[1].toLowerCase() === repo.toLowerCase())),
		);
		return { issueNumber, ref: value, sameRepository, external: Boolean(issueNumber && !sameRepository) };
	} catch {
		return { issueNumber: '', ref: value, sameRepository: false, external: false };
	}
}

function uniqueIssueNumbersFromRefs(refs = []) {
	return [...new Set((refs || []).map((ref) => String(ref.issueNumber || '')).filter(Boolean))];
}

export function exactIssueTokens(value = '', { repository = '', source = 'metadata' } = {}) {
	const refs = [];
	const invalidRefs = [];
	for (const token of issueRefTokens(value)) {
		const parsed = issueReferenceFromToken(token, { repository });
		if (parsed.issueNumber && parsed.sameRepository) {
			refs.push({ issueNumber: parsed.issueNumber, ref: parsed.ref, source });
		} else {
			invalidRefs.push({
				ref: parsed.ref,
				source,
				reason: parsed.external ? 'external_repository_issue' : 'invalid_issue_reference',
			});
		}
	}
	return { refs, invalidRefs, issueNumbers: uniqueIssueNumbersFromRefs(refs) };
}

export function branchIssueTokens(value = '', { source = 'branch' } = {}) {
	const refs = [];
	const branch = String(value || '');
	const seen = new Set();

	const record = (issueNumber, ref) => {
		if (!issueNumber || seen.has(issueNumber)) return;
		seen.add(issueNumber);
		refs.push({ issueNumber, ref, source });
	};

	const isSemverDigitFragment = (digitIndex, digitLength) => {
		const before = branch[digitIndex - 1];
		const after = branch[digitIndex + digitLength];
		return before === '.' || after === '.';
	};

	// Explicit hash token: feature/#2334-closeout
	for (const match of branch.matchAll(/#(\d+)(?=$|[-/])/g)) {
		const issueNumber = match[1];
		const digitIndex = match.index + match[0].indexOf(issueNumber);
		if (!isSemverDigitFragment(digitIndex, issueNumber.length)) {
			record(issueNumber, match[0].trim());
		}
	}

	// Path-segment issue token: codex/2323-post-merge-closeout-hardening
	for (const match of branch.matchAll(/(?:^|\/)(\d+)(?=$|[-/])/g)) {
		const issueNumber = match[1];
		const digitIndex = match.index + match[0].length - issueNumber.length;
		if (!isSemverDigitFragment(digitIndex, issueNumber.length)) {
			record(issueNumber, match[0].trim() || issueNumber);
		}
	}

	return { refs, invalidRefs: [], issueNumbers: uniqueIssueNumbersFromRefs(refs) };
}

function resolverFailure(code, message, candidates = []) {
	return { code, message, candidates };
}

function titleStageFailures(titleTokens = {}) {
	if (!titleTokens.invalidRefs?.length) return [];
	return [{
		code: 'invalid_source_issue_reference',
		message: `Merged PR title contains invalid or external source issue reference(s): ${titleTokens.invalidRefs.map((ref) => ref.ref).join(', ')}`,
	}];
}

export function resolveSourceIssueFromPr(pr = {}, { repository = '' } = {}) {
	const bodyAccounting = sourceIssueAccounting(pr?.body || '', { repository });
	const titleTokens = exactIssueTokens(pr?.title || '', { repository, source: 'title' });
	const branchTokens = branchIssueTokens(pr?.headRefName || pr?.head?.ref || '', { source: 'branch' });
	const marker = String(pr?.body || '').match(/<!--\s*orchestrator-source-issue:\s*(\d+)\s*-->/i);
	const titleFailures = titleStageFailures(titleTokens);
	const stages = [
		{ source: 'primary-body-line', issueNumbers: bodyAccounting.issueNumbers, candidates: bodyAccounting.sourceIssueCandidates, failures: bodyAccounting.failures },
		{ source: 'title', issueNumbers: titleTokens.issueNumbers, candidates: titleTokens.refs.map((ref) => `#${ref.issueNumber}`), failures: titleFailures },
		{ source: 'branch', issueNumbers: branchTokens.issueNumbers, candidates: branchTokens.refs.map((ref) => `#${ref.issueNumber}`), failures: [] },
		{ source: 'hidden-marker', issueNumbers: marker ? [marker[1]] : [], candidates: marker ? [`#${marker[1]}`] : [], failures: [] },
	];

	const precedence = [
		{ source: 'primary-body-line', issueNumbers: bodyAccounting.issueNumber ? [bodyAccounting.issueNumber] : [] },
		{ source: 'title', issueNumbers: titleTokens.issueNumbers },
		{ source: 'branch', issueNumbers: branchTokens.issueNumbers },
		{ source: 'hidden-marker', issueNumbers: marker ? [marker[1]] : [] },
	];
	const allNumbers = uniqueIssueNumbersFromRefs([
		...bodyAccounting.refs,
		...titleTokens.refs,
		...branchTokens.refs,
		...(marker ? [{ issueNumber: marker[1] }] : []),
	]);
	const candidates = allNumbers.map((number) => `#${number}`);
	const failures = [];

	// Post-merge closeout replay bodies carry a single authoritative source issue.
	// Title/branch tokens may reference related remediation context and must not
	// override the canonical primary body line or hidden orchestrator marker.
	if (marker?.[1]) {
		return {
			issueNumber: marker[1],
			source: 'hidden-marker',
			candidates: [`#${marker[1]}`],
			failures: [],
			stages,
		};
	}

	const bodyAuthoritative = bodyAccounting.issueNumber
		&& !bodyAccounting.failures.some((failure) => failure.code !== 'duplicate_source_issue_metadata');
	if (bodyAuthoritative) {
		return {
			issueNumber: bodyAccounting.issueNumber,
			source: 'primary-body-line',
			candidates: [`#${bodyAccounting.issueNumber}`],
			failures: [],
			stages,
		};
	}

	if (bodyAccounting.failures.some((failure) => failure.code !== 'missing_source_issue')) failures.push(...bodyAccounting.failures);
	if (titleFailures.length) failures.push(...titleFailures);
	if (titleTokens.issueNumbers.length > 1 || branchTokens.issueNumbers.length > 1) {
		failures.push(resolverFailure('multiple_source_issues', 'Post-merge source issue resolver found multiple issue tokens in a single metadata field.', candidates));
	}
	if (allNumbers.length > 1) {
		failures.push(resolverFailure('ambiguous_source_issue_candidates', `Post-merge source issue resolver found conflicting candidates: ${candidates.join(', ')}.`, candidates));
	}
	if (failures.length) return { issueNumber: '', source: '', candidates, failures, stages };

	const resolved = precedence.find((stage) => stage.issueNumbers.length === 1);
	if (resolved) {
		return { issueNumber: resolved.issueNumbers[0], source: resolved.source, candidates: [`#${resolved.issueNumbers[0]}`], failures: [], stages };
	}

	return {
		issueNumber: '',
		source: '',
		candidates: [],
		failures: [resolverFailure('missing_source_issue', 'Post-merge source issue resolver could not identify exactly one same-repository source issue from PR body, title, branch, or supported hidden marker.', [])],
		stages,
	};
}

export function sourceIssueAccounting(body = '', { repository = '' } = {}) {
	const refs = [];
	const invalidRefs = [];
	const sourceIssueLines = [];

	for (const line of String(body || '').split(/\r?\n/)) {
		if (/OPS\s+Tracker/i.test(line) || /Umbrella\s+Tracker/i.test(line)) continue;

		const normalizedLine = normalizeIssueReferenceLine(line);
		const semantic = normalizedLine.match(/^issue\b(?:\s*:)?\s*(.*)$/i);
		if (!semantic) continue;

		sourceIssueLines.push(line);
		const tokens = issueRefTokens(semantic[1]);
		if (!tokens.length) {
			invalidRefs.push({
				ref: semantic[1] || normalizedLine,
				source: 'primary-body-line',
				reason: 'missing_issue_reference',
			});
			continue;
		}

		for (const token of tokens) {
			const parsed = issueReferenceFromToken(token, { repository });
			if (parsed.issueNumber && parsed.sameRepository) {
				refs.push({ issueNumber: parsed.issueNumber, ref: parsed.ref, source: 'primary-body-line' });
			} else {
				invalidRefs.push({
					ref: parsed.ref,
					source: 'primary-body-line',
					reason: parsed.external ? 'external_repository_issue' : 'invalid_issue_reference',
				});
			}
		}
	}

	const issueNumbers = [...new Set(refs.map((ref) => ref.issueNumber))];
	const sourceIssueCandidates = [
		...issueNumbers.map((issueNumber) => `#${issueNumber}`),
		...invalidRefs.map((ref) => ref.ref),
	];
	const failures = [];

	if (!refs.length && !invalidRefs.length) {
		failures.push({
			code: 'missing_source_issue',
			message: 'Merged PR body does not contain a primary source issue line.',
		});
	}
	if (invalidRefs.length) {
		failures.push({
			code: 'invalid_source_issue_reference',
			message: `Merged PR body contains invalid or external source issue reference(s): ${invalidRefs.map((ref) => ref.ref).join(', ')}`,
		});
	}
	if (issueNumbers.length > 1) {
		failures.push({
			code: 'multiple_source_issues',
			message: 'Merged PR body contains multiple distinct same-repository source issues; closeout requires one source issue identity.',
		});
	}
	if (issueNumbers.length === 1 && (sourceIssueLines.length > 1 || refs.length > 1)) {
		failures.push({
			code: 'duplicate_source_issue_metadata',
			message: `Merged PR body repeats source issue #${issueNumbers[0]} in canonical source metadata; keep exactly one canonical source issue reference.`,
		});
	}

	return {
		refs,
		invalidRefs,
		sourceIssueLines,
		issueNumbers,
		sourceIssueCandidates,
		failures,
		issueNumber: issueNumbers.length === 1 && invalidRefs.length === 0 ? issueNumbers[0] : '',
	};
}

export function linkedIssueNumber(body = '') {
	const sourceMarker = body.match(/<!--\s*orchestrator-source-issue:\s*(\d+)\s*-->/i);
	if (sourceMarker) return sourceMarker[1];

	return sourceIssueAccounting(body, { repository: null }).issueNumber;
}
