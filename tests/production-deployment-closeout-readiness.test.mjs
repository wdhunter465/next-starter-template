import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  REQUIRED_CLOSEOUT_FIELDS,
  buildCloseoutReadiness,
  main,
  validateCloseoutRecord,
} from '../scripts/ci/production_deployment_closeout_readiness.mjs';

function compliantCloseout(overrides = {}) {
  const closeout = {};
  for (const field of REQUIRED_CLOSEOUT_FIELDS) {
    closeout[field] = `evidence for ${field}`;
  }
  return { ...closeout, ...overrides };
}

const readySmokeResult = { ready: true, blockers: [], detail: {} };
const notReadySmokeResult = { ready: false, blockers: ['critical_smoke_test_failure'], detail: {} };

describe('validateCloseoutRecord', () => {
  it('accepts a closeout record with every required field populated', () => {
    expect(validateCloseoutRecord(compliantCloseout())).toEqual([]);
  });

  it('flags every missing or empty required field', () => {
    const problems = validateCloseoutRecord(
      compliantCloseout({ day2OwnershipEvidence: '', productAcceptanceEvidence: undefined }),
    );
    expect(problems).toContain('missing_or_empty:day2OwnershipEvidence');
    expect(problems).toContain('missing_or_empty:productAcceptanceEvidence');
  });

  it('flags a whitespace-only field as missing', () => {
    expect(validateCloseoutRecord(compliantCloseout({ monitoringActiveEvidence: '   ' }))).toContain(
      'missing_or_empty:monitoringActiveEvidence',
    );
  });

  it('fails closed on a non-object closeout record instead of throwing', () => {
    expect(validateCloseoutRecord(null)).toEqual(['closeout_not_an_object']);
    expect(validateCloseoutRecord('x')).toEqual(['closeout_not_an_object']);
  });

  it('covers every element #2933 requires', () => {
    expect(REQUIRED_CLOSEOUT_FIELDS).toEqual([
      'publicBehaviorAcceptanceEvidence',
      'noOpenLaunchBlockerEvidence',
      'recoveryActiveEvidence',
      'monitoringActiveEvidence',
      'productAcceptanceEvidence',
      'day2OwnershipEvidence',
      'issuePrReleaseEvidenceConsistency',
    ]);
  });
});

describe('buildCloseoutReadiness', () => {
  it('is ready when the closeout record is complete and the smoke-verification result is itself ready', () => {
    const result = buildCloseoutReadiness({
      closeout: compliantCloseout(),
      smokeVerificationResult: readySmokeResult,
    });
    expect(result.ready).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('blocks on an incomplete closeout record', () => {
    const result = buildCloseoutReadiness({
      closeout: compliantCloseout({ recoveryActiveEvidence: '' }),
      smokeVerificationResult: readySmokeResult,
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('closeout_incomplete');
  });

  it('blocks on a null closeout record without throwing', () => {
    expect(() => buildCloseoutReadiness({ closeout: null, smokeVerificationResult: readySmokeResult })).not.toThrow();
    const result = buildCloseoutReadiness({ closeout: null, smokeVerificationResult: readySmokeResult });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('closeout_incomplete');
  });

  it('blocks when the upstream smoke-verification result is not ready', () => {
    const result = buildCloseoutReadiness({
      closeout: compliantCloseout(),
      smokeVerificationResult: notReadySmokeResult,
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('smoke_verification_not_ready');
  });

  it('fails closed when the smoke-verification result is missing entirely, rather than presuming it fine', () => {
    const result = buildCloseoutReadiness({ closeout: compliantCloseout(), smokeVerificationResult: undefined });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('smoke_verification_not_ready');
  });

  it('fails closed when the smoke-verification result is malformed (missing ready field)', () => {
    const result = buildCloseoutReadiness({
      closeout: compliantCloseout(),
      smokeVerificationResult: { blockers: [] },
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('smoke_verification_not_ready');
  });

  it('blocks on unresolved protected decisions being present', () => {
    const result = buildCloseoutReadiness({
      closeout: compliantCloseout(),
      smokeVerificationResult: readySmokeResult,
      unresolvedProtectedDecisions: ['decision-1'],
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('unresolved_protected_decisions_present');
  });

  it('fails closed on a non-array unresolvedProtectedDecisions value', () => {
    const result = buildCloseoutReadiness({
      closeout: compliantCloseout(),
      smokeVerificationResult: readySmokeResult,
      unresolvedProtectedDecisions: 'not-an-array',
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('unresolved_protected_decisions_malformed');
  });

  it('reports multiple blockers simultaneously when several conditions fail', () => {
    const result = buildCloseoutReadiness({
      closeout: compliantCloseout({ day2OwnershipEvidence: '' }),
      smokeVerificationResult: notReadySmokeResult,
      unresolvedProtectedDecisions: ['decision-1'],
    });
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        'closeout_incomplete',
        'smoke_verification_not_ready',
        'unresolved_protected_decisions_present',
      ]),
    );
  });
});

describe('main() CLI (fails closed instead of throwing on bad input)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'closeout-readiness-'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('requires --closeout', () => {
    const smokeResultPath = path.join(tmpDir, 'smoke.json');
    fs.writeFileSync(smokeResultPath, JSON.stringify(readySmokeResult));
    expect(main(['--smoke-result', smokeResultPath])).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('requires --smoke-result', () => {
    const closeoutPath = path.join(tmpDir, 'closeout.json');
    fs.writeFileSync(closeoutPath, JSON.stringify(compliantCloseout()));
    expect(main(['--closeout', closeoutPath])).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('fails closed when --closeout is present but has no value', () => {
    const smokeResultPath = path.join(tmpDir, 'smoke.json');
    fs.writeFileSync(smokeResultPath, JSON.stringify(readySmokeResult));
    const result = main(['--closeout', '--smoke-result', smokeResultPath]);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('fails closed when --unresolved-decisions is present but has no value', () => {
    const closeoutPath = path.join(tmpDir, 'closeout.json');
    const smokeResultPath = path.join(tmpDir, 'smoke.json');
    fs.writeFileSync(closeoutPath, JSON.stringify(compliantCloseout()));
    fs.writeFileSync(smokeResultPath, JSON.stringify(readySmokeResult));
    const result = main(['--closeout', closeoutPath, '--smoke-result', smokeResultPath, '--unresolved-decisions']);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('fails closed on a nonexistent --closeout file', () => {
    const smokeResultPath = path.join(tmpDir, 'smoke.json');
    fs.writeFileSync(smokeResultPath, JSON.stringify(readySmokeResult));
    const result = main(['--closeout', path.join(tmpDir, 'nope.json'), '--smoke-result', smokeResultPath]);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('fails closed on invalid JSON in --smoke-result', () => {
    const closeoutPath = path.join(tmpDir, 'closeout.json');
    const badSmokeResult = path.join(tmpDir, 'bad-smoke.json');
    fs.writeFileSync(closeoutPath, JSON.stringify(compliantCloseout()));
    fs.writeFileSync(badSmokeResult, 'not json');
    const result = main(['--closeout', closeoutPath, '--smoke-result', badSmokeResult]);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('runs end-to-end against real temp files and exits 0 when ready', () => {
    const closeoutPath = path.join(tmpDir, 'closeout.json');
    const smokeResultPath = path.join(tmpDir, 'smoke.json');
    fs.writeFileSync(closeoutPath, JSON.stringify(compliantCloseout()));
    fs.writeFileSync(smokeResultPath, JSON.stringify(readySmokeResult));
    const result = main(['--closeout', closeoutPath, '--smoke-result', smokeResultPath]);
    expect(result.ready).toBe(true);
    expect(process.exitCode).toBe(0);
  });

  it('exits 1 end-to-end when the upstream smoke-verification result is not ready', () => {
    const closeoutPath = path.join(tmpDir, 'closeout.json');
    const smokeResultPath = path.join(tmpDir, 'smoke.json');
    fs.writeFileSync(closeoutPath, JSON.stringify(compliantCloseout()));
    fs.writeFileSync(smokeResultPath, JSON.stringify(notReadySmokeResult));
    const result = main(['--closeout', closeoutPath, '--smoke-result', smokeResultPath]);
    expect(result.ready).toBe(false);
    expect(process.exitCode).toBe(1);
  });

  it('resets the exit code to 0 on a later successful call after an earlier failing call in the same process', () => {
    main(['--closeout', path.join(tmpDir, 'nope.json'), '--smoke-result', path.join(tmpDir, 'nope2.json')]);
    expect(process.exitCode).toBe(1);

    const closeoutPath = path.join(tmpDir, 'closeout.json');
    const smokeResultPath = path.join(tmpDir, 'smoke.json');
    fs.writeFileSync(closeoutPath, JSON.stringify(compliantCloseout()));
    fs.writeFileSync(smokeResultPath, JSON.stringify(readySmokeResult));
    const result = main(['--closeout', closeoutPath, '--smoke-result', smokeResultPath]);
    expect(result.ready).toBe(true);
    expect(process.exitCode).toBe(0);
  });
});
