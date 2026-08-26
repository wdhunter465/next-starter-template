import { describe, expect, it } from 'vitest';
import {
  assessModelCPaths,
  isModelCAllowlistedPath,
  isModelCProhibitedPath,
} from '../scripts/ci/model_c_path_gate.mjs';

describe('model_c_path_gate', () => {
  it('allowlists docs how-to path', () => {
    expect(isModelCAllowlistedPath('docs/how-to/pmo/classify-work.md')).toBe(true);
    expect(isModelCProhibitedPath('docs/how-to/pmo/classify-work.md')).toBe(false);
  });

  it('path-based: markdown under functions is prohibited', () => {
    expect(isModelCAllowlistedPath('functions/api/README.md')).toBe(false);
    expect(isModelCProhibitedPath('functions/api/README.md')).toBe(true);
    const result = assessModelCPaths({ changedFiles: ['functions/api/README.md'] });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'model_c_path_prohibited')).toBe(true);
  });

  it('valid docs-only set passes', () => {
    const result = assessModelCPaths({
      changedFiles: [
        'docs/how-to/delivery/run-model-a-release.md',
        'docs/reference/ci/delivery-profile-contract.md',
        'README.md',
      ],
    });
    expect(result.ok).toBe(true);
    expect(result.prohibited).toHaveLength(0);
  });

  it('scripts and workflows fail', () => {
    const result = assessModelCPaths({
      changedFiles: ['scripts/ci/delivery_profile.mjs', '.github/workflows/gate-quality.yml'],
    });
    expect(result.ok).toBe(false);
    expect(result.prohibited).toContain('scripts/ci/delivery_profile.mjs');
  });

  it('cross-boundary move into code path fails', () => {
    const result = assessModelCPaths({
      changedFiles: ['src/README.md'],
      renames: [{ from: 'docs/how-to/x.md', to: 'src/README.md' }],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'model_c_cross_boundary_move')).toBe(true);
  });

  it('missing changed-file evidence fails closed', () => {
    const result = assessModelCPaths({});
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'missing_changed_files_evidence')).toBe(true);
  });

  it('empty changed-file list fails closed', () => {
    const result = assessModelCPaths({ changedFiles: [] });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'missing_changed_files_evidence')).toBe(true);
  });
});
