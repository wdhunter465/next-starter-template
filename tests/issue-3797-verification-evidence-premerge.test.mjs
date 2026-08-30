import { describe, expect, it } from 'vitest';
import { hardHygieneFailures } from '../scripts/ci/pr_hygiene_audit.mjs';

// TDD RED checkpoint: production hygiene behavior is intentionally unchanged here.
const baseBody = `# PR Summary

- **Issue:** #3797
- Intent label: intent:fix
- PR class: ci

## Scope

Allowed paths:
- \`scripts/ci/pr_hygiene_audit.mjs\`
- \`tests/issue-3797-verification-evidence-premerge.test.mjs\`

## Change Summary

Align pre-merge verification evidence enforcement with post-merge closeout.

## Acceptance Criteria

- [x] Source issue acceptance criteria reviewed
- [x] Regression is bounded to verification evidence
`;

function codes(body) {
  return hardHygieneFailures({
    body,
    changedFiles: [
      'scripts/ci/pr_hygiene_audit.mjs',
      'tests/issue-3797-verification-evidence-premerge.test.mjs',
    ],
  }).map((failure) => failure.code);
}

describe('issue #3797 verification evidence convergence', () => {
  it('blocks missing local verification commands before merge', () => {
    const body = `${baseBody}\n## Verification\n\nLocal verification:\n  Result: PASS\n\nCI verification:\n- Required checks expected to pass: YES\n`;
    expect(codes(body)).toContain('missing_verification_commands');
  });

  it('blocks FAIL or PENDING verification before merge', () => {
    const failed = `${baseBody}\n## Verification\n\nLocal verification:\n- Command: \`npm test\`\n  Result: FAIL\n`;
    const pending = `${baseBody}\n## Verification\n\nLocal verification:\n- Command: \`npm test\`\n  Result: PENDING\n`;
    expect(codes(failed)).toContain('verification_not_pass');
    expect(codes(pending)).toContain('verification_not_pass');
  });

  it('blocks the unchanged verification result placeholder before merge', () => {
    const body = `${baseBody}\n## Verification\n\nLocal verification:\n- Command: \`npm test\`\n  Result: PASS / FAIL / NOT RUN\n`;
    expect(codes(body)).toContain('verification_placeholder');
  });

  it('accepts populated passing verification evidence', () => {
    const body = `${baseBody}\n## Verification\n\nLocal verification:\n- Command: \`npm test -- tests/issue-3797-verification-evidence-premerge.test.mjs\`\n  Result: PASS\n\nCI verification:\n- Required checks expected to pass: YES\n`;
    expect(codes(body)).not.toContain('missing_verification_commands');
    expect(codes(body)).not.toContain('verification_not_pass');
    expect(codes(body)).not.toContain('verification_placeholder');
  });
});
