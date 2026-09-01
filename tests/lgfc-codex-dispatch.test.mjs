import { describe, expect, it } from 'vitest';
import {
	buildCodexPrompt,
	classifyDispatchEvent,
	createDeliveryState,
	isStaleDelivery,
	validateDispatchIdentifiers,
} from '../scripts/lgfc-codex-dispatch/dispatch.mjs';

describe('Codex dispatch security contract', () => {
	it('accepts only trusted repository identifiers and events', () => {
		expect(
			classifyDispatchEvent({
				repository: 'wdhunter465/next-starter-template',
				event: 'issues',
				action: 'labeled',
				labelNames: ['agent:codex', 'handoff:ready'],
				actor: 'wdhunter465',
			}),
		).toEqual({ deliver: true, reason: 'trusted-codex-label-routing' });

		expect(
			classifyDispatchEvent({
				repository: 'evil/fork',
				event: 'issues',
				action: 'labeled',
				labelNames: ['agent:codex', 'handoff:ready'],
				actor: 'wdhunter645',
			}).deliver,
		).toBe(false);
	});

	it('fails closed for public payload text and malformed identifiers', () => {
		expect(() =>
			validateDispatchIdentifiers({
				repository: 'wdhunter465/next-starter-template',
				issue: '3808;rm -rf /',
				event: 'issues',
				deliveryId: 'wake-1',
				runId: '1',
			}),
		).toThrow(/issue/i);
		expect(buildCodexPrompt({ repository: 'wdhunter465/next-starter-template', issue: 3808 })).not.toMatch(/PUBLIC|comment|payload/i);
	});

	it('creates retryable durable state and deduplicates delivery ids', () => {
		expect(createDeliveryState({ deliveryId: 'wake-1', issue: 3808, runId: 9 })).toMatchObject({
			deliveryId: 'wake-1',
			status: 'queued',
			attempt: 0,
			issue: 3808,
		});
	});

	it('routes Codex-owned review, merge, CI, and explicit resume signals', () => {
		for (const event of ['pull_request_review', 'pull_request', 'workflow_run']) {
			expect(
				classifyDispatchEvent({
					repository: 'wdhunter465/next-starter-template',
					event,
					action: event === 'workflow_run' ? 'codex-resume' : event === 'pull_request' ? 'closed' : 'codex-resume',
					labelNames: ['agent:codex'],
					actor: 'github-actions',
				}).deliver,
			).toBe(true);
		}
	});

	it('accepts pull-request identifiers for merged Codex-owned PR notifications', () => {
		expect(() =>
			validateDispatchIdentifiers({
				repository: 'wdhunter465/next-starter-template',
				issue: 3844,
				event: 'pull_request',
				deliveryId: 'wake-2',
				runId: 2,
			}),
		).not.toThrow();
	});

	it('marks queued deliveries stale after the retry observation window', () => {
		expect(isStaleDelivery({ queuedAt: new Date(Date.now() - 16 * 60 * 1000).toISOString() })).toBe(true);
	});
});
