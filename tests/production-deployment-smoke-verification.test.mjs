import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  REQUIRED_SMOKE_TEST_CATEGORIES,
  SMOKE_TEST_RESULTS,
  buildSmokeVerificationReadiness,
  main,
  validateSmokeTestRecord,
  validateSmokeTestSuite,
} from '../scripts/ci/production_deployment_smoke_verification.mjs';

function compliantRecord(overrides = {}) {
  return {
    category: 'public',
    result: 'pass',
    evidence: 'evidence for public smoke test',
    deployedCandidateSha: 'sha-deploy',
    ...overrides,
  };
}

function compliantSuite(overrides = {}) {
  const suite = REQUIRED_SMOKE_TEST_CATEGORIES.map((category) =>
    compliantRecord({ category, evidence: `evidence for ${category}` }),
  );
  return overrides.records ? overrides.records : suite;
}

describe('validateSmokeTestRecord', () => {
  it('accepts a fully compliant record', () => {
    expect(validateSmokeTestRecord(compliantRecord())).toEqual([]);
  });

  it('flags every missing or empty required field', () => {
    const problems = validateSmokeTestRecord(compliantRecord({ evidence: '', deployedCandidateSha: undefined }));
    expect(problems).toContain('missing_or_empty:evidence');
    expect(problems).toContain('missing_or_empty:deployedCandidateSha');
  });

  it('flags a whitespace-only field as missing', () => {
    expect(validateSmokeTestRecord(compliantRecord({ evidence: '   ' }))).toContain('missing_or_empty:evidence');
  });

  it('fails closed on a non-object record instead of throwing', () => {
    expect(validateSmokeTestRecord(null)).toEqual(['record_not_an_object']);
    expect(validateSmokeTestRecord('x')).toEqual(['record_not_an_object']);
  });

  it('flags an unknown category', () => {
    expect(validateSmokeTestRecord(compliantRecord({ category: 'not_a_real_category' }))).toContain(
      'unknown_category:not_a_real_category',
    );
  });

  it('flags an unknown result value', () => {
    expect(validateSmokeTestRecord(compliantRecord({ result: 'maybe' }))).toContain('unknown_result:maybe');
  });

  it('covers every category #2932 requires', () => {
    expect(REQUIRED_SMOKE_TEST_CATEGORIES).toEqual([
      'public',
      'auth_member',
      'content_data_media',
      'email_fundraiser_state',
      'monitoring',
      'failure_behavior',
    ]);
  });

  it('accepts exactly the three defined result values', () => {
    expect(SMOKE_TEST_RESULTS).toEqual(['pass', 'fail', 'stop_rollback_activated']);
  });
});

describe('validateSmokeTestSuite', () => {
  it('accepts a suite with every required category present and a single agreed candidate SHA', () => {
    const { problems, agreedCandidateSha } = validateSmokeTestSuite(compliantSuite());
    expect(problems).toEqual([]);
    expect(agreedCandidateSha).toBe('sha-deploy');
  });

  it('fails closed on a non-array suite instead of throwing', () => {
    expect(validateSmokeTestSuite(null).problems).toEqual(['smoke_suite_not_an_array']);
    expect(validateSmokeTestSuite({}).problems).toEqual(['smoke_suite_not_an_array']);
  });

  it('flags every missing required category', () => {
    const suite = compliantSuite().filter((record) => record.category !== 'monitoring');
    expect(validateSmokeTestSuite(suite).problems).toContain('missing_category:monitoring');
  });

  it('flags disagreement in deployedCandidateSha across records — the "no changed candidate" invariant', () => {
    const suite = compliantSuite();
    suite[0] = { ...suite[0], deployedCandidateSha: 'sha-different' };
    const { problems, agreedCandidateSha } = validateSmokeTestSuite(suite);
    expect(problems).toContain('deployed_candidate_identity_mismatch');
    expect(agreedCandidateSha).toBeNull();
  });

  it('tolerates a malformed entry without throwing and reports it by index', () => {
    const suite = [...compliantSuite(), null];
    const { problems } = validateSmokeTestSuite(suite);
    expect(problems.some((problem) => problem.startsWith('record[6]:'))).toBe(true);
  });
});

describe('buildSmokeVerificationReadiness', () => {
  it('is ready when the suite is complete, identities agree, and there is no manifest to cross-check', () => {
    const result = buildSmokeVerificationReadiness({ records: compliantSuite() });
    expect(result.ready).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('is ready when the agreed candidate SHA matches the supplied deployment candidate SHA', () => {
    const result = buildSmokeVerificationReadiness({
      records: compliantSuite(),
      deploymentCandidateSha: 'sha-deploy',
      manifestProvided: true,
    });
    expect(result.ready).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('blocks on an incomplete suite', () => {
    const suite = compliantSuite().filter((record) => record.category !== 'public');
    const result = buildSmokeVerificationReadiness({ records: suite });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('smoke_suite_incomplete');
  });

  it('blocks on a null records value without throwing', () => {
    expect(() => buildSmokeVerificationReadiness({ records: null })).not.toThrow();
    const result = buildSmokeVerificationReadiness({ records: null });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('smoke_suite_incomplete');
  });

  it('fails closed when a manifest was supplied but carries no usable candidateSha', () => {
    const result = buildSmokeVerificationReadiness({
      records: compliantSuite(),
      deploymentCandidateSha: undefined,
      manifestProvided: true,
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(['manifest_candidate_sha_missing_or_invalid']);
  });

  it('blocks when the deployed candidate does not match the manifest candidate', () => {
    const result = buildSmokeVerificationReadiness({
      records: compliantSuite(),
      deploymentCandidateSha: 'sha-manifest-candidate',
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('deployed_candidate_does_not_match_manifest_candidate');
  });

  it('blocks on an unhandled critical smoke-test failure', () => {
    const suite = compliantSuite().map((record) =>
      record.category === 'monitoring' ? { ...record, result: 'fail' } : record,
    );
    const result = buildSmokeVerificationReadiness({ records: suite });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('critical_smoke_test_failure');
    expect(result.detail.unhandledFailureCategories).toEqual(['monitoring']);
  });

  it('does not block when a failure is handled by stop/rollback activating', () => {
    const suite = compliantSuite().map((record) =>
      record.category === 'failure_behavior' ? { ...record, result: 'stop_rollback_activated' } : record,
    );
    const result = buildSmokeVerificationReadiness({ records: suite });
    expect(result.blockers).not.toContain('critical_smoke_test_failure');
  });

  it('reports multiple blockers simultaneously when several conditions fail', () => {
    const suite = compliantSuite()
      .filter((record) => record.category !== 'public')
      .map((record) => (record.category === 'monitoring' ? { ...record, result: 'fail' } : record));
    const result = buildSmokeVerificationReadiness({ records: suite });
    expect(result.blockers).toEqual(
      expect.arrayContaining(['smoke_suite_incomplete', 'critical_smoke_test_failure']),
    );
  });
});

describe('main() CLI (fails closed instead of throwing on bad input)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smoke-verification-'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('requires --records', () => {
    expect(main([])).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('fails closed when --records is present but has no value', () => {
    const result = main(['--records']);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('fails closed on a nonexistent --records file', () => {
    const result = main(['--records', path.join(tmpDir, 'nope.json')]);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('fails closed on invalid JSON in --records', () => {
    const bad = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(bad, 'not json');
    const result = main(['--records', bad]);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('fails closed when --manifest is present but has no value', () => {
    const recordsPath = path.join(tmpDir, 'records.json');
    fs.writeFileSync(recordsPath, JSON.stringify(compliantSuite()));
    const result = main(['--records', recordsPath, '--manifest']);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('fails closed on invalid JSON in --manifest', () => {
    const recordsPath = path.join(tmpDir, 'records.json');
    fs.writeFileSync(recordsPath, JSON.stringify(compliantSuite()));
    const badManifest = path.join(tmpDir, 'bad-manifest.json');
    fs.writeFileSync(badManifest, 'not json');
    const result = main(['--records', recordsPath, '--manifest', badManifest]);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('fails closed end-to-end when --manifest is given but the file omits candidateSha', () => {
    const recordsPath = path.join(tmpDir, 'records.json');
    const manifestPath = path.join(tmpDir, 'manifest.json');
    fs.writeFileSync(recordsPath, JSON.stringify(compliantSuite()));
    fs.writeFileSync(manifestPath, JSON.stringify({ someOtherField: 'value' }));
    const result = main(['--records', recordsPath, '--manifest', manifestPath]);
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('manifest_candidate_sha_missing_or_invalid');
    expect(process.exitCode).toBe(1);
  });

  it('runs end-to-end against real temp files and exits 0 when ready', () => {
    const recordsPath = path.join(tmpDir, 'records.json');
    const manifestPath = path.join(tmpDir, 'manifest.json');
    fs.writeFileSync(recordsPath, JSON.stringify(compliantSuite()));
    fs.writeFileSync(manifestPath, JSON.stringify({ candidateSha: 'sha-deploy' }));
    const result = main(['--records', recordsPath, '--manifest', manifestPath]);
    expect(result.ready).toBe(true);
    expect(process.exitCode).toBe(0);
  });

  it('exits 1 end-to-end when the manifest candidateSha does not match the suite identity', () => {
    const recordsPath = path.join(tmpDir, 'records.json');
    const manifestPath = path.join(tmpDir, 'manifest.json');
    fs.writeFileSync(recordsPath, JSON.stringify(compliantSuite()));
    fs.writeFileSync(manifestPath, JSON.stringify({ candidateSha: 'sha-not-deployed' }));
    const result = main(['--records', recordsPath, '--manifest', manifestPath]);
    expect(result.ready).toBe(false);
    expect(process.exitCode).toBe(1);
  });

  it('resets the exit code to 0 on a later successful call after an earlier failing call in the same process', () => {
    main(['--records', path.join(tmpDir, 'nope.json')]);
    expect(process.exitCode).toBe(1);

    const recordsPath = path.join(tmpDir, 'records.json');
    fs.writeFileSync(recordsPath, JSON.stringify(compliantSuite()));
    const result = main(['--records', recordsPath]);
    expect(result.ready).toBe(true);
    expect(process.exitCode).toBe(0);
  });
});
