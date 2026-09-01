#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const REPOSITORY = 'wdhunter465/next-starter-template';
const TRUSTED_ACTOR = 'wdhunter645';
const TRUSTED_EVENTS = new Set(['issues', 'pull_request_review', 'pull_request', 'workflow_run', 'workflow_dispatch']);
export const STALE_AFTER_MS = 15 * 60 * 1000;

export function classifyDispatchEvent({ repository, event, action = '', labelNames = [], actor = '' } = {}) {
	if (repository !== REPOSITORY) return { deliver: false, reason: 'untrusted-repository-or-actor' };
	const labels = new Set(labelNames);
	if (event === 'issues' && action === 'labeled' && labels.has('agent:codex') && labels.has('handoff:ready')) {
		return { deliver: true, reason: 'trusted-codex-label-routing' };
	}
	if (event === 'workflow_dispatch' && actor === TRUSTED_ACTOR) return { deliver: true, reason: 'trusted-manual-dispatch' };
	if ((event === 'pull_request_review' || event === 'pull_request') && labels.has('agent:codex')) {
		return { deliver: true, reason: 'codex-owned-pr-routing' };
	}
	if (TRUSTED_EVENTS.has(event) && action === 'codex-resume') return { deliver: true, reason: 'trusted-resume-routing' };
	return { deliver: false, reason: 'event-not-authorized-for-codex' };
}

export function validateDispatchIdentifiers({ repository, issue, event, deliveryId, runId } = {}) {
	if (repository !== REPOSITORY) throw new Error('repository must be the canonical repository');
	if (!/^\d+$/.test(String(issue ?? ''))) throw new Error('issue must be numeric');
	if (!/^[A-Za-z0-9._:-]+$/.test(String(deliveryId ?? ''))) throw new Error('deliveryId contains unsafe characters');
	if (!/^\d+$/.test(String(runId ?? ''))) throw new Error('runId must be numeric');
	if (!TRUSTED_EVENTS.has(String(event))) throw new Error('event is not authorized');
	return { repository, issue: Number(issue), event, deliveryId: String(deliveryId), runId: String(runId) };
}

export function buildCodexPrompt({ repository, issue }) {
	return `Wake check-in for repository ${repository}, source Issue #${issue}. Load live repository authority and the assigned Issue before taking any action. This notification grants awareness only; do not infer scope, claim a lane, approve, or merge.`;
}

export function createDeliveryState({ deliveryId, issue, runId }) {
	return { deliveryId, issue: Number(issue), runId: String(runId), status: 'queued', attempt: 0, queuedAt: new Date().toISOString() };
}

export function isStaleDelivery(state, now = Date.now()) {
	const queuedAt = Date.parse(state?.queuedAt || '');
	return Boolean(queuedAt && now - queuedAt >= STALE_AFTER_MS);
}

function parseArgs(argv) {
	const args = {};
	for (let i = 0; i < argv.length; i += 1) {
		if (!argv[i].startsWith('--')) throw new Error('unexpected positional argument');
		const key = argv[i].slice(2).replaceAll('-', '_');
		const value = argv[i + 1];
		if (!value || value.startsWith('--')) throw new Error(`missing value for --${key}`);
		args[key] = value;
		i += 1;
	}
	return args;
}

function atomicWrite(file, value) {
	fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
	const temp = `${file}.${process.pid}.tmp`;
	fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
	fs.renameSync(temp, file);
}

export function runDispatch(rawArgs, { env = process.env, runner = spawnSync } = {}) {
	const normalized = {
		repository: rawArgs.repository || rawArgs.repo,
		issue: rawArgs.issue,
		event: rawArgs.event,
		deliveryId: rawArgs.deliveryId || rawArgs.delivery_id,
		runId: rawArgs.runId || rawArgs.run_id,
	};
	const args = validateDispatchIdentifiers(normalized);
	const workspace = rawArgs.workspace || process.cwd();
	const queueDir = path.join(workspace, '.lgfc-codex-dispatch');
	const queueFile = path.join(queueDir, `${args.deliveryId}.json`);
	if (fs.existsSync(queueFile)) return { status: 'duplicate', deliveryId: args.deliveryId };
	let state = createDeliveryState(args);
	atomicWrite(queueFile, state);
	if (rawArgs.dry_run === 'true' || rawArgs.dryRun === true) {
		state = { ...state, status: 'acknowledged', acknowledgedAt: new Date().toISOString(), dryRun: true };
		atomicWrite(queueFile, state);
		return state;
	}
	const prompt = buildCodexPrompt(args);
	const result = runner('/usr/bin/codex', ['exec', '--cd', workspace, prompt], { env, encoding: 'utf8' });
	if (result.status !== 0) {
		state = {
			...state,
			status: 'retryable-failure',
			attempt: 1,
			error: String(result.stderr || 'codex exec failed').slice(0, 500),
			nextRetry: new Date(Date.now() + 60_000).toISOString(),
		};
		if (isStaleDelivery(state)) state = { ...state, status: 'stale', staleAt: new Date().toISOString() };
		atomicWrite(queueFile, state);
		return state;
	}
	state = { ...state, status: 'acknowledged', acknowledgedAt: new Date().toISOString() };
	atomicWrite(queueFile, state);
	const gh = runner(
		'gh',
		[
			'issue',
			'comment',
			String(args.issue),
			'--repo',
			REPOSITORY,
			'--body',
			`Codex wake acknowledged: ${args.deliveryId} (run ${args.runId}).`,
		],
		{ env, encoding: 'utf8' },
	);
	if (gh.status !== 0) state = { ...state, status: 'acknowledgment-failed' };
	atomicWrite(queueFile, state);
	return state;
}

if (import.meta.url === `file://${process.argv[1]}`) {
	try {
		const args = parseArgs(process.argv.slice(2));
		const result = runDispatch(args);
		console.log(JSON.stringify(result));
	} catch (error) {
		console.error(`Codex dispatch rejected: ${error.message}`);
		process.exitCode = 1;
	}
}
