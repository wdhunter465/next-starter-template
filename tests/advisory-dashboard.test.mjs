import { describe, expect, it } from 'vitest';

import { renderDashboard } from '../scripts/ops/advisory-dashboard/render.mjs';
import { buildRows } from '../scripts/ops/advisory-dashboard/rows.mjs';

const now = new Date('2026-10-27T18:00:00Z');

const commentUrl = 'https://github.com/wdhunter465/next-starter-template/pull/4975#issuecomment-1';

function input(extra = {}) {
	return {
		now,
		comments: [
			{
				body: '<!-- diff-scope-advisory -->\nAllowlist mismatch on the workflow file.',
				url: commentUrl,
				createdAt: '2026-10-26T12:00:00Z',
				prNumber: 4975,
			},
			{
				body: '<!-- pr-hygiene-advisory -->\nUnchecked acceptance criterion.',
				url: 'https://github.com/wdhunter465/next-starter-template/pull/4974#issuecomment-2',
				createdAt: '2026-10-27T15:00:00Z',
				prNumber: 4974,
			},
			{
				body: 'A plain comment with no advisory marker.',
				url: 'https://github.com/wdhunter465/next-starter-template/pull/1#issuecomment-3',
				createdAt: '2026-10-27T16:00:00Z',
				prNumber: 1,
			},
			{
				body: '<!-- diataxis-folder-advisory -->\nFolder heading is missing.',
				url: 'https://github.com/wdhunter465/next-starter-template/pull/2#issuecomment-4',
				createdAt: '2026-09-01T00:00:00Z',
				prNumber: 2,
			},
		],
		checks: [
			{
				name: 'quality',
				conclusion: 'failure',
				completedAt: '2026-10-27T17:00:00Z',
				url: 'https://github.com/wdhunter465/next-starter-template/runs/quality',
				prNumber: 4975,
			},
			{
				name: 'Cloudflare Pages',
				conclusion: 'failure',
				completedAt: '2026-10-27T16:30:00Z',
				url: 'https://github.com/wdhunter465/next-starter-template/runs/pages',
				prNumber: 4975,
			},
			{
				name: 'docs_guardrails',
				conclusion: 'success',
				completedAt: '2026-10-27T16:00:00Z',
				url: 'https://github.com/wdhunter465/next-starter-template/runs/docs',
				prNumber: 4975,
			},
		],
		issues: [
			{
				number: 4500,
				title: 'Follow-up',
				body: 'Responds to advisory: https://github.com/wdhunter465/next-starter-template/pull/4975#issuecomment-1',
				comments: [],
			},
			{
				number: 4501,
				title: 'Names the pull request only',
				body: 'See #4974 for the hygiene note.',
				comments: [],
			},
			{
				number: 4502,
				title: 'Names the check',
				body: 'PR #4975 failed-check Cloudflare Pages needs a look.',
				comments: [],
			},
		],
		...extra,
	};
}

describe('advisory dashboard rows', () => {
	it('orders newest first and keeps only marker comments inside the window', () => {
		const rows = buildRows(input());
		const types = rows.map((row) => row.type);
		expect(types).toEqual(['failed-check', 'pr-hygiene', 'diff-scope']);
		expect(rows[0].time > rows[1].time).toBe(true);
		expect(rows.some((row) => row.summary.includes('Folder heading'))).toBe(false);
		expect(rows.some((row) => row.parentNumber === 1)).toBe(false);
	});

	it('fills the response issue for the comment URL and leaves a non-matching issue blank', () => {
		const rows = buildRows(input());
		const hygiene = rows.find((row) => row.type === 'pr-hygiene');
		const scope = rows.find((row) => row.type === 'diff-scope');
		expect(hygiene.responseIssue).toBeNull();
		expect(scope.responseIssue).toBe(4500);
	});

	it('matches a failed non-required check by pull request number and advisory type', () => {
		const rows = buildRows(input());
		const failed = rows.find((row) => row.type === 'failed-check');
		expect(failed.summary).toBe('Cloudflare Pages');
		expect(failed.responseIssue).toBe(4502);
		expect(rows.some((row) => row.summary === 'quality')).toBe(false);
	});

	it('renders the issue column blank when nothing matches and escapes summary text', () => {
		const rows = buildRows({
			now,
			comments: [
				{
					body: '<!-- pr-hygiene-advisory -->\n<script>alert(1)</script>',
					url: 'https://example.test/comment',
					createdAt: '2026-10-27T12:00:00Z',
					prNumber: 9,
				},
			],
			checks: [],
			issues: [],
		});
		const html = renderDashboard({
			rows,
			generatedAt: now.toISOString(),
			lookbackDays: 30,
			note: '',
		});
		expect(html).toContain('<td></td>');
		expect(html).toContain('&lt;script&gt;');
		expect(html).not.toContain('<script>');
		expect(html).toContain('For Engineering, Operations, PMO Admin, and Governance.');
	});
});
