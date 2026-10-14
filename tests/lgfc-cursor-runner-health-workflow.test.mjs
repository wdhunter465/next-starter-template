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

const healthScript = extractHealthScript(workflow);
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const runHealth = new AsyncFunction('github', 'context', 'core', 'process', healthScript);

const CURRENT_RUN_ID = 500;

function runner(status) {
	return { id: 1, name: 'lgfc-cursor-chromebook', status, busy: false, labels: [{ name: 'lgfc-cursor' }] };
}

function jsonResponse(status, body) {
	return {
		ok: status >= 200 && status < 300,
		status,
		async json() {
			return body;
		},
	};
}

function completedRun(id, conclusion, createdAt = '2026-10-13T17:27:06Z') {
	return {
		id,
		conclusion,
		created_at: createdAt,
		html_url: `https://github.com/wdhunter465/next-starter-template/actions/runs/${id}`,
		status: 'completed',
	};
}

const previousRun = completedRun(499, 'success');
const offlineMarker = { name: 'runner-offline-observation', expired: false };

// Recorded 2026-10-14 from the live Actions API (run 38438752619 and its artifacts).
const recordedOnlinePrevious = {
	total_count: 405,
	workflow_runs: [
		{
			id: 38438752619,
			conclusion: 'success',
			created_at: '2026-10-13T17:27:06Z',
			html_url: 'https://github.com/wdhunter465/next-starter-template/actions/runs/38438752619',
			status: 'completed',
		},
	],
};
const recordedEmptyArtifacts = { total_count: 0, artifacts: [] };

async function observe({
	runners,
	listRunnersError,
	runsPayload,
	artifactsByRun,
	apiStatus,
	reenable,
	issueError,
} = {}) {
	const result = { failed: null, notices: [], outputs: {}, summary: '', calls: [], issues: [] };
	globalThis.fetch = async (url) => {
		const target = String(url);
		result.calls.push(target);
		if (apiStatus && target.includes('/runs?')) return jsonResponse(apiStatus, { message: 'boom' });
		if (target.includes('/artifacts')) {
			const id = target.match(/runs\/(\d+)\/artifacts/)[1];
			return jsonResponse(200, artifactsByRun?.[id] || { total_count: 0, artifacts: [] });
		}
		if (target.includes('/runs?')) {
			return jsonResponse(200, runsPayload || { total_count: 0, workflow_runs: [] });
		}
		return jsonResponse(404, { message: 'not found' });
	};
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
		rest: {
			actions: { listSelfHostedRunnersForRepo() {} },
			issues: {
				async create(payload) {
					if (issueError) throw issueError;
					result.issues.push(payload);
					return { data: { number: 4700 } };
				},
			},
		},
		async paginate() {
			if (listRunnersError) throw listRunnersError;
			return runners;
		},
	};
	const context = { repo: { owner: 'wdhunter465', repo: 'next-starter-template' }, runId: CURRENT_RUN_ID };
	const fakeProcess = {
		env: {
			ACTIONS_READ_TOKEN: 'token',
			OFFLINE_ARTIFACT_NAME: 'runner-offline-observation',
			HALT_ARTIFACT_NAME: 'runner-health-halted',
			REENABLE_ARTIFACT_NAME: 'runner-health-reenabled',
			REENABLE_RUNNER_HEALTH: reenable ? 'true' : 'false',
		},
	};
	await runHealth(github, context, core, fakeProcess);
	return result;
}

describe('LGFC Cursor Runner Health workflow (#4570, #4587)', () => {
	it('does not call getOctokit; github-script@v7 does not define it', () => {
		expect(healthScript).not.toMatch(/getOctokit\s*\(/);
		expect(healthScript).toContain('https://api.github.com');
	});

	it('passes quietly when the runner is online', async () => {
		const result = await observe({ runners: [runner('online')] });
		expect(result.failed).toBeNull();
		expect(result.notices).toEqual([]);
		expect(result.outputs.offline_observed).toBeUndefined();
		expect(result.summary).toContain('**ONLINE**');
		expect(result.issues).toEqual([]);
	});

	it('turns a single offline observation into a notice, not a failure', async () => {
		const result = await observe({
			runners: [runner('offline')],
			runsPayload: { total_count: 1, workflow_runs: [previousRun] },
		});
		expect(result.failed).toBeNull();
		expect(result.notices).toHaveLength(1);
		expect(result.outputs.offline_observed).toBe('true');
		expect(result.summary).toContain('first observation, notice only');
	});

	it('parses a recorded previous-run API response and does not fail a first offline check', async () => {
		const result = await observe({
			runners: [runner('offline')],
			runsPayload: recordedOnlinePrevious,
			artifactsByRun: { 38438752619: recordedEmptyArtifacts },
		});
		expect(result.calls.some((url) => url.includes('/actions/workflows/lgfc-cursor-runner-health.yml/runs?status=completed'))).toBe(true);
		expect(result.calls.some((url) => url.includes('/actions/runs/38438752619/artifacts'))).toBe(true);
		expect(result.failed).toBeNull();
		expect(result.notices).toHaveLength(1);
		expect(result.summary).toContain('run 38438752619');
		expect(result.summary).toContain('offline=false');
		expect(result.summary).not.toContain('second consecutive check');
	});

	it('fails when the previous check was also offline', async () => {
		const result = await observe({
			runners: [runner('offline')],
			runsPayload: { total_count: 1, workflow_runs: [completedRun(499, 'failure', '2026-10-14T11:29:35Z')] },
			artifactsByRun: { 499: { total_count: 1, artifacts: [offlineMarker] } },
		});
		expect(result.failed).toMatch(/two consecutive checks/);
		expect(result.failed).not.toMatch(/Halted after 3/);
		expect(result.outputs.offline_observed).toBe('true');
		expect(result.summary).toContain('second consecutive check');
		expect(result.issues).toEqual([]);
	});

	it('ignores an expired offline marker', async () => {
		const result = await observe({
			runners: [runner('offline')],
			runsPayload: { total_count: 1, workflow_runs: [previousRun] },
			artifactsByRun: { 499: { total_count: 1, artifacts: [{ ...offlineMarker, expired: true }] } },
		});
		expect(result.failed).toBeNull();
		expect(result.notices).toHaveLength(1);
	});

	it('treats the first ever check as a notice', async () => {
		const result = await observe({ runners: [runner('offline')], runsPayload: { total_count: 0, workflow_runs: [] } });
		expect(result.failed).toBeNull();
		expect(result.notices).toHaveLength(1);
	});

	it('reports a lookup error and does not count it as an offline run', async () => {
		const result = await observe({ runners: [runner('offline')], apiStatus: 500 });
		expect(result.failed).toBeNull();
		expect(result.outputs.offline_observed).toBeUndefined();
		expect(result.summary).toContain('lookup failed');
		expect(result.summary).toContain('LOOKUP_FAILED');
		expect(result.summary).not.toContain('second consecutive check');
	});

	it('on the third consecutive failure opens one Issue and arms the halt marker', async () => {
		const prior = [completedRun(499, 'failure', '2026-10-14T11:29:35Z'), completedRun(498, 'failure', '2026-10-13T17:17:00Z')];
		const result = await observe({
			runners: [runner('offline')],
			runsPayload: { total_count: 2, workflow_runs: prior },
			artifactsByRun: {
				499: { total_count: 1, artifacts: [offlineMarker] },
				498: { total_count: 1, artifacts: [offlineMarker] },
			},
		});
		expect(result.failed).toBeNull();
		expect(result.outputs.halt_check).toBe('true');
		expect(result.issues).toHaveLength(1);
		expect(result.issues[0].title).toContain('halted after 3 consecutive failures');
		expect(result.issues[0].body).toContain(`/actions/runs/${CURRENT_RUN_ID}`);
		expect(result.issues[0].body).toContain('/actions/runs/499');
		expect(result.issues[0].labels).toEqual(['team:operations', 'ops-exception']);
		expect(result.summary).toContain('Halt issue: #4700');
	});

	it('fails once when the halt Issue cannot be created, so the watcher can open the one exception', async () => {
		const prior = [completedRun(499, 'failure', '2026-10-14T11:29:35Z'), completedRun(498, 'failure', '2026-10-13T17:17:00Z')];
		const result = await observe({
			runners: [runner('offline')],
			issueError: Object.assign(new Error('forbidden'), { status: 403 }),
			runsPayload: { total_count: 2, workflow_runs: prior },
			artifactsByRun: {
				499: { total_count: 1, artifacts: [offlineMarker] },
				498: { total_count: 1, artifacts: [offlineMarker] },
			},
		});
		expect(result.issues).toEqual([]);
		expect(result.outputs.halt_check).toBe('true');
		expect(result.failed).toMatch(/Halted after 3 consecutive failures/);
		expect(result.summary).toContain('create failed');
	});

	it('does not open a second Issue or fail again while the halt marker is current', async () => {
		const result = await observe({
			runners: [runner('offline')],
			runsPayload: { total_count: 1, workflow_runs: [completedRun(499, 'failure')] },
			artifactsByRun: {
				499: { total_count: 1, artifacts: [{ name: 'runner-health-halted', expired: false }] },
			},
		});
		expect(result.failed).toBeNull();
		expect(result.issues).toEqual([]);
		expect(result.outputs.offline_observed).toBeUndefined();
		expect(result.summary).toContain('**HALTED**');
		expect(result.notices[0]).toMatch(/halted after 3/);
	});

	it('a re-enable run clears the halt and starts the failure count over', async () => {
		const result = await observe({
			runners: [runner('offline')],
			reenable: true,
			runsPayload: { total_count: 1, workflow_runs: [completedRun(499, 'failure')] },
			artifactsByRun: {
				499: {
					total_count: 2,
					artifacts: [offlineMarker, { name: 'runner-health-halted', expired: false }],
				},
			},
		});
		expect(result.outputs.reenabled).toBe('true');
		expect(result.failed).toMatch(/two consecutive checks/);
		expect(result.failed).not.toMatch(/Halted after 3/);
		expect(result.issues).toEqual([]);
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

	it('runs twice a day and records offline, halt, and re-enable markers', () => {
		expect(workflow).toContain('- cron: "17 11 * * *"');
		expect(workflow).toContain('- cron: "17 17 * * *"');
		expect(workflow).toMatch(/if: always\(\) && steps\.health\.outputs\.offline_observed == 'true'\n\s+uses: actions\/upload-artifact@v4/);
		expect(workflow).toContain('name: runner-offline-observation');
		expect(workflow).toContain('name: runner-health-halted');
		expect(workflow).toContain('name: runner-health-reenabled');
		expect(workflow).toContain('REENABLE_CURSOR_RUNNER_HEALTH');
	});

	it('adds no permissions beyond contents and actions read (#4311)', () => {
		const permissions = workflow.match(/^permissions:\n((?: {2}.+\n)+)/m)[1];
		expect(permissions.trim().split('\n').map((line) => line.trim())).toEqual(['contents: read', 'actions: read']);
		expect(workflow).not.toMatch(/administration:/);
		expect(workflow).not.toMatch(/issues:/);
	});
});
