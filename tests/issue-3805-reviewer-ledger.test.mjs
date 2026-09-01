import { describe, expect, it } from 'vitest';
import { evaluateReviewerCommentDisposition } from '../scripts/ci/reviewer_comment_disposition.mjs';

describe('issue #3805 reviewer-ledger convergence', () => {
  it('does not require a PR-body ledger for an outdated review submission superseded by a clean current-head review', () => {
    const result = evaluateReviewerCommentDisposition({
      body: '## REVIEWER RESPONSE ACCOUNTING\n- reviewed',
      reviews: [
        {
          id: 2005,
          user: { login: 'cubic-dev-ai[bot]' },
          commit_id: 'new-sha',
          state: 'COMMENTED',
          body: '## Approval recommended\nComments generated: 0',
          submitted_at: '2026-06-01T00:00:00Z',
        },
        {
          id: 2004,
          user: { login: 'cubic-dev-ai[bot]' },
          commit_id: 'old-sha',
          state: 'COMMENTED',
          body: 'Please update this helper.',
          submitted_at: '2026-06-02T00:00:00Z',
        },
      ],
      headSha: 'new-sha',
      auditPhase: 'post_merge',
    });

    expect(result.ok).toBe(true);
    expect(result.outdatedWithoutDispositionCount).toBe(0);
  });
});
