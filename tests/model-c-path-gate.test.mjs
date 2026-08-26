import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assessModelCPaths,
  isModelCAllowlistedPath,
  isModelCProhibitedPath,
} from '../scripts/ci/model_c_path_gate.mjs';

test('allowlists docs how-to path', () => {
  assert.equal(isModelCAllowlistedPath('docs/how-to/pmo/classify-work.md'), true);
  assert.equal(isModelCProhibitedPath('docs/how-to/pmo/classify-work.md'), false);
});

test('path-based: markdown under functions is prohibited', () => {
  assert.equal(isModelCAllowlistedPath('functions/api/README.md'), false);
  assert.equal(isModelCProhibitedPath('functions/api/README.md'), true);
  const result = assessModelCPaths({ changedFiles: ['functions/api/README.md'] });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.code === 'model_c_path_prohibited'));
});

test('valid docs-only set passes', () => {
  const result = assessModelCPaths({
    changedFiles: [
      'docs/how-to/delivery/run-model-a-release.md',
      'docs/reference/ci/delivery-profile-contract.md',
      'README.md',
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.prohibited.length, 0);
});

test('scripts and workflows fail', () => {
  const result = assessModelCPaths({
    changedFiles: ['scripts/ci/delivery_profile.mjs', '.github/workflows/gate-quality.yml'],
  });
  assert.equal(result.ok, false);
  assert.ok(result.prohibited.includes('scripts/ci/delivery_profile.mjs'));
});

test('cross-boundary move into code path fails', () => {
  const result = assessModelCPaths({
    changedFiles: ['src/README.md'],
    renames: [{ from: 'docs/how-to/x.md', to: 'src/README.md' }],
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.code === 'model_c_cross_boundary_move'));
});

test('missing changed-file evidence fails closed', () => {
  const result = assessModelCPaths({});
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.code === 'missing_changed_files_evidence'));
});
