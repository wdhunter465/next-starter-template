import { describe, expect, it } from 'vitest';
import {
  DECISION_MATRIX,
  PMO_LIFECYCLE_STAGES,
  assertNoConflictingModels,
  classifyWorkEvidence,
  isPmoLifecycleStageValid,
  isPmoPriorityValid,
} from './support/pmo_work_classification.mjs';

describe('PMO work-size and delivery-model classification', () => {
  it('classifies every required example deterministically', () => {
    for (const example of DECISION_MATRIX) {
      const result = classifyWorkEvidence(example.evidence);
      expect(result.provisionalSize, example.id).toBe(example.expected.provisionalSize);
      expect(result.finalSize, example.id).toBe(example.expected.finalSize);
      expect(result.changeMode, example.id).toBe(example.expected.changeMode);
      expect(result.deliveryModel, example.id).toBe(example.expected.deliveryModel);
      expect(result.approvalProfile, example.id).toBe(example.expected.approvalProfile);
      expect(result.rollbackProfile, example.id).toBe(example.expected.rollbackProfile);
      expect(assertNoConflictingModels(result), example.id).toBe(true);
    }
  });

  it('never allows both Model A and Model B for the same evidence', () => {
    for (const example of DECISION_MATRIX) {
      const result = classifyWorkEvidence(example.evidence);
      if (result.finalSize === 'medium' && result.deliveryModel !== 'emergency-recovery') {
        expect(result.modelAEligible && result.modelBRequired, example.id).toBe(false);
      }
    }
  });

  it('routes emergency examples outside the Medium Model A/B tree', () => {
    const emergencyExamples = DECISION_MATRIX.filter(
      (example) => example.expected.deliveryModel === 'emergency-recovery',
    );
    expect(emergencyExamples.length).toBeGreaterThan(0);
    for (const example of emergencyExamples) {
      const result = classifyWorkEvidence(example.evidence);
      expect(result.route, example.id).toBe('emergency');
      expect(result.deliveryModel, example.id).toBe('emergency-recovery');
    }
  });

  it('produces identical results for identical evidence', () => {
    const sample = DECISION_MATRIX[0].evidence;
    const first = classifyWorkEvidence(sample);
    const second = classifyWorkEvidence(sample);
    expect(second).toEqual(first);
  });

  it('validates canonical 6-stage PMO lifecycle stages (#3597)', () => {
    expect(PMO_LIFECYCLE_STAGES).toEqual([
      'initial-idea',
      'drafted-design',
      'pending-launch-packet',
      'graduation-candidate',
      'active',
      'closed',
    ]);

    for (const stage of PMO_LIFECYCLE_STAGES) {
      expect(isPmoLifecycleStageValid(stage)).toBe(true);
    }

    expect(isPmoLifecycleStageValid('invalid-stage')).toBe(false);
  });

  it('validates 1...XXX execution order priorities for PMO and Engineering (#3597)', () => {
    expect(isPmoPriorityValid(1)).toBe(true);
    expect(isPmoPriorityValid(5)).toBe(true);
    expect(isPmoPriorityValid(42)).toBe(true);
    expect(isPmoPriorityValid('1')).toBe(true);
    expect(isPmoPriorityValid('10')).toBe(true);

    expect(isPmoPriorityValid(0)).toBe(false);
    expect(isPmoPriorityValid(-1)).toBe(false);
    expect(isPmoPriorityValid('invalid')).toBe(false);
  });
});
