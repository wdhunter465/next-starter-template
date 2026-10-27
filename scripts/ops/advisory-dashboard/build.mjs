import fs from 'node:fs';
import path from 'node:path';

import { collectAdvisories } from './collect.mjs';
import { renderDashboard } from './render.mjs';
import { LOOKBACK_DAYS, buildRows } from './rows.mjs';

const now = new Date();
const outDir = process.env.ADVISORY_DASHBOARD_OUT || 'advisory-dashboard-out';
const fixturePath = process.env.ADVISORY_DASHBOARD_FIXTURE;

let comments = [];
let checks = [];
let issues = [];
let note = '';

if (fixturePath) {
	const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
	comments = fixture.comments || [];
	checks = fixture.checks || [];
	issues = fixture.issues || [];
	note = fixture.note || '';
} else {
	const token = process.env.GITHUB_TOKEN;
	const repository = process.env.GITHUB_REPOSITORY;
	if (!token || !repository) {
		throw new Error('GITHUB_TOKEN and GITHUB_REPOSITORY are required unless ADVISORY_DASHBOARD_FIXTURE is set.');
	}
	const collected = await collectAdvisories({ token, repository, now, lookbackDays: LOOKBACK_DAYS });
	comments = collected.comments;
	checks = collected.checks;
	issues = collected.issues;
	note = collected.note;
}

const rows = buildRows({ comments, checks, issues, now, lookbackDays: LOOKBACK_DAYS });
const html = renderDashboard({
	rows,
	generatedAt: now.toISOString(),
	lookbackDays: LOOKBACK_DAYS,
	note,
});

fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'index.html');
fs.writeFileSync(outFile, html);
console.log(`Wrote ${rows.length} rows to ${outFile}`);
