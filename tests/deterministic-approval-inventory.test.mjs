import { describe, expect, it } from 'vitest';
import {
  GATE_CATEGORIES,
  GATE_INVENTORY,
  GATE_MODE,
  assertNoSelfApproval,
  evaluateDeterministicEligibility
} from '../scripts/ci/deterministic-approval-inventory.mjs';

const ALL_TRUE_SPOOF_EVIDENCE = {
  isolatedEnvironment: true,
  noProductionCredentials: true,
  noProductionWrites: true,
  noPromotionPath: true,
  nonProtectedPath: true,
  componentBranchTarget: true,
  requiredChecksPassing: true,
  allPathsMatchDocsGlob: true,
  singleReviewablePr: true,
  oneStepRollback: true,
  testReproducesDefectBeforeFix: true,
  testPassesAfterFix: true,
  touchesProtectedPath: false,
  // an attacker-controlled attempt to force eligibility directly
  eligible: true,
  mode: GATE_MODE.DETERMINISTIC
};

describe('deterministic-approval-inventory (#3671)', () => {
  it('inventories Production, protected paths, schema/data changes, refactoring, and Promotion Candidate as JUDGMENT', () => {
    expect(GATE_INVENTORY[GATE_CATEGORIES.PRODUCTION].mode).toBe(GATE_MODE.JUDGMENT);
    expect(GATE_INVENTORY[GATE_CATEGORIES.PROTECTED_PATH].mode).toBe(GATE_MODE.JUDGMENT);
    expect(GATE_INVENTORY[GATE_CATEGORIES.SCHEMA_DATA_CHANGE].mode).toBe(GATE_MODE.JUDGMENT);
    expect(GATE_INVENTORY[GATE_CATEGORIES.REFACTORING].mode).toBe(GATE_MODE.JUDGMENT);
    expect(GATE_INVENTORY[GATE_CATEGORIES.PROMOTION_CANDIDATE].mode).toBe(GATE_MODE.JUDGMENT);
  });

  it('inventories Sandbox, Development, documentation-only, and bug fixes as DETERMINISTIC-eligible categories', () => {
    expect(GATE_INVENTORY[GATE_CATEGORIES.SANDBOX].mode).toBe(GATE_MODE.DETERMINISTIC);
    expect(GATE_INVENTORY[GATE_CATEGORIES.DEVELOPMENT].mode).toBe(GATE_MODE.DETERMINISTIC);
    expect(GATE_INVENTORY[GATE_CATEGORIES.DOCUMENTATION_ONLY].mode).toBe(GATE_MODE.DETERMINISTIC);
    expect(GATE_INVENTORY[GATE_CATEGORIES.BUG_FIX].mode).toBe(GATE_MODE.DETERMINISTIC);
  });

  it('never grants Production eligibility, even with every evidence flag spoofed true', () => {
    const result = evaluateDeterministicEligibility({
      category: GATE_CATEGORIES.PRODUCTION,
      evidence: ALL_TRUE_SPOOF_EVIDENCE
    });
    expect(result.eligible).toBe(false);
    expect(result.mode).toBe(GATE_MODE.JUDGMENT);
  });

  it('never grants protected-path eligibility, even with every evidence flag spoofed true', () => {
    const result = evaluateDeterministicEligibility({
      category: GATE_CATEGORIES.PROTECTED_PATH,
      evidence: ALL_TRUE_SPOOF_EVIDENCE
    });
    expect(result.eligible).toBe(false);
    expect(result.mode).toBe(GATE_MODE.JUDGMENT);
  });

  it('never grants schema/data-change or refactoring eligibility regardless of evidence', () => {
    expect(
      evaluateDeterministicEligibility({
        category: GATE_CATEGORIES.SCHEMA_DATA_CHANGE,
        evidence: ALL_TRUE_SPOOF_EVIDENCE
      }).eligible
    ).toBe(false);
    expect(
      evaluateDeterministicEligibility({
        category: GATE_CATEGORIES.REFACTORING,
        evidence: ALL_TRUE_SPOOF_EVIDENCE
      }).eligible
    ).toBe(false);
  });

  it('grants documentation-only eligibility when all criteria are met', () => {
    const result = evaluateDeterministicEligibility({
      category: GATE_CATEGORIES.DOCUMENTATION_ONLY,
      evidence: { allPathsMatchDocsGlob: true, touchesProtectedPath: false }
    });
    expect(result.eligible).toBe(true);
    expect(result.mode).toBe(GATE_MODE.DETERMINISTIC);
  });

  it('falls back to judgment for documentation-only when it touches a protected path', () => {
    const result = evaluateDeterministicEligibility({
      category: GATE_CATEGORIES.DOCUMENTATION_ONLY,
      evidence: { allPathsMatchDocsGlob: true, touchesProtectedPath: true }
    });
    expect(result.eligible).toBe(false);
    expect(result.mode).toBe(GATE_MODE.JUDGMENT);
  });

  it('grants bug-fix eligibility only when the full regression-proof criteria are met', () => {
    const complete = evaluateDeterministicEligibility({
      category: GATE_CATEGORIES.BUG_FIX,
      evidence: {
        singleReviewablePr: true,
        oneStepRollback: true,
        testReproducesDefectBeforeFix: true,
        testPassesAfterFix: true,
        touchesProtectedPath: false
      }
    });
    expect(complete.eligible).toBe(true);

    const incomplete = evaluateDeterministicEligibility({
      category: GATE_CATEGORIES.BUG_FIX,
      evidence: { singleReviewablePr: true, oneStepRollback: true }
    });
    expect(incomplete.eligible).toBe(false);
    expect(incomplete.reason).toMatch(/testReproducesDefectBeforeFix/);
  });

  it('grants Sandbox eligibility only when isolation and no-Production criteria are all met', () => {
    const eligible = evaluateDeterministicEligibility({
      category: GATE_CATEGORIES.SANDBOX,
      evidence: {
        isolatedEnvironment: true,
        noProductionCredentials: true,
        noProductionWrites: true,
        noPromotionPath: true
      }
    });
    expect(eligible.eligible).toBe(true);

    const notEligible = evaluateDeterministicEligibility({
      category: GATE_CATEGORIES.SANDBOX,
      evidence: {
        isolatedEnvironment: true,
        noProductionCredentials: true,
        noProductionWrites: false,
        noPromotionPath: true
      }
    });
    expect(notEligible.eligible).toBe(false);
  });

  it('falls closed to judgment on an unrecognized category', () => {
    const result = evaluateDeterministicEligibility({ category: 'not-a-real-category', evidence: {} });
    expect(result.eligible).toBe(false);
    expect(result.mode).toBe(GATE_MODE.JUDGMENT);
    expect(result.reason).toMatch(/unrecognized gate category/);
  });

  it('blocks self-approval even when eligibility is granted', () => {
    const result = assertNoSelfApproval({ eligible: true, implementerIsApprover: true });
    expect(result.permitted).toBe(false);
    expect(result.reason).toMatch(/does not grant self-approval/);
  });

  it('permits action only when eligible and not self-approved', () => {
    expect(assertNoSelfApproval({ eligible: true, implementerIsApprover: false }).permitted).toBe(true);
    expect(assertNoSelfApproval({ eligible: false, implementerIsApprover: false }).permitted).toBe(false);
  });
});
