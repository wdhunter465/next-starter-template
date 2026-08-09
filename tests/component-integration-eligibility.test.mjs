import { describe, expect, it } from 'vitest';
import {
  COMPONENT_STATES,
  HOLD_LABELS,
  assessChecks,
  assessProtectedChangeReview,
  assessReviews,
  deriveComponentStateFromCombinedStatus,
  evaluateComponentIntegration,
  selectAuthoritativeChecks,
} from '../scripts/ci/component_integration_eligibility.mjs';

function eligibleProfile(overrides = {}) {
  return {
    deliveryModel: 'B-child',
    gateProfile: 'component-child',
    approvalProfile: 'component-auto-integration',
    componentBranch: 'component/delivery-system-v1',
    componentMaster: '#2477',
    protectedChange: false,
    errors: [],
    baseRef: 'component/delivery-system-v1',
    baseBehindComponentHead: 0,
    ...overrides,
  };
}

function greenChecks() {
  return [
    { name: 'GATE — Quality Checks', conclusion: 'success' },
    { name: 'GATE — Diff Scope', conclusion: 'success' },
  ];
}

function evaluate(overrides = {}, options = {}) {
  const profile = eligibleProfile(overrides.profile);
  return evaluateComponentIntegration({
    profile,
    checks: 'checks' in options ? options.checks : greenChecks(),
    reviews: options.reviews || [],
    componentState: options.componentState || 'green',
    labels: options.labels || [],
    changedFiles: options.changedFiles || ['src/components/example.tsx'],
    headSha: options.headSha || profile.headSha || 'abc123',
    implementationLogin: options.implementationLogin || '',
  });
}

describe('component integration contract constants', () => {
  it('exports stable hold labels and component states', () => {
    expect(HOLD_LABELS).toEqual(['component-integration-hold', 'hold:component-integration']);
    expect(COMPONENT_STATES).toEqual(['green', 'red', 'hold']);
  });
});

describe('component integration negative fixtures', () => {
  it('blocks failed checks', () => {
    const result = evaluate({}, {
      checks: [
        { name: 'GATE — Quality Checks', conclusion: 'success' },
        { name: 'GATE — Diff Scope', conclusion: 'failure' },
      ],
    });

    expect(result.eligible).toBe(false);
    expect(result.blockedReasons.map((reason) => reason.code)).toContain('failed_check');
    expect(result.requiresChatReview).toBe(false);
  });

  it('blocks pending checks', () => {
    const result = evaluate({}, {
      checks: [
        { name: 'GATE — Quality Checks', conclusion: 'success' },
        { name: 'GATE — Diff Scope', status: 'in_progress' },
      ],
    });

    expect(result.eligible).toBe(false);
    expect(result.blockedReasons.map((reason) => reason.code)).toContain('pending_check');
  });

  it('blocks non-component base branches', () => {
    const result = evaluate({
      profile: {
        baseRef: 'main',
        componentBranch: 'component/delivery-system-v1',
      },
    });

    expect(result.eligible).toBe(false);
    expect(result.blockedReasons.map((reason) => reason.code)).toContain('non_component_base');
  });

  it('blocks protected changes and requires Chat review', () => {
    const result = evaluate({
      profile: {
        protectedChange: true,
        approvalProfile: 'protected-change-review',
      },
    }, {
      changedFiles: ['.github/workflows/gate-quality.yml'],
    });

    expect(result.eligible).toBe(false);
    expect(result.requiresChatReview).toBe(true);
    expect(result.blockedReasons.map((reason) => reason.code)).toContain('protected_change');
  });

  it('blocks component integration holds from labels', () => {
    const result = evaluate({}, {
      labels: [{ name: 'component-integration-hold' }],
    });

    expect(result.eligible).toBe(false);
    expect(result.blockedReasons.map((reason) => reason.code)).toContain('component_hold');
  });

  it('blocks component red integration state', () => {
    const result = evaluate({}, { componentState: 'red' });

    expect(result.eligible).toBe(false);
    expect(result.blockedReasons.map((reason) => reason.code)).toContain('component_red_state');
  });

  it('blocks component branch metadata mismatch', () => {
    const result = evaluate({
      profile: {
        componentBranch: 'component/other-release',
        baseRef: 'component/delivery-system-v1',
      },
    });

    expect(result.eligible).toBe(false);
    expect(result.blockedReasons.map((reason) => reason.code)).toContain('branch_mismatch');
  });

  it('blocks missing component master metadata', () => {
    const result = evaluate({
      profile: {
        componentMaster: '',
      },
    });

    expect(result.eligible).toBe(false);
    expect(result.blockedReasons.map((reason) => reason.code)).toContain('missing_component_master');
  });

  it('blocks stale PR base behind component branch head', () => {
    const result = evaluate({
      profile: {
        baseBehindComponentHead: 3,
      },
    });

    expect(result.eligible).toBe(false);
    expect(result.blockedReasons.map((reason) => reason.code)).toContain('stale_base');
  });

  it('blocks production and emergency delivery models', () => {
    const production = evaluate({
      profile: {
        deliveryModel: 'A',
        gateProfile: 'production-candidate',
        approvalProfile: 'chat-bill-production',
        componentBranch: '',
        componentMaster: '',
        baseRef: 'main',
      },
    });
    const emergency = evaluate({
      profile: {
        deliveryModel: 'emergency-recovery',
        gateProfile: 'emergency-recovery',
        approvalProfile: 'emergency-approval',
        componentBranch: '',
        componentMaster: '',
        baseRef: 'main',
      },
    });

    expect(production.eligible).toBe(false);
    expect(emergency.eligible).toBe(false);
    expect(production.blockedReasons.map((reason) => reason.code)).toContain('invalid_delivery_model');
    expect(emergency.blockedReasons.map((reason) => reason.code)).toContain('invalid_delivery_model');
  });
});

describe('component integration positive fixture', () => {
  it('marks a clean eligible Model B child as auto-integration eligible', () => {
    const result = evaluate();

    expect(result).toEqual({
      eligible: true,
      blockedReasons: [],
      requiresChatReview: false,
      componentState: 'green',
      deliveryModel: 'B-child',
      gateProfile: 'component-child',
      approvalProfile: 'component-auto-integration',
      componentBranch: 'component/delivery-system-v1',
      componentMaster: '#2477',
      protectedChange: false,
    });
  });
});

describe('component integration check/review truthfulness (#2536)', () => {
  it('ignores self, advisory, stale, and unrelated check runs', () => {
    const authoritative = selectAuthoritativeChecks([
      { name: 'Component Integration Eligibility', status: 'in_progress', id: 1 },
      { name: 'component-child-integration', status: 'queued', id: 2 },
      { name: 'cursor-review', conclusion: 'failure', completed_at: '2026-07-15T12:00:00Z', id: 3 },
      { name: 'DIATAXIS Folder Authority', conclusion: 'failure', completed_at: '2026-07-15T12:00:01Z', id: 4 },
      { name: 'Cloudflare Pages', status: 'in_progress', id: 5 },
      {
        name: 'GATE — Quality Checks',
        conclusion: 'failure',
        completed_at: '2026-07-15T11:00:00Z',
        id: 6,
      },
      {
        name: 'GATE — Quality Checks',
        conclusion: 'success',
        completed_at: '2026-07-15T12:30:00Z',
        id: 7,
      },
      {
        name: 'GATE — Diff Scope',
        conclusion: 'success',
        completed_at: '2026-07-15T12:30:01Z',
        id: 8,
      },
    ]);

    expect(authoritative.map((check) => check.name).sort()).toEqual([
      'GATE — Diff Scope',
      'GATE — Quality Checks',
    ]);
    expect(authoritative.find((check) => check.name === 'GATE — Quality Checks')?.conclusion).toBe('success');
    expect(assessChecks(authoritative).failed).toEqual([]);
    expect(assessChecks(authoritative).pending).toEqual([]);
  });

  it('reproduces the #2527-style false-block and proves settle eligibility', () => {
    const artifactLikeChecks = [
      { name: 'component-child-integration', status: 'in_progress', id: 1 },
      { name: 'Component Integration Eligibility', status: 'queued', id: 2 },
      { name: 'validate-diataxis-authority', status: 'in_progress', id: 3 },
      { name: 'reviewer-response-completion', status: 'in_progress', id: 4 },
      { name: 'cursor-review', status: 'queued', id: 5 },
      {
        name: 'GATE — Quality Checks',
        conclusion: 'success',
        completed_at: '2026-07-15T13:00:00Z',
        id: 6,
      },
      {
        name: 'GATE — Diff Scope',
        conclusion: 'success',
        completed_at: '2026-07-15T13:00:01Z',
        id: 7,
      },
      {
        name: 'GATE — Secret Scan',
        conclusion: 'success',
        completed_at: '2026-07-15T13:00:02Z',
        id: 8,
      },
    ];

    const settled = evaluate({
      profile: { headSha: 'abc123' },
    }, {
      checks: artifactLikeChecks,
      reviews: [
        {
          state: 'CHANGES_REQUESTED',
          commit_id: 'oldsha',
          submitted_at: '2026-07-15T10:00:00Z',
          user: { login: 'copilot-pull-request-reviewer' },
        },
      ],
      componentState: deriveComponentStateFromCombinedStatus('pending'),
    });

    expect(deriveComponentStateFromCombinedStatus('pending')).toBe('green');
    expect(settled.eligible).toBe(true);
    expect(settled.requiresChatReview).toBe(false);
    expect(settled.blockedReasons).toEqual([]);
  });

  it('blocks only current-head CHANGES_REQUESTED after latest-by-author selection', () => {
    const headSha = 'headsha';
    const blocked = assessReviews([
      {
        state: 'CHANGES_REQUESTED',
        commit_id: headSha,
        submitted_at: '2026-07-15T12:00:00Z',
        user: { login: 'reviewer' },
      },
    ], { headSha });
    expect(blocked.map((reason) => reason.code)).toContain('changes_requested');

    const cleared = assessReviews([
      {
        state: 'CHANGES_REQUESTED',
        commit_id: 'old',
        submitted_at: '2026-07-15T11:00:00Z',
        user: { login: 'reviewer' },
      },
      {
        state: 'APPROVED',
        commit_id: headSha,
        submitted_at: '2026-07-15T12:00:00Z',
        user: { login: 'reviewer' },
      },
    ], { headSha });
    expect(cleared).toEqual([]);
  });

  it('blocks component integration when the implementer supplies the approval', () => {
    const result = evaluate({}, {
      implementationLogin: 'codex',
      reviews: [
        {
          state: 'APPROVED',
          commit_id: 'abc123',
          submitted_at: '2026-07-24T23:45:00Z',
          user: { login: 'codex' },
        },
      ],
    });

    expect(result.eligible).toBe(false);
    expect(result.blockedReasons.map((reason) => reason.code)).toContain('implementer-self-approval');
  });

  it('does not treat pending combined status as component hold', () => {
    expect(deriveComponentStateFromCombinedStatus('pending')).toBe('green');
    expect(deriveComponentStateFromCombinedStatus('failure')).toBe('red');
    const held = evaluate({}, {
      labels: [{ name: 'component-integration-hold' }],
      componentState: 'green',
    });
    expect(held.blockedReasons.map((reason) => reason.code)).toContain('component_hold');
  });
});

describe('protected-change review completion (#3151)', () => {
  const headSha = 'headsha';

  function independentApproval(overrides = {}) {
    return {
      state: 'APPROVED',
      commit_id: headSha,
      submitted_at: '2026-08-07T12:00:00Z',
      user: { login: 'engineering-approver' },
      ...overrides,
    };
  }

  describe('assessProtectedChangeReview() unit behavior', () => {
    it('1. is pending with no reviews at all', () => {
      const result = assessProtectedChangeReview({ implementationLogin: 'codex', reviews: [], headSha });
      expect(result.satisfied).toBe(false);
      expect(result.blockers.map((b) => b.code)).toEqual(['protected_change']);
    });

    it('2. is satisfied by an independent current-head APPROVED review', () => {
      const result = assessProtectedChangeReview({
        implementationLogin: 'codex',
        reviews: [independentApproval()],
        headSha,
      });
      expect(result.satisfied).toBe(true);
      expect(result.blockers).toEqual([]);
    });

    it('3. is stale when the only independent approval is for a prior head', () => {
      const result = assessProtectedChangeReview({
        implementationLogin: 'codex',
        reviews: [independentApproval({ commit_id: 'oldsha' })],
        headSha,
      });
      expect(result.satisfied).toBe(false);
      expect(result.blockers.map((b) => b.code)).toEqual(['protected_change_stale_approval']);
    });

    it('5. self-approval alone does not satisfy the requirement', () => {
      const result = assessProtectedChangeReview({
        implementationLogin: 'codex',
        reviews: [independentApproval({ user: { login: 'codex' } })],
        headSha,
      });
      expect(result.satisfied).toBe(false);
      expect(result.blockers.map((b) => b.code)).toEqual(['protected_change']);
    });

    it('an independent approval for the current head satisfies even when a stale approval also exists', () => {
      const result = assessProtectedChangeReview({
        implementationLogin: 'codex',
        reviews: [
          independentApproval({ commit_id: 'oldsha', user: { login: 'reviewer-a' } }),
          independentApproval({ commit_id: headSha, user: { login: 'reviewer-b' } }),
        ],
        headSha,
      });
      expect(result.satisfied).toBe(true);
    });

    it('honors a Reviewer actor attestation over the raw GitHub login for identity comparison', () => {
      const result = assessProtectedChangeReview({
        implementationLogin: 'codex',
        reviews: [
          independentApproval({
            user: { login: 'some-bot' },
            body: 'Reviewer actor: codex\nDecision: APPROVED',
          }),
        ],
        headSha,
      });
      // the attested actor ("codex") matches the implementer, so this does not count as independent
      expect(result.satisfied).toBe(false);
    });
  });

  describe('evaluateComponentIntegration() integration behavior', () => {
    it('1. pending: blocks with protected_change and requiresChatReview true (no regression)', () => {
      const result = evaluate({
        profile: { protectedChange: true, approvalProfile: 'protected-change-review' },
      }, { changedFiles: ['.github/workflows/gate-quality.yml'] });

      expect(result.eligible).toBe(false);
      expect(result.requiresChatReview).toBe(true);
      expect(result.blockedReasons.map((r) => r.code)).toContain('protected_change');
    });

    it('2. satisfied: clears protected_change and requiresChatReview when independent current-head approval exists', () => {
      const result = evaluate({
        profile: { protectedChange: true, approvalProfile: 'protected-change-review', headSha },
      }, {
        changedFiles: ['.github/workflows/gate-quality.yml'],
        headSha,
        implementationLogin: 'codex',
        reviews: [independentApproval()],
      });

      expect(result.eligible).toBe(true);
      expect(result.requiresChatReview).toBe(false);
      expect(result.blockedReasons.map((r) => r.code)).not.toContain('protected_change');
      expect(result.blockedReasons.map((r) => r.code)).not.toContain('protected_change_stale_approval');
    });

    it('3. stale: blocks with protected_change_stale_approval, not the generic pending code', () => {
      const result = evaluate({
        profile: { protectedChange: true, approvalProfile: 'protected-change-review', headSha },
      }, {
        changedFiles: ['.github/workflows/gate-quality.yml'],
        headSha,
        implementationLogin: 'codex',
        reviews: [independentApproval({ commit_id: 'oldsha' })],
      });

      expect(result.eligible).toBe(false);
      expect(result.requiresChatReview).toBe(true);
      expect(result.blockedReasons.map((r) => r.code)).toContain('protected_change_stale_approval');
      expect(result.blockedReasons.map((r) => r.code)).not.toContain('protected_change');
    });

    it('4. current-head CHANGES_REQUESTED remains blocking alongside the still-pending protected_change state', () => {
      const result = evaluate({
        profile: { protectedChange: true, approvalProfile: 'protected-change-review', headSha },
      }, {
        changedFiles: ['.github/workflows/gate-quality.yml'],
        headSha,
        implementationLogin: 'codex',
        reviews: [{
          state: 'CHANGES_REQUESTED',
          commit_id: headSha,
          submitted_at: '2026-08-07T12:00:00Z',
          user: { login: 'engineering-approver' },
        }],
      });

      expect(result.eligible).toBe(false);
      expect(result.blockedReasons.map((r) => r.code)).toContain('changes_requested');
      expect(result.blockedReasons.map((r) => r.code)).toContain('protected_change');
    });

    it('5. self-approval: implementer-self-approval and protected_change both remain, protected change is not satisfied', () => {
      const result = evaluate({
        profile: { protectedChange: true, approvalProfile: 'protected-change-review', headSha },
      }, {
        changedFiles: ['.github/workflows/gate-quality.yml'],
        headSha,
        implementationLogin: 'codex',
        reviews: [independentApproval({ user: { login: 'codex' } })],
      });

      expect(result.eligible).toBe(false);
      expect(result.requiresChatReview).toBe(true);
      expect(result.blockedReasons.map((r) => r.code)).toContain('protected_change');
      expect(result.blockedReasons.map((r) => r.code)).toContain('implementer-self-approval');
    });

    it('6. non-protected children are unaffected: no protected_change assessment runs at all', () => {
      const result = evaluate({
        profile: { protectedChange: false },
      }, { headSha, reviews: [] });

      expect(result.requiresChatReview).toBe(false);
      expect(result.blockedReasons.map((r) => r.code)).not.toContain('protected_change');
      expect(result.blockedReasons.map((r) => r.code)).not.toContain('protected_change_stale_approval');
    });
  });
});
