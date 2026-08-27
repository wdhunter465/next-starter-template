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
    '- **Comments generated:** 0',
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
});
