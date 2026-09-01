import { classifyDispatchEvent, validateDispatchIdentifiers } from './dispatch.mjs';

const accepted = classifyDispatchEvent({
	repository: 'wdhunter465/next-starter-template',
	event: 'issues',
	action: 'labeled',
	labelNames: ['agent:codex', 'handoff:ready'],
	actor: 'wdhunter465',
});
if (!accepted.deliver) throw new Error(`trusted event rejected: ${accepted.reason}`);

const hostile = classifyDispatchEvent({
	repository: 'attacker/repo',
	event: 'issues',
	action: 'labeled',
	labelNames: ['agent:codex', 'handoff:ready'],
	actor: 'attacker',
});
if (hostile.deliver) throw new Error('untrusted event accepted');

let rejected = false;
try {
	validateDispatchIdentifiers({
		repository: 'wdhunter465/next-starter-template',
		issue: '1;echo pwned',
		event: 'issues',
		deliveryId: 'x',
		runId: '1',
	});
} catch {
	rejected = true;
}
if (!rejected) throw new Error('hostile identifier accepted');
console.log('Codex dispatch security tests passed.');
