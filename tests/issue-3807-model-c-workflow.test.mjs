import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

const gateWorkflow = fs.readFileSync('.github/workflows/gate-model-c.yml', 'utf8');
const postMergeWorkflow = fs.readFileSync('.github/workflows/post-merge-model-c.yml', 'utf8');

// These workflow contracts keep API failures observable under fail-fast shells.

function invalidPlainRunScalars(workflow) {
  return workflow
    .split(/\r?\n/)
    .filter((line) => /^\s+run:\s+.+$/.test(line))
    .filter((line) => {
      const value = line.replace(/^\s+run:\s+/, '');
      const isQuoted = value.startsWith("'") || value.startsWith('"');
      return !isQuoted && value.includes(': ');
    });
}

describe('issue #3807 Model C workflow contracts', () => {
  it('keeps the pre-merge PR and manual-dispatch triggers parseable with an intended job', () => {
    expect(gateWorkflow).toMatch(/on:\n\s+pull_request:\n\s+workflow_dispatch:/);
    expect(gateWorkflow).toContain('model-c-path:');
    expect(invalidPlainRunScalars(gateWorkflow)).toEqual([]);
  });

  it('collects immutable PR file evidence before classification instead of relying on a shallow checkout', () => {
    expect(gateWorkflow).toMatch(/gh api\b[\s\S]*pulls\/\$PR_NUMBER\/files/);
    expect(gateWorkflow).toContain('test -s "$RUNNER_TEMP/changed_files.txt"');
    expect(gateWorkflow).not.toContain('git fetch --no-tags --depth=0');
    expect(gateWorkflow).not.toContain('git diff --name-only');
  });

  it('reports PR-files API failure deterministically before exiting in the pre-merge workflow', () => {
    expect(gateWorkflow).toMatch(/if ! gh api --paginate[\s\S]*pulls\/\$PR_NUMBER\/files[\s\S]*> "\$RUNNER_TEMP\/changed_files\.txt"; then/);
    expect(gateWorkflow).toMatch(/if ! gh api --paginate[\s\S]*then[\s\S]*::error::Model C changed-file evidence is unavailable for PR #\$PR_NUMBER \(GitHub API request failed\)\.[\s\S]*exit 1/);
  });

  it('collects immutable PR file evidence after merge instead of diffing a mutable base tip', () => {
    expect(postMergeWorkflow).toMatch(/gh api\b[\s\S]*pulls\/\$PR_NUMBER\/files/);
    expect(postMergeWorkflow).toContain('test -s "$RUNNER_TEMP/changed_files.txt"');
    expect(postMergeWorkflow).not.toContain('git diff --name-only');
    expect(postMergeWorkflow).not.toContain('changed_files.txt" || true');
  });

  it('reports PR-files API failure deterministically before exiting in the post-merge workflow', () => {
    expect(postMergeWorkflow).toMatch(/if ! gh api --paginate[\s\S]*pulls\/\$PR_NUMBER\/files[\s\S]*> "\$RUNNER_TEMP\/changed_files\.txt"; then/);
    expect(postMergeWorkflow).toMatch(/if ! gh api --paginate[\s\S]*then[\s\S]*::error::Model C changed-file evidence is unavailable for PR #\$PR_NUMBER \(GitHub API request failed\)\.[\s\S]*exit 1/);
  });

  it('retains pull-request-close and manual-dispatch verification entry points', () => {
    expect(postMergeWorkflow).toMatch(/pull_request:\n\s+types: \[closed\]/);
    expect(postMergeWorkflow).toContain('workflow_dispatch:');
    expect(postMergeWorkflow).toContain('model-c-post-merge:');
  });
});
