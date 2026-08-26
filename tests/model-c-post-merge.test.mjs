import test from 'node:test';
import assert from 'node:assert/strict';
import { assessModelCPostMerge } from '../scripts/ci/model_c_post_merge.mjs';

test('post-merge succeeds for allowlisted paths without diataxis filesystem', () => {
  const result = assessModelCPostMerge({
    changedFiles: ['docs/how-to/pmo/example.md'],
    prMerged: true,
    issueClosed: true,
    skipDiataxis: true,
  });
  assert.equal(result.ok, true);
});

test('post-merge fails when prohibited path landed', () => {
  const result = assessModelCPostMerge({
    changedFiles: ['src/index.ts'],
    prMerged: true,
    skipDiataxis: true,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.code === 'model_c_path_prohibited'));
});

test('post-merge fails when PR not merged', () => {
  const result = assessModelCPostMerge({
    changedFiles: ['docs/reference/ci/x.md'],
    prMerged: false,
    skipDiataxis: true,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.code === 'pr_not_merged'));
});

test('post-merge fails when issue remains open after merge', () => {
  const result = assessModelCPostMerge({
    changedFiles: ['docs/reference/ci/x.md'],
    prMerged: true,
    issueClosed: false,
    skipDiataxis: true,
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.code === 'source_issue_open'));
});
