import { describe, expect, it } from 'vitest';
import {
  evaluateReviewerCommentDisposition,
  isActionableReviewSubmission,
} from '../scripts/ci/reviewer_comment_disposition.mjs';

const approvalRecommendedReview = {
  id: 5035009705,
  user: { login: 'copilot-pull-request-reviewer[bot]' },
  state: 'COMMENTED',
  submitted_at: '2026-08-26T20:57:26Z',
  body: [
    '### 🟢 Approval recommended',
    '',
    'The workflow now handles PR body content strictly as data and includes regression coverage that guards against restoring the unsafe interpolation path.',
    '',
    'This PR eliminates unsafe shell interpolation and prevents a security bug from being reintroduced.',
    '',
    '- **Files reviewed:** 2/2 changed files',
    '- **Comments generated:** 0',
    '- **Review effort level:** Lite',
  ].join('\n'),
};

describe('issue #3790 reviewer disposition regression', () => {
  it('treats an approval-recommended trusted COMMENTED review with zero findings as non-actionable', () => {
    expect(isActionableReviewSubmission(approvalRecommendedReview)).toBe(false);

    const result = evaluateReviewerCommentDisposition({
      body: '## REVIEWER RESPONSE ACCOUNTING\n- reviewed',
      reviews: [approvalRecommendedReview],
      headSha: 'head-sha',
      auditPhase: 'post_merge',
    });

    expect(result.ok).toBe(true);
    expect(result.undispositionedCount).toBe(0);
    expect(result.failures).toEqual([]);
  });

  it('does not create a post-merge exception for an outdated bot thread superseded by the same reviewer cleanly reviewing current head', () => {
    const currentHeadReview = {
      ...approvalRecommendedReview,
      id: 5035009706,
      commit_id: 'new-sha',
      submitted_at: '2026-08-26T21:05:00Z',
    };

    const result = evaluateReviewerCommentDisposition({
      body: '## REVIEWER RESPONSE ACCOUNTING\n- reviewed',
      reviewComments: [{
        id: 3853170861,
        user: { login: 'copilot-pull-request-reviewer[bot]' },
        commit_id: 'old-sha',
        path: 'scripts/ci/example.mjs',
        line: 20,
        body: 'Please fix this prior-head issue.',
        created_at: '2026-08-26T20:30:00Z',
      }],
      reviews: [currentHeadReview],
      headSha: 'new-sha',
      mergedAt: '2026-08-27T11:29:12Z',
      auditPhase: 'post_merge',
    });

    expect(result.ok).toBe(true);
    expect(result.outdatedWithoutDispositionCount).toBe(0);
    expect(result.failures).toEqual([]);
  });
});
