import { describe, expect, it } from 'vitest';
import {
  evaluateReviewerCommentDisposition,
  hasValidDisposition,
  isOutdatedComment,
  parseReviewerDispositions,
} from '../scripts/ci/reviewer_comment_disposition.mjs';
import { assessReviewerResponseGate } from '../scripts/ci/reviewer-response-gate.mjs';
import { assessReviewerLifecycle } from '../scripts/ci/reviewer_lifecycle_gate.mjs';
import { evaluateReviewerAccounting } from '../scripts/ci/reviewer-gate-simulation.mjs';
import {
  reviewerDispositionFailures,
  buildResult,
} from '../scripts/ci/post_merge_validator.mjs';
import { shouldCloseSourceIssue } from '../scripts/ci/post_merge_source_issue_closeout.mjs';

const reviewerAccountingSection = [
  '## REVIEWER RESPONSE ACCOUNTING',
  '- [x] Reviewed all reviewer comments.',
  '- review-comment:1001 — accepted — Fixed in commit abc — thread state: resolved',
  '- review-comment:1002 — rejected — Not applicable to this scope — thread state: outdated',
].join('\n');

describe('reviewer comment disposition parsing', () => {
  it('parses review-comment disposition lines from the accounting section', () => {
    const dispositions = parseReviewerDispositions(reviewerAccountingSection);

    expect(dispositions.get('1001')).toMatchObject({
      verb: 'accepted',
      threadState: 'resolved',
    });
    expect(dispositions.get('1002')).toMatchObject({
      verb: 'rejected',
      threadState: 'outdated',
    });
    expect(hasValidDisposition(dispositions.get('1001'))).toBe(true);
  });

  it('detects outdated inline comments by commit SHA mismatch', () => {
    expect(isOutdatedComment({ commit_id: 'old-sha' }, 'new-sha')).toBe(true);
    expect(isOutdatedComment({ commit_id: 'new-sha' }, 'new-sha')).toBe(false);
  });
});

describe('reviewer comment disposition enforcement', () => {
  it('fails unresolved active inline review threads on current head', () => {
    const result = evaluateReviewerCommentDisposition({
      body: '## REVIEWER RESPONSE ACCOUNTING\n- none yet',
      reviewComments: [{
        id: 2001,
        user: { login: 'copilot-pull-request-reviewer[bot]' },
        commit_id: 'abc123',
        path: 'scripts/ci/example.mjs',
        line: 10,
        body: 'Please fix this issue.',
        created_at: '2026-06-01T00:00:00Z',
      }],
      headSha: 'abc123',
    });

    expect(result.ok).toBe(false);
    expect(result.undispositionedCount).toBe(1);
    expect(result.failures[0].code).toBe('undispositioned_reviewer_comment');
  });

  it('does not fail pre-merge solely on outdated prior-SHA threads without disposition (#3281 E)', () => {
    const result = evaluateReviewerCommentDisposition({
      body: '## REVIEWER RESPONSE ACCOUNTING\n- reviewed',
      reviewComments: [{
        id: 2002,
        user: { login: 'cubic-dev-ai[bot]' },
        commit_id: 'old-sha',
        path: 'scripts/ci/example.mjs',
        line: 12,
        body: 'Outdated finding on prior commit.',
        created_at: '2026-06-01T00:00:00Z',
      }],
      headSha: 'new-sha',
      auditPhase: 'pre_merge',
    });

    expect(result.ok).toBe(true);
    expect(result.outdatedWithoutDispositionCount).toBe(0);
  });

  it('still tracks outdated-without-disposition for post-merge audit', () => {
    const result = evaluateReviewerCommentDisposition({
      body: '## REVIEWER RESPONSE ACCOUNTING\n- reviewed',
      reviewComments: [{
        id: 2002,
        user: { login: 'cubic-dev-ai[bot]' },
        commit_id: 'old-sha',
        path: 'scripts/ci/example.mjs',
        line: 12,
        body: 'Outdated finding on prior commit.',
        created_at: '2026-06-01T00:00:00Z',
      }],
      headSha: 'new-sha',
      auditPhase: 'post_merge',
    });

    expect(result.ok).toBe(false);
    expect(result.outdatedWithoutDispositionCount).toBe(1);
    expect(result.failures[0].code).toBe('outdated_reviewer_thread_without_disposition');
  });

  it('passes outdated threads with explicit disposition in the PR body', () => {
    const result = evaluateReviewerCommentDisposition({
      body: [
        '## REVIEWER RESPONSE ACCOUNTING',
        '- review-comment:2003 — acknowledged — Superseded by refactor — thread state: outdated',
      ].join('\n'),
      reviewComments: [{
        id: 2003,
        user: { login: 'cubic-dev-ai[bot]' },
        commit_id: 'old-sha',
        path: 'scripts/ci/example.mjs',
        line: 14,
        body: 'Please update this helper.',
        created_at: '2026-06-01T00:00:00Z',
      }],
      headSha: 'new-sha',
    });

    expect(result.ok).toBe(true);
  });

  it('passes current-head threads closed by native resolve-by-reply without body disposition (#3281 D)', () => {
    const result = evaluateReviewerCommentDisposition({
      body: '## REVIEWER RESPONSE ACCOUNTING\n- none',
      reviewComments: [
        {
          id: 2100,
          user: { login: 'copilot-pull-request-reviewer[bot]' },
          commit_id: 'abc123',
          path: 'scripts/ci/example.mjs',
          line: 10,
          body: 'Please fix this issue.',
          created_at: '2026-06-01T00:00:00Z',
        },
        {
          id: 2101,
          in_reply_to_id: 2100,
          user: { login: 'implementer' },
          commit_id: 'abc123',
          path: 'scripts/ci/example.mjs',
          line: 10,
          body: '✅ Addressed in follow-up commit.',
          created_at: '2026-06-01T00:05:00Z',
        },
      ],
      headSha: 'abc123',
    });

    expect(result.ok).toBe(true);
    expect(result.undispositionedCount).toBe(0);
  });

  it('captures late post-merge reviewer comments as disposition failures', () => {
    const result = evaluateReviewerCommentDisposition({
      body: '## REVIEWER RESPONSE ACCOUNTING\n- reviewed',
      reviewComments: [{
        id: 2004,
        user: { login: 'copilot-pull-request-reviewer[bot]' },
        commit_id: 'merge-sha',
        path: 'scripts/ci/example.mjs',
        line: 16,
        body: 'Late finding after merge.',
        created_at: '2026-06-03T00:00:00Z',
      }],
      headSha: 'merge-sha',
      mergedAt: '2026-06-02T00:00:00Z',
      auditPhase: 'post_merge',
    });

    expect(result.ok).toBe(false);
    expect(result.lateFindingsCount).toBe(1);
    expect(result.failures[0].code).toBe('late_undispositioned_reviewer_comment');
  });
});

describe('reviewer response gate integration', () => {
  it('does not block pull_request_target when late findings are dispositioned', () => {
    const prBody = [
      'Status: READY FOR REVIEW',
      '## REVIEWER RESPONSE ACCOUNTING',
      'Reviewer items:',
      '- review-comment:3396937120 — accepted — Removed duplicate load path — thread state: resolved',
      '- review-comment:3396953330 — accepted — duplicate-load guard added — thread state: resolved',
      '- review-comment:3396953405 — accepted — Publish button disabled when selected block absent — thread state: resolved',
    ].join('\n');

    const reviewComments = [
      {
        id: 3396937120,
        user: { login: 'cubic-dev-ai[bot]' },
        commit_id: 'bad2cd41eaa8d68a4fc9ade698c014e42a68f70b',
        path: 'src/app/admin/content/page.tsx',
        line: 141,
        body: 'Please fix duplicate loads.',
        created_at: '2026-06-11T14:56:39Z',
      },
      {
        id: 3396953330,
        user: { login: 'copilot-pull-request-reviewer[bot]' },
        commit_id: 'e69e5e9820e048338908d394f9ae47db36a0a088',
        path: 'src/app/admin/content/page.tsx',
        line: 12,
        body: 'P2: duplicate loads.',
        created_at: '2026-06-11T14:58:53Z',
      },
      {
        id: 3396953405,
        user: { login: 'copilot-pull-request-reviewer[bot]' },
        commit_id: 'bad2cd41eaa8d68a4fc9ade698c014e42a68f70b',
        path: 'src/app/admin/cms/page.tsx',
        line: 332,
        body: 'Publish should be disabled when selected block is absent.',
        created_at: '2026-06-11T14:58:54Z',
      },
    ];

    const disposition = evaluateReviewerCommentDisposition({
      body: prBody,
      reviewComments,
      headSha: 'bad2cd41eaa8d68a4fc9ade698c014e42a68f70b',
      readyForReviewAt: '2026-06-11T14:54:33Z',
      auditPhase: 'pre_merge',
    });

    expect(disposition.ok).toBe(true);
    expect(disposition.lateFindingsCount).toBe(3);
    expect(disposition.lateUndispositionedCount).toBe(0);
    expect(disposition.undispositionedCount).toBe(0);

    const accounting = evaluateReviewerAccounting({
      eventName: 'pull_request_target',
      labels: ['infra'],
      files: ['src/app/admin/cms/page.tsx'],
      currentHeadLinkedReview: true,
      lateUndispositionedReviewerComments: disposition.lateUndispositionedCount,
    });

    expect(accounting.ok).toBe(true);
    expect(accounting.reason).toBe('reviewer-accounting-ok');

    const lifecycle = assessReviewerLifecycle({
      eventName: 'pull_request_target',
      labels: ['infra'],
      files: ['src/app/admin/cms/page.tsx', 'src/app/admin/content/page.tsx'],
      enforceFailure: true,
      headSha: 'bad2cd41eaa8d68a4fc9ade698c014e42a68f70b',
      body: prBody,
      readyForReviewAt: '2026-06-11T14:54:33Z',
      reviewComments,
      reviews: [{
        user: { login: 'copilot-pull-request-reviewer[bot]' },
        commit_id: 'bad2cd41eaa8d68a4fc9ade698c014e42a68f70b',
        state: 'COMMENTED',
      }],
    });

    expect(lifecycle.shouldFail).toBe(false);
  });

  it('blocks pull_request_target when late findings remain undispositioned', () => {
    const accounting = evaluateReviewerAccounting({
      eventName: 'pull_request_target',
      labels: ['infra'],
      files: ['src/app/admin/cms/page.tsx'],
      currentHeadLinkedReview: true,
      undispositionedReviewerComments: 1,
      lateUndispositionedReviewerComments: 1,
    });

    expect(accounting.ok).toBe(false);
    expect(accounting.reason).toBe('undispositioned-reviewer-comment');
  });

  it('blocks pull_request_target when undispositioned reviewer comments exist', () => {
    const accounting = evaluateReviewerAccounting({
      eventName: 'pull_request_target',
      labels: ['infra'],
      files: ['docs/reference/ci/reviewer-lifecycle-surface.md'],
      currentHeadLinkedReview: true,
      undispositionedReviewerComments: 1,
    });

    expect(accounting.ok).toBe(false);
    expect(accounting.reason).toBe('undispositioned-reviewer-comment');
  });

  it('fails lifecycle assessment for undispositioned trusted inline comments on current head', () => {
    const result = assessReviewerLifecycle({
      eventName: 'pull_request_target',
      labels: ['docs-only'],
      files: ['docs/reference/ci/reviewer-lifecycle-surface.md'],
      enforceFailure: true,
      headSha: 'abc123',
      reviewComments: [{
        id: 3001,
        user: { login: 'copilot-pull-request-reviewer[bot]' },
        commit_id: 'abc123',
        path: 'docs/reference/ci/reviewer-lifecycle-surface.md',
        line: 8,
        body: 'Please clarify this section.',
        created_at: '2026-06-01T00:00:00Z',
      }],
      body: '## REVIEWER RESPONSE ACCOUNTING\n- reviewed only',
    });

    expect(result.shouldFail).toBe(true);
    expect(result.assessment.reason).toBe('undispositioned-reviewer-comment');
  });

  it('does not fail lifecycle on outdated prior-SHA bot comments without disposition on pre-merge (#3281 E)', () => {
    const result = assessReviewerLifecycle({
      eventName: 'pull_request',
      labels: ['ci'],
      files: ['scripts/ci/reviewer_lifecycle_gate.mjs'],
      enforceFailure: true,
      headSha: 'new-sha',
      body: '## REVIEWER RESPONSE ACCOUNTING\n- reviewed only',
      reviewComments: [{
        id: 2002,
        user: { login: 'cubic-dev-ai[bot]' },
        commit_id: 'old-sha',
        path: 'scripts/ci/reviewer_lifecycle_gate.mjs',
        line: 12,
        body: 'Outdated finding on prior commit.',
        created_at: '2026-06-01T00:00:00Z',
      }],
    });

    expect(result.shouldFail).toBe(false);
    expect(result.disposition.outdatedWithoutDispositionCount).toBe(0);
  });

  it('passes response gate when all actionable comments are dispositioned', () => {
    const gate = assessReviewerResponseGate({
      enforceFailure: true,
      body: reviewerAccountingSection,
      reviewComments: [{
        id: 1001,
        user: { login: 'copilot-pull-request-reviewer[bot]' },
        commit_id: 'abc123',
        path: 'scripts/ci/example.mjs',
        line: 10,
        body: 'Please fix this issue.',
        created_at: '2026-06-01T00:00:00Z',
      }],
      headSha: 'abc123',
    });

    expect(gate.shouldFail).toBe(false);
  });
});

describe('post-merge closeout reviewer disposition', () => {
  it('refuses source issue closeout when undispositioned reviewer findings exist', () => {
    const postMergeResult = buildResult({
      pr: { body: '- **Issue:** #1452' },
      resolution: { pr: '1500' },
      reviewerDispositionFailures: [{
        code: 'undispositioned_reviewer_comment',
        message: 'Trusted reviewer comment 4001 lacks required PR-body disposition.',
      }],
    });

    expect(
      shouldCloseSourceIssue({
        action: 'post_merge_remediation',
        issueNumber: '1452',
        isMerged: true,
        postMergeResult,
      }),
    ).toMatchObject({ close: false, reason: 'action_post_merge_remediation' });

    expect(
      shouldCloseSourceIssue({
        action: 'post_merge_success',
        issueNumber: '1452',
        isMerged: true,
        postMergeResult: {
          status: 'pass',
          remediation_required: false,
          reviewer_disposition_failures: [{
            code: 'undispositioned_reviewer_comment',
            message: 'missing disposition',
          }],
        },
      }),
    ).toMatchObject({ close: false, reason: 'undispositioned_reviewer_findings' });
  });

  it('stops queue advancement while reviewer disposition failures remain', () => {
    const result = buildResult({
      pr: { body: '- **Issue:** #1452' },
      resolution: { pr: '1500' },
      reviewerDispositionFailures: [{
        code: 'outdated_reviewer_thread_without_disposition',
        message: 'Outdated thread requires disposition.',
      }],
    });

    expect(result.remediation_required).toBe(true);
    expect(result.queue_advancement_status).toContain('stopped');
  });

  it('maps post-merge validator reviewer disposition failures from review data', () => {
    const failures = reviewerDispositionFailures({
      body: '## REVIEWER RESPONSE ACCOUNTING\n- reviewed',
      reviewComments: [{
        id: 5001,
        user: { login: 'cubic-dev-ai[bot]' },
        commit_id: 'merge-sha',
        path: 'scripts/ci/example.mjs',
        line: 20,
        body: 'Post-merge undispositioned finding.',
        created_at: '2026-06-03T00:00:00Z',
      }],
      headSha: 'merge-sha',
      mergedAt: '2026-06-02T00:00:00Z',
    });

    expect(failures).toHaveLength(1);
    expect(failures[0].code).toBe('late_undispositioned_reviewer_comment');
  });
});
