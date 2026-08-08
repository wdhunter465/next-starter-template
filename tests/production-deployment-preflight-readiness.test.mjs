import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  REQUIRED_PREFLIGHT_FIELDS,
  buildDeploymentReadiness,
  main,
  validatePreflightRecord,
} from '../scripts/ci/production_deployment_preflight_readiness.mjs';

function compliantPreflight(overrides = {}) {
  const preflight = {};
  for (const field of REQUIRED_PREFLIGHT_FIELDS) {
    preflight[field] = field === 'rollbackCandidateSha' ? 'sha-rollback' : `evidence for ${field}`;
  }
  return { ...preflight, ...overrides };
}

describe('validatePreflightRecord', () => {
  it('accepts a preflight record with every required field populated', () => {
    expect(validatePreflightRecord(compliantPreflight())).toEqual([]);
  });

  it('flags every missing or empty required field', () => {
    const problems = validatePreflightRecord(compliantPreflight({ recoveryOwner: '', stopTriggers: undefined }));
    expect(problems).toContain('missing_or_empty:recoveryOwner');
    expect(problems).toContain('missing_or_empty:stopTriggers');
  });

  it('flags a whitespace-only field as missing', () => {
    expect(validatePreflightRecord(compliantPreflight({ communicationPlan: '   ' }))).toContain(
      'missing_or_empty:communicationPlan',
    );
  });

  it('fails closed on a non-object preflight record instead of throwing', () => {
    expect(validatePreflightRecord(null)).toEqual(['preflight_not_an_object']);
    expect(validatePreflightRecord('x')).toEqual(['preflight_not_an_object']);
  });

  it('covers every element #2931 requires', () => {
    expect(REQUIRED_PREFLIGHT_FIELDS).toEqual([
      'changeWindowStart',
      'changeWindowEnd',
      'executorRole',
      'verifierRole',
      'preflightChecklistEvidence',
      'communicationPlan',
      'credentialBoundaryStatement',
      'smokeTestPlan',
      'completeVerificationPlan',
      'stopTriggers',
      'rollbackCandidateSha',
      'recoveryOwner',
    ]);
  });
});

describe('buildDeploymentReadiness', () => {
  it('is ready when the preflight record is complete and the rollback candidate differs from the deployment candidate', () => {
    const result = buildDeploymentReadiness({
      preflight: compliantPreflight(),
      deploymentCandidateSha: 'sha-deploy',
    });
    expect(result.ready).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('blocks on an incomplete preflight record', () => {
    const result = buildDeploymentReadiness({
      preflight: compliantPreflight({ executorRole: '' }),
      deploymentCandidateSha: 'sha-deploy',
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('preflight_incomplete');
  });

  it('blocks on a null preflight record without throwing', () => {
    expect(() => buildDeploymentReadiness({ preflight: null, deploymentCandidateSha: 'sha-deploy' })).not.toThrow();
    const result = buildDeploymentReadiness({ preflight: null, deploymentCandidateSha: 'sha-deploy' });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('preflight_incomplete');
  });

  it('blocks when the rollback candidate SHA equals the deployment candidate SHA — the untested-recovery-path case', () => {
    const result = buildDeploymentReadiness({
      preflight: compliantPreflight({ rollbackCandidateSha: 'sha-deploy' }),
      deploymentCandidateSha: 'sha-deploy',
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(['rollback_candidate_same_as_deployment_candidate']);
  });

  it('does not flag rollback-vs-deployment when deploymentCandidateSha is not supplied (e.g. #2930 manifest not yet linked)', () => {
    const result = buildDeploymentReadiness({ preflight: compliantPreflight() });
    expect(result.blockers).not.toContain('rollback_candidate_same_as_deployment_candidate');
  });

  it('reports both blockers simultaneously when both conditions fail', () => {
    const result = buildDeploymentReadiness({
      preflight: compliantPreflight({ executorRole: '', rollbackCandidateSha: 'sha-deploy' }),
      deploymentCandidateSha: 'sha-deploy',
    });
    expect(result.blockers).toEqual(
      expect.arrayContaining(['preflight_incomplete', 'rollback_candidate_same_as_deployment_candidate']),
    );
  });
});

describe('main() CLI (fails closed instead of throwing on bad input)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'preflight-readiness-'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('requires --preflight', () => {
    expect(main([])).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('fails closed on a nonexistent --preflight file', () => {
    const result = main(['--preflight', path.join(tmpDir, 'nope.json')]);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('fails closed on invalid JSON in --preflight', () => {
    const bad = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(bad, 'not json');
    const result = main(['--preflight', bad]);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('fails closed on invalid JSON in --manifest', () => {
    const preflightPath = path.join(tmpDir, 'preflight.json');
    fs.writeFileSync(preflightPath, JSON.stringify(compliantPreflight()));
    const badManifest = path.join(tmpDir, 'bad-manifest.json');
    fs.writeFileSync(badManifest, 'not json');
    const result = main(['--preflight', preflightPath, '--manifest', badManifest]);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('runs end-to-end against real temp files and exits 0 when ready', () => {
    const preflightPath = path.join(tmpDir, 'preflight.json');
    const manifestPath = path.join(tmpDir, 'manifest.json');
    fs.writeFileSync(preflightPath, JSON.stringify(compliantPreflight()));
    fs.writeFileSync(manifestPath, JSON.stringify({ candidateSha: 'sha-deploy' }));
    const result = main(['--preflight', preflightPath, '--manifest', manifestPath]);
    expect(result.ready).toBe(true);
    expect(process.exitCode).toBe(0);
  });

  it('exits 1 end-to-end when the manifest candidateSha matches the preflight rollbackCandidateSha', () => {
    const preflightPath = path.join(tmpDir, 'preflight.json');
    const manifestPath = path.join(tmpDir, 'manifest.json');
    fs.writeFileSync(preflightPath, JSON.stringify(compliantPreflight({ rollbackCandidateSha: 'sha-deploy' })));
    fs.writeFileSync(manifestPath, JSON.stringify({ candidateSha: 'sha-deploy' }));
    const result = main(['--preflight', preflightPath, '--manifest', manifestPath]);
    expect(result.ready).toBe(false);
    expect(process.exitCode).toBe(1);
  });

  it('resets the exit code to 0 on a later successful call after an earlier failing call in the same process', () => {
    main(['--preflight', path.join(tmpDir, 'nope.json')]);
    expect(process.exitCode).toBe(1);

    const preflightPath = path.join(tmpDir, 'preflight.json');
    fs.writeFileSync(preflightPath, JSON.stringify(compliantPreflight()));
    const result = main(['--preflight', preflightPath]);
    expect(result.ready).toBe(true);
    expect(process.exitCode).toBe(0);
  });
});
