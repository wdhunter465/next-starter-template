#!/usr/bin/env node

import fs from 'node:fs';

export const DELIVERY_MODELS = ['A', 'B-child', 'B-promotion', 'emergency-recovery'];
export const WORK_SIZES = ['medium-provisional', 'small', 'medium', 'large'];
export const CHANGE_MODES = ['project', 'routine-ops', 'planned-migration', 'emergency'];
export const TARGET_ENVIRONMENTS = ['component', 'preview', 'production', 'recovery'];
export const APPROVAL_PROFILES = [
  'component-auto-integration',
  'work-bill-production',
  'protected-change-review',
  'emergency-approval',
];
export const GATE_PROFILES = [
  'component-child',
  'production-candidate',
  'component-promotion',
  'emergency-recovery',
];
export const ROLLBACK_PROFILES = ['one-step', 'multi-step', 'emergency-stabilization'];

const FIELD_LABELS = {
  size: 'Size',
  deliveryModel: 'Delivery model',
  changeMode: 'Change mode',
  targetEnvironment: 'Target environment',
  approvalProfile: 'Approval profile',
  gateProfile: 'Gate profile',
  rollbackProfile: 'Rollback profile',
  componentBranch: 'Component branch',
  componentMaster: 'Component master',
};

const REQUIRED_FIELDS = [
  'size',
  'deliveryModel',
  'changeMode',
  'targetEnvironment',
  'approvalProfile',
  'gateProfile',
  'rollbackProfile',
];

const ENUMS = {
  size: WORK_SIZES,
  deliveryModel: DELIVERY_MODELS,
  changeMode: CHANGE_MODES,
  targetEnvironment: TARGET_ENVIRONMENTS,
  approvalProfile: APPROVAL_PROFILES,
  gateProfile: GATE_PROFILES,
  rollbackProfile: ROLLBACK_PROFILES,
};

const PLACEHOLDER_VALUES = new Set([
  '',
  '#____',
  '____',
  'todo',
  'tbd',
  'placeholder',
  'not set',
  'not-set',
]);

const PROTECTED_PATTERNS = [
  /^\.github\/workflows\/.+/,
  /^\.github\/CODEOWNERS$/,
  /^wrangler[^/]*\.toml$/,
  /^migrations\/.+/,
  /^functions\/api\/auth\/.+/,
  /^functions\/api\/admin\/.+/,
  /^scripts\/ci\/.+/,
  /^docs\/governance\/.+/,
];

function defaultMetadata() {
  return Object.fromEntries(Object.keys(FIELD_LABELS).map((field) => [field, '']));
}

function stripInlineSyntax(value) {
  return value
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^`(.*)`$/, '$1')
    .trim();
}

function normalizeMetadataValue(value) {
  const cleaned = stripInlineSyntax(String(value || ''));
  const lower = cleaned.toLowerCase();
  if (PLACEHOLDER_VALUES.has(lower) || /^_+$/.test(cleaned)) {
    return '';
  }
  return cleaned;
}

function normalizeOptionalComponentValue(value) {
  const normalized = normalizeMetadataValue(value);
  return normalized === 'not-applicable' ? '' : normalized;
}

function isComponentRef(ref) {
  return /^component\/[^/].*/.test(String(ref || ''));
}

function isValidComponentMasterIssue(ref) {
  return /^#\d+$/.test(String(ref || '').trim());
}

function isProtectedPath(filePath) {
  const normalized = String(filePath || '').replace(/^\.\/+/, '');
  return PROTECTED_PATTERNS.some((pattern) => pattern.test(normalized));
}

function deliveryError(code, message, details = {}) {
  return { code, message, ...details };
}

function pushExpectedError(errors, field, actual, expected) {
  if (actual !== expected) {
    errors.push(deliveryError(
      `invalid_${field}`,
      `${FIELD_LABELS[field] || field} must be ${expected}.`,
      { expected, value: actual },
    ));
  }
}

function parseLineValue(body, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^[^\\S\\r\\n]*(?:[-*][^\\S\\r\\n]*)?${escaped}:[^\\S\\r\\n]*([^\\r\\n]*)[\\r\\n]*$`, 'im');
  const match = String(body || '').match(pattern);
  return match ? match[1] : '';
}

function readListFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function validateComponentMasterIssue(errors, componentMaster) {
  if (!componentMaster) {
    errors.push(deliveryError('missing_componentMaster', 'Component master is required for Model B PRs.'));
    return;
  }
  if (!isValidComponentMasterIssue(componentMaster)) {
    errors.push(deliveryError(
      'invalid_componentMaster',
      'Component master must be a canonical GitHub issue reference matching #<number>.',
      { value: componentMaster },
    ));
  }
}

function rejectComponentMetadataForNonModelB(errors, componentBranch, componentMaster, deliveryModel) {
  if (componentBranch) {
    errors.push(deliveryError(
      'invalid_componentBranch',
      `Component branch must be empty or not-applicable for ${deliveryModel} PRs.`,
      { value: componentBranch },
    ));
  }
  if (componentMaster) {
    errors.push(deliveryError(
      'invalid_componentMaster',
      `Component master must be empty or not-applicable for ${deliveryModel} PRs.`,
      { value: componentMaster },
    ));
  }
}

function writeJsonArtifact(result, env) {
  if (env.DELIVERY_PROFILE_RESULT_JSON) {
    fs.writeFileSync(env.DELIVERY_PROFILE_RESULT_JSON, `${JSON.stringify(result, null, 2)}\n`);
  }
}

export function parseDeliveryMetadata(body = '') {
  const metadata = defaultMetadata();
  for (const [field, label] of Object.entries(FIELD_LABELS)) {
    metadata[field] = normalizeMetadataValue(parseLineValue(body, label));
  }
  return metadata;
}

export function classifyDeliveryProfile({
  baseRef = '',
  headRef = '',
  body = '',
  changedFiles = undefined,
} = {}) {
  const metadata = parseDeliveryMetadata(body);
  const errors = [];
  const hasChangedFileEvidence = Array.isArray(changedFiles);
  const protectedChange = hasChangedFileEvidence && changedFiles.some(isProtectedPath);

  for (const field of REQUIRED_FIELDS) {
    if (!metadata[field]) {
      errors.push(deliveryError(
        `missing_${field}`,
        `${FIELD_LABELS[field]} is required.`,
      ));
    }
  }

  for (const [field, validValues] of Object.entries(ENUMS)) {
    const value = metadata[field];
    if (value && !validValues.includes(value)) {
      errors.push(deliveryError(
        `invalid_${field}`,
        `${FIELD_LABELS[field]} must be one of: ${validValues.join(', ')}.`,
        { value, validValues },
      ));
    }
  }

  const componentBranch = normalizeOptionalComponentValue(metadata.componentBranch);
  const componentMaster = normalizeOptionalComponentValue(metadata.componentMaster);
  const implementationAgent = normalizeMetadataValue(parseLineValue(body, 'Implementation agent'));

  if (metadata.deliveryModel === 'A') {
    pushExpectedError(errors, 'targetEnvironment', metadata.targetEnvironment, 'production');
    pushExpectedError(errors, 'approvalProfile', metadata.approvalProfile, 'work-bill-production');
    pushExpectedError(errors, 'gateProfile', metadata.gateProfile, 'production-candidate');
    pushExpectedError(errors, 'rollbackProfile', metadata.rollbackProfile, 'one-step');
    if (baseRef !== 'main') {
      errors.push(deliveryError('invalid_baseRef', 'Model A PRs must target main.', {
        expected: 'main',
        value: baseRef,
      }));
    }
    rejectComponentMetadataForNonModelB(errors, componentBranch, componentMaster, 'Model A');
  }

  if (metadata.deliveryModel === 'B-child') {
    if (!hasChangedFileEvidence) {
      errors.push(deliveryError(
        'missing_changed_files_evidence',
        'Changed-file evidence is required for Model B child PRs.',
      ));
    }
    pushExpectedError(errors, 'targetEnvironment', metadata.targetEnvironment, 'component');
    pushExpectedError(
      errors,
      'approvalProfile',
      metadata.approvalProfile,
      protectedChange ? 'protected-change-review' : 'component-auto-integration',
    );
    pushExpectedError(errors, 'gateProfile', metadata.gateProfile, 'component-child');
    pushExpectedError(errors, 'rollbackProfile', metadata.rollbackProfile, 'multi-step');
    if (!implementationAgent) {
      errors.push(deliveryError(
        'missing_implementationAgent',
        'Implementation agent is required for Model B child PRs.',
      ));
    }
    if (!isComponentRef(baseRef)) {
      errors.push(deliveryError('invalid_baseRef', 'Model B child PRs must target component/**.', {
        expected: 'component/**',
        value: baseRef,
      }));
    }
    if (!componentBranch) {
      errors.push(deliveryError('missing_componentBranch', 'Component branch is required for Model B child PRs.'));
    } else if (componentBranch !== baseRef) {
      errors.push(deliveryError('invalid_componentBranch', 'Component branch must match the base ref.', {
        expected: baseRef,
        value: componentBranch,
      }));
    }
    validateComponentMasterIssue(errors, componentMaster);
  }

  if (metadata.deliveryModel === 'B-promotion') {
    pushExpectedError(errors, 'targetEnvironment', metadata.targetEnvironment, 'production');
    pushExpectedError(errors, 'approvalProfile', metadata.approvalProfile, 'work-bill-production');
    pushExpectedError(errors, 'gateProfile', metadata.gateProfile, 'component-promotion');
    pushExpectedError(errors, 'rollbackProfile', metadata.rollbackProfile, 'multi-step');
    if (!implementationAgent) {
      errors.push(deliveryError(
        'missing_implementationAgent',
        'Implementation agent is required for Model B promotion PRs.',
      ));
    }
    if (baseRef !== 'main') {
      errors.push(deliveryError('invalid_baseRef', 'Model B promotion PRs must target main.', {
        expected: 'main',
        value: baseRef,
      }));
    }
    if (!isComponentRef(headRef)) {
      errors.push(deliveryError('invalid_headRef', 'Model B promotion PRs must promote from component/**.', {
        expected: 'component/**',
        value: headRef,
      }));
    }
    if (!componentBranch) {
      errors.push(deliveryError('missing_componentBranch', 'Component branch is required for Model B promotion PRs.'));
    } else if (componentBranch !== headRef) {
      errors.push(deliveryError('invalid_componentBranch', 'Component branch must match the head ref.', {
        expected: headRef,
        value: componentBranch,
      }));
    }
    validateComponentMasterIssue(errors, componentMaster);
  }

  if (metadata.deliveryModel === 'emergency-recovery') {
    pushExpectedError(errors, 'changeMode', metadata.changeMode, 'emergency');
    pushExpectedError(errors, 'targetEnvironment', metadata.targetEnvironment, 'recovery');
    pushExpectedError(errors, 'approvalProfile', metadata.approvalProfile, 'emergency-approval');
    pushExpectedError(errors, 'gateProfile', metadata.gateProfile, 'emergency-recovery');
    pushExpectedError(errors, 'rollbackProfile', metadata.rollbackProfile, 'emergency-stabilization');
    if (baseRef !== 'main') {
      errors.push(deliveryError('invalid_baseRef', 'Emergency recovery PRs must target main.', {
        expected: 'main',
        value: baseRef,
      }));
    }
    rejectComponentMetadataForNonModelB(errors, componentBranch, componentMaster, 'emergency recovery');
  }

  return {
    deliveryModel: metadata.deliveryModel,
    size: metadata.size,
    changeMode: metadata.changeMode,
    targetEnvironment: metadata.targetEnvironment,
    approvalProfile: metadata.approvalProfile,
    gateProfile: metadata.gateProfile,
    rollbackProfile: metadata.rollbackProfile,
    componentBranch,
    componentMaster,
    implementationAgent,
    protectedChange,
    errors,
  };
}

export function runCli(env = process.env) {
  if (!env.PR_BODY_FILE || !fs.existsSync(env.PR_BODY_FILE)) {
    const result = {
      deliveryModel: '',
      size: '',
      changeMode: '',
      targetEnvironment: '',
      approvalProfile: '',
      gateProfile: '',
      rollbackProfile: '',
      componentBranch: '',
      componentMaster: '',
      protectedChange: false,
      errors: [
        deliveryError('missing_pr_body_file', 'PR_BODY_FILE is required and must point to an existing file.'),
      ],
    };
    writeJsonArtifact(result, env);
    console.error(result.errors[0].message);
    return 2;
  }

  const body = fs.readFileSync(env.PR_BODY_FILE, 'utf8');
  const metadata = parseDeliveryMetadata(body);
  let changedFiles = undefined;
  if (env.CHANGED_FILES_FILE) {
    if (!fs.existsSync(env.CHANGED_FILES_FILE)) {
      if (metadata.deliveryModel === 'B-child') {
        const result = {
          deliveryModel: metadata.deliveryModel,
          size: metadata.size,
          changeMode: metadata.changeMode,
          targetEnvironment: metadata.targetEnvironment,
          approvalProfile: metadata.approvalProfile,
          gateProfile: metadata.gateProfile,
          rollbackProfile: metadata.rollbackProfile,
          componentBranch: normalizeOptionalComponentValue(metadata.componentBranch),
          componentMaster: normalizeOptionalComponentValue(metadata.componentMaster),
          protectedChange: false,
          errors: [
            deliveryError(
              'missing_changed_files_file',
              'CHANGED_FILES_FILE is required and must point to an existing file for Model B child PRs.',
            ),
          ],
        };
        writeJsonArtifact(result, env);
        console.log(JSON.stringify(result, null, 2));
        return 1;
      }
      changedFiles = [];
    } else {
      changedFiles = readListFile(env.CHANGED_FILES_FILE);
    }
  }
  const result = classifyDeliveryProfile({
    baseRef: env.PR_BASE_REF || '',
    headRef: env.PR_HEAD_REF || '',
    body,
    changedFiles,
  });

  writeJsonArtifact(result, env);
  console.log(JSON.stringify(result, null, 2));
  return result.errors.length === 0 ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = runCli();
}
