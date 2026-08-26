import { describe, expect, it } from 'vitest';
import { classifyDeliveryProfile } from '../scripts/ci/delivery_profile.mjs';
import {
  DELIVERY_QUALITY_MINIMUMS,
  determineQualityPlan,
  normalizePrClass,
  renderQualityPlan,
} from '../scripts/ci/pr_class_quality_plan.mjs';

function bodyFor(prClass, deliveryOverrides = {}) {
  const values = {
    size: 'medium',
    deliveryModel: 'A',
    changeMode: 'project',
    targetEnvironment: 'production',
    approvalProfile: 'work-bill-production',
    gateProfile: 'production-candidate',
    rollbackProfile: 'one-step',
    componentBranch: 'not-applicable',
    componentMaster: 'not-applicable',
    ...deliveryOverrides,
  };

  return `# PR Summary

- **Issue:** #2181
- Intent label: intent:ci
- PR class: ${prClass}
- Size: ${values.size}
- Delivery model: ${values.deliveryModel}
- Change mode: ${values.changeMode}
- Target environment: ${values.targetEnvironment}
- Approval profile: ${values.approvalProfile}
- Gate profile: ${values.gateProfile}
- Rollback profile: ${values.rollbackProfile}
- Component branch: ${values.componentBranch}
- Component master: ${values.componentMaster}
`;
}

function classify(body, options = {}) {
  return classifyDeliveryProfile({
    baseRef: options.baseRef || 'main',
    headRef: options.headRef || 'cursor/example',
    body,
    changedFiles: options.changedFiles,
  });
}

describe('PR class quality plan', () => {
  it('normalizes valid PR classes', () => {
    expect(normalizePrClass('ci')).toBe('ci');
    expect(normalizePrClass('mixed-approved')).toBe('mixed-approved');
  });

  it('rejects invalid or placeholder PR classes', () => {
    expect(normalizePrClass('')).toBe('');
    expect(normalizePrClass('<!-- code / ci -->')).toBe('');
    expect(normalizePrClass('unknown')).toBe('');
  });

  it('runs full quality for code, release, and mixed-approved PRs', () => {
    for (const prClass of ['code', 'release', 'mixed-approved']) {
      const plan = determineQualityPlan({ body: bodyFor(prClass) });
      expect(plan.prClass).toBe(prClass);
      expect(plan.typecheck).toBe(true);
      expect(plan.lint).toBe(true);
      expect(plan.test).toBe(true);
      expect(plan.build).toBe(true);
    }
  });

  it('skips production build for governance, CI, config, ops, and docs classes', () => {
    for (const prClass of ['docs-governance', 'docs-content', 'ci', 'config', 'ops']) {
      const plan = determineQualityPlan({ body: bodyFor(prClass) });
      expect(plan.prClass).toBe(prClass);
      expect(plan.typecheck).toBe(true);
      expect(plan.lint).toBe(true);
      expect(plan.build).toBe(false);
    }
  });

  it('skips unit tests for docs-only and ops classes', () => {
    for (const prClass of ['docs-governance', 'docs-content', 'ops', 'config']) {
      const plan = determineQualityPlan({ body: bodyFor(prClass) });
      expect(plan.test).toBe(false);
    }
  });

  it('defaults to full code profile when class is missing', () => {
    const plan = determineQualityPlan({ body: '# PR Summary\n\n- **Issue:** #2181' });
    expect(plan.prClass).toBe('code');
    expect(plan.explicitPrClass).toBe(false);
    expect(plan.build).toBe(true);
  });

  it('renders the selected plan', () => {
    const rendered = renderQualityPlan(determineQualityPlan({ body: bodyFor('ci') }));
    expect(rendered).toContain('PR class: ci');
    expect(rendered).toContain('Run production build: no');
  });
});

describe('delivery-profile quality routing', () => {
  it('exports stable delivery minimum profiles', () => {
    expect(Object.keys(DELIVERY_QUALITY_MINIMUMS).sort()).toEqual([
      'component-child',
      'component-promotion',
      'documentation',
      'emergency-recovery',
      'production-candidate',
    ].sort());
  });

  it('requires full production build for Model A code paths', () => {
    const body = bodyFor('code');
    const plan = determineQualityPlan({
      body,
      deliveryProfile: classify(body, { changedFiles: ['src/app/page.tsx'] }),
    });

    expect(plan.deliveryGateProfile).toBe('production-candidate');
    expect(plan.build).toBe(true);
    expect(plan.test).toBe(true);
  });

  it('keeps Model A docs paths light', () => {
    const body = bodyFor('docs-governance');
    const plan = determineQualityPlan({
      body,
      deliveryProfile: classify(body, { changedFiles: ['docs/reference/ci/delivery-profile-contract.md'] }),
    });

    expect(plan.build).toBe(false);
    expect(plan.test).toBe(false);
  });

  it('keeps non-protected Model B child docs light', () => {
    const body = bodyFor('docs-content', {
      size: 'medium-provisional',
      deliveryModel: 'B-child',
      targetEnvironment: 'component',
      approvalProfile: 'component-auto-integration',
      gateProfile: 'component-child',
      rollbackProfile: 'multi-step',
      componentBranch: 'component/delivery-system-v1',
      componentMaster: '#2477',
    });
    const plan = determineQualityPlan({
      body,
      deliveryProfile: classify(body, {
        baseRef: 'component/delivery-system-v1',
        changedFiles: ['docs/reference/ci/delivery-profile-contract.md'],
      }),
    });

    expect(plan.deliveryGateProfile).toBe('component-child');
    expect(plan.build).toBe(false);
    expect(plan.test).toBe(false);
  });

  it('upgrades protected Model B child paths to full quality', () => {
    const body = bodyFor('docs-content', {
      deliveryModel: 'B-child',
      targetEnvironment: 'component',
      approvalProfile: 'protected-change-review',
      gateProfile: 'component-child',
      rollbackProfile: 'multi-step',
      componentBranch: 'component/delivery-system-v1',
      componentMaster: '#2477',
    });
    const plan = determineQualityPlan({
      body,
      deliveryProfile: classify(body, {
        baseRef: 'component/delivery-system-v1',
        changedFiles: ['scripts/ci/delivery_profile.mjs'],
      }),
    });

    expect(plan.protectedChange).toBe(true);
    expect(plan.build).toBe(true);
    expect(plan.test).toBe(true);
  });

  it('requires full production build for Model B promotion release paths', () => {
    const body = bodyFor('release', {
      deliveryModel: 'B-promotion',
      targetEnvironment: 'production',
      approvalProfile: 'work-bill-production',
      gateProfile: 'component-promotion',
      rollbackProfile: 'multi-step',
      componentBranch: 'component/delivery-system-v1',
      componentMaster: '#2477',
    });
    const plan = determineQualityPlan({
      body,
      deliveryProfile: classify(body, {
        baseRef: 'main',
        headRef: 'component/delivery-system-v1',
        changedFiles: ['docs/reference/ci/delivery-profile-contract.md'],
      }),
    });

    expect(plan.deliveryGateProfile).toBe('component-promotion');
    expect(plan.build).toBe(true);
    expect(plan.test).toBe(true);
  });

  it('keeps emergency recovery ops paths light', () => {
    const body = bodyFor('ops', {
      deliveryModel: 'emergency-recovery',
      changeMode: 'emergency',
      targetEnvironment: 'recovery',
      approvalProfile: 'emergency-approval',
      gateProfile: 'emergency-recovery',
      rollbackProfile: 'emergency-stabilization',
    });
    const plan = determineQualityPlan({
      body,
      deliveryProfile: classify(body, { changedFiles: ['scripts/ci/pr_preflight.mjs'] }),
    });

    expect(plan.deliveryGateProfile).toBe('emergency-recovery');
    expect(plan.build).toBe(false);
    expect(plan.test).toBe(false);
  });

  it('preserves PR class routing when delivery profile is invalid', () => {
    const body = bodyFor('ci', { deliveryModel: 'Model X' });
    const plan = determineQualityPlan({
      body,
      deliveryProfile: classify(body, { baseRef: 'component/delivery-system-v1' }),
    });

    expect(plan.prClass).toBe('ci');
    expect(plan.test).toBe(true);
    expect(plan.build).toBe(false);
    expect(plan.deliveryProfileValid).toBe(false);
  });
});
