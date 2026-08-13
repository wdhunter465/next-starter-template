import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluatePrPreflight } from '../scripts/ci/pr_preflight.mjs';
import { parseImplementationActor } from '../scripts/ci/reviewer_lifecycle_gate.mjs';

function metadataBody(overrides = {}, prClass = 'ci', allowedPaths = null) {
  const values = {
    issue: '#2497',
    intentLabel: 'intent:ci',
    prClass,
    size: 'medium',
    deliveryModel: 'A',
    changeMode: 'project',
    targetEnvironment: 'production',
    approvalProfile: 'work-bill-production',
    gateProfile: 'production-candidate',
    rollbackProfile: 'one-step',
    componentBranch: 'not-applicable',
    componentMaster: 'not-applicable',
    implementationAgent: 'Cursor Local',
    ...overrides,
  };
  const paths = allowedPaths || [
    '`scripts/ci/**`',
    '`tests/**`',
    '`docs/reference/ci/**`',
    '`.github/workflows/gate-quality.yml`',
    '`package.json`',
  ];
  const implementationLine = Object.prototype.hasOwnProperty.call(overrides, 'implementationAgent')
    && !overrides.implementationAgent
    ? ''
    : `- Implementation agent: ${values.implementationAgent}\n`;

  return `# PR Summary

- **Issue:** ${values.issue}
- Intent label: ${values.intentLabel}
- PR class: ${values.prClass}
- Size: ${values.size}
- Delivery model: ${values.deliveryModel}
- Change mode: ${values.changeMode}
- Target environment: ${values.targetEnvironment}
- Approval profile: ${values.approvalProfile}
- Gate profile: ${values.gateProfile}
- Rollback profile: ${values.rollbackProfile}
${implementationLine}- Component branch: ${values.componentBranch}
- Component master: ${values.componentMaster}

## Scope

Allowed paths:
${paths.map((path) => `- ${path}`).join('\n')}

Out-of-scope changes present: NO
Exception issue/approval if YES: not-applicable

## Change Summary

Preflight fixture body.

## Verification

Local verification:
- Command: \`npm test\`
  Result: PASS

CI verification:
- Required checks expected to pass: YES
- Known failing/advisory checks: none

## Acceptance Criteria

- [x] Source issue acceptance criteria reviewed
- [x] Criteria complete, or a follow-up issue is linked below

Follow-up issue required: NO
Follow-up issue if required: not-applicable

## Reviewer / Bot Review Attestation

- [x] I have read all human review threads on this PR
- [x] I have read all bot/advisory findings on this PR
`;
}

function runPreflight(overrides = {}, options = {}) {
  const body = metadataBody(overrides.metadata, overrides.prClass);
  return evaluatePrPreflight({
    body,
    baseRef: options.baseRef || 'main',
    headRef: options.headRef || 'cursor/2497-branch-aware-ci',
    changedFiles: options.changedFiles || ['scripts/ci/pr_preflight.mjs'],
    repository: options.repository || 'wdhunter645/next-starter-template',
    reviews: options.reviews || [],
    reviewThreads: options.reviewThreads || [],
    issueComments: options.issueComments || [],
    reviewComments: options.reviewComments || [],
    labels: options.labels || [],
    pr: options.pr || {},
    sourceIssue: options.sourceIssue ?? null,
  });
}

describe('pr preflight profile routing', () => {
  it('passes Model A code with closeout prediction', () => {
    const result = runPreflight({ prClass: 'code' });

    expect(result.deliveryProfile.deliveryModel).toBe('A');
    expect(result.qualityPlan.build).toBe(true);
    expect(result.closeoutPrediction.applicable).toBe(true);
    expect(result.result).toBe('pass');
  });

  it('passes Model A docs with light quality and closeout prediction', () => {
    const result = runPreflight(
      { prClass: 'docs-governance' },
      { changedFiles: ['docs/reference/ci/delivery-profile-contract.md'] },
    );

    expect(result.deliveryProfile.deliveryModel).toBe('A');
    expect(result.qualityPlan.build).toBe(false);
    expect(result.qualityPlan.test).toBe(false);
    expect(result.closeoutPrediction.applicable).toBe(true);
    expect(result.result).toBe('pass');
  });

  it('passes non-protected Model B child code with component profile', () => {
    const result = runPreflight(
      {
        prClass: 'code',
        metadata: {
          size: 'medium-provisional',
          deliveryModel: 'B-child',
          targetEnvironment: 'component',
          approvalProfile: 'protected-change-review',
          gateProfile: 'component-child',
          rollbackProfile: 'multi-step',
          componentBranch: 'component/delivery-system-v1',
          componentMaster: '#2477',
        },
      },
      {
        baseRef: 'component/delivery-system-v1',
        headRef: 'cursor/2497-branch-aware-ci',
        changedFiles: ['scripts/ci/pr_preflight.mjs'],
      },
    );

    expect(result.deliveryProfile.gateProfile).toBe('component-child');
    expect(result.deliveryProfile.protectedChange).toBe(true);
    expect(result.qualityPlan.build).toBe(true);
    expect(result.closeoutPrediction.applicable).toBe(false);
    expect(result.result).toBe('pass');
  });

  it('passes non-protected Model B child docs with light quality', () => {
    const result = runPreflight(
      {
        prClass: 'docs-content',
        metadata: {
          size: 'medium-provisional',
          deliveryModel: 'B-child',
          targetEnvironment: 'component',
          approvalProfile: 'component-auto-integration',
          gateProfile: 'component-child',
          rollbackProfile: 'multi-step',
          componentBranch: 'component/delivery-system-v1',
          componentMaster: '#2477',
        },
      },
      {
        baseRef: 'component/delivery-system-v1',
        changedFiles: ['docs/reference/ci/delivery-profile-contract.md'],
      },
    );

    expect(result.deliveryProfile.protectedChange).toBe(false);
    expect(result.qualityPlan.build).toBe(false);
    expect(result.qualityPlan.test).toBe(false);
    expect(result.result).toBe('pass');
  });

  it('passes Model B promotion release with full quality and closeout prediction', () => {
    const result = runPreflight(
      {
        prClass: 'release',
        metadata: {
          deliveryModel: 'B-promotion',
          targetEnvironment: 'production',
          approvalProfile: 'work-bill-production',
          gateProfile: 'component-promotion',
          rollbackProfile: 'multi-step',
          componentBranch: 'component/delivery-system-v1',
          componentMaster: '#2477',
        },
      },
      {
        baseRef: 'main',
        headRef: 'component/delivery-system-v1',
        changedFiles: ['docs/reference/ci/delivery-profile-contract.md'],
      },
    );

    expect(result.deliveryProfile.deliveryModel).toBe('B-promotion');
    expect(result.qualityPlan.build).toBe(true);
    expect(result.closeoutPrediction.applicable).toBe(true);
    expect(result.result).toBe('pass');
  });

  it('passes emergency recovery ops profile', () => {
    const result = runPreflight(
      {
        prClass: 'ops',
        metadata: {
          deliveryModel: 'emergency-recovery',
          changeMode: 'emergency',
          targetEnvironment: 'recovery',
          approvalProfile: 'emergency-approval',
          gateProfile: 'emergency-recovery',
          rollbackProfile: 'emergency-stabilization',
        },
      },
      { changedFiles: ['scripts/ci/pr_preflight.mjs'] },
    );

    expect(result.deliveryProfile.deliveryModel).toBe('emergency-recovery');
    expect(result.qualityPlan.build).toBe(false);
    expect(result.closeoutPrediction.applicable).toBe(false);
    expect(result.result).toBe('pass');
  });

  it('blocks invalid delivery profile metadata', () => {
    const result = runPreflight({
      metadata: {
        deliveryModel: 'Model C',
        targetEnvironment: 'component',
        approvalProfile: 'protected-change-review',
        gateProfile: 'component-child',
        rollbackProfile: 'multi-step',
        componentBranch: 'component/delivery-system-v1',
        componentMaster: '#2477',
      },
    }, {
      baseRef: 'component/delivery-system-v1',
    });

    expect(result.result).toBe('block');
    expect(result.blocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'invalid_deliveryModel' }),
    ]));
  });

  it('blocks invalid branch routing for Model A', () => {
    const result = runPreflight({}, { baseRef: 'component/delivery-system-v1' });

    expect(result.result).toBe('block');
    expect(result.blocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'invalid_baseRef' }),
    ]));
  });

  it('fails protected child metadata that still claims auto-integration', () => {
    const result = runPreflight(
      {
        metadata: {
          deliveryModel: 'B-child',
          targetEnvironment: 'component',
          approvalProfile: 'component-auto-integration',
          gateProfile: 'component-child',
          rollbackProfile: 'multi-step',
          componentBranch: 'component/delivery-system-v1',
          componentMaster: '#2477',
        },
      },
      {
        baseRef: 'component/delivery-system-v1',
        changedFiles: ['docs/governance/PR_PROCESS.md'],
      },
    );

    expect(result.deliveryProfile.protectedChange).toBe(true);
    expect(result.result).toBe('block');
    expect(result.blocks).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'invalid_approvalProfile' }),
    ]));
  });
});

describe('pr preflight evidence surfaces', () => {
  it('reports required preflight sections', () => {
    const result = runPreflight();

    expect(result).toMatchObject({
      schemaVersion: 1,
      deliveryProfile: expect.any(Object),
      qualityPlan: expect.any(Object),
      scopeResult: expect.any(Object),
      requiredLocalCommands: expect.any(Array),
      githubEvidence: expect.any(Object),
      reviewThreadResult: expect.any(Object),
      sourceIssueAccounting: expect.any(Object),
      closeoutPrediction: expect.any(Object),
      protectedChange: expect.any(Boolean),
      result: expect.stringMatching(/^(pass|fail|block)$/),
    });
    expect(result.sourceIssueAccounting.issueNumber).toBe('2497');
    expect(result.requiredLocalCommands.length).toBeGreaterThan(0);
  });

  it('fails when unresolved human review threads are present', () => {
    const result = runPreflight({}, {
      reviewThreads: [{
        id: 'thread-1',
        isResolved: false,
        isOutdated: false,
        comments: { nodes: [{ author: { login: 'bill' }, body: 'Please fix this.' }] },
      }],
    });

    expect(result.reviewThreadResult.status).toBe('fail');
    expect(result.result).toBe('fail');
  });

  it('fails when the implementation identity approves its own PR', () => {
    const result = runPreflight({
      metadata: { implementationAgent: 'codex' },
    }, {
      pr: { author: { login: 'codex' } },
      reviews: [{
        user: { login: 'codex' },
        state: 'APPROVED',
        commit_id: 'head-sha',
      }],
    });

    expect(result.reviewThreadResult.blockingReasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'implementer-self-approval' }),
    ]));
    expect(result.result).toBe('fail');
  });

  it('accepts Work approval when Work and the implementer share a GitHub login', () => {
    const result = runPreflight({}, {
      pr: {
        author: { login: 'wdhunter645' },
        implementationActor: 'codex',
      },
      reviews: [{
        user: { login: 'wdhunter645' },
        body: 'Reviewer actor: Work',
        state: 'APPROVED',
        commit_id: 'head-sha',
      }],
    });

    expect(result.reviewThreadResult.blockingReasons).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'implementer-self-approval' }),
    ]));
    expect(result.result).toBe('pass');
  });

  it('rejects Codex approval attestation when actors share a GitHub login', () => {
    const result = runPreflight({}, {
      pr: {
        author: { login: 'wdhunter645' },
        implementationActor: 'codex',
      },
      reviews: [{
        user: { login: 'wdhunter645' },
        body: 'Reviewer actor: Codex\nDecision: APPROVED',
        state: 'COMMENTED',
        commit_id: 'head-sha',
      }],
    });

    expect(result.reviewThreadResult.blockingReasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'implementer-self-approval' }),
    ]));
    expect(result.result).toBe('fail');
  });

});


describe('reviewer lifecycle actor metadata parsing', () => {
  it('reads the implementation actor from standard bulleted PR metadata', () => {
    const body = '# PR Summary\n\n- Implementation agent: Codex\n- Independent reviewer: ChatGPT Work';

    expect(parseImplementationActor(body)).toBe('Codex');
  });

  it('reads the implementation actor from unbulleted PR metadata', () => {
    const body = '# PR Summary\n\nImplementation agent: Codex\nIndependent reviewer: ChatGPT Work';

    expect(parseImplementationActor(body)).toBe('Codex');
  });

  it('uses the canonical regex metacharacter escape class', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'scripts/ci/reviewer_lifecycle_gate.mjs'),
      'utf8',
    );

    expect(source).toContain("field.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')");
  });
});
