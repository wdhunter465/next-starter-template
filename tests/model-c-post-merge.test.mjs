import { describe, expect, it } from 'vitest';
import { assessModelCPostMerge } from '../scripts/ci/model_c_post_merge.mjs';

describe('model_c_post_merge', () => {
  it('succeeds for allowlisted paths without diataxis filesystem', () => {
    const result = assessModelCPostMerge({
      changedFiles: ['docs/how-to/pmo/example.md'],
      prMerged: true,
      issueClosed: true,
      skipDiataxis: true,
    });
    expect(result.ok).toBe(true);
  });

  it('fails when prohibited path landed', () => {
    const result = assessModelCPostMerge({
      changedFiles: ['src/index.ts'],
      prMerged: true,
      skipDiataxis: true,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'model_c_path_prohibited')).toBe(true);
  });

  it('fails when PR not merged', () => {
    const result = assessModelCPostMerge({
      changedFiles: ['docs/reference/ci/x.md'],
      prMerged: false,
      skipDiataxis: true,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'pr_not_merged')).toBe(true);
  });

  it('fails when issue remains open after merge', () => {
    const result = assessModelCPostMerge({
      changedFiles: ['docs/reference/ci/x.md'],
      prMerged: true,
      issueClosed: false,
      skipDiataxis: true,
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === 'source_issue_open')).toBe(true);
  });
});


describe('model_c_post_merge changed-file evidence', () => {
  it('fails closed when changed-file evidence is genuinely unavailable', () => {
    const result = assessModelCPostMerge({
      changedFiles: [],
      prMerged: true,
      issueClosed: true,
      skipDiataxis: true,
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({
      code: 'missing_changed_files_evidence',
    }));
  });

  it('fails closed when changed-file evidence normalizes to an empty list', () => {
    const result = assessModelCPostMerge({
      changedFiles: ['  ', '\n'],
      prMerged: true,
      issueClosed: true,
      skipDiataxis: true,
    });

    expect(result.ok).toBe(false);
    expect(result.errors).toContainEqual(expect.objectContaining({
      code: 'missing_changed_files_evidence',
    }));
  });
});
