import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  APPROVAL_PROFILES,
  CHANGE_MODES,
  DELIVERY_MODELS,
  GATE_PROFILES,
  ROLLBACK_PROFILES,
  TARGET_ENVIRONMENTS,
  WORK_SIZES,
  classifyDeliveryProfile,
  parseDeliveryMetadata,
  runCli,
} from '../scripts/ci/delivery_profile.mjs';

function metadataBody(overrides = {}) {
  const values = {
    issue: '#2485',
    intentLabel: 'intent:ci',
    prClass: 'ci',
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

## Change Summary

Stable PR class fields are intentionally independent from the delivery profile.
`;
}

function classify(overrides = {}, options = {}) {
  const changedFiles = 'changedFiles' in options ? options.changedFiles : ['src/app/page.tsx'];
  return classifyDeliveryProfile({
    baseRef: options.baseRef || 'main',
    headRef: options.headRef || 'cursor/example',
    body: metadataBody(overrides),
    changedFiles,
  });
}

describe('delivery profile contract constants', () => {
  it('exports stable delivery contract values', () => {
    expect(DELIVERY_MODELS).toEqual(['A', 'B-child', 'B-promotion', 'emergency-recovery']);
    expect(WORK_SIZES).toEqual(['medium-provisional', 'small', 'medium', 'large']);
    expect(CHANGE_MODES).toEqual(['project', 'routine-ops', 'planned-migration', 'emergency']);
    expect(TARGET_ENVIRONMENTS).toEqual(['component', 'preview', 'production', 'recovery']);
    expect(APPROVAL_PROFILES).toEqual([
      'component-auto-integration',
      'work-bill-production',
      'protected-change-review',
      'emergency-approval',
    ]);
    expect(GATE_PROFILES).toEqual([
      'component-child',
      'production-candidate',
      'component-promotion',
      'emergency-recovery',
    ]);
    expect(ROLLBACK_PROFILES).toEqual(['one-step', 'multi-step', 'emergency-stabilization']);
  });
});

describe('parseDeliveryMetadata', () => {
  it('parses stable metadata and ignores PR class as a separate concern', () => {
    const metadata = parseDeliveryMetadata(metadataBody({
      size: 'medium-provisional',
      deliveryModel: 'B-child',
      targetEnvironment: 'component',
      approvalProfile: 'component-auto-integration',
      gateProfile: 'component-child',
      rollbackProfile: 'multi-step',
      componentBranch: 'component/delivery-system-v1',
      componentMaster: '#2477',
    }));

    expect(metadata).toEqual({
      size: 'medium-provisional',
      deliveryModel: 'B-child',
      changeMode: 'project',
      targetEnvironment: 'component',
      approvalProfile: 'component-auto-integration',
      gateProfile: 'component-child',
      rollbackProfile: 'multi-step',
      componentBranch: 'component/delivery-system-v1',
      componentMaster: '#2477',
    });
    expect(metadata.prClass).toBeUndefined();
  });

  it('treats HTML comments and placeholders as missing metadata', () => {
    const metadata = parseDeliveryMetadata(metadataBody({
      size: '<!-- medium-provisional / small / medium / large -->',
      deliveryModel: '____',
      changeMode: 'TBD',
      targetEnvironment: 'placeholder',
      approvalProfile: '',
    }));

    expect(metadata.size).toBe('');
    expect(metadata.deliveryModel).toBe('');
    expect(metadata.changeMode).toBe('');
    expect(metadata.targetEnvironment).toBe('');
    expect(metadata.approvalProfile).toBe('');
  });
});

describe('classifyDeliveryProfile', () => {
  it('classifies Model A production candidates with Work review and Bill protection', () => {
    const profile = classify({
      approvalProfile: 'work-bill-production',
    });

    expect(profile).toMatchObject({
      deliveryModel: 'A',
      targetEnvironment: 'production',
      approvalProfile: 'work-bill-production',
      gateProfile: 'production-candidate',
      errors: [],
    });
  });

  it('classifies Model A production candidates', () => {
    const profile = classify();

    expect(profile).toMatchObject({
      deliveryModel: 'A',
      size: 'medium',
      changeMode: 'project',
      targetEnvironment: 'production',
      approvalProfile: 'work-bill-production',
      gateProfile: 'production-candidate',
      rollbackProfile: 'one-step',
      componentBranch: '',
      componentMaster: '',
      protectedChange: false,
      errors: [],
    });
  });

  it('classifies non-protected Model B child PRs as component auto-integration eligible', () => {
    const profile = classify(
      {
        size: 'medium-provisional',
        deliveryModel: 'B-child',
        targetEnvironment: 'component',
        approvalProfile: 'component-auto-integration',
        gateProfile: 'component-child',
        rollbackProfile: 'multi-step',
        componentBranch: 'component/delivery-system-v1',
        componentMaster: '#2477',
      },
      {
        baseRef: 'component/delivery-system-v1',
        headRef: 'cursor/2485-delivery-profile-contract',
        changedFiles: ['docs/reference/ci/delivery-profile-contract.md'],
      },
    );

    expect(profile).toMatchObject({
      deliveryModel: 'B-child',
      size: 'medium-provisional',
      targetEnvironment: 'component',
      approvalProfile: 'component-auto-integration',
      gateProfile: 'component-child',
      rollbackProfile: 'multi-step',
      componentBranch: 'component/delivery-system-v1',
      componentMaster: '#2477',
      implementationAgent: 'Cursor Local',
      protectedChange: false,
      errors: [],
    });
  });

  it('fails Model B child when Rollback profile does not match Delivery model', () => {
    const profile = classify(
      {
        deliveryModel: 'B-child',
        targetEnvironment: 'component',
        approvalProfile: 'component-auto-integration',
        gateProfile: 'component-child',
        rollbackProfile: 'one-step',
        componentBranch: 'component/delivery-system-v1',
        componentMaster: '#2477',
      },
      {
        baseRef: 'component/delivery-system-v1',
        headRef: 'cursor/2683-rollback-mismatch',
        changedFiles: ['docs/reference/ci/delivery-profile-contract.md'],
      },
    );

    expect(profile.errors).toContainEqual(expect.objectContaining({
      code: 'invalid_rollbackProfile',
      expected: 'multi-step',
      value: 'one-step',
    }));
  });

  it('fails Model B child when Implementation agent is missing', () => {
    const profile = classify(
      {
        deliveryModel: 'B-child',
        targetEnvironment: 'component',
        approvalProfile: 'component-auto-integration',
        gateProfile: 'component-child',
        rollbackProfile: 'multi-step',
        componentBranch: 'component/delivery-system-v1',
        componentMaster: '#2477',
        implementationAgent: '',
      },
      {
        baseRef: 'component/delivery-system-v1',
        headRef: 'cursor/2683-missing-impl-agent',
        changedFiles: ['docs/reference/ci/delivery-profile-contract.md'],
      },
    );

    expect(profile.errors).toContainEqual(expect.objectContaining({
      code: 'missing_implementationAgent',
    }));
  });

  it('classifies protected Model B child PRs for Chat review', () => {
    const profile = classify(
      {
        deliveryModel: 'B-child',
        targetEnvironment: 'component',
        approvalProfile: 'protected-change-review',
        gateProfile: 'component-child',
        rollbackProfile: 'multi-step',
        componentBranch: 'component/delivery-system-v1',
        componentMaster: '#2477',
      },
      {
        baseRef: 'component/delivery-system-v1',
        headRef: 'cursor/2485-delivery-profile-contract',
        changedFiles: ['scripts/ci/delivery_profile.mjs'],
      },
    );

    expect(profile.protectedChange).toBe(true);
    expect(profile.approvalProfile).toBe('protected-change-review');
    expect(profile.errors).toEqual([]);
  });

  it('classifies Model B promotion PRs', () => {
    const profile = classify(
      {
        deliveryModel: 'B-promotion',
        targetEnvironment: 'production',
        approvalProfile: 'work-bill-production',
        gateProfile: 'component-promotion',
        rollbackProfile: 'multi-step',
        componentBranch: 'component/delivery-system-v1',
        componentMaster: '#2477',
      },
      {
        baseRef: 'main',
        headRef: 'component/delivery-system-v1',
        changedFiles: ['docs/reference/ci/delivery-profile-contract.md'],
      },
    );

    expect(profile).toMatchObject({
      deliveryModel: 'B-promotion',
      targetEnvironment: 'production',
      approvalProfile: 'work-bill-production',
      gateProfile: 'component-promotion',
      rollbackProfile: 'multi-step',
      componentBranch: 'component/delivery-system-v1',
      componentMaster: '#2477',
      protectedChange: false,
      errors: [],
    });
  });

  it('classifies emergency recovery PRs', () => {
    const profile = classify({
      deliveryModel: 'emergency-recovery',
      changeMode: 'emergency',
      targetEnvironment: 'recovery',
      approvalProfile: 'emergency-approval',
      gateProfile: 'emergency-recovery',
      rollbackProfile: 'emergency-stabilization',
    });

    expect(profile).toMatchObject({
      deliveryModel: 'emergency-recovery',
      changeMode: 'emergency',
      targetEnvironment: 'recovery',
      approvalProfile: 'emergency-approval',
      gateProfile: 'emergency-recovery',
      rollbackProfile: 'emergency-stabilization',
      errors: [],
    });
  });

  it('fails explicitly when required fields are missing', () => {
    const profile = classify({
      size: '',
      deliveryModel: '',
      changeMode: '',
      targetEnvironment: '',
      approvalProfile: '',
      gateProfile: '',
      rollbackProfile: '',
    });

    expect(profile.errors).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'missing_size' }),
      expect.objectContaining({ code: 'missing_deliveryModel' }),
      expect.objectContaining({ code: 'missing_changeMode' }),
      expect.objectContaining({ code: 'missing_targetEnvironment' }),
      expect.objectContaining({ code: 'missing_approvalProfile' }),
      expect.objectContaining({ code: 'missing_gateProfile' }),
      expect.objectContaining({ code: 'missing_rollbackProfile' }),
    ]));
  });

  it('fails explicitly for invalid model values', () => {
    const profile = classify({ deliveryModel: 'Model C' });

    expect(profile.errors).toContainEqual(expect.objectContaining({
      code: 'invalid_deliveryModel',
      value: 'Model C',
    }));
  });

  it('fails explicitly for wrong base branch', () => {
    const profile = classify({}, { baseRef: 'component/delivery-system-v1' });

    expect(profile.errors).toContainEqual(expect.objectContaining({
      code: 'invalid_baseRef',
      expected: 'main',
    }));
  });

  it('fails explicitly for wrong promotion head branch', () => {
    const profile = classify(
      {
        deliveryModel: 'B-promotion',
        targetEnvironment: 'production',
        approvalProfile: 'work-bill-production',
        gateProfile: 'component-promotion',
        rollbackProfile: 'multi-step',
        componentBranch: 'component/delivery-system-v1',
        componentMaster: '#2477',
      },
      {
        baseRef: 'main',
        headRef: 'cursor/not-component',
        changedFiles: ['docs/reference/ci/delivery-profile-contract.md'],
      },
    );

    expect(profile.errors).toContainEqual(expect.objectContaining({
      code: 'invalid_headRef',
      expected: 'component/**',
    }));
  });

  it('fails explicitly when component metadata is missing', () => {
    const profile = classify(
      {
        deliveryModel: 'B-child',
        targetEnvironment: 'component',
        approvalProfile: 'component-auto-integration',
        gateProfile: 'component-child',
        rollbackProfile: 'multi-step',
        componentBranch: 'component/delivery-system-v1',
        componentMaster: '<!-- main -->',
      },
      {
        baseRef: 'component/delivery-system-v1',
        changedFiles: ['docs/reference/ci/delivery-profile-contract.md'],
      },
    );

    expect(profile.errors).toContainEqual(expect.objectContaining({
      code: 'missing_componentMaster',
    }));
  });

  it('fails explicitly for malformed component master issue references', () => {
    const profile = classify(
      {
        deliveryModel: 'B-child',
        targetEnvironment: 'component',
        approvalProfile: 'component-auto-integration',
        gateProfile: 'component-child',
        rollbackProfile: 'multi-step',
        componentBranch: 'component/delivery-system-v1',
        componentMaster: 'main',
      },
      {
        baseRef: 'component/delivery-system-v1',
        changedFiles: ['docs/reference/ci/delivery-profile-contract.md'],
      },
    );

    expect(profile.errors).toContainEqual(expect.objectContaining({
      code: 'invalid_componentMaster',
      value: 'main',
    }));
  });

  it('retains the same component master from child through promotion', () => {
    const child = classify(
      {
        deliveryModel: 'B-child',
        targetEnvironment: 'component',
        approvalProfile: 'component-auto-integration',
        gateProfile: 'component-child',
        rollbackProfile: 'multi-step',
        componentBranch: 'component/delivery-system-v1',
        componentMaster: '#2477',
      },
      {
        baseRef: 'component/delivery-system-v1',
        changedFiles: ['docs/reference/ci/delivery-profile-contract.md'],
      },
    );
    const promotion = classify(
      {
        deliveryModel: 'B-promotion',
        targetEnvironment: 'production',
        approvalProfile: 'work-bill-production',
        gateProfile: 'component-promotion',
        rollbackProfile: 'multi-step',
        componentBranch: 'component/delivery-system-v1',
        componentMaster: '#2477',
      },
      {
        baseRef: 'main',
        headRef: 'component/delivery-system-v1',
        changedFiles: ['docs/reference/ci/delivery-profile-contract.md'],
      },
    );

    expect(child.componentMaster).toBe('#2477');
    expect(promotion.componentMaster).toBe('#2477');
    expect(child.errors).toEqual([]);
    expect(promotion.errors).toEqual([]);
  });

  it('fails closed when Model B child changed-file evidence is absent', () => {
    const profile = classifyDeliveryProfile({
      baseRef: 'component/delivery-system-v1',
      headRef: 'cursor/example',
      body: metadataBody({
        deliveryModel: 'B-child',
        targetEnvironment: 'component',
        approvalProfile: 'component-auto-integration',
        gateProfile: 'component-child',
        rollbackProfile: 'multi-step',
        componentBranch: 'component/delivery-system-v1',
        componentMaster: '#2477',
      }),
    });

    expect(profile.errors).toContainEqual(expect.objectContaining({
      code: 'missing_changed_files_evidence',
    }));
    expect(profile.protectedChange).toBe(false);
  });

  it('rejects non-empty component metadata on Model A PRs', () => {
    const profile = classify({
      componentBranch: 'component/delivery-system-v1',
      componentMaster: '#2477',
    });

    expect(profile.errors).toContainEqual(expect.objectContaining({
      code: 'invalid_componentBranch',
    }));
    expect(profile.errors).toContainEqual(expect.objectContaining({
      code: 'invalid_componentMaster',
    }));
  });

  it('rejects non-empty component metadata on emergency recovery PRs', () => {
    const profile = classify({
      deliveryModel: 'emergency-recovery',
      changeMode: 'emergency',
      targetEnvironment: 'recovery',
      approvalProfile: 'emergency-approval',
      gateProfile: 'emergency-recovery',
      rollbackProfile: 'emergency-stabilization',
      componentBranch: 'component/delivery-system-v1',
      componentMaster: '#2477',
    });

    expect(profile.errors).toContainEqual(expect.objectContaining({
      code: 'invalid_componentBranch',
    }));
    expect(profile.errors).toContainEqual(expect.objectContaining({
      code: 'invalid_componentMaster',
    }));
  });

  it('fails explicitly when protected paths use auto-integration approval', () => {
    const profile = classify(
      {
        deliveryModel: 'B-child',
        targetEnvironment: 'component',
        approvalProfile: 'component-auto-integration',
        gateProfile: 'component-child',
        rollbackProfile: 'multi-step',
        componentBranch: 'component/delivery-system-v1',
        componentMaster: '#2477',
      },
      {
        baseRef: 'component/delivery-system-v1',
        changedFiles: ['docs/governance/PR_PROCESS.md'],
      },
    );

    expect(profile.protectedChange).toBe(true);
    expect(profile.errors).toContainEqual(expect.objectContaining({
      code: 'invalid_approvalProfile',
      expected: 'protected-change-review',
    }));
  });
});

describe('delivery profile CLI', () => {
  it('writes a JSON artifact and returns nonzero for invalid metadata', () => {
    const bodyPath = 'delivery-profile-body.test.md';
    const changedPath = 'delivery-profile-changed.test.txt';
    const resultPath = 'delivery-profile-result.test.json';
    fs.writeFileSync(bodyPath, metadataBody({
      deliveryModel: 'Model C',
      targetEnvironment: 'component',
      approvalProfile: 'protected-change-review',
      gateProfile: 'component-child',
      rollbackProfile: 'multi-step',
      componentBranch: 'component/delivery-system-v1',
      componentMaster: '#2477',
    }));
    fs.writeFileSync(changedPath, 'scripts/ci/delivery_profile.mjs\n');

    try {
      expect(runCli({
        PR_BODY_FILE: bodyPath,
        PR_BASE_REF: 'component/delivery-system-v1',
        PR_HEAD_REF: 'cursor/2485-delivery-profile-contract',
        CHANGED_FILES_FILE: changedPath,
        DELIVERY_PROFILE_RESULT_JSON: resultPath,
      })).toBe(1);

      const artifact = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
      expect(artifact.errors).toContainEqual(expect.objectContaining({
        code: 'invalid_deliveryModel',
      }));
      expect(artifact.protectedChange).toBe(true);
    } finally {
      for (const file of [bodyPath, changedPath, resultPath]) {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      }
    }
  });

  it('fails closed when Model B child changed-file evidence is missing from the CLI', () => {
    const bodyPath = 'delivery-profile-body-missing-files.test.md';
    const resultPath = 'delivery-profile-result-missing-files.test.json';
    fs.writeFileSync(bodyPath, metadataBody({
      deliveryModel: 'B-child',
      targetEnvironment: 'component',
      approvalProfile: 'protected-change-review',
      gateProfile: 'component-child',
      rollbackProfile: 'multi-step',
      componentBranch: 'component/delivery-system-v1',
      componentMaster: '#2477',
    }));

    try {
      expect(runCli({
        PR_BODY_FILE: bodyPath,
        PR_BASE_REF: 'component/delivery-system-v1',
        PR_HEAD_REF: 'cursor/2485-delivery-profile-contract',
        DELIVERY_PROFILE_RESULT_JSON: resultPath,
      })).toBe(1);

      const artifact = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
      expect(artifact.errors).toContainEqual(expect.objectContaining({
        code: 'missing_changed_files_evidence',
      }));
    } finally {
      for (const file of [bodyPath, resultPath]) {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      }
    }
  });

  it('fails closed when Model B child changed-file list file is absent', () => {
    const bodyPath = 'delivery-profile-body-absent-file.test.md';
    const resultPath = 'delivery-profile-result-absent-file.test.json';
    fs.writeFileSync(bodyPath, metadataBody({
      deliveryModel: 'B-child',
      targetEnvironment: 'component',
      approvalProfile: 'protected-change-review',
      gateProfile: 'component-child',
      rollbackProfile: 'multi-step',
      componentBranch: 'component/delivery-system-v1',
      componentMaster: '#2477',
    }));

    try {
      expect(runCli({
        PR_BODY_FILE: bodyPath,
        PR_BASE_REF: 'component/delivery-system-v1',
        PR_HEAD_REF: 'cursor/2485-delivery-profile-contract',
        CHANGED_FILES_FILE: 'delivery-profile-missing-changed-list.test.txt',
        DELIVERY_PROFILE_RESULT_JSON: resultPath,
      })).toBe(1);

      const artifact = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
      expect(artifact.errors).toContainEqual(expect.objectContaining({
        code: 'missing_changed_files_file',
      }));
    } finally {
      for (const file of [bodyPath, resultPath]) {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      }
    }
  });
});
