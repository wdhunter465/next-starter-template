import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  DEFECT_DISPOSITIONS,
  DEFECT_SEVERITIES,
  auditRetestCoverage,
  main,
  validateDefectRecord,
  validateLedger,
} from '../scripts/ci/launch_rehearsal_defect_ledger.mjs';

function baseDefect(overrides = {}) {
  return {
    id: 'd1',
    journeyId: 'anon-home-browse',
    severity: 'major',
    summary: 'Home page returned 500 under synthetic load.',
    disposition: 'resolved',
    candidateSha: 'sha-a',
    evidenceRef: 'evidence-log entry 12',
    ...overrides,
  };
}

describe('validateDefectRecord', () => {
  it('accepts a fully-compliant resolved defect', () => {
    expect(validateDefectRecord(baseDefect())).toEqual([]);
  });

  it('flags every missing or empty required field', () => {
    const problems = validateDefectRecord(baseDefect({ summary: '', journeyId: undefined }));
    expect(problems).toContain('missing_or_empty:summary');
    expect(problems).toContain('missing_or_empty:journeyId');
  });

  it('flags an unapproved severity', () => {
    expect(validateDefectRecord(baseDefect({ severity: 'catastrophic' }))).toContain('unapproved_severity:catastrophic');
  });

  it('flags an unapproved disposition', () => {
    expect(validateDefectRecord(baseDefect({ disposition: 'ignored' }))).toContain('unapproved_disposition:ignored');
  });

  it('requires evidenceRef for a resolved defect', () => {
    const problems = validateDefectRecord(baseDefect({ evidenceRef: undefined }));
    expect(problems).toContain('resolved_or_accepted_defect_missing_evidenceRef');
  });

  it('requires evidenceRef for a formally-dispositioned-accepted-risk defect', () => {
    const problems = validateDefectRecord(
      baseDefect({ disposition: 'formally-dispositioned-accepted-risk', evidenceRef: undefined }),
    );
    expect(problems).toContain('resolved_or_accepted_defect_missing_evidenceRef');
  });

  it('does not require evidenceRef for a requires-retest defect', () => {
    const problems = validateDefectRecord(baseDefect({ disposition: 'requires-retest', evidenceRef: undefined }));
    expect(problems).not.toContain('resolved_or_accepted_defect_missing_evidenceRef');
  });

  it('requires deferredOwner for a deferred-with-owner defect', () => {
    const problems = validateDefectRecord(
      baseDefect({ disposition: 'deferred-with-owner', evidenceRef: undefined, deferredOwner: undefined }),
    );
    expect(problems).toContain('deferred_defect_missing_deferredOwner');
  });

  it('accepts a deferred-with-owner defect that names an owner', () => {
    const problems = validateDefectRecord(
      baseDefect({ disposition: 'deferred-with-owner', evidenceRef: undefined, deferredOwner: 'Implementation / Operations' }),
    );
    expect(problems).toEqual([]);
  });

  it('fails closed on a non-object defect', () => {
    expect(validateDefectRecord(null)).toEqual(['defect_not_an_object']);
  });

  it('exposes the exact approved vocabularies', () => {
    expect(DEFECT_SEVERITIES).toEqual(['launch-blocker', 'major', 'minor']);
    expect(DEFECT_DISPOSITIONS).toEqual(['resolved', 'formally-dispositioned-accepted-risk', 'requires-retest', 'deferred-with-owner']);
  });
});

describe('validateLedger', () => {
  it('passes a ledger of fully-compliant defects', () => {
    const result = validateLedger({ defects: [baseDefect({ id: 'd1' }), baseDefect({ id: 'd2', disposition: 'requires-retest', evidenceRef: undefined })] });
    expect(result.ok).toBe(true);
    expect(result.defectCount).toBe(2);
  });

  it('reports per-defect problems without throwing on a malformed entry', () => {
    const result = validateLedger({ defects: [baseDefect(), null, { id: '' }] });
    expect(result.ok).toBe(false);
    expect(result.defectsWithProblems.length).toBe(2);
  });

  it('treats an empty/malformed ledger as zero defects, not a throw', () => {
    expect(validateLedger({}).defectCount).toBe(0);
    expect(validateLedger(null).defectCount).toBe(0);
  });
});

describe('auditRetestCoverage', () => {
  it('passes when every failing evidence entry has a matching defect record and every requires-retest defect has a later pass on a different candidate SHA', () => {
    const evidenceLog = [
      { journeyId: 'j1', result: 'fail', candidateSha: 'sha-a' },
      { journeyId: 'j1', result: 'pass', candidateSha: 'sha-b' },
    ];
    const ledger = { defects: [baseDefect({ journeyId: 'j1', candidateSha: 'sha-a', disposition: 'requires-retest', evidenceRef: undefined })] };
    const result = auditRetestCoverage(evidenceLog, ledger);
    expect(result.ok).toBe(true);
    expect(result.missingDefectRecord).toEqual([]);
    expect(result.uncoveredRetests).toEqual([]);
  });

  it('flags a failing evidence entry with no matching defect record', () => {
    const evidenceLog = [{ journeyId: 'j1', result: 'fail', candidateSha: 'sha-a' }];
    const result = auditRetestCoverage(evidenceLog, { defects: [] });
    expect(result.ok).toBe(false);
    expect(result.missingDefectRecord).toEqual(['j1@sha-a']);
  });

  it('flags a requires-retest defect with no later passing evidence on any candidate', () => {
    const ledger = { defects: [baseDefect({ journeyId: 'j1', candidateSha: 'sha-a', disposition: 'requires-retest', evidenceRef: undefined })] };
    const result = auditRetestCoverage([{ journeyId: 'j1', result: 'fail', candidateSha: 'sha-a' }], ledger);
    expect(result.ok).toBe(false);
    expect(result.uncoveredRetests).toEqual(['d1']);
  });

  it('flags a requires-retest defect whose only later pass is on the SAME candidate SHA — this is the hidden-candidate-drift case', () => {
    const evidenceLog = [
      { journeyId: 'j1', result: 'fail', candidateSha: 'sha-a' },
      { journeyId: 'j1', result: 'pass', candidateSha: 'sha-a' },
    ];
    const ledger = { defects: [baseDefect({ journeyId: 'j1', candidateSha: 'sha-a', disposition: 'requires-retest', evidenceRef: undefined })] };
    const result = auditRetestCoverage(evidenceLog, ledger);
    expect(result.ok).toBe(false);
    expect(result.uncoveredRetests).toEqual(['d1']);
  });

  it('does not require retest coverage for resolved/accepted-risk/deferred defects', () => {
    const ledger = { defects: [baseDefect({ journeyId: 'j1', candidateSha: 'sha-a', disposition: 'resolved' })] };
    const result = auditRetestCoverage([{ journeyId: 'j1', result: 'fail', candidateSha: 'sha-a' }], ledger);
    expect(result.uncoveredRetests).toEqual([]);
  });

  it('accepts an object-keyed evidence log without throwing on null/undefined values', () => {
    expect(() => auditRetestCoverage({ j1: null }, { defects: [] })).not.toThrow();
  });

  it('does not throw when ledger.defects contains null/non-object entries, and excludes them rather than crashing', () => {
    const evidenceLog = [{ journeyId: 'j1', result: 'fail', candidateSha: 'sha-a' }];
    const ledger = { defects: [null, undefined, 'not-an-object', baseDefect({ journeyId: 'j1', candidateSha: 'sha-a', disposition: 'resolved' })] };
    expect(() => auditRetestCoverage(evidenceLog, ledger)).not.toThrow();
    const result = auditRetestCoverage(evidenceLog, ledger);
    expect(result.ok).toBe(true);
    expect(result.defectCount).toBe(1);
  });

  it('does not throw when a requires-retest defect in the ledger is malformed, and reports "(missing id)" instead of crashing on defect.id', () => {
    const ledger = { defects: [null, { journeyId: 'j1', disposition: 'requires-retest', candidateSha: 'sha-a' }] };
    expect(() => auditRetestCoverage([{ journeyId: 'j1', result: 'fail', candidateSha: 'sha-a' }], ledger)).not.toThrow();
    const result = auditRetestCoverage([{ journeyId: 'j1', result: 'fail', candidateSha: 'sha-a' }], ledger);
    expect(result.uncoveredRetests).toEqual(['(missing id)']);
  });
});

describe('main() CLI (fails closed instead of throwing on bad input)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'defect-ledger-harness-'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('requires --ledger', () => {
    const result = main([]);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('fails closed on a nonexistent --ledger file', () => {
    const result = main(['--ledger', path.join(tmpDir, 'nope.json')]);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('fails closed on invalid JSON in --ledger', () => {
    const bad = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(bad, 'not json');
    const result = main(['--ledger', bad]);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('runs validate-ledger end-to-end against a real temp ledger file', () => {
    const ledgerPath = path.join(tmpDir, 'ledger.json');
    fs.writeFileSync(ledgerPath, JSON.stringify({ defects: [baseDefect()] }));
    const result = main(['--ledger', ledgerPath]);
    expect(result.ok).toBe(true);
    expect(process.exitCode).toBeUndefined();
  });

  it('requires --evidence for retest-coverage mode', () => {
    const ledgerPath = path.join(tmpDir, 'ledger.json');
    fs.writeFileSync(ledgerPath, JSON.stringify({ defects: [] }));
    const result = main(['--ledger', ledgerPath, '--mode', 'retest-coverage']);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('runs retest-coverage end-to-end against real temp files', () => {
    const ledgerPath = path.join(tmpDir, 'ledger.json');
    const evidencePath = path.join(tmpDir, 'evidence.json');
    fs.writeFileSync(
      ledgerPath,
      JSON.stringify({ defects: [baseDefect({ journeyId: 'j1', candidateSha: 'sha-a', disposition: 'requires-retest', evidenceRef: undefined })] }),
    );
    fs.writeFileSync(
      evidencePath,
      JSON.stringify([
        { journeyId: 'j1', result: 'fail', candidateSha: 'sha-a' },
        { journeyId: 'j1', result: 'pass', candidateSha: 'sha-b' },
      ]),
    );
    const result = main(['--ledger', ledgerPath, '--mode', 'retest-coverage', '--evidence', evidencePath]);
    expect(result.ok).toBe(true);
  });
});
