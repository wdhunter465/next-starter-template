import { describe, expect, it } from 'vitest';
import {
  assertCandidateAuthorityBoundary,
  evaluateCandidateIntake,
  findDuplicateCandidates,
  isDuplicateCandidate,
  validateCandidatePackage
} from '../scripts/ci/engineering-candidate-intake.mjs';

const COMPLETE_CANDIDATE_BODY = `
Evidence: 3 flaky CI runs on tests/api/fanclub-photos-upload.test.ts in the last week
Stated deficiency: the upload test suite intermittently times out under load
Intended outcome: deterministic, non-flaky upload test suite
Candidate remediation direction: mock the storage backend instead of hitting live D1
Constraints/risks: must not weaken production upload coverage
Provenance: observed by Claude Code during #3668 CI failure triage
`;

describe('engineering-candidate-intake (#3670)', () => {
  it('accepts a fully evidence-backed candidate as package-complete', () => {
    const result = validateCandidatePackage({ body: COMPLETE_CANDIDATE_BODY });
    expect(result.complete).toBe(true);
    expect(result.missing).toEqual([]);
  });

  it('rejects a candidate missing required fields', () => {
    const result = validateCandidatePackage({ body: 'Evidence: saw it happen once' });
    expect(result.complete).toBe(false);
    expect(result.missing.length).toBeGreaterThan(0);
  });

  it('detects a duplicate via identical stated deficiency', () => {
    const a = { id: 1, body: 'Stated deficiency: the upload test suite intermittently times out' };
    const b = { id: 2, body: 'Stated deficiency: The Upload Test Suite Intermittently Times Out' };
    const result = isDuplicateCandidate(a, b);
    expect(result.duplicate).toBe(true);
    expect(result.reason).toMatch(/stated deficiency/);
  });

  it('detects a duplicate via identical provenance', () => {
    const a = { id: 1, body: 'Provenance: observed during #3668 triage' };
    const b = { id: 2, body: 'Provenance: Observed During #3668 Triage' };
    const result = isDuplicateCandidate(a, b);
    expect(result.duplicate).toBe(true);
    expect(result.reason).toMatch(/provenance/);
  });

  it('does not flag genuinely distinct candidates as duplicates', () => {
    const a = { id: 1, body: 'Stated deficiency: flaky upload test\nProvenance: #3668' };
    const b = { id: 2, body: 'Stated deficiency: stale documentation link\nProvenance: #3665' };
    const duplicates = findDuplicateCandidates(a, [b]);
    expect(duplicates).toEqual([]);
  });

  it('marks intake ready only when complete and not a duplicate', () => {
    const existing = [{ id: 99, body: COMPLETE_CANDIDATE_BODY }];
    const result = evaluateCandidateIntake({
      candidate: { id: 100, body: COMPLETE_CANDIDATE_BODY },
      existingCandidates: existing
    });
    expect(result.intakeReady).toBe(false);
    expect(result.duplicates[0].id).toBe(99);
  });

  it('marks intake ready for a complete, non-duplicate candidate', () => {
    const result = evaluateCandidateIntake({
      candidate: { id: 100, body: COMPLETE_CANDIDATE_BODY },
      existingCandidates: []
    });
    expect(result.intakeReady).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('prohibits self-promotion to PMO Active priority, implementation Go, Graduation, or Product Authority decisions', () => {
    expect(assertCandidateAuthorityBoundary('assign-pmo-active-priority').permitted).toBe(false);
    expect(assertCandidateAuthorityBoundary('grant-implementation-go').permitted).toBe(false);
    expect(assertCandidateAuthorityBoundary('grant-project-graduation').permitted).toBe(false);
    expect(assertCandidateAuthorityBoundary('change-product-authority-decision').permitted).toBe(false);
  });

  it('permits submitting and routing a candidate without Product Authority relay', () => {
    expect(assertCandidateAuthorityBoundary('submit-candidate').permitted).toBe(true);
    expect(assertCandidateAuthorityBoundary('route-to-engineering-qualification').permitted).toBe(true);
  });

  it('fails closed on an unrecognized action', () => {
    const result = assertCandidateAuthorityBoundary('auto-merge-candidate');
    expect(result.permitted).toBe(false);
    expect(result.reason).toMatch(/unrecognized action/);
  });
});
