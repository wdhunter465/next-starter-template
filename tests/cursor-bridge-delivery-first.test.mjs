import { describe, expect, it } from 'vitest';
import {
  validateEligibility,
  resolveDeliveryKey,
  sanitizeDeliveryKey,
} from '../scripts/cursor-bridge/lib/eligibility.mjs';
import {
  shouldDeliverCursorWake,
  isNonCursorDirectedTraffic,
  hasCursorRoutingSignal,
  hasReadyCursorHandoff,
  conflictingAgentRoutingReason,
  hasConflictingAgentRoutingLabels,
} from '../scripts/cursor-bridge/lib/wake-ingress.mjs';
import { buildPrompt } from '../scripts/cursor-bridge/lib/launch.mjs';
import { shouldQueueRecovery, buildRecoveryPacket } from '../scripts/cursor-bridge/lib/reconcile.mjs';
import { consumedPath } from '../scripts/cursor-bridge/lib/claim.mjs';
import path from 'node:path';

const baseIssue = {
  number: 2997,
  state: 'OPEN',
  title: 'DEFECT: delivery-first Bridge',
  body: 'Trusted notifications must reach Cursor.',
  labels: [{ name: 'agent:cursor' }, { name: 'handoff:ready' }],
  url: 'https://github.com/wdhunter645/next-starter-template/issues/2997',
  repository: { nameWithOwner: 'wdhunter645/next-starter-template' },
};

describe('cursor bridge label- and status-driven eligibility', () => {
  it('is eligible on agent:cursor + handoff:ready alone, no comments involved', () => {
    const r = validateEligibility(baseIssue, [], {
      expectedRepo: 'wdhunter645/next-starter-template',
    });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('is eligible identically whether comments are omitted or present (unused)', () => {
    const withComments = validateEligibility(baseIssue, [
      { id: 1, body: 'unrelated chatter', createdAt: '2026-08-01T00:00:00Z' },
    ]);
    const withoutComments = validateEligibility(baseIssue, []);
    expect(withComments.ok).toBe(withoutComments.ok);
    expect(withComments.errors).toEqual(withoutComments.errors);
  });

  it('accepts lowercase open state and fails closed on null issue without throwing', () => {
    const lowercase = validateEligibility({ ...baseIssue, state: 'open' }, []);
    expect(lowercase.ok).toBe(true);

    expect(() => validateEligibility(null, [])).not.toThrow();
    const missing = validateEligibility(null, []);
    expect(missing.ok).toBe(false);
    expect(missing.errors).toContain('missing_issue');
  });

  it('still blocks untrusted repository identity and closed issues before launch', () => {
    const closed = validateEligibility({ ...baseIssue, state: 'CLOSED' }, []);
    expect(closed.ok).toBe(false);
    expect(closed.errors).toContain('source_issue_not_open');

    const wrongRepo = validateEligibility(
      { ...baseIssue, repository: { nameWithOwner: 'evil/other' } },
      [],
      { expectedRepo: 'wdhunter645/next-starter-template' },
    );
    expect(wrongRepo.ok).toBe(false);
    expect(wrongRepo.errors).toContain('repository_mismatch');

    const missingLabel = validateEligibility({ ...baseIssue, labels: [{ name: 'handoff:ready' }] }, []);
    expect(missingLabel.ok).toBe(false);
    expect(missingLabel.errors).toContain('missing_label:agent:cursor');
  });

  it('blocks relaunch when the Issue already carries a handed-off status label', () => {
    for (const status of ['status:review', 'status:complete', 'status:post-merge-verify']) {
      const r = validateEligibility(
        { ...baseIssue, labels: [...baseIssue.labels, { name: status }] },
        [],
      );
      expect(r.ok).toBe(false);
      expect(r.errors).toContain(`already_handed_off:${status}`);
    }

    // A live in-progress status must not block a fresh handoff.
    const inProgress = validateEligibility(
      { ...baseIssue, labels: [...baseIssue.labels, { name: 'status:implementation' }] },
      [],
    );
    expect(inProgress.ok).toBe(true);
  });

  it('builds a prompt with live Issue/comment context and disposition instructions, no marker fields', () => {
    const prompt = buildPrompt({
      issueNumber: 2997,
      issue: baseIssue,
      comments: [{ id: 1, author: 'wdhunter645', body: 'context', createdAt: '2026-08-01T00:00:00Z' }],
      semanticFindings: [],
      workspace: '/tmp/ws',
    });
    expect(prompt).toContain('label- and status-driven');
    expect(prompt).toContain('Trusted notifications must reach Cursor.');
    expect(prompt).toContain('assigned this Issue by its labels alone');
    expect(prompt).toContain('Required disposition after evaluating live Issue + comments + governance:');
    expect(prompt).toContain('- hold: post a Cursor-authored hold explaining the blocker and set the matching canonical Issue status;');
    expect(prompt).not.toContain('LOCAL CURSOR RESUME URL');
    expect(prompt).not.toContain('CHATGPT RESPONSE URL');
  });

  it('reconciliation follows the label/state-only mechanical contract', () => {
    expect(
      shouldQueueRecovery({
        eligibilityOk: true,
        deliveryKey: 'issue-2997',
        consumed: false,
        hasPendingPacket: false,
        claimBlocks: false,
      }),
    ).toEqual({ queue: true, reason: 'missed_eligible_handoff' });

    expect(
      shouldQueueRecovery({
        eligibilityOk: false,
        deliveryKey: 'issue-2997',
        consumed: false,
        hasPendingPacket: false,
        claimBlocks: false,
      }).queue,
    ).toBe(false);

    const packet = buildRecoveryPacket({
      issueNumber: 2997,
      deliveryKey: 'issue-2997',
    });
    expect(packet.resumeHint).toBe('issue-2997');
    expect(packet.deliveryId).toContain('reconcile-issue-2997-');
  });

  it('does not queue reconciliation recovery for ChatGPT/Claude-only issues', () => {
    const chatgptOnly = validateEligibility(
      { ...baseIssue, labels: [{ name: 'agent:ChatGPT' }, { name: 'handoff:ready' }] },
      [],
    );
    expect(chatgptOnly.ok).toBe(false);
    expect(
      shouldQueueRecovery({
        eligibilityOk: chatgptOnly.ok,
        deliveryKey: 'issue-2997',
        consumed: false,
        hasPendingPacket: false,
        claimBlocks: false,
      }).queue,
    ).toBe(false);

    const claudeOnly = validateEligibility({ ...baseIssue, labels: [{ name: 'agent:claude' }] }, []);
    expect(claudeOnly.ok).toBe(false);
    expect(
      shouldQueueRecovery({
        eligibilityOk: claudeOnly.ok,
        deliveryKey: resolveDeliveryKey({ packet: null, issueNumber: 2997 }),
        consumed: false,
        hasPendingPacket: false,
        claimBlocks: false,
      }).reason,
    ).toBe('ineligible');
  });

  it('resolveDeliveryKey always uses packet identity — there is no comment id to prefer', () => {
    expect(resolveDeliveryKey({ packet: { deliveryId: 'wake-1' }, issueNumber: 2997 })).toBe('wake-1');
    expect(resolveDeliveryKey({ packet: null, issueNumber: 2997 })).toBe('issue-2997');

    const traversal = resolveDeliveryKey({ packet: { deliveryId: '../x' }, issueNumber: 2997 });
    expect(traversal).toMatch(/^enc-[0-9a-f]+$/);
    expect(traversal.includes('..')).toBe(false);
    expect(traversal.includes('/')).toBe(false);

    const recovery = buildRecoveryPacket({
      issueNumber: 2997,
      deliveryKey: '../../etc/passwd',
    });
    expect(recovery.deliveryId.startsWith('reconcile-enc-')).toBe(true);
    expect(recovery.deliveryId.includes('..')).toBe(false);
  });

  it('sanitizeDeliveryKey and consumedPath block path traversal', () => {
    expect(sanitizeDeliveryKey('99')).toBe('99');
    expect(sanitizeDeliveryKey('../x')).toMatch(/^enc-[0-9a-f]{64}$/);
    expect(sanitizeDeliveryKey('a/b')).toMatch(/^enc-[0-9a-f]{64}$/);
    expect(sanitizeDeliveryKey('')).toBe('issue-unknown');

    const home = '/tmp/lgfc-bridge-home';
    process.env.LGFC_CURSOR_BRIDGE_HOME = home;
    try {
      const p = consumedPath({ consumedDir: 'consumed' }, '../x');
      expect(p.startsWith(path.join(home, 'consumed'))).toBe(true);
      expect(p.includes(`${path.sep}..${path.sep}`)).toBe(false);
      expect(path.basename(p)).toMatch(/^enc-[0-9a-f]{64}\.json$/);
    } finally {
      delete process.env.LGFC_CURSOR_BRIDGE_HOME;
    }
  });

  it('sanitizeDeliveryKey keeps long shared-prefix GitHub URLs distinct', () => {
    const base = 'https://github.com/wdhunter645/next-starter-template/issues/2997#issuecomment-';
    const a = `${base}${'1'.repeat(80)}`;
    const b = `${base}${'2'.repeat(80)}`;
    const keyA = sanitizeDeliveryKey(a);
    const keyB = sanitizeDeliveryKey(b);
    expect(keyA).toMatch(/^enc-[0-9a-f]{64}$/);
    expect(keyB).toMatch(/^enc-[0-9a-f]{64}$/);
    expect(keyA).not.toBe(keyB);
    expect(sanitizeDeliveryKey(a)).toBe(keyA);
    expect(sanitizeDeliveryKey(b)).toBe(keyB);
  });
});

describe('cursor-only wake ingress / packet boundary (label-driven)', () => {
  const repo = 'wdhunter465/next-starter-template';
  const cursorLabels = ['agent:cursor', 'handoff:ready'];

  it('delivers on a handoff:ready labeled event when agent:cursor is already present', () => {
    expect(
      shouldDeliverCursorWake({
        repository: repo,
        eventName: 'issues',
        action: 'labeled',
        labelName: 'handoff:ready',
        issueLabels: cursorLabels,
      }),
    ).toEqual({ deliver: true, reason: 'handoff_ready_on_cursor_issue' });
  });

  it('delivers on an agent:cursor labeled event when handoff:ready is already present (order-independent)', () => {
    expect(
      shouldDeliverCursorWake({
        repository: repo,
        eventName: 'issues',
        action: 'labeled',
        labelName: 'agent:cursor',
        issueLabels: cursorLabels,
      }),
    ).toEqual({ deliver: true, reason: 'handoff_ready_on_cursor_issue' });
  });

  it('does not deliver when only one of the two required labels is present', () => {
    expect(
      shouldDeliverCursorWake({
        repository: repo,
        eventName: 'issues',
        action: 'labeled',
        labelName: 'agent:cursor',
        issueLabels: ['agent:cursor'],
      }).reason,
    ).toBe('absent_cursor_routing');

    expect(
      shouldDeliverCursorWake({
        repository: repo,
        eventName: 'issues',
        action: 'labeled',
        labelName: 'handoff:ready',
        issueLabels: ['handoff:ready'],
      }).reason,
    ).toBe('absent_cursor_routing');
  });

  it('rejects ChatGPT/Atlas/Engineering-directed traffic at wake ingress', () => {
    expect(isNonCursorDirectedTraffic({ labels: ['agent:ChatGPT', 'handoff:ready'] })).toBe(true);
    expect(isNonCursorDirectedTraffic({ labels: ['agent:engineering', 'handoff:ready'] })).toBe(true);

    expect(
      shouldDeliverCursorWake({
        repository: repo,
        eventName: 'issues',
        action: 'labeled',
        labelName: 'handoff:ready',
        issueLabels: ['agent:ChatGPT', 'handoff:ready'],
      }).deliver,
    ).toBe(false);
  });

  it('fails closed on mixed agent:cursor + other agent:* labels (#3013)', () => {
    const mixed = ['agent:cursor', 'agent:claude', 'handoff:ready'];
    expect(hasConflictingAgentRoutingLabels(mixed)).toBe(true);
    expect(conflictingAgentRoutingReason(mixed)).toBe(
      'conflicting_agent_routing_labels:agent:claude,agent:cursor',
    );

    const wake = shouldDeliverCursorWake({
      repository: repo,
      eventName: 'issues',
      action: 'labeled',
      labelName: 'handoff:ready',
      issueLabels: mixed,
    });
    expect(wake.deliver).toBe(false);
    expect(wake.reason).toBe('conflicting_agent_routing_labels:agent:claude,agent:cursor');

    const eligibility = validateEligibility(
      {
        ...baseIssue,
        labels: [
          { name: 'agent:cursor' },
          { name: 'agent:codex' },
          { name: 'handoff:ready' },
        ],
      },
      [],
    );
    expect(eligibility.ok).toBe(false);
    expect(eligibility.errors).toContain(
      'conflicting_agent_routing_labels:agent:codex,agent:cursor',
    );

    // Single agent:cursor remains eligible
    expect(hasConflictingAgentRoutingLabels(['agent:cursor', 'handoff:ready'])).toBe(false);
  });

  it('rejects other-agent and unrelated GitHub traffic', () => {
    expect(
      shouldDeliverCursorWake({
        repository: repo,
        eventName: 'issues',
        action: 'labeled',
        labelName: 'bug',
        issueLabels: ['bug'],
      }).reason,
    ).toBe('unrelated_issue_label_event');

    expect(
      shouldDeliverCursorWake({
        repository: repo,
        eventName: 'pull_request',
        issueLabels: cursorLabels,
      }).reason,
    ).toBe('unrelated_github_traffic');

    expect(
      shouldDeliverCursorWake({
        repository: 'evil/other',
        eventName: 'issues',
        action: 'labeled',
        labelName: 'handoff:ready',
        issueLabels: cursorLabels,
      }).reason,
    ).toBe('untrusted_repository');

    expect(hasCursorRoutingSignal({ labels: ['agent:codex'] })).toBe(false);
    expect(hasCursorRoutingSignal({ labels: ['agent:cursor'] })).toBe(true);
    expect(hasReadyCursorHandoff({ labels: cursorLabels })).toBe(true);
    expect(hasReadyCursorHandoff({ labels: ['agent:cursor'] })).toBe(false);
  });

  it('manual dispatch requires Cursor routing before queue write', () => {
    expect(
      shouldDeliverCursorWake({
        repository: repo,
        eventName: 'workflow_dispatch',
        actor: 'wdhunter645',
        issueLabels: ['agent:cursor'],
      }).deliver,
    ).toBe(true);

    expect(
      shouldDeliverCursorWake({
        repository: repo,
        eventName: 'workflow_dispatch',
        actor: 'wdhunter645',
        issueLabels: ['agent:ChatGPT'],
      }).deliver,
    ).toBe(false);
  });
});
