import test from 'node:test';
import assert from 'node:assert/strict';
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

test('DELIVERY_MODELS includes C', () => {
  assert.ok(DELIVERY_MODELS.includes('C'));
  assert.ok(GATE_PROFILES.includes('documentation'));
});

test('Model C valid docs-only classification passes', () => {
  const result = classifyDeliveryProfile({
    baseRef: 'main',
    headRef: 'docs/topic',
    body: modelCBody(),
    changedFiles: ['docs/how-to/pmo/classify-work-and-select-delivery-model.md'],
  });
  assert.equal(result.errors.length, 0);
  assert.equal(result.deliveryModel, 'C');
  assert.equal(result.gateProfile, 'documentation');
});

test('Model C fails on prohibited code path', () => {
  const result = classifyDeliveryProfile({
    baseRef: 'main',
    headRef: 'docs/topic',
    body: modelCBody(),
    changedFiles: ['scripts/ci/delivery_profile.mjs'],
  });
  assert.ok(result.errors.some((e) => e.code === 'model_c_path_prohibited'));
});

test('Model C fails on documentation-looking file under code path', () => {
  const result = classifyDeliveryProfile({
    baseRef: 'main',
    headRef: 'docs/topic',
    body: modelCBody(),
    changedFiles: ['functions/api/README.md'],
  });
  assert.ok(result.errors.some((e) => e.code === 'model_c_path_prohibited'));
});

test('Model C cross-boundary rename fails', () => {
  const result = classifyDeliveryProfile({
    baseRef: 'main',
    headRef: 'docs/topic',
    body: modelCBody(),
    changedFiles: ['app/README.md'],
    renames: [{ from: 'docs/explanation/x.md', to: 'app/README.md' }],
  });
  assert.ok(result.errors.some((e) => e.code === 'model_c_cross_boundary_move'));
});

test('Model C governance path requires protected-change-review', () => {
  const result = classifyDeliveryProfile({
    baseRef: 'main',
    headRef: 'docs/topic',
    body: modelCBody({ approval: 'documentation-review' }),
    changedFiles: ['docs/governance/DELIVERY-AND-RELEASE.md'],
  });
  assert.ok(result.errors.some((e) => e.code === 'invalid_approvalProfile'));
  const ok = classifyDeliveryProfile({
    baseRef: 'main',
    headRef: 'docs/topic',
    body: modelCBody({ approval: 'protected-change-review' }),
    changedFiles: ['docs/governance/DELIVERY-AND-RELEASE.md'],
  });
  assert.equal(ok.errors.length, 0);
});

test('Model C quality plan skips code build and test', () => {
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
  assert.equal(plan.build, false);
  assert.equal(plan.test, false);
  assert.equal(plan.typecheck, false);
  assert.equal(plan.lint, false);
  assert.equal(plan.deliveryModel, 'C');
});
