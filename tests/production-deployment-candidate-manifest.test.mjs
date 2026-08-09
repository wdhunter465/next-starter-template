import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  REQUIRED_MANIFEST_FIELDS,
  buildGoNoGoReadiness,
  main,
  validateManifest,
} from '../scripts/ci/production_deployment_candidate_manifest.mjs';

function compliantManifest(overrides = {}) {
  const manifest = {};
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    manifest[field] = `evidence for ${field}`;
  }
  return { ...manifest, ...overrides };
}

describe('validateManifest', () => {
  it('accepts a manifest with every required field populated', () => {
    expect(validateManifest(compliantManifest())).toEqual([]);
  });

  it('flags every missing or empty required field', () => {
    const problems = validateManifest(compliantManifest({ candidateSha: '', productAuthorityProductionGo: undefined }));
    expect(problems).toContain('missing_or_empty:candidateSha');
    expect(problems).toContain('missing_or_empty:productAuthorityProductionGo');
  });

  it('flags a whitespace-only field as missing', () => {
    expect(validateManifest(compliantManifest({ rollbackTargetAndOwner: '   ' }))).toContain(
      'missing_or_empty:rollbackTargetAndOwner',
    );
  });

  it('fails closed on a non-object manifest instead of throwing', () => {
    expect(validateManifest(null)).toEqual(['manifest_not_an_object']);
    expect(validateManifest('x')).toEqual(['manifest_not_an_object']);
    expect(validateManifest(undefined)).toEqual(['manifest_not_an_object']);
  });

  it('rejects an array manifest as manifest_not_an_object rather than reporting every field missing', () => {
    expect(validateManifest(['not', 'a', 'manifest'])).toEqual(['manifest_not_an_object']);
    expect(validateManifest([])).toEqual(['manifest_not_an_object']);
  });

  it('covers every #2782 Go/No-Go evidence item named in the required-fields list', () => {
    expect(REQUIRED_MANIFEST_FIELDS).toEqual([
      'candidateSha',
      'sourceIssueAccounting',
      'contract2776Evidence',
      'sequence2777Evidence',
      'productProjectReadiness',
      'contentDataReadiness',
      'complianceReadiness',
      'communicationReadiness',
      'platformReadiness',
      'recoveryReadiness',
      'monitoringReadiness',
      'operatorReadiness',
      'vendorAccountReadiness',
      'program2781GoRecommendation',
      'ciReviewChecksEvidence',
      'cloudflareEnvironmentIdentity',
      'rollbackTargetAndOwner',
      'noOpenLaunchBlockerEvidence',
      'productAuthorityProductionGo',
    ]);
  });
});

describe('buildGoNoGoReadiness', () => {
  it('is ready when the manifest is complete and no unresolved decisions exist', () => {
    const result = buildGoNoGoReadiness({ manifest: compliantManifest() });
    expect(result.ready).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('blocks on an incomplete manifest', () => {
    const result = buildGoNoGoReadiness({ manifest: compliantManifest({ candidateSha: '' }) });
    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(['candidate_manifest_incomplete']);
    expect(result.detail.manifestProblems).toContain('missing_or_empty:candidateSha');
  });

  it('blocks on a null manifest without throwing', () => {
    expect(() => buildGoNoGoReadiness({ manifest: null })).not.toThrow();
    const result = buildGoNoGoReadiness({ manifest: null });
    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(['candidate_manifest_incomplete']);
  });

  it('blocks when any unresolved protected decision is present, even with a complete manifest', () => {
    const result = buildGoNoGoReadiness({
      manifest: compliantManifest(),
      unresolvedProtectedDecisions: ['Product Authority must confirm rollback owner availability'],
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(['unresolved_protected_decisions_present']);
  });

  it('blocks on a non-array unresolvedProtectedDecisions instead of silently treating it as empty', () => {
    const result = buildGoNoGoReadiness({ manifest: compliantManifest(), unresolvedProtectedDecisions: 'not-an-array' });
    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(['unresolved_protected_decisions_malformed']);
  });

  it('normalizes detail.unresolvedProtectedDecisions to an array even when the input is malformed', () => {
    const result = buildGoNoGoReadiness({ manifest: compliantManifest(), unresolvedProtectedDecisions: 'not-an-array' });
    expect(result.detail.unresolvedProtectedDecisions).toEqual([]);

    const objectResult = buildGoNoGoReadiness({ manifest: compliantManifest(), unresolvedProtectedDecisions: { bad: true } });
    expect(objectResult.detail.unresolvedProtectedDecisions).toEqual([]);
  });

  it('reports both blockers simultaneously when both conditions fail', () => {
    const result = buildGoNoGoReadiness({
      manifest: compliantManifest({ candidateSha: '' }),
      unresolvedProtectedDecisions: ['x'],
    });
    expect(result.blockers).toEqual(
      expect.arrayContaining(['candidate_manifest_incomplete', 'unresolved_protected_decisions_present']),
    );
  });
});

describe('main() CLI (fails closed instead of throwing on bad input)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'candidate-manifest-'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('requires --manifest', () => {
    expect(main([])).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('fails closed on a nonexistent --manifest file', () => {
    const result = main(['--manifest', path.join(tmpDir, 'nope.json')]);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('fails closed on invalid JSON in --manifest', () => {
    const bad = path.join(tmpDir, 'bad.json');
    fs.writeFileSync(bad, 'not json');
    const result = main(['--manifest', bad]);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('fails closed when --unresolved-decisions is passed with no following value', () => {
    const manifestPath = path.join(tmpDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(compliantManifest()));
    const result = main(['--manifest', manifestPath, '--unresolved-decisions']);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('runs end-to-end against a real temp manifest and exits 0 when ready', () => {
    const manifestPath = path.join(tmpDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(compliantManifest()));
    const result = main(['--manifest', manifestPath]);
    expect(result.ready).toBe(true);
    expect(process.exitCode).toBe(0);
  });

  it('resets the exit code to 0 on a later successful call after an earlier failing call in the same process', () => {
    main(['--manifest', path.join(tmpDir, 'nope.json')]);
    expect(process.exitCode).toBe(1);

    const manifestPath = path.join(tmpDir, 'manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(compliantManifest()));
    const result = main(['--manifest', manifestPath]);
    expect(result.ready).toBe(true);
    expect(process.exitCode).toBe(0);
  });
});
