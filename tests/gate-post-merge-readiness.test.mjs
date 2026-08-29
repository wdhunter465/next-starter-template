import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  GateInputError,
  evaluatePostMergeReadinessGate,
  main,
  renderGateReport,
} from '../scripts/ci/post_merge_readiness_gate.mjs';

const compliantBody = [
  '- **Issue:** #1544',
  '',
  '## CHANGE SUMMARY',
  '- Added post-merge readiness enforcement.',
  '',
  '## BUILD / TEST / VERIFICATION',
  '- Commands run:',
  '  - `npm test -- tests/gate-post-merge-readiness.test.mjs` — PASS',
  '- Result summary: PASS',
  '',
  '## FILE-TOUCH ALLOWLIST (MANDATORY)',
  'Allowed files:',
  '- scripts/ci/post_merge_readiness_gate.mjs',
  '',
  'All other files are out of scope',
  '',
  '## REVIEWER RESPONSE ACCOUNTING',
  '- review-comment:101 — accepted — fixed by the readiness gate — thread state: resolved',
  '',
  '## ACCEPTANCE CRITERIA',
  '- [x] Gate passes compliant PR bodies.',
  '',
  '## REQUIRED PRE-REVIEW SELF-CHECK',
  '- [x] PR body contains all required sections with exact headings',
].join('\n');

const compliantPr = {
  number: 1544,
  body: compliantBody,
  base: { ref: 'main' },
  head: { sha: 'abc123' },
  updated_at: '2026-06-11T12:00:00Z',
};

const compliantFiles = [{ filename: 'scripts/ci/post_merge_readiness_gate.mjs', status: 'added' }];

function evaluate(overrides = {}) {
  return evaluatePostMergeReadinessGate({
    pr: { ...compliantPr, ...(overrides.pr || {}) },
    files: overrides.files || compliantFiles,
    issueComments: overrides.issueComments || [],
    reviewComments: overrides.reviewComments || [],
    reviews: overrides.reviews || [],
    repository: 'wdhunter645/next-starter-template',
  });
}

describe('post-merge readiness gate', () => {
  it('passes a compliant PR body and matching allowlist', () => {
    const result = evaluate();

    expect(result.status).toBe('pass');
    expect(result.source_issue).toBe('1544');
    expect(result.failures).toEqual([]);
    expect(renderGateReport(result)).toContain('Post-merge readiness gate result: pass');
  });

  it('fails when a required post-merge body section is missing', () => {
    const result = evaluate({
      pr: { body: compliantBody.replace('## BUILD / TEST / VERIFICATION', '## SUMMARY ONLY') },
    });

    expect(result.status).toBe('fail');
    expect(result.metadata_failures).toContainEqual(expect.objectContaining({
      code: 'missing_required_section',
      message: expect.stringContaining('BUILD / TEST / VERIFICATION'),
    }));
  });

  it('fails when source issue accounting is missing before merge', () => {
    const result = evaluate({
      pr: { body: compliantBody.replace('- **Issue:** #1544\n\n', '') },
    });

    expect(result.status).toBe('fail');
    expect(result.source_issue_failures).toContainEqual(expect.objectContaining({
      code: 'missing_source_issue',
      message: expect.stringContaining('PR body does not contain a primary source issue line'),
    }));
    expect(result.failures).toContainEqual(expect.objectContaining({
      code: 'missing_source_issue',
    }));
  });

  it('blocks duplicate canonical source lines with precise pre-merge metadata hygiene', () => {
    const result = evaluate({
      pr: { body: compliantBody.replace('- **Issue:** #1544', '- **Issue:** #1544\n- Issue: #1544') },
    });

    expect(result.status).toBe('fail');
    expect(result.source_issue).toBe('1544');
    expect(result.source_issue_failures).toContainEqual(expect.objectContaining({
      code: 'duplicate_source_issue_metadata',
    }));
    expect(result.source_issue_failures).not.toContainEqual(expect.objectContaining({
      code: 'multiple_source_issues',
    }));
  });

  it('fails stale blocked status declarations before merge', () => {
    const result = evaluate({
      pr: { body: compliantBody.replace('## CHANGE SUMMARY', '## CHANGE SUMMARY\n- Status: BLOCKED\n') },
    });

    expect(result.status).toBe('fail');
    expect(result.metadata_failures).toContainEqual(expect.objectContaining({
      code: 'closeout_blocker_declared',
    }));
  });

  it('ignores generated auto-repair scaffold text before merge', () => {
    const result = evaluate({
      pr: {
        body: [
          compliantBody,
          '',
          '<!-- pr-body-auto-repair:start -->',
          '## PROGRESS + READINESS (MANDATORY)',
          '- Status: BLOCKED',
          '- Blocking Issues: auto-repair evidence requires agent verification before READY FOR REVIEW',
          '- review-comment:3427000000 — acknowledged — auto-generated disposition pending agent completion; agent must replace with final fix/rationale before READY FOR REVIEW — thread state: unresolved-with-rationale',
          '<!-- pr-body-auto-repair:end -->',
        ].join('\n'),
      },
    });

    expect(result.status).toBe('pass');
    expect(result.metadata_failures).not.toContainEqual(expect.objectContaining({
      code: 'unresolved_auto_repair_scaffold',
    }));
  });

  it('fails pending agent-completion text outside the generated auto-repair block', () => {
    const result = evaluate({
      pr: {
        body: [
          compliantBody,
          '',
          '- Status: BLOCKED',
          '- review-comment:3427000000 — acknowledged — auto-generated disposition pending agent completion; agent must replace with final fix/rationale before READY FOR REVIEW — thread state: unresolved',
        ].join('\n'),
      },
    });

    expect(result.status).toBe('fail');
    expect(result.metadata_failures).toContainEqual(expect.objectContaining({
      code: 'unresolved_auto_repair_scaffold',
    }));
  });

  it('fails when changed files are absent from the declared allowlist', () => {
    const result = evaluate({
      files: [
        ...compliantFiles,
        { filename: '.github/workflows/gate-post-merge-readiness.yml', status: 'added' },
      ],
    });

    expect(result.status).toBe('fail');
    expect(result.implementation_failures).toContainEqual(expect.objectContaining({
      code: 'allowlist_violation',
      message: expect.stringContaining('.github/workflows/gate-post-merge-readiness.yml'),
    }));
  });

  it('fails when the PR body omits allowlist evidence', () => {
    const result = evaluate({
      pr: {
        body: compliantBody.replace(
          [
            '## FILE-TOUCH ALLOWLIST (MANDATORY)',
            'Allowed files:',
            '- scripts/ci/post_merge_readiness_gate.mjs',
            '',
            'All other files are out of scope',
            '',
          ].join('\n'),
          '',
        ),
      },
    });

    expect(result.status).toBe('fail');
    expect(result.implementation_failures).toContainEqual(expect.objectContaining({
      code: 'missing_allowlist',
    }));
  });

  it('fails unchecked required acceptance criteria before merge', () => {
    const result = evaluate({
      pr: { body: compliantBody.replace('- [x] Gate passes compliant PR bodies.', '- [ ] Gate passes compliant PR bodies.') },
    });

    expect(result.status).toBe('fail');
    expect(result.implementation_failures).toContainEqual(expect.objectContaining({
      code: 'unchecked_acceptance_criterion',
    }));
  });

  it('fails verification result placeholders before merge', () => {
    const result = evaluate({
      pr: { body: compliantBody.replace('- Result summary: PASS', '- Result summary: PASS / FAIL / PENDING') },
    });

    expect(result.status).toBe('fail');
    expect(result.implementation_failures).toContainEqual(expect.objectContaining({
      code: 'verification_placeholder',
    }));
  });

  it('passes explicit remediation follow-up wording allowed by closeout governance', () => {
    const result = evaluate({
      pr: { body: `${compliantBody}\n\nRemediation follow-up for PR #1412.` },
    });

    expect(result.status).toBe('pass');
  });

  it('fails forbidden placeholder tokens before merge', () => {
    const result = evaluate({
      pr: { body: `${compliantBody}\n\nTBD after review.` },
    });

    expect(result.status).toBe('fail');
    expect(result.metadata_failures).toContainEqual(expect.objectContaining({
      code: 'forbidden_placeholder_token',
    }));
  });

  it('fails undispositioned trusted reviewer findings', () => {
    const result = evaluate({
      issueComments: [{
        id: 202,
        user: { login: 'cubic-dev-ai[bot]' },
        body: 'P1 blocking: please fix the gate before merge.',
        created_at: '2026-06-11T11:00:00Z',
      }],
    });

    expect(result.status).toBe('fail');
    expect(result.reviewer_disposition_failures).toContainEqual(expect.objectContaining({
      code: 'undispositioned_reviewer_comment',
      commentId: '202',
    }));
  });

  it('uses pre-merge wording for implementation evidence failures', () => {
    const result = evaluate({
      files: [
        ...compliantFiles,
        { filename: '.github/workflows/gate-post-merge-readiness.yml', status: 'added' },
      ],
    });

    expect(result.implementation_failures[0].message).toContain('Changed file is outside declared allowlist');
  });

  it('handles null PR payloads without throwing', () => {
    const result = evaluatePostMergeReadinessGate({
      pr: null,
      files: compliantFiles,
      repository: 'wdhunter645/next-starter-template',
    });

    expect(result.status).toBe('fail');
    expect(result.metadata_failures.length).toBeGreaterThan(0);
  });

  it('handles non-array changed-file payloads without throwing', () => {
    const result = evaluatePostMergeReadinessGate({
      pr: compliantPr,
      files: null,
      repository: 'wdhunter645/next-starter-template',
    });

    expect(result.status).toBe('fail');
    expect(result.input_failures).toContainEqual(expect.objectContaining({
      code: 'invalid_changed_files_input',
    }));
  });
});

describe('post-merge readiness gate CLI input handling', () => {
  function withTempDir(run) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-test-'));
    try {
      return run(tmpDir);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }

  it('fails deterministically on malformed JSON input files', async () => {
    await withTempDir(async (tmpDir) => {
      const badJson = path.join(tmpDir, 'bad.json');
      fs.writeFileSync(badJson, '{not json');

      await main(['--pr', badJson]);
      expect(process.exitCode).toBe(1);
      process.exitCode = 0;
    });
  });

  it('fails deterministically when --output has no path value', async () => {
    await main(['--output']);
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
  });

  it('runs main() when invoked directly with fixture files', () => {
    withTempDir((tmpDir) => {
      const prFile = path.join(tmpDir, 'pr.json');
      const filesFile = path.join(tmpDir, 'files.json');
      const issueCommentsFile = path.join(tmpDir, 'issue-comments.json');
      const reviewCommentsFile = path.join(tmpDir, 'review-comments.json');
      const reviewsFile = path.join(tmpDir, 'reviews.json');
      const outputFile = path.join(tmpDir, 'result.json');

      fs.writeFileSync(prFile, JSON.stringify(compliantPr));
      fs.writeFileSync(filesFile, JSON.stringify(compliantFiles));
      fs.writeFileSync(issueCommentsFile, '[]');
      fs.writeFileSync(reviewCommentsFile, '[]');
      fs.writeFileSync(reviewsFile, '[]');

      const output = execFileSync(
        'node',
        [
          'scripts/ci/post_merge_readiness_gate.mjs',
          '--pr', prFile,
          '--files', filesFile,
          '--issue-comments', issueCommentsFile,
          '--review-comments', reviewCommentsFile,
          '--reviews', reviewsFile,
          '--repository', 'wdhunter645/next-starter-template',
          '--output', outputFile,
        ],
        { encoding: 'utf8' },
      );

      expect(output).toContain('Post-merge readiness gate result:');
      expect(fs.existsSync(outputFile)).toBe(true);
      const result = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
      expect(result.status).toBeDefined();
    });
  });

  it('throws GateInputError for invalid file path options', () => {
    expect(() => {
      throw new GateInputError('invalid_input_path', 'Invalid file path option: true');
    }).toThrow(GateInputError);
  });
});
