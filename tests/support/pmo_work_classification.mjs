/**
 * PMO work-size and Model A/B classification fixture for issue #2487 and #3597.
 * Implements docs/reference/pmo/work-size-and-delivery-model-contract.md
 * and docs/governance/PMO-PORTFOLIO.md
 */

export const PMO_LIFECYCLE_STAGES = [
  'initial-idea',
  'drafted-design',
  'pending-launch-packet',
  'graduation-candidate',
  'active',
  'closed',
];

export function isPmoPriorityValid(priority) {
  if (typeof priority === 'number') {
    return Number.isInteger(priority) && priority >= 1;
  }
  if (typeof priority === 'string') {
    const parsed = Number.parseInt(priority, 10);
    return !Number.isNaN(parsed) && parsed >= 1 && String(parsed) === priority.trim();
  }
  return false;
}

export function isPmoLifecycleStageValid(stage) {
  return PMO_LIFECYCLE_STAGES.includes(stage);
}

export const DECISION_MATRIX = [
  {
    id: 'typo-bounded-content',
    label: 'Typo or bounded content correction',
    evidence: {
      singleReviewablePr: true,
      oneStepRollback: true,
      fullPreviewTestable: true,
      unresolvedArchitecture: false,
      protectedMultiStepBoundary: false,
      harmfulIncompleteProduction: false,
      multipleDeployableComponents: false,
      multiplePromotions: false,
      multipleArchitecturalDomains: false,
      severalProtectedBoundaries: false,
      platformMigrationOrOperatingModelChange: false,
      emergencyCondition: false,
      fullOutageOrUnsafeProduction: false,
    },
    expected: {
      provisionalSize: 'medium-provisional',
      finalSize: 'small',
      changeMode: 'routine-ops',
      deliveryModel: 'A',
      approvalProfile: 'work-bill-production',
      rollbackProfile: 'one-step',
    },
  },
  {
    id: 'routine-dependency-patch',
    label: 'Routine dependency patch',
    evidence: {
      singleReviewablePr: true,
      oneStepRollback: true,
      fullPreviewTestable: true,
      unresolvedArchitecture: false,
      protectedMultiStepBoundary: false,
      harmfulIncompleteProduction: false,
      multipleDeployableComponents: false,
      multiplePromotions: false,
      multipleArchitecturalDomains: false,
      severalProtectedBoundaries: false,
      platformMigrationOrOperatingModelChange: false,
      emergencyCondition: false,
      fullOutageOrUnsafeProduction: false,
    },
    expected: {
      provisionalSize: 'medium-provisional',
      finalSize: 'small',
      changeMode: 'routine-ops',
      deliveryModel: 'A',
      approvalProfile: 'work-bill-production',
      rollbackProfile: 'one-step',
    },
  },
  {
    id: 'homepage-newspaper-feature',
    label: 'Club Homepage newspaper feature',
    evidence: {
      singleReviewablePr: false,
      oneStepRollback: false,
      fullPreviewTestable: false,
      unresolvedArchitecture: false,
      protectedMultiStepBoundary: true,
      harmfulIncompleteProduction: false,
      multipleDeployableComponents: false,
      multiplePromotions: false,
      multipleArchitecturalDomains: false,
      severalProtectedBoundaries: false,
      platformMigrationOrOperatingModelChange: false,
      emergencyCondition: false,
      fullOutageOrUnsafeProduction: false,
    },
    expected: {
      provisionalSize: 'medium-provisional',
      finalSize: 'medium',
      changeMode: 'project',
      deliveryModel: 'B-child',
      approvalProfile: 'component-auto-integration',
      rollbackProfile: 'multi-step',
    },
  },
  {
    id: 'content-collection-phase-1',
    label: 'Content Collection Phase 1',
    evidence: {
      singleReviewablePr: false,
      oneStepRollback: false,
      fullPreviewTestable: false,
      unresolvedArchitecture: false,
      protectedMultiStepBoundary: true,
      harmfulIncompleteProduction: false,
      multipleDeployableComponents: false,
      multiplePromotions: false,
      multipleArchitecturalDomains: false,
      severalProtectedBoundaries: false,
      platformMigrationOrOperatingModelChange: false,
      emergencyCondition: false,
      fullOutageOrUnsafeProduction: false,
    },
    expected: {
      provisionalSize: 'medium-provisional',
      finalSize: 'medium',
      changeMode: 'project',
      deliveryModel: 'B-child',
      approvalProfile: 'component-auto-integration',
      rollbackProfile: 'multi-step',
    },
  },
  {
    id: 'two-model-delivery-program',
    label: 'Two-model delivery-system program',
    evidence: {
      singleReviewablePr: false,
      oneStepRollback: false,
      fullPreviewTestable: false,
      unresolvedArchitecture: true,
      protectedMultiStepBoundary: true,
      harmfulIncompleteProduction: false,
      multipleDeployableComponents: true,
      multiplePromotions: true,
      multipleArchitecturalDomains: true,
      severalProtectedBoundaries: true,
      platformMigrationOrOperatingModelChange: true,
      emergencyCondition: false,
      fullOutageOrUnsafeProduction: false,
    },
    expected: {
      provisionalSize: 'medium-provisional',
      finalSize: 'large',
      changeMode: 'planned-migration',
      deliveryModel: 'B-child',
      approvalProfile: 'protected-change-review',
      rollbackProfile: 'multi-step',
    },
  },
  {
    id: 'ci-redesign',
    label: 'CI redesign',
    evidence: {
      singleReviewablePr: false,
      oneStepRollback: false,
      fullPreviewTestable: false,
      unresolvedArchitecture: false,
      protectedMultiStepBoundary: true,
      harmfulIncompleteProduction: false,
      multipleDeployableComponents: true,
      multiplePromotions: false,
      multipleArchitecturalDomains: false,
      severalProtectedBoundaries: true,
      platformMigrationOrOperatingModelChange: true,
      emergencyCondition: false,
      fullOutageOrUnsafeProduction: false,
    },
    expected: {
      provisionalSize: 'medium-provisional',
      finalSize: 'large',
      changeMode: 'planned-migration',
      deliveryModel: 'B-child',
      approvalProfile: 'protected-change-review',
      rollbackProfile: 'multi-step',
    },
  },
  {
    id: 'authentication-migration',
    label: 'Authentication migration',
    evidence: {
      singleReviewablePr: false,
      oneStepRollback: false,
      fullPreviewTestable: false,
      unresolvedArchitecture: true,
      protectedMultiStepBoundary: true,
      harmfulIncompleteProduction: false,
      multipleDeployableComponents: false,
      multiplePromotions: true,
      multipleArchitecturalDomains: true,
      severalProtectedBoundaries: true,
      platformMigrationOrOperatingModelChange: true,
      emergencyCondition: false,
      fullOutageOrUnsafeProduction: false,
    },
    expected: {
      provisionalSize: 'medium-provisional',
      finalSize: 'large',
      changeMode: 'planned-migration',
      deliveryModel: 'B-child',
      approvalProfile: 'protected-change-review',
      rollbackProfile: 'multi-step',
    },
  },
  {
    id: 'bounded-performance-degradation',
    label: 'Bounded performance degradation',
    evidence: {
      singleReviewablePr: true,
      oneStepRollback: true,
      fullPreviewTestable: true,
      unresolvedArchitecture: false,
      protectedMultiStepBoundary: false,
      harmfulIncompleteProduction: true,
      multipleDeployableComponents: false,
      multiplePromotions: false,
      multipleArchitecturalDomains: false,
      severalProtectedBoundaries: false,
      platformMigrationOrOperatingModelChange: false,
      emergencyCondition: false,
      fullOutageOrUnsafeProduction: false,
    },
    expected: {
      provisionalSize: 'medium-provisional',
      finalSize: 'medium',
      changeMode: 'routine-ops',
      deliveryModel: 'A',
      approvalProfile: 'work-bill-production',
      rollbackProfile: 'one-step',
    },
  },
  {
    id: 'structural-performance-degradation',
    label: 'Structural performance degradation',
    evidence: {
      singleReviewablePr: false,
      oneStepRollback: false,
      fullPreviewTestable: false,
      unresolvedArchitecture: false,
      protectedMultiStepBoundary: false,
      harmfulIncompleteProduction: true,
      multipleDeployableComponents: false,
      multiplePromotions: false,
      multipleArchitecturalDomains: false,
      severalProtectedBoundaries: false,
      platformMigrationOrOperatingModelChange: false,
      emergencyCondition: true,
      fullOutageOrUnsafeProduction: false,
    },
    expected: {
      provisionalSize: 'medium-provisional',
      finalSize: 'medium',
      changeMode: 'emergency',
      deliveryModel: 'emergency-recovery',
      approvalProfile: 'emergency-approval',
      rollbackProfile: 'emergency-stabilization',
    },
  },
  {
    id: 'full-outage-unsafe-production',
    label: 'Full outage or unsafe production state',
    evidence: {
      singleReviewablePr: false,
      oneStepRollback: false,
      fullPreviewTestable: false,
      unresolvedArchitecture: false,
      protectedMultiStepBoundary: false,
      harmfulIncompleteProduction: true,
      multipleDeployableComponents: false,
      multiplePromotions: false,
      multipleArchitecturalDomains: false,
      severalProtectedBoundaries: false,
      platformMigrationOrOperatingModelChange: false,
      emergencyCondition: true,
      fullOutageOrUnsafeProduction: true,
    },
    expected: {
      provisionalSize: 'medium-provisional',
      finalSize: 'medium',
      changeMode: 'emergency',
      deliveryModel: 'emergency-recovery',
      approvalProfile: 'emergency-approval',
      rollbackProfile: 'emergency-stabilization',
    },
  },
];

function isLarge(evidence) {
  return (
    evidence.multipleDeployableComponents
    || evidence.multiplePromotions
    || evidence.multipleArchitecturalDomains
    || evidence.severalProtectedBoundaries
    || evidence.platformMigrationOrOperatingModelChange
  );
}

function isSmall(evidence) {
  return (
    evidence.singleReviewablePr
    && evidence.oneStepRollback
    && evidence.fullPreviewTestable
    && !evidence.unresolvedArchitecture
    && !evidence.protectedMultiStepBoundary
    && !evidence.harmfulIncompleteProduction
    && !isLarge(evidence)
  );
}

function modelAConditions(evidence) {
  return {
    singleReviewablePr: evidence.singleReviewablePr,
    fullPreviewTestable: evidence.fullPreviewTestable,
    singlePromotion: !evidence.multiplePromotions,
    oneStepRollback: evidence.oneStepRollback,
    noProtectedMultiStep: !evidence.protectedMultiStepBoundary,
  };
}

function allModelAConditionsMet(evidence) {
  const conditions = modelAConditions(evidence);
  return Object.values(conditions).every(Boolean);
}

export function classifyWorkEvidence(evidence) {
  const provisionalSize = 'medium-provisional';

  if (evidence.emergencyCondition || evidence.fullOutageOrUnsafeProduction) {
    return {
      provisionalSize,
      finalSize: 'medium',
      changeMode: 'emergency',
      deliveryModel: 'emergency-recovery',
      approvalProfile: 'emergency-approval',
      rollbackProfile: 'emergency-stabilization',
      route: 'emergency',
      modelAEligible: false,
      modelBRequired: false,
    };
  }

  if (isLarge(evidence)) {
    return {
      provisionalSize,
      finalSize: 'large',
      changeMode: evidence.platformMigrationOrOperatingModelChange
        ? 'planned-migration'
        : 'project',
      deliveryModel: 'B-child',
      approvalProfile: 'protected-change-review',
      rollbackProfile: 'multi-step',
      route: 'large-model-b',
      modelAEligible: false,
      modelBRequired: true,
    };
  }

  if (isSmall(evidence)) {
    return {
      provisionalSize,
      finalSize: 'small',
      changeMode: 'routine-ops',
      deliveryModel: 'A',
      approvalProfile: 'work-bill-production',
      rollbackProfile: 'one-step',
      route: 'small-model-a',
      modelAEligible: true,
      modelBRequired: false,
    };
  }

  const modelAEligible = allModelAConditionsMet(evidence);
  const changeMode = evidence.emergencyCondition
    ? 'emergency'
    : (evidence.harmfulIncompleteProduction ? 'routine-ops' : 'project');
  return {
    provisionalSize,
    finalSize: 'medium',
    changeMode,
    deliveryModel: modelAEligible ? 'A' : 'B-child',
    approvalProfile: modelAEligible ? 'work-bill-production' : 'component-auto-integration',
    rollbackProfile: modelAEligible ? 'one-step' : 'multi-step',
    route: modelAEligible ? 'medium-model-a' : 'medium-model-b',
    modelAEligible,
    modelBRequired: !modelAEligible,
  };
}

export function assertNoConflictingModels(classification) {
  return !(classification.modelAEligible && classification.modelBRequired);
}
