import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ENTRY_CRITERION_STATUSES,
  REQUIRED_ENTRY_RECORD_FIELDS,
  buildEntryReadiness,
  main,
  validateEntryCriterionItem,
  validateEntryRecord,
} from '../scripts/ci/launch_rehearsal_entry_criteria.mjs';

function satisfiedCriterion(overrides = {}) {
  return {
    name: 'candidate build reproducible',
    status: 'satisfied',
    evidence: 'CI build log link',
    ...overrides,
  };
}

function deferredCriterion(overrides = {}) {
  return {
    name: 'monitoring dashboards wired',
    status: 'deferred',
    owner: 'ops-lead',
    releaseCondition: '#2780 acceptance',
    ...overrides,
  };
}

function compliantRecord(overrides = {}) {
  const record = {};
  for (const field of REQUIRED_ENTRY_RECORD_FIELDS) {
    record[field] = `evidence for ${field}`;
  }
  record.entryCriteria = [satisfiedCriterion(), deferredCriterion()];
  return { ...record, ...overrides };
}

describe('validateEntryCriterionItem', () => {
  it('accepts a satisfied criterion with evidence', () => {
    expect(validateEntryCriterionItem(satisfiedCriterion())).toEqual([]);
  });

  it('accepts a deferred criterion with owner and release condition', () => {
    expect(validateEntryCriterionItem(deferredCriterion())).toEqual([]);
  });

  it('flags a satisfied criterion missing evidence', () => {
    expect(validateEntryCriterionItem(satisfiedCriterion({ evidence: '' }))).toContain(
      'missing_or_empty:evidence',
    );
  });

  it('flags a deferred criterion missing owner or release condition', () => {
    const problems = validateEntryCriterionItem(deferredCriterion({ owner: '', releaseCondition: undefined }));
    expect(problems).toContain('missing_or_empty:owner');
    expect(problems).toContain('missing_or_empty:releaseCondition');
  });

  it('flags a missing or invalid status', () => {
    expect(validateEntryCriterionItem(satisfiedCriterion({ status: 'maybe' }))).toContain(
      'missing_or_invalid:status',
    );
    expect(validateEntryCriterionItem(satisfiedCriterion({ status: undefined }))).toContain(
      'missing_or_invalid:status',
    );
  });

  it('flags a missing name', () => {
    expect(validateEntryCriterionItem(satisfiedCriterion({ name: '' }))).toContain('missing_or_empty:name');
  });

  it('fails closed on a non-object criterion instead of throwing', () => {
    expect(validateEntryCriterionItem(null)).toEqual(['criterion_not_an_object']);
    expect(validateEntryCriterionItem('x')).toEqual(['criterion_not_an_object']);
  });

  it('rejects an array as not-an-object, instead of cascading through as a valid criterion (typeof [] === "object")', () => {
    expect(validateEntryCriterionItem(['not', 'a', 'criterion'])).toEqual(['criterion_not_an_object']);
  });

  it('covers exactly satisfied and deferred as the valid statuses', () => {
    expect(ENTRY_CRITERION_STATUSES).toEqual(['satisfied', 'deferred']);
  });
});

describe('validateEntryRecord', () => {
  it('accepts a fully compliant entry-criteria record', () => {
    expect(validateEntryRecord(compliantRecord())).toEqual([]);
  });

  it('flags every missing or empty required top-level field', () => {
    const problems = validateEntryRecord(compliantRecord({ recoveryOwner: '', cleanupPlan: undefined }));
    expect(problems).toContain('missing_or_empty:recoveryOwner');
    expect(problems).toContain('missing_or_empty:cleanupPlan');
  });

  it('covers every element #2926 requires', () => {
    expect(REQUIRED_ENTRY_RECORD_FIELDS).toEqual([
      'candidateIdentity',
      'environmentIdentity',
      'testDataPlan',
      'executorRole',
      'verifierRole',
      'recoveryOwner',
      'cleanupPlan',
      'productionDataExclusionEvidence',
    ]);
  });

  it('flags a missing entryCriteria array', () => {
    const record = compliantRecord();
    delete record.entryCriteria;
    expect(validateEntryRecord(record)).toContain('entry_criteria_missing_or_empty');
  });

  it('flags an empty entryCriteria array', () => {
    expect(validateEntryRecord(compliantRecord({ entryCriteria: [] }))).toContain(
      'entry_criteria_missing_or_empty',
    );
  });

  it('reports per-item problems indexed by position — the "silently dropped gap" case', () => {
    const record = compliantRecord({
      entryCriteria: [satisfiedCriterion(), satisfiedCriterion({ evidence: '' })],
    });
    const problems = validateEntryRecord(record);
    expect(problems).toContain('entryCriteria[1]:missing_or_empty:evidence');
  });

  it('fails closed on a non-object record instead of throwing', () => {
    expect(validateEntryRecord(null)).toEqual(['entry_record_not_an_object']);
    expect(validateEntryRecord('x')).toEqual(['entry_record_not_an_object']);
  });

  it('rejects an array as not-an-object, instead of cascading through as a valid record (typeof [] === "object")', () => {
    expect(validateEntryRecord(['not', 'a', 'record'])).toEqual(['entry_record_not_an_object']);
  });
});

describe('buildEntryReadiness', () => {
  it('is ready when the record is fully compliant', () => {
    const result = buildEntryReadiness({ record: compliantRecord() });
    expect(result.ready).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('blocks on an incomplete record', () => {
    const result = buildEntryReadiness({ record: compliantRecord({ executorRole: '' }) });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('entry_record_incomplete');
  });

  it('blocks on a null record without throwing', () => {
    expect(() => buildEntryReadiness({ record: null })).not.toThrow();
    const result = buildEntryReadiness({ record: null });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('entry_record_incomplete');
  });

  it('blocks when a criterion is neither satisfied-with-evidence nor deferred-with-disposition', () => {
    const record = compliantRecord({
      entryCriteria: [{ name: 'orphan criterion', status: 'satisfied' }],
    });
    const result = buildEntryReadiness({ record });
    expect(result.ready).toBe(false);
    expect(result.detail.entryRecordProblems).toContain('entryCriteria[0]:missing_or_empty:evidence');
  });
});

describe('main() CLI (fails closed instead of throwing on bad input)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'entry-criteria-'));
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

  it('fails closed when --record is present but has no value', () => {
    const result = main(['--record']);
    expect(result).toBeNull();
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
    fs.writeFileSync(recordPath, JSON.stringify(compliantRecord()));
    const result = main(['--record', recordPath]);
    expect(result.ready).toBe(true);
    expect(process.exitCode).toBe(0);
  });

  it('exits 1 end-to-end on an incomplete record', () => {
    const recordPath = path.join(tmpDir, 'record.json');
    fs.writeFileSync(recordPath, JSON.stringify(compliantRecord({ entryCriteria: [] })));
    const result = main(['--record', recordPath]);
    expect(result.ready).toBe(false);
    expect(process.exitCode).toBe(1);
  });

  it('resets the exit code to 0 on a later successful call after an earlier failing call in the same process', () => {
    main(['--record', path.join(tmpDir, 'nope.json')]);
    expect(process.exitCode).toBe(1);

    const recordPath = path.join(tmpDir, 'record.json');
    fs.writeFileSync(recordPath, JSON.stringify(compliantRecord()));
    const result = main(['--record', recordPath]);
    expect(result.ready).toBe(true);
    expect(process.exitCode).toBe(0);
  });
});
