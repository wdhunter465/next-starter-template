import { describe, expect, it } from 'vitest';
import { classifyDeliveryProfile, DELIVERY_MODELS, GATE_PROFILES } from '../scripts/ci/delivery_profile.mjs';
import { determineQualityPlan } from '../scripts/ci/pr_class_quality_plan.mjs';

function modelCBody({
  approval = 'documentation-review',
  changeMode = 'documentation',
  target = 'docs',
} = {}) {
  return [
    'Size: small',
    'Delivery model: C',
    `Change mode: ${changeMode}`,
    `Target environment: ${target}`,
    `Approval profile: ${approval}`,
    'Gate profile: documentation',
    'Rollback profile: one-step',
  ].join('\n');
}

describe('Model C delivery profile', () => {
  it('DELIVERY_MODELS includes C', () => {
    expect(DELIVERY_MODELS).toContain('C');
    expect(GATE_PROFILES).toContain('documentation');
  });

  it('Model C valid docs-only classification passes', () => {
    const result = classifyDeliveryProfile({
      baseRef: 'main',
      headRef: 'docs/topic',
      body: modelCBody(),
      changedFiles: ['docs/how-to/pmo/classify-work-and-select-delivery-model.md'],
    });
    expect(result.errors).toEqual([]);
    expect(result.deliveryModel).toBe('C');
    expect(result.gateProfile).toBe('documentation');
  });

  it('Model C fails on prohibited code path', () => {
    const result = classifyDeliveryProfile({
      baseRef: 'main',
      headRef: 'docs/topic',
      body: modelCBody(),
      changedFiles: ['scripts/ci/delivery_profile.mjs'],
    });
    expect(result.errors.some((e) => e.code === 'model_c_path_prohibited')).toBe(true);
  });

  it('Model C fails on documentation-looking file under code path', () => {
    const result = classifyDeliveryProfile({
      baseRef: 'main',
      headRef: 'docs/topic',
      body: modelCBody(),
      changedFiles: ['functions/api/README.md'],
    });
    expect(result.errors.some((e) => e.code === 'model_c_path_prohibited')).toBe(true);
  });

  it('Model C fails closed on empty changed files', () => {
    const result = classifyDeliveryProfile({
      baseRef: 'main',
      headRef: 'docs/topic',
      body: modelCBody(),
      changedFiles: [],
    });
    expect(result.errors.some((e) => e.code === 'missing_changed_files_evidence')).toBe(true);
  });

  it('Model C cross-boundary rename fails', () => {
    const result = classifyDeliveryProfile({
      baseRef: 'main',
      headRef: 'docs/topic',
      body: modelCBody(),
      changedFiles: ['app/README.md'],
      renames: [{ from: 'docs/explanation/x.md', to: 'app/README.md' }],
    });
    expect(result.errors.some((e) => e.code === 'model_c_cross_boundary_move')).toBe(true);
  });

  it('Model C governance path requires protected-change-review', () => {
    const result = classifyDeliveryProfile({
      baseRef: 'main',
      headRef: 'docs/topic',
      body: modelCBody({ approval: 'documentation-review' }),
      changedFiles: ['docs/governance/DELIVERY-AND-RELEASE.md'],
    });
    expect(result.errors.some((e) => e.code === 'invalid_approvalProfile')).toBe(true);
    const ok = classifyDeliveryProfile({
      baseRef: 'main',
      headRef: 'docs/topic',
      body: modelCBody({ approval: 'protected-change-review' }),
      changedFiles: ['docs/governance/DELIVERY-AND-RELEASE.md'],
    });
    expect(ok.errors).toEqual([]);
  });

  it('Model C quality plan skips code build and test', () => {
    const plan = determineQualityPlan({
      body: modelCBody(),
      prClass: 'docs-content',
      deliveryProfile: {
        deliveryModel: 'C',
        gateProfile: 'documentation',
        protectedChange: false,
        errors: [],
      },
    });
    expect(plan.build).toBe(false);
    expect(plan.test).toBe(false);
    expect(plan.typecheck).toBe(false);
    expect(plan.lint).toBe(false);
    expect(plan.deliveryModel).toBe('C');
  });
});
