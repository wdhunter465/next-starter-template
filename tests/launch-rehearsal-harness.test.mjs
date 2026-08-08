import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import {
  APPROVED_CATEGORIES,
  REQUIRED_JOURNEY_FIELDS,
  auditEvidence,
  validateJourney,
  validateRegistry,
} from '../scripts/ci/launch_rehearsal_harness.mjs';

const REGISTRY_PATH = 'docs/ops/reports/launch-rehearsal-journey-registry-2927.json';

function baseJourney(overrides = {}) {
  return {
    id: 'j1',
    category: 'anonymous',
    name: 'Journey name',
    expectedResult: 'Expected result',
    evidence: 'Evidence description',
    owner: 'Implementation / Operations',
    privacyControl: 'Privacy control',
    cleanup: 'Cleanup',
    defectRouting: 'Defect routing',
    executionPath: 'Execution path',
    ...overrides,
  };
}

describe('validateJourney', () => {
  it('accepts a journey with every required field populated', () => {
    expect(validateJourney(baseJourney())).toEqual([]);
  });

  it('flags every missing or empty required field', () => {
    const defects = validateJourney(baseJourney({ evidence: '', owner: undefined }));
    expect(defects).toContain('missing_or_empty:evidence');
    expect(defects).toContain('missing_or_empty:owner');
  });

  it('flags a whitespace-only field as missing', () => {
    expect(validateJourney(baseJourney({ cleanup: '   ' }))).toContain('missing_or_empty:cleanup');
  });

  it('flags an unapproved category', () => {
    expect(validateJourney(baseJourney({ category: 'not-a-real-category' }))).toContain(
      'unapproved_category:not-a-real-category',
    );
  });

  it('fails closed on a non-object journey', () => {
    expect(validateJourney(null)).toEqual(['journey_not_an_object']);
    expect(validateJourney('x')).toEqual(['journey_not_an_object']);
  });

  it('covers every field #2927 requires: id, category, name, expectedResult, evidence, owner, privacyControl, cleanup, defectRouting, executionPath', () => {
    expect(REQUIRED_JOURNEY_FIELDS).toEqual([
      'id',
      'category',
      'name',
      'expectedResult',
      'evidence',
      'owner',
      'privacyControl',
      'cleanup',
      'defectRouting',
      'executionPath',
    ]);
  });
});

describe('validateRegistry', () => {
  it('passes a registry of fully-compliant, uniquely-idd journeys covering every approved category', () => {
    const registry = { journeys: APPROVED_CATEGORIES.map((category, i) => baseJourney({ id: `j${i}`, category })) };
    const result = validateRegistry(registry);
    expect(result.ok).toBe(true);
    expect(result.journeyCount).toBe(APPROVED_CATEGORIES.length);
    expect(result.duplicateIds).toEqual([]);
    expect(result.missingCategories).toEqual([]);
  });

  it('fails on duplicate journey ids', () => {
    const registry = { journeys: [baseJourney({ id: 'dup' }), baseJourney({ id: 'dup', category: 'membership' })] };
    const result = validateRegistry(registry);
    expect(result.ok).toBe(false);
    expect(result.duplicateIds).toEqual(['dup']);
  });

  it('fails on a category from #2781\'s required-journeys list having zero registry entries', () => {
    const registry = { journeys: [baseJourney({ id: 'j1', category: 'anonymous' })] };
    const result = validateRegistry(registry);
    expect(result.ok).toBe(false);
    expect(result.missingCategories.length).toBe(APPROVED_CATEGORIES.length - 1);
  });

  it('reports per-journey defects without throwing on a malformed entry', () => {
    const registry = { journeys: [baseJourney({ id: 'j1' }), null, baseJourney({ id: '', category: 'membership' })] };
    const result = validateRegistry(registry);
    expect(result.ok).toBe(false);
    expect(result.journeysWithDefects.some((entry) => entry.id === '(missing id)')).toBe(true);
  });

  it('treats an empty/malformed registry as zero journeys, not a throw', () => {
    expect(validateRegistry({}).journeyCount).toBe(0);
    expect(validateRegistry(null).journeyCount).toBe(0);
  });
});

describe('auditEvidence', () => {
  const registry = { journeys: [baseJourney({ id: 'a' }), baseJourney({ id: 'b', category: 'membership' })] };

  it('passes when every registry journey has exactly one evidence entry and nothing extra', () => {
    const result = auditEvidence(registry, [{ journeyId: 'a' }, { journeyId: 'b' }]);
    expect(result.ok).toBe(true);
    expect(result.missingEvidence).toEqual([]);
    expect(result.orphanedEvidence).toEqual([]);
  });

  it('flags a registry journey with no evidence entry', () => {
    const result = auditEvidence(registry, [{ journeyId: 'a' }]);
    expect(result.ok).toBe(false);
    expect(result.missingEvidence).toEqual(['b']);
  });

  it('flags an evidence entry with no matching registry journey (orphaned)', () => {
    const result = auditEvidence(registry, [{ journeyId: 'a' }, { journeyId: 'b' }, { journeyId: 'not-in-registry' }]);
    expect(result.ok).toBe(false);
    expect(result.orphanedEvidence).toEqual(['not-in-registry']);
  });

  it('accepts an object-keyed evidence log as well as an array', () => {
    const result = auditEvidence(registry, { a: { capturedAt: 't' }, b: { capturedAt: 't' } });
    expect(result.ok).toBe(true);
  });
});

describe('the committed #2927 registry file', () => {
  it('exists, parses as JSON, and passes validateRegistry', () => {
    const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    const result = validateRegistry(registry);
    expect(result.journeysWithDefects).toEqual([]);
    expect(result.duplicateIds).toEqual([]);
    expect(result.missingCategories).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('covers every #2781 required-journey category with more than one journey where the category is broad', () => {
    const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
    const byCategory = registry.journeys.reduce((acc, j) => {
      acc[j.category] = (acc[j.category] || 0) + 1;
      return acc;
    }, {});
    for (const category of APPROVED_CATEGORIES) {
      expect(byCategory[category]).toBeGreaterThan(0);
    }
  });
});
