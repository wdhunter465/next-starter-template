import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  QA_ROW_STATUSES,
  buildCrossRouteQaReadiness,
  main,
  validateCrossRouteQaRecord,
  validateQaRowItem,
} from '../scripts/ci/production_content_cross_route_qa.mjs';

function verifiedRow(overrides = {}) {
  return {
    matrixId: 'P-03',
    status: 'verified-safe-fallback',
    testFile: 'tests/homepage-sections-empty-state.test.tsx',
    testName: 'shows "No matchup available this week." instead of crashing or rendering a partial matchup',
    ...overrides,
  };
}

function deferredRow(overrides = {}) {
  return {
    matrixId: 'F-02',
    status: 'deferred',
    owner: 'Editorial',
    releaseCondition: '#2907/#2908 club-home content population',
    ...overrides,
  };
}

function compliantRecord(overrides = {}) {
  return {
    matrixSourceSha: '00e1608adb8ff27b24eae2fa995372e79c2ab8eb',
    rows: [verifiedRow(), deferredRow()],
    ...overrides,
  };
}

describe('validateQaRowItem', () => {
  it('accepts a verified-safe-fallback row with test evidence', () => {
    expect(validateQaRowItem(verifiedRow())).toEqual([]);
  });

  it('accepts a deferred row with owner and release condition', () => {
    expect(validateQaRowItem(deferredRow())).toEqual([]);
  });

  it('flags a verified row missing testFile or testName', () => {
    const problems = validateQaRowItem(verifiedRow({ testFile: '', testName: undefined }));
    expect(problems).toContain('missing_or_empty:testFile');
    expect(problems).toContain('missing_or_empty:testName');
  });

  it('flags a deferred row missing owner or releaseCondition', () => {
    const problems = validateQaRowItem(deferredRow({ owner: '', releaseCondition: undefined }));
    expect(problems).toContain('missing_or_empty:owner');
    expect(problems).toContain('missing_or_empty:releaseCondition');
  });

  it('flags a missing matrixId', () => {
    expect(validateQaRowItem(verifiedRow({ matrixId: '' }))).toContain('missing_or_empty:matrixId');
  });

  it('flags a missing or invalid status', () => {
    expect(validateQaRowItem(verifiedRow({ status: 'maybe' }))).toContain('missing_or_invalid:status');
  });

  it('fails closed on a non-object or array item instead of throwing', () => {
    expect(validateQaRowItem(null)).toEqual(['row_not_an_object']);
    expect(validateQaRowItem(['x'])).toEqual(['row_not_an_object']);
  });

  it('covers exactly the two defined statuses', () => {
    expect(QA_ROW_STATUSES).toEqual(['verified-safe-fallback', 'deferred']);
  });
});

describe('validateCrossRouteQaRecord', () => {
  it('accepts a compliant record with all required matrix IDs present', () => {
    const problems = validateCrossRouteQaRecord(compliantRecord(), { requiredMatrixIds: ['P-03', 'F-02'] });
    expect(problems).toEqual([]);
  });

  it('flags a missing matrixSourceSha', () => {
    expect(validateCrossRouteQaRecord(compliantRecord({ matrixSourceSha: '' }))).toContain(
      'missing_or_empty:matrixSourceSha',
    );
  });

  it('flags a missing or empty rows array', () => {
    expect(validateCrossRouteQaRecord(compliantRecord({ rows: [] }))).toContain('rows_missing_or_empty');
  });

  it('flags every required matrix ID silently missing from rows — the "no dropped row" invariant', () => {
    const problems = validateCrossRouteQaRecord(compliantRecord(), {
      requiredMatrixIds: ['P-03', 'F-02', 'X-01', 'A-05'],
    });
    expect(problems).toContain('missing_matrix_id:X-01');
    expect(problems).toContain('missing_matrix_id:A-05');
  });

  it('reports per-row problems indexed by position', () => {
    const record = compliantRecord({ rows: [verifiedRow({ testName: '' }), deferredRow()] });
    const problems = validateCrossRouteQaRecord(record, { requiredMatrixIds: [] });
    expect(problems).toContain('rows[0]:missing_or_empty:testName');
  });

  it('fails closed on a non-object or array record instead of throwing', () => {
    expect(validateCrossRouteQaRecord(null)).toEqual(['qa_record_not_an_object']);
    expect(validateCrossRouteQaRecord(['x'])).toEqual(['qa_record_not_an_object']);
  });
});

describe('buildCrossRouteQaReadiness', () => {
  it('is ready when every required row has an explicit disposition', () => {
    const result = buildCrossRouteQaReadiness({
      record: compliantRecord(),
      requiredMatrixIds: ['P-03', 'F-02'],
    });
    expect(result.ready).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.detail.deferredMatrixIds).toEqual(['F-02']);
  });

  it('blocks on an incomplete record', () => {
    const result = buildCrossRouteQaReadiness({ record: compliantRecord({ matrixSourceSha: '' }), requiredMatrixIds: [] });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('qa_record_incomplete');
  });

  it('blocks when a required matrix row is silently missing', () => {
    const result = buildCrossRouteQaReadiness({
      record: compliantRecord(),
      requiredMatrixIds: ['P-03', 'F-02', 'X-01'],
    });
    expect(result.ready).toBe(false);
    expect(result.detail.qaRecordProblems).toContain('missing_matrix_id:X-01');
  });

  it('blocks on a null record without throwing', () => {
    expect(() => buildCrossRouteQaReadiness({ record: null, requiredMatrixIds: [] })).not.toThrow();
    const result = buildCrossRouteQaReadiness({ record: null, requiredMatrixIds: [] });
    expect(result.ready).toBe(false);
  });

  it('blocks with missing_required_matrix_ids when requiredMatrixIds is empty, even with a fully compliant record — the closed false-ready-by-omission gap', () => {
    const result = buildCrossRouteQaReadiness({ record: compliantRecord(), requiredMatrixIds: [] });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('missing_required_matrix_ids');
  });

  it('blocks with missing_required_matrix_ids when requiredMatrixIds is not an array', () => {
    const result = buildCrossRouteQaReadiness({ record: compliantRecord(), requiredMatrixIds: undefined });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('missing_required_matrix_ids');
  });
});

describe('main() CLI (fails closed instead of throwing on bad input)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cross-route-qa-'));
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

  it('fails closed when --required-ids-file is omitted, even with a fully compliant record', () => {
    const recordPath = path.join(tmpDir, 'record.json');
    fs.writeFileSync(recordPath, JSON.stringify(compliantRecord()));
    const result = main(['--record', recordPath]);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('fails closed when --required-ids-file points at an empty/nonexistent file', () => {
    const recordPath = path.join(tmpDir, 'record.json');
    const idsPath = path.join(tmpDir, 'empty-ids.txt');
    fs.writeFileSync(recordPath, JSON.stringify(compliantRecord()));
    fs.writeFileSync(idsPath, '');
    const result = main(['--record', recordPath, '--required-ids-file', idsPath]);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('runs end-to-end against a real temp file and exits 0 when ready (with a required-ids file covering every row)', () => {
    const recordPath = path.join(tmpDir, 'record.json');
    const idsPath = path.join(tmpDir, 'ids.txt');
    fs.writeFileSync(recordPath, JSON.stringify(compliantRecord()));
    fs.writeFileSync(idsPath, 'P-03\nF-02\n');
    const result = main(['--record', recordPath, '--required-ids-file', idsPath]);
    expect(result.ready).toBe(true);
    expect(process.exitCode).toBe(0);
  });

  it('runs end-to-end with a required-ids file and exits 1 when a row is missing', () => {
    const recordPath = path.join(tmpDir, 'record.json');
    const idsPath = path.join(tmpDir, 'ids.txt');
    fs.writeFileSync(recordPath, JSON.stringify(compliantRecord()));
    fs.writeFileSync(idsPath, 'P-03\nF-02\nX-01\n');
    const result = main(['--record', recordPath, '--required-ids-file', idsPath]);
    expect(result.ready).toBe(false);
    expect(process.exitCode).toBe(1);
  });
});
