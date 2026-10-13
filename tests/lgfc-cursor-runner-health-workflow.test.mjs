import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

const WORKFLOW_PATH = '.github/workflows/lgfc-cursor-runner-health.yml';
const workflow = fs.readFileSync(WORKFLOW_PATH, 'utf8');

function extractHealthScript(text) {
	const lines = text.split('\n');
	const idLine = lines.findIndex((line) => line.trim() === 'id: health');
	const scriptLine = lines.findIndex((line, index) => index > idLine && line.trim() === 'script: |');
	const indent = lines[scriptLine].indexOf('script') + 2;
	const body = [];
	for (const line of lines.slice(scriptLine + 1)) {
		if (line.trim() !== '' && line.search(/\S/) < indent) break;
		body.push(line.slice(indent));
	}
	return body.join('\n');
}

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const runHealth = new AsyncFunction('github', 'context', 'core', 'getOctokit', 'process', extractHealthScript(workflow));

const CURRENT_RUN_ID = 500;

function runner(status) {
	return { id: 1, name: 'lgfc-cursor-chromebook', status, busy: false, labels: [{ name: 'lgfc-cursor' }] };
}

async function observe({ runners, listRunnersError, previousRuns, artifacts, lookupError } = {}) {
	const result = { failed: null, notices: [], outputs: {}, summary: '' };
	const core = {
		info() {},
		warning() {},
		notice(message) {
			result.notices.push(message);
		},
		setFailed(message) {
			result.failed = message;
		},
		setOutput(name, value) {
			result.outputs[name] = value;
		},
		summary: {
			addRaw(text) {
				result.summary += text;
				return { write: async () => {} };
			},
		},
	};
	const github = {
		rest: { actions: { listSelfHostedRunnersForRepo() {} } },
		async paginate() {
			if (listRunnersError) throw listRunnersError;
			return runners;
		},
	};
	const actionsClient = {
		rest: {
			actions: {
				async listWorkflowRuns() {
					if (lookupError) throw lookupError;
					return { data: { workflow_runs: previousRuns ?? [] } };
				},
				async listWorkflowRunArtifacts() {
					return { data: { artifacts: artifacts ?? [] } };
				},
			},
		},
	};
	const context = { repo: { owner: 'wdhunter465', repo: 'next-starter-template' }, runId: CURRENT_RUN_ID };
	const fakeProcess = {
		env: { ACTIONS_READ_TOKEN: 'token', OFFLINE_ARTIFACT_NAME: 'runner-offline-observation' },
	};
	await runHealth(github, context, core, () => actionsClient, fakeProcess);
	return result;
}

const previousRun = { id: 499, created_at: '2026-10-13T11:17:00Z' };
const offlineMarker = { name: 'runner-offline-observation', expired: false };

describe('LGFC Cursor Runner Health workflow (#4570)', () => {
	it('passes quietly when the runner is online', async () => {
		const result = await observe({ runners: [runner('online')] });
		expect(result.failed).toBeNull();
		expect(result.notices).toEqual([]);
		expect(result.outputs.offline_observed).toBeUndefined();
		expect(result.summary).toContain('**ONLINE**');
	});

	it('turns a single offline observation into a notice, not a failure', async () => {
		const result = await observe({ runners: [runner('offline')], previousRuns: [previousRun], artifacts: [] });
		expect(result.failed).toBeNull();
		expect(result.notices).toHaveLength(1);
		expect(result.outputs.offline_observed).toBe('true');
		expect(result.summary).toContain('first observation, notice only');
	});

	it('fails when the previous check was also offline', async () => {
		const result = await observe({
			runners: [runner('offline')],
			previousRuns: [{ id: CURRENT_RUN_ID }, previousRun],
			artifacts: [offlineMarker],
		});
		expect(result.failed).toMatch(/two consecutive checks/);
		expect(result.outputs.offline_observed).toBe('true');
		expect(result.summary).toContain('second consecutive check');
	});

	it('ignores an expired offline marker', async () => {
		const result = await observe({
			runners: [runner('offline')],
			previousRuns: [previousRun],
			artifacts: [{ ...offlineMarker, expired: true }],
		});
		expect(result.failed).toBeNull();
		expect(result.notices).toHaveLength(1);
	});

	it('treats the first ever check as a notice', async () => {
		const result = await observe({ runners: [runner('offline')], previousRuns: [] });
		expect(result.failed).toBeNull();
		expect(result.notices).toHaveLength(1);
	});

	it('fails closed when the previous run cannot be looked up', async () => {
		const result = await observe({
			runners: [runner('offline')],
			lookupError: Object.assign(new Error('boom'), { status: 500 }),
		});
		expect(result.failed).toMatch(/two consecutive checks/);
		expect(result.summary).toContain('lookup failed');
	});

	it('still fails immediately when no runner is registered', async () => {
		const result = await observe({ runners: [] });
		expect(result.failed).toMatch(/not registered/);
		expect(result.outputs.offline_observed).toBeUndefined();
	});

	it('still fails immediately on AUTH_DENIED', async () => {
		const result = await observe({ listRunnersError: Object.assign(new Error('denied'), { status: 403 }) });
		expect(result.failed).toMatch(/AUTH_DENIED/);
	});

	it('runs twice a day and records the offline marker even when the step fails', () => {
		expect(workflow).toContain('- cron: "17 11 * * *"');
		expect(workflow).toContain('- cron: "17 17 * * *"');
		expect(workflow).toMatch(/if: always\(\) && steps\.health\.outputs\.offline_observed == 'true'\n\s+uses: actions\/upload-artifact@v4/);
		expect(workflow).toContain('name: runner-offline-observation');
	});

	it('adds no permissions beyond contents and actions read (#4311)', () => {
		const permissions = workflow.match(/^permissions:\n((?: {2}.+\n)+)/m)[1];
		expect(permissions.trim().split('\n').map((line) => line.trim())).toEqual(['contents: read', 'actions: read']);
		expect(workflow).not.toMatch(/administration:/);
	});
});
