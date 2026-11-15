export function prBody(overrides = {}) {
  const values = {
    issue: '#2501',
    intentLabel: 'intent:ci',
    prClass: 'ci',
    size: 'small',
    deliveryModel: 'A',
    changeMode: 'project',
    targetEnvironment: 'production',
    approvalProfile: 'cmo-production',
    gateProfile: 'production-candidate',
    rollbackProfile: 'one-step',
    componentBranch: 'not-applicable',
    componentMaster: 'not-applicable',
    extra: '',
    ...overrides,
  };

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
- Component branch: ${values.componentBranch}
- Component master: ${values.componentMaster}

## Change Summary

Delivery System v1 pilot fixture.

${values.extra}
`;
}

export const LEGACY_HEADER = `---
Doc Type: Governance
Audience: Human + AI
Authority Level: Controlled
Owns: fixture
Does Not Own: production
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Last Reviewed: 2026-07-13
---

# Legacy Document
`;

export const FIXTURE_DISPOSITION_MAP = `---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: fixture disposition map
Does Not Own: production policy
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Last Reviewed: 2026-07-13
---

# Fixture Disposition Map

| Current path | Current owner | Target owner | Action | Replacement / notes | Reference-update scope |
| --- | --- | --- | --- | --- | --- |
| \`docs/governance/legacy-header-only.md\` | Governance | Documentation and Knowledge | retain | Header-only failure fixture | \`Agent.md\` |
| \`docs/governance/legacy-emergency-source.md\` | Governance | Documentation and Knowledge | migrate | Move to \`docs/reference/diataxis/emergency-target.md\` | \`Agent.md\` |
`;

export const ONE_STEP_ROLLBACK_FIELDS = [
  'rollback_target_type',
  'rollback_target_ref',
  'smoke_tests',
  'verification_owner',
];

export const MULTI_STEP_ROLLBACK_FIELDS = [
  'release_unit',
  'rollback_trigger',
  'disablement_steps',
  'external_write_stops',
  'config_restoration',
  'data_restoration',
  'deployment_restoration',
  'dependency_order',
  'verification_checklist',
  'reconciliation',
  'package_owner',
  'package_finalized_before_promotion',
];

export const PROMOTION_PACKAGE_FIELDS = [
  ...MULTI_STEP_ROLLBACK_FIELDS,
  'integrated_children_complete',
  'pilot_evidence_path',
  'authority_disposition_complete',
];

export function parseEvidenceBlock(text = '') {
  const fields = {};
  for (const line of String(text).split(/\r?\n/)) {
    const match = line.match(/^([a-z_]+):\s*(.+)\s*$/i);
    if (match) {
      fields[match[1]] = match[2].trim();
    }
  }
  return fields;
}

export function missingEvidenceFields(fields, required) {
  return required.filter((field) => {
    const value = fields[field];
    return !value || value === 'no' || value === 'missing' || value === 'tbd';
  });
}

/**
 * Deterministic, non-mutating ordered rollback dry-run.
 * Each step is a pure state transition; no GitHub/Cloudflare/D1 side effects.
 */
export function runOrderedRollbackSimulation({
  initialState = {},
  steps = [],
  expectedAfterEach = [],
  expectedFinal = null,
} = {}) {
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new Error('rollback simulation requires an ordered step list');
  }

  let state = { ...initialState, history: [] };
  const snapshots = [];

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index];
    if (typeof step.apply !== 'function') {
      throw new Error(`rollback step ${index} is missing apply()`);
    }
    state = step.apply({ ...state });
    state = {
      ...state,
      history: [...(state.history || []), step.id],
    };
    snapshots.push({ afterStep: step.id, state: { ...state } });

    const expected = expectedAfterEach[index];
    if (expected) {
      for (const [key, value] of Object.entries(expected)) {
        if (state[key] !== value) {
          throw new Error(
            `after step ${step.id}: expected ${key}=${JSON.stringify(value)} but got ${JSON.stringify(state[key])}`,
          );
        }
      }
    }
  }

  if (expectedFinal) {
    for (const [key, value] of Object.entries(expectedFinal)) {
      if (state[key] !== value) {
        throw new Error(
          `final state: expected ${key}=${JSON.stringify(value)} but got ${JSON.stringify(state[key])}`,
        );
      }
    }
  }

  return { ok: true, finalState: state, snapshots };
}

export function assertRollbackFailsWhenOmitted({ initialState, steps, omitStepId }) {
  const reduced = steps.filter((step) => step.id !== omitStepId);
  try {
    runOrderedRollbackSimulation({
      initialState,
      steps: reduced,
      expectedFinal: { verified: true },
    });
  } catch {
    return true;
  }
  throw new Error(`expected omission of ${omitStepId} to fail verification`);
}

export function assertRollbackFailsWhenReordered({ initialState, steps }) {
  if (steps.length < 2) {
    throw new Error('reorder assertion requires at least two steps');
  }
  // Swap the first two steps and rely on step preconditions/dependencies —
  // do not inject original-order expectations that would force a false fail.
  const reordered = [steps[1], steps[0], ...steps.slice(2)];
  try {
    runOrderedRollbackSimulation({
      initialState,
      steps: reordered,
      expectedFinal: { verified: true },
    });
  } catch {
    return true;
  }
  throw new Error('expected reordered rollback steps to fail due to step preconditions');
}
