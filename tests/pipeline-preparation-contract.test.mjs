import { describe, expect, it } from 'vitest';
import {
  PREPARATION_CLAIM_STATUS,
  assertPreparationAuthorityBoundary,
  evaluateGraduationCandidateReadiness,
  evaluatePreparationClaim,
  validateLaunchPackageCompleteness
} from '../scripts/ci/pipeline-preparation-contract.mjs';

const COMPLETE_LAUNCH_PACKAGE_BODY = `
Objective: Prepare the widget program for Graduation Candidate review
Scope and non-goals: covers widget UI; excludes billing
Requirements: must support rollback
Acceptance criteria: launch package reviewed and complete
Architecture/design: component-based widget renderer
Dependencies: none outstanding
Child graph: #2001 -> #2002 -> #2003
Validation: npm test passes on each child
Rollback: revert the merge commit
Stop conditions: Production credential exposure
Delivery model: B-child
Production/Day-2 boundaries: no live credential writes during preparation
Intended implementation owner: Implementation / Operations
`;

describe('pipeline-preparation-contract (#3672)', () => {
  it('allows a single preparer to claim preparation with no existing claim', () => {
    const result = evaluatePreparationClaim({
      pipelineParent: { labels: ['pmo', 'pmo:pipeline', 'team:pmo'] },
      requestingAgent: 'claude'
    });
    expect(result.status).toBe(PREPARATION_CLAIM_STATUS.ALLOWED);
  });

  it('allows bounded collaborative preparation when explicitly requested', () => {
    const pipelineParent = { labels: ['pmo', 'pmo:pipeline', 'team:pmo', 'agent:grok'] };
    pipelineParent.hasRecentExecutionEvidence = true;
    const result = evaluatePreparationClaim({
      pipelineParent,
      requestingAgent: 'claude',
      collaborationRequested: true
    });
    expect(result.status).toBe(PREPARATION_CLAIM_STATUS.ALLOWED_BOUNDED_COLLABORATION);
  });

  it('blocks a duplicate preparation claim without explicit collaboration', () => {
    const pipelineParent = { labels: ['pmo', 'pmo:pipeline', 'team:pmo', 'agent:grok'] };
    pipelineParent.hasRecentExecutionEvidence = true;
    const result = evaluatePreparationClaim({
      pipelineParent,
      requestingAgent: 'claude',
      collaborationRequested: false
    });
    expect(result.status).toBe(PREPARATION_CLAIM_STATUS.BLOCKED_DUPLICATE_CLAIM);
  });

  it('blocks with BLOCKED-RESERVATION when a Product Authority reservation is held by another agent', () => {
    const pipelineParent = { labels: ['pmo', 'pmo:pipeline', 'team:pmo', 'agent:grok'] };
    pipelineParent.hasExplicitReservationEvidence = true;
    const result = evaluatePreparationClaim({
      pipelineParent,
      requestingAgent: 'claude'
    });
    expect(result.status).toBe(PREPARATION_CLAIM_STATUS.BLOCKED_RESERVATION);
  });

  it('blocks with BLOCKED-AMBIGUOUS-CLAIM-STATE on an unclassifiable claim', () => {
    const pipelineParent = { labels: ['pmo', 'pmo:pipeline', 'team:pmo', 'agent:grok'] };
    const result = evaluatePreparationClaim({
      pipelineParent,
      requestingAgent: 'claude'
    });
    expect(result.status).toBe(PREPARATION_CLAIM_STATUS.BLOCKED_AMBIGUOUS_CLAIM_STATE);
  });

  it('blocks with BLOCKED-INVALID-REQUEST when no requestingAgent is supplied', () => {
    const pipelineParent = { labels: ['pmo', 'pmo:pipeline', 'team:pmo'] };
    const result = evaluatePreparationClaim({ pipelineParent });
    expect(result.status).toBe(PREPARATION_CLAIM_STATUS.BLOCKED_INVALID_REQUEST);
  });

  it('rejects an incomplete launch package', () => {
    const result = validateLaunchPackageCompleteness({ body: 'Objective: prepare the launch package' });
    expect(result.complete).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  it('accepts a complete launch package as Graduation Candidate ready', () => {
    const result = evaluateGraduationCandidateReadiness({ body: COMPLETE_LAUNCH_PACKAGE_BODY });
    expect(result.readyForGraduationCandidate).toBe(true);
    expect(result.package.missing).toEqual([]);
  });

  it('prohibits self-graduation and self-approval regardless of package completeness', () => {
    expect(assertPreparationAuthorityBoundary('grant-project-graduation').permitted).toBe(false);
    expect(assertPreparationAuthorityBoundary('self-approve-package').permitted).toBe(false);
    expect(assertPreparationAuthorityBoundary('assign-pmo-active-priority').permitted).toBe(false);
    expect(assertPreparationAuthorityBoundary('grant-implementation-go').permitted).toBe(false);
  });

  it('permits bounded drafting/refining actions', () => {
    expect(assertPreparationAuthorityBoundary('draft-launch-package').permitted).toBe(true);
    expect(assertPreparationAuthorityBoundary('refine-child-issues').permitted).toBe(true);
  });

  it('fails closed on an unrecognized action', () => {
    const result = assertPreparationAuthorityBoundary('deploy-to-production');
    expect(result.permitted).toBe(false);
    expect(result.reason).toMatch(/unrecognized action/);
  });
});
