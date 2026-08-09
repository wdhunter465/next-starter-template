import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildDispositionReadiness, main } from '../scripts/ci/launch_rehearsal_disposition_readiness.mjs';

function okResult(extra = {}) {
  return { ok: true, ...extra };
}

function failResult(extra = {}) {
  return { ok: false, ...extra };
}

describe('buildDispositionReadiness', () => {
  it('is ready when all four sub-results are ok and no unresolved decisions exist', () => {
    const result = buildDispositionReadiness({
      registryResult: okResult(),
      evidenceResult: okResult(),
      ledgerResult: okResult(),
      retestResult: okResult(),
    });
    expect(result.ready).toBe(true);
    expect(result.blockers).toEqual([]);
  });

  it('blocks on an invalid journey registry result', () => {
    const result = buildDispositionReadiness({
      registryResult: failResult(),
      evidenceResult: okResult(),
      ledgerResult: okResult(),
      retestResult: okResult(),
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('journey_registry_invalid');
  });

  it('blocks on incomplete evidence', () => {
    const result = buildDispositionReadiness({
      registryResult: okResult(),
      evidenceResult: failResult(),
      ledgerResult: okResult(),
      retestResult: okResult(),
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('evidence_incomplete');
  });

  it('blocks on an invalid defect ledger', () => {
    const result = buildDispositionReadiness({
      registryResult: okResult(),
      evidenceResult: okResult(),
      ledgerResult: failResult(),
      retestResult: okResult(),
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('defect_ledger_invalid');
  });

  it('blocks on incomplete retest coverage', () => {
    const result = buildDispositionReadiness({
      registryResult: okResult(),
      evidenceResult: okResult(),
      ledgerResult: okResult(),
      retestResult: failResult(),
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('retest_coverage_incomplete');
  });

  it('blocks when any unresolved protected decision is present, even if every sub-result is ok', () => {
    const result = buildDispositionReadiness({
      registryResult: okResult(),
      evidenceResult: okResult(),
      ledgerResult: okResult(),
      retestResult: okResult(),
      unresolvedProtectedDecisions: ['Product Authority must accept residual fundraiser-boundary risk'],
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(['unresolved_protected_decisions_present']);
  });

  it('reports every applicable blocker simultaneously, not just the first one found', () => {
    const result = buildDispositionReadiness({
      registryResult: failResult(),
      evidenceResult: failResult(),
      ledgerResult: failResult(),
      retestResult: okResult(),
      unresolvedProtectedDecisions: ['x'],
    });
    expect(result.blockers).toEqual(
      expect.arrayContaining([
        'journey_registry_invalid',
        'evidence_incomplete',
        'defect_ledger_invalid',
        'unresolved_protected_decisions_present',
      ]),
    );
    expect(result.blockers).not.toContain('retest_coverage_incomplete');
  });

  it('preserves each sub-result unchanged under detail, for the future report to cite verbatim', () => {
    const registryResult = okResult({ journeyCount: 22 });
    const result = buildDispositionReadiness({
      registryResult,
      evidenceResult: okResult(),
      ledgerResult: okResult(),
      retestResult: okResult(),
    });
    expect(result.detail.registryResult).toEqual(registryResult);
  });

  it('does not throw when a sub-result is null, and treats it as a blocker instead of dereferencing .ok', () => {
    expect(() =>
      buildDispositionReadiness({
        registryResult: null,
        evidenceResult: okResult(),
        ledgerResult: okResult(),
        retestResult: okResult(),
      }),
    ).not.toThrow();
    const result = buildDispositionReadiness({
      registryResult: null,
      evidenceResult: okResult(),
      ledgerResult: okResult(),
      retestResult: okResult(),
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toContain('journey_registry_invalid');
  });

  it('does not throw when a sub-result is a non-object (e.g. malformed JSON parsed to a string/number)', () => {
    expect(() =>
      buildDispositionReadiness({
        registryResult: 'not-an-object',
        evidenceResult: okResult(),
        ledgerResult: okResult(),
        retestResult: okResult(),
      }),
    ).not.toThrow();
  });

  it('blocks on a non-array unresolvedProtectedDecisions instead of silently treating it as empty', () => {
    const result = buildDispositionReadiness({
      registryResult: okResult(),
      evidenceResult: okResult(),
      ledgerResult: okResult(),
      retestResult: okResult(),
      unresolvedProtectedDecisions: 'not-an-array',
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(['unresolved_protected_decisions_malformed']);
  });

  it('blocks on unresolvedProtectedDecisions explicitly set to null', () => {
    const result = buildDispositionReadiness({
      registryResult: okResult(),
      evidenceResult: okResult(),
      ledgerResult: okResult(),
      retestResult: okResult(),
      unresolvedProtectedDecisions: null,
    });
    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(['unresolved_protected_decisions_malformed']);
  });
});

describe('main() CLI (fails closed instead of throwing on bad input)', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'disposition-readiness-'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    vi.restoreAllMocks();
    process.exitCode = undefined;
  });

  it('requires all four result-file flags', () => {
    expect(main([])).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  function writeResultFiles(dir, overrides = {}) {
    const paths = {};
    for (const name of ['registry-result', 'evidence-result', 'ledger-result', 'retest-result']) {
      const p = path.join(dir, `${name}.json`);
      fs.writeFileSync(p, JSON.stringify(overrides[name] || okResult()));
      paths[name] = p;
    }
    return paths;
  }

  it('fails closed on a nonexistent result file', () => {
    const paths = writeResultFiles(tmpDir);
    const result = main([
      '--registry-result', path.join(tmpDir, 'nope.json'),
      '--evidence-result', paths['evidence-result'],
      '--ledger-result', paths['ledger-result'],
      '--retest-result', paths['retest-result'],
    ]);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('fails closed on invalid JSON in a result file', () => {
    const paths = writeResultFiles(tmpDir);
    fs.writeFileSync(paths['ledger-result'], 'not json');
    const result = main([
      '--registry-result', paths['registry-result'],
      '--evidence-result', paths['evidence-result'],
      '--ledger-result', paths['ledger-result'],
      '--retest-result', paths['retest-result'],
    ]);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('runs end-to-end against real temp files and exits 0 when ready', () => {
    const paths = writeResultFiles(tmpDir);
    const result = main([
      '--registry-result', paths['registry-result'],
      '--evidence-result', paths['evidence-result'],
      '--ledger-result', paths['ledger-result'],
      '--retest-result', paths['retest-result'],
    ]);
    expect(result.ready).toBe(true);
    expect(process.exitCode).toBe(0);
  });

  it('exits 1 when an unresolved-decisions file lists any entry', () => {
    const paths = writeResultFiles(tmpDir);
    const decisionsPath = path.join(tmpDir, 'decisions.json');
    fs.writeFileSync(decisionsPath, JSON.stringify(['still open']));
    const result = main([
      '--registry-result', paths['registry-result'],
      '--evidence-result', paths['evidence-result'],
      '--ledger-result', paths['ledger-result'],
      '--retest-result', paths['retest-result'],
      '--unresolved-decisions', decisionsPath,
    ]);
    expect(result.ready).toBe(false);
    expect(process.exitCode).toBe(1);
  });

  it('fails closed when --unresolved-decisions is passed with no following value, instead of silently ignoring it', () => {
    const paths = writeResultFiles(tmpDir);
    const result = main([
      '--registry-result', paths['registry-result'],
      '--evidence-result', paths['evidence-result'],
      '--ledger-result', paths['ledger-result'],
      '--retest-result', paths['retest-result'],
      '--unresolved-decisions',
    ]);
    expect(result).toBeNull();
    expect(process.exitCode).toBe(1);
  });

  it('resets the exit code to 0 on a later successful call after an earlier failing call in the same process', () => {
    const paths = writeResultFiles(tmpDir);
    main(['--registry-result', path.join(tmpDir, 'nope.json')]);
    expect(process.exitCode).toBe(1);

    const result = main([
      '--registry-result', paths['registry-result'],
      '--evidence-result', paths['evidence-result'],
      '--ledger-result', paths['ledger-result'],
      '--retest-result', paths['retest-result'],
    ]);
    expect(result.ready).toBe(true);
    expect(process.exitCode).toBe(0);
  });

  it('propagates a failing sub-result through to the blockers list', () => {
    const paths = writeResultFiles(tmpDir, { 'evidence-result': failResult() });
    const result = main([
      '--registry-result', paths['registry-result'],
      '--evidence-result', paths['evidence-result'],
      '--ledger-result', paths['ledger-result'],
      '--retest-result', paths['retest-result'],
    ]);
    expect(result.ready).toBe(false);
    expect(result.blockers).toEqual(['evidence_incomplete']);
  });
});
