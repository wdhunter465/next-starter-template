import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { checkPolicyControlMatrix, MATRIX_PATH } from '../.agents/checks/policy_control_matrix_check.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const tempDirs = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'policy-matrix-'));
  tempDirs.push(dir);

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(dir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }

  return dir;
}

function tableWithRow(row) {
  return [
    '## Matrix',
    '',
    '| Control | Domain owner | State | Evidence | Last verified |',
    '| --- | --- | --- | --- | --- |',
    row,
    '',
  ].join('\n');
}

describe('policy control matrix check (#2821)', () => {
  it('passes on the live repository', () => {
    expect(checkPolicyControlMatrix(repoRoot)).toEqual([]);
  });

  it('reports a missing matrix file', () => {
    const dir = makeTempRepo({});
    expect(checkPolicyControlMatrix(dir)).toContainEqual(
      expect.stringContaining('matrix file is missing'),
    );
  });

  it('fails an Enforced row whose evidence path does not exist', () => {
    const dir = makeTempRepo({
      [MATRIX_PATH]: tableWithRow('| Fake gate | CI and Verification | Enforced | `scripts/ci/does_not_exist.mjs` | 2026-09-17 |'),
    });

    const failures = checkPolicyControlMatrix(dir);
    expect(failures).toContainEqual(expect.stringContaining('none of its cited evidence paths exist'));
  });

  it('passes an Enforced row whose evidence path exists', () => {
    const dir = makeTempRepo({
      [MATRIX_PATH]: tableWithRow('| Fake gate | CI and Verification | Enforced | `real.mjs` | 2026-09-17 |'),
      'real.mjs': '// exists',
    });

    expect(checkPolicyControlMatrix(dir)).toEqual([]);
  });

  it('does not require evidence to resolve for non-claim states', () => {
    const dir = makeTempRepo({
      [MATRIX_PATH]: tableWithRow('| Fake gate | CI and Verification | Defined, not fully Enforced | prose only, no path | 2026-09-17 |'),
    });

    expect(checkPolicyControlMatrix(dir)).toEqual([]);
  });

  it('flags a malformed row with the wrong column count', () => {
    const dir = makeTempRepo({
      [MATRIX_PATH]: [
        '## Matrix',
        '',
        '| Control | Domain owner | State | Evidence | Last verified |',
        '| --- | --- | --- | --- | --- |',
        '| Fake gate | CI and Verification | Enforced |',
        '',
      ].join('\n'),
    });

    expect(checkPolicyControlMatrix(dir)).toContainEqual(expect.stringContaining('has 3 columns, expected 5'));
  });

  it('fails gracefully instead of throwing when a required column is missing from the header', () => {
    const dir = makeTempRepo({
      [MATRIX_PATH]: [
        '## Matrix',
        '',
        '| Control | Domain owner | Evidence | Last verified |',
        '| --- | --- | --- | --- |',
        '| Fake gate | CI and Verification | `real.mjs` | 2026-09-17 |',
        '',
      ].join('\n'),
      'real.mjs': '// exists',
    });

    expect(() => checkPolicyControlMatrix(dir)).not.toThrow();
    expect(checkPolicyControlMatrix(dir)).toContainEqual(
      expect.stringContaining('missing required column: State'),
    );
  });

  it('rejects an Enforced row whose evidence path resolves outside the repository root', () => {
    const dir = makeTempRepo({
      [MATRIX_PATH]: tableWithRow('| Fake gate | CI and Verification | Enforced | `../../../../etc/passwd` | 2026-09-17 |'),
    });

    const failures = checkPolicyControlMatrix(dir);
    expect(failures).toContainEqual(expect.stringContaining('none of its cited evidence paths exist'));
  });
});
