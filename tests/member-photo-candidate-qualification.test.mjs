import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  REQUIRED_SCENARIO_CATEGORIES,
  SCENARIO_STATUSES,
  buildQualificationReadiness,
  main,
  validateQualificationRecord,
  validateScenarioItem,
} from '../scripts/ci/member_photo_candidate_qualification.mjs';

function coveredScenario(overrides = {}) {
  return {
    category: 'authorization',
    status: 'covered',
    testFile: 'tests/member-photo-upload-rollback.test.ts',
    testName: 'still requires authentication before reporting storage-unavailable',
    ...overrides,
  };
}

function gapScenario(overrides = {}) {
  return {
    category: 'b2-failure',
    status: 'gap',
    owner: 'implementation-lead',
    releaseCondition: 'add a mid-write B2 PUT-failure test before Production activation',
    ...overrides,
  };
}

function allCategoriesRecord(overrides = {}) {
  const scenarios = REQUIRED_SCENARIO_CATEGORIES.map((category) => coveredScenario({ category }));
  return {
    candidateSha: '7c69f8844d057bcac6fc98df6bc18bb7abb62698',
    scenarios,
    ...overrides,
  };
}

describe('validateScenarioItem', () => {
  it('accepts a covered scenario with test evidence', () => {
    expect(validateScenarioItem(coveredScenario())).toEqual([]);
  });

  it('accepts a gap scenario with owner and release condition', () => {
    expect(validateScenarioItem(gapScenario())).toEqual([]);
  });

  it('flags a covered scenario missing testFile or testName', () => {
    const problems = validateScenarioItem(coveredScenario({ testFile: '', testName: undefined }));
    expect(problems).toContain('missing_or_empty:testFile');
    expect(problems).toContain('missing_or_empty:testName');
  });

  it('flags a gap scenario missing owner or releaseCondition', () => {
    const problems = validateScenarioItem(gapScenario({ owner: '', releaseCondition: undefined }));
    expect(problems).toContain('missing_or_empty:owner');
    expect(problems).toContain('missing_or_empty:releaseCondition');
  });

  it('flags a missing or invalid status', () => {
    expect(validateScenarioItem(coveredScenario({ status: 'maybe' }))).toContain('missing_or_invalid:status');
  });

  it('flags an unrecognized category', () => {
    expect(validateScenarioItem(coveredScenario({ category: 'made-up-category' }))).toContain(
      'missing_or_unrecognized:category',
    );
  });

  it('fails closed on a non-object or array item instead of throwing', () => {
    expect(validateScenarioItem(null)).toEqual(['scenario_not_an_object']);
    expect(validateScenarioItem(['x'])).toEqual(['scenario_not_an_object']);
  });

  it('covers exactly the two defined statuses', () => {
    expect(SCENARIO_STATUSES).toEqual(['covered', 'gap']);
  });
});

describe('validateQualificationRecord', () => {
  it('accepts a record with all thirteen categories covered', () => {
    expect(validateQualificationRecord(allCategoriesRecord())).toEqual([]);
  });

  it('accepts a record where some categories are honest gaps with disposition', () => {
    const scenarios = REQUIRED_SCENARIO_CATEGORIES.map((category) =>
      category === 'b2-failure' || category === 'responsive-behavior'
        ? gapScenario({ category })
        : coveredScenario({ category }),
    );
    expect(validateQualificationRecord({ candidateSha: 'abc123', scenarios })).toEqual([]);
  });

  it('covers exactly the thirteen categories #2857/#2901 require', () => {
    expect(REQUIRED_SCENARIO_CATEGORIES).toEqual([
      'authorization',
      'allowed-rejected-files',
      'size-signature-dimension-errors',
      'rate-limits',
      'b2-failure',
      'd1-failure',
      'pending-visibility',
      'approval-visibility',
      'attribution',
      'stale-media',
      'keyboard-navigation',
      'responsive-behavior',
      'rollback-staff-gallery-preserved',
    ]);
  });

  it('flags a missing candidateSha', () => {
    expect(validateQualificationRecord(allCategoriesRecord({ candidateSha: '' }))).toContain(
      'missing_or_empty:candidateSha',
    );
  });

  it('flags a missing or empty scenarios array', () => {
    expect(validateQualificationRecord(allCategoriesRecord({ scenarios: [] }))).toContain(
      'scenarios_missing_or_empty',
    );
    const record = allCategoriesRecord();
    delete record.scenarios;
    expect(validateQualificationRecord(record)).toContain('scenarios_missing_or_empty');
  });

  it('flags every category silently missing from the scenarios list — the "no dropped category" invariant', () => {
    const scenarios = REQUIRED_SCENARIO_CATEGORIES.filter((c) => c !== 'stale-media' && c !== 'keyboard-navigation').map(
      (category) => coveredScenario({ category }),
    );
    const problems = validateQualificationRecord({ candidateSha: 'abc123', scenarios });
    expect(problems).toContain('missing_category:stale-media');
    expect(problems).toContain('missing_category:keyboard-navigation');
  });

  it('reports per-item problems indexed by position', () => {
    const scenarios = REQUIRED_SCENARIO_CATEGORIES.map((category) => coveredScenario({ category }));
    scenarios[2] = coveredScenario({ category: scenarios[2].category, testName: '' });
    const problems = validateQualificationRecord({ candidateSha: 'abc123', scenarios });
    expect(problems).toContain('scenarios[2]:missing_or_empty:testName');
  });

  it('fails closed on a non-object or array record instead of throwing', () => {
    expect(validateQualificationRecord(null)).toEqual(['qualification_record_not_an_object']);
    expect(validateQualificationRecord(['x'])).toEqual(['qualification_record_not_an_object']);
  });
});

describe('buildQualificationReadiness', () => {
  it('is ready when every category has an explicit disposition', () => {
    const result = buildQualificationReadiness({ record: allCategoriesRecord() });
    expect(result.ready).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.detail.gapCategories).toEqual([]);
  });

  it('is still ready when some categories are honest gaps — ready means "dispositioned", not "all covered"', () => {
    const scenarios = REQUIRED_SCENARIO_CATEGORIES.map((category) =>
      category === 'b2-failure' ? gapScenario({ category }) : coveredScenario({ category }),
    );
    const result = buildQualificationReadiness({ record: { candidateSha: 'abc123', scenarios } });
    expect(result.ready).toBe(true);
    expect(result.detail.gapCategories).toEqual(['b2-failure']);
  });

  it('blocks on an incomplete record', () => {
    const result = buildQualificationReadiness({ record: allCategoriesRecord({ candidateSha: '' }) });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('qualification_record_incomplete');
  });

  it('blocks on a null record without throwing', () => {
    expect(() => buildQualificationReadiness({ record: null })).not.toThrow();
    const result = buildQualificationReadiness({ record: null });
    expect(result.ready).toBe(false);
  });
});

describe('main() CLI (fails closed instead of throwing on bad input)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'photo-qualification-'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('requires --record', () => {
    expect(main([])).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('fails closed on a nonexistent --record file', () => {
    const result = main(['--record', path.join(tmpDir, 'nope.json')]);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('fails closed on invalid JSON in --record', () => {
    const bad = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(bad, 'not json');
    const result = main(['--record', bad]);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('runs end-to-end against a real temp file and exits 0 when ready', () => {
    const recordPath = path.join(tmpDir, 'record.json');
    fs.writeFileSync(recordPath, JSON.stringify(allCategoriesRecord()));
    const result = main(['--record', recordPath]);
    expect(result.ready).toBe(true);
    expect(process.exitCode).toBe(0);
  });

  it('exits 1 end-to-end on a record missing a category', () => {
    const scenarios = REQUIRED_SCENARIO_CATEGORIES.filter((c) => c !== 'attribution').map((category) =>
      coveredScenario({ category }),
    );
    const recordPath = path.join(tmpDir, 'record.json');
    fs.writeFileSync(recordPath, JSON.stringify({ candidateSha: 'abc123', scenarios }));
    const result = main(['--record', recordPath]);
    expect(result.ready).toBe(false);
    expect(process.exitCode).toBe(1);
  });
});
