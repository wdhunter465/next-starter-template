import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const PROCESS_TEST = /^(reviewer-|post-merge-).*\.test\.mjs$/;
const known = JSON.parse(fs.readFileSync('scripts/ci/process-tests-known-failing.json', 'utf8')).files;
const processFiles = fs.readdirSync('tests').filter((name) => PROCESS_TEST.test(name));

describe('reviewer and post-merge process tests run in CI (#4466)', () => {
	it('every known-failing entry names an existing file, a tracking issue and a reason', () => {
		for (const entry of known) {
			expect(fs.existsSync(entry.file), `${entry.file} no longer exists; remove its entry`).toBe(true);
			expect(PROCESS_TEST.test(path.basename(entry.file)), `${entry.file} is not a process test`).toBe(true);
			expect(Number.isInteger(entry.issue) && entry.issue > 0, `${entry.file} needs a tracking issue`).toBe(true);
			expect(String(entry.reason).trim().length, `${entry.file} needs a reason`).toBeGreaterThan(20);
		}
	});

	it('only the listed files are left out of the process run', () => {
		const left = new Set(known.map((entry) => path.basename(entry.file)));
		const run = processFiles.filter((name) => !left.has(name));
		expect(run.length).toBeGreaterThan(0);
		expect(run.length + left.size).toBe(processFiles.length);
	});

	it('the default config still excludes these globs and the process config includes them', () => {
		const main = fs.readFileSync('vitest.config.ts', 'utf8');
		const processConfig = fs.readFileSync('scripts/ci/vitest.process.config.ts', 'utf8');
		for (const glob of ['tests/reviewer-*.test.mjs', 'tests/post-merge-*.test.mjs']) {
			expect(main).toContain(glob);
			expect(processConfig).toContain(glob);
		}
	});

	it('the quality gate runs the process config', () => {
		const gate = fs.readFileSync('.github/workflows/gate-quality.yml', 'utf8');
		expect(gate).toContain('npx vitest run --config scripts/ci/vitest.process.config.ts');
	});
});
