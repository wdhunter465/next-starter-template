import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const qualityWorkflow = fs.readFileSync('.github/workflows/gate-quality.yml', 'utf8');

describe('issue #3796 deterministic lint and formatting contract', () => {
	it('uses direct ESLint and exposes a non-mutating formatting check', () => {
		expect(packageJson.scripts.lint).toBe('eslint src');
		expect(packageJson.scripts['format:check']).toBe('prettier --check tests/issue-3796-lint-format.test.mjs');
	});

	it('runs the formatting check in the existing quality workflow', () => {
		expect(qualityWorkflow).toContain('run: npm run format:check');
	});
});
