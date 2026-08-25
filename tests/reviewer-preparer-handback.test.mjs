import { describe, expect, it } from 'vitest';

import {
  HANDOFF_MARKER,
  buildPreparerHandbackBlock,
  extractPendingPlaceholderIds,
  resolvePreparerIdentity,
} from '../scripts/ci/reviewer_preparer_handback.mjs';

describe('reviewer preparer handback (#3703)', () => {
  it('prefers explicit Implementation agent metadata', () => {
    expect(resolvePreparerIdentity({
      body: '- Implementation agent: google-labs-jules[bot]',
      labels: ['agent:grok'],
      authorLogin: 'wdhunter465',
    })).toEqual({ value: 'google-labs-jules[bot]', source: 'implementation-agent' });
  });

  it('falls back from not-applicable implementation metadata to agent label', () => {
    expect(resolvePreparerIdentity({
      body: '- Implementation agent: not-applicable',
      labels: ['team:operations', 'agent:jules'],
      authorLogin: 'wdhunter465',
    })).toEqual({ value: 'agent:jules', source: 'agent-label' });
  });

  it('falls back to PR author when no implementation identity is available', () => {
    expect(resolvePreparerIdentity({
      body: '',
      labels: ['team:operations'],
      authorLogin: 'wdhunter465',
    })).toEqual({ value: 'wdhunter465', source: 'pr-author' });
  });

  it('detects CI disposition scaffolds that must not satisfy merge readiness', () => {
    const body = `## REVIEWER RESPONSE ACCOUNTING\n- review-comment:123 — acknowledged — auto-generated disposition pending agent completion; agent must replace with final fix/rationale before READY FOR REVIEW — thread state: unresolved-with-rationale\n- review-comment:456 — accepted — fixed correctly — thread state: resolved`;
    expect(extractPendingPlaceholderIds(body)).toEqual(['123']);
  });

  it('builds a deterministic same-PR handback with finding ids and correction format', () => {
    const block = buildPreparerHandbackBlock({
      preparer: { value: 'agent:jules', source: 'agent-label' },
      blockingReasons: [{
        code: 'undispositioned-reviewer-comment',
        commentId: '789',
        message: 'Trusted reviewer comment 789 lacks required closeout.',
      }],
      pendingPlaceholderIds: ['123'],
    });

    expect(block).toContain(HANDOFF_MARKER);
    expect(block).toContain('Target preparer: agent:jules');
    expect(block).toContain('| 789 | undispositioned-reviewer-comment |');
    expect(block).toContain('| 123 | pending-agent-disposition |');
    expect(block).toContain('correct this same PR');
    expect(block).toContain('pending agent completion');
  });
});
