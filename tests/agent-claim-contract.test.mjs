import { describe, expect, it } from 'vitest';
import {
  CLAIM_CLASSES,
  agentLabelsFrom,
  canClaim,
  classifyClaim,
  shouldReleaseAtHandoff
} from '../scripts/ci/agent-claim-contract.mjs';

describe('agent-claim-contract (#3240)', () => {
  it('extracts agent:* labels only', () => {
    expect(
      agentLabelsFrom(['team:governance', 'agent:grok', 'status:active', { name: 'agent:cursor' }])
    ).toEqual(['agent:grok', 'agent:cursor']);
  });

  it('classifies queue-only as NONE', () => {
    const result = classifyClaim({ labels: ['team:operations', 'ops:priority:1'] });
    expect(result.class).toBe(CLAIM_CLASSES.NONE);
    expect(result.agentLabels).toEqual([]);
  });

  it('classifies active claim from execution evidence', () => {
    const result = classifyClaim({
      labels: ['agent:grok', 'team:governance'],
      hasRecentExecutionEvidence: true
    });
    expect(result.class).toBe(CLAIM_CLASSES.ACTIVE_CLAIM);
  });

  it('classifies explicit reservation', () => {
    const result = classifyClaim({
      labels: ['agent:claude'],
      hasExplicitReservationEvidence: true
    });
    expect(result.class).toBe(CLAIM_CLASSES.EXPLICIT_RESERVATION);
  });

  it('classifies active claim before reservation after reserved agent starts work', () => {
    const result = classifyClaim({
      labels: ['agent:claude'],
      hasExplicitReservationEvidence: true,
      hasRecentExecutionEvidence: true
    });
    expect(result.class).toBe(CLAIM_CLASSES.ACTIVE_CLAIM);
  });

  it('classifies proven stale pre-assignment', () => {
    const result = classifyClaim({
      labels: ['agent:cursor'],
      hasStaleEvidence: true
    });
    expect(result.class).toBe(CLAIM_CLASSES.STALE_PREASSIGNMENT);
  });

  it('classifies dual agent labels as AMBIGUOUS', () => {
    const result = classifyClaim({ labels: ['agent:claude', 'agent:grok'] });
    expect(result.class).toBe(CLAIM_CLASSES.AMBIGUOUS);
  });

  it('classifies body contradiction as AMBIGUOUS', () => {
    const result = classifyClaim({
      labels: ['agent:grok'],
      bodyContradictsLabel: true
    });
    expect(result.class).toBe(CLAIM_CLASSES.AMBIGUOUS);
  });

  it('allows claim on queue-only issue', () => {
    const result = canClaim({
      labels: ['team:engineering'],
      requestingAgent: 'grok'
    });
    expect(result.allowed).toBe(true);
  });

  it('does not let caller-provided NONE bypass a present agent label', () => {
    const result = canClaim({
      labels: ['team:engineering', 'agent:claude'],
      claimClass: CLAIM_CLASSES.NONE,
      requestingAgent: 'grok'
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/agent:claude/);
  });

  it('blocks independent claim when ACTIVE_CLAIM held by another agent', () => {
    const result = canClaim({
      labels: ['agent:claude'],
      claimClass: CLAIM_CLASSES.ACTIVE_CLAIM,
      requestingAgent: 'grok'
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/ACTIVE_CLAIM/);
  });

  it('blocks takeover of EXPLICIT_RESERVATION', () => {
    const result = canClaim({
      labels: ['agent:claude'],
      claimClass: CLAIM_CLASSES.EXPLICIT_RESERVATION,
      requestingAgent: 'cursor'
    });
    expect(result.allowed).toBe(false);
  });

  it('allows same agent to retain own claim', () => {
    const result = canClaim({
      labels: ['agent:grok'],
      claimClass: CLAIM_CLASSES.ACTIVE_CLAIM,
      requestingAgent: 'agent:grok'
    });
    expect(result.allowed).toBe(true);
  });

  it('allows claim after proven stale pre-assignment', () => {
    const result = canClaim({
      labels: ['agent:cursor'],
      claimClass: CLAIM_CLASSES.STALE_PREASSIGNMENT,
      requestingAgent: 'grok'
    });
    expect(result.allowed).toBe(true);
  });

  it('blocks AMBIGUOUS independent start', () => {
    const result = canClaim({
      labels: ['agent:cursor'],
      claimClass: CLAIM_CLASSES.AMBIGUOUS,
      requestingAgent: 'grok'
    });
    expect(result.allowed).toBe(false);
  });

  it('releases claim at PR-ready when no residual duties', () => {
    expect(shouldReleaseAtHandoff({ prReady: true })).toEqual({
      release: true,
      reason: 'PR-ready handoff; no residual duties'
    });
  });

  it('keeps claim when remediation duty remains', () => {
    expect(
      shouldReleaseAtHandoff({ prReady: true, retainsRemediationDuty: true }).release
    ).toBe(false);
  });

  it('keeps claim when post-merge duty remains', () => {
    expect(
      shouldReleaseAtHandoff({ prReady: true, retainsPostMergeDuty: true }).release
    ).toBe(false);
  });
});
