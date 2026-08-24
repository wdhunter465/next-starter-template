/**
 * Machine-readable executable project/child contract for #3665.
 * Composes the existing queue-label contract (#2724) and agent-claim
 * contract (#3240) with package-completeness and lifecycle-state
 * consistency checks so a child Issue's claimability can be evaluated
 * deterministically and fail closed with actionable evidence.
 * Pure functions only — no GitHub API side effects.
 */

import { analyzeQueueLabels } from '../pmo-dashboard/queue-label-contract.mjs';

export const CONTRACT_STATUS = Object.freeze({
  PACKAGE_COMPLETE: 'PACKAGE-COMPLETE',
  PACKAGE_INCOMPLETE: 'PACKAGE-INCOMPLETE',
  LIFECYCLE_CONTRADICTION: 'LIFECYCLE-CONTRADICTION',
  INVALID_QUEUE_STATE: 'INVALID-QUEUE-STATE'
});

/**
 * Required execution-contract fields (#3665). Each field is matched
 * against a labeled `Label: value` line (case-insensitive, optional
 * leading `-`), following the convention already used by the human
 * template at docs/templates/executable-child-task-template.md and by
 * the `project-child` `requiresBodyReference` rule in
 * .github/queue-label-registry.json.
 */
export const CONTRACT_FIELDS = Object.freeze([
  { key: 'objective', labels: ['objective', 'one bounded objective'] },
  { key: 'parentProject', labels: ['parent project', 'parent'] },
  {
    key: 'predecessor',
    labels: ['predecessor', 'predecessor and required work acceptance', 'predecessor(s)']
  },
  {
    key: 'permittedScope',
    labels: ['writable files/actions', 'permitted file/domain scope', 'permitted scope']
  },
  {
    key: 'acceptanceCriteria',
    labels: ['acceptance criteria', 'observable acceptance criteria']
  },
  {
    key: 'requiredValidation',
    labels: ['required validation', 'positive validation', 'negative/failure-path validation']
  },
  {
    key: 'expectedArtifact',
    labels: ['expected artifact/pr', 'exact observable deliverable', 'pr target branch']
  },
  { key: 'rollback', labels: ['rollback', 'rollback/disable/recovery procedure'] },
  {
    key: 'protectedStops',
    labels: ['protected stops', 'stop conditions', 'protected product/production/legal/privacy/rights/cost/provider/credential/destructive-data/public-claim boundaries']
  },
  {
    key: 'reviewerRequirement',
    labels: ['independent reviewer role holder', 'required review/check evidence', 'collaboration/reviewer requirement']
  },
  { key: 'successor', labels: ['successor'] },
  {
    key: 'completionEvidence',
    labels: ['durable evidence location', 'completion evidence']
  }
]);

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasRealContent(value) {
  if (!value) return false;
  return /[A-Za-z0-9]/.test(value.replace(/_+/g, ''));
}

/**
 * Find the value of the first `Label: value` line matching any of the
 * given synonym labels. Returns null when no line matches.
 *
 * @param {string} body
 * @param {string[]} labels
 * @returns {string|null}
 */
export function extractFieldValue(body, labels) {
  const text = body || '';
  for (const label of labels) {
    const re = new RegExp(`^\\s*-?\\s*${escapeRegExp(label)}\\s*:\\s*(.*)$`, 'im');
    const match = text.match(re);
    if (match) {
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Parse and evaluate the presence of every required contract field.
 *
 * @param {string} body
 * @returns {{ present: string[], missing: string[], values: Record<string, string|null> }}
 */
export function parseContractFields(body) {
  const present = [];
  const missing = [];
  const values = {};

  for (const field of CONTRACT_FIELDS) {
    const value = extractFieldValue(body, field.labels);
    values[field.key] = value;
    if (hasRealContent(value)) {
      present.push(field.key);
    } else {
      missing.push(field.key);
    }
  }

  return { present, missing, values };
}

/**
 * Package completeness: every required execution-contract field must
 * be present with a real (non-placeholder) value before an Issue is
 * claimable.
 *
 * @param {{ body?: string }} issue
 */
export function validatePackageCompleteness(issue = {}) {
  const { present, missing, values } = parseContractFields(issue.body || '');
  const errors = [];
  const remediation = [];

  if (missing.length) {
    errors.push(`missing required execution-contract field(s): ${missing.join(', ')}`);
    remediation.push(
      `Add labeled fields for: ${missing.join(', ')} (see docs/reference/pmo/executable-child-contract.md)`
    );
  }

  return {
    complete: missing.length === 0,
    present,
    missing,
    values,
    errors,
    remediation
  };
}

const NORMALIZE_LABEL_RE = /^\s+|\s+$/g;

function normalizeLabels(input) {
  return (input || [])
    .map((label) => (typeof label === 'string' ? label : label?.name))
    .filter(Boolean)
    .map((label) => label.replace(NORMALIZE_LABEL_RE, ''));
}

const NOT_AUTHORIZED_RE =
  /\b(?:not(?:\s+yet)?\s+authorized|implementation is not authorized|do not implement|not\s+approved\s+for\s+implementation|no\s+go\b|not\s+cleared\s+(?:for|to)\s+(?:implement|execute))\b/i;

const DISPOSITION_FIELD_RE = /^\s*-?\s*(?:Disposition|Status|State)\s*:\s*(.+)$/im;
const STAGE_FIELD_RE = /^\s*-?\s*(?:Lifecycle stage|Stage)\s*:\s*(.+)$/im;

const TERMINAL_WORDS_RE = /\b(closed|complete|completed|done|terminal|reconciled|accept(?:ed)?)\b/i;
const ACTIVE_WORDS_RE = /\b(in[\s-]?progress|active|pending|open|not[\s-]?started|blocked|hold)\b/i;

const STAGE_LABEL_MAP = {
  'engineering qualification': { requires: ['team:engineering'], forbids: ['pmo:pipeline'] },
  'initial idea': { requires: ['pmo:pipeline', 'pmo:stage:initial-idea'] },
  'drafted design': { requires: ['pmo:pipeline', 'pmo:stage:drafted-design'] },
  'pending launch packet': { requires: ['pmo:pipeline', 'pmo:stage:pending-launch-packet'] },
  'graduation candidate': { requires: ['pmo:pipeline', 'pmo:stage:graduation-candidate'] },
  active: { requires: ['pmo:active'] },
  closed: { requires: ['pmo:closed'] }
};

function hasClaimableLifecycleLabel(labels) {
  return (
    labels.includes('pmo:active') ||
    labels.includes('pmo:task') ||
    (labels.includes('pmo:pipeline') && labels.includes('pmo:stage:graduation-candidate')) ||
    labels.some((label) => /^agent:/i.test(label))
  );
}

/**
 * Detect contradictions between the Issue's narrative body text and its
 * live labels/lifecycle state. Fails closed with actionable evidence
 * rather than silently routing a contradictory Issue.
 *
 * @param {{ body?: string, labels?: Array<string|{name?: string}> }} issue
 */
export function detectLifecycleContradiction(issue = {}) {
  const body = issue.body || '';
  const labels = normalizeLabels(issue.labels);
  const contradictions = [];
  const remediation = [];

  if (NOT_AUTHORIZED_RE.test(body) && hasClaimableLifecycleLabel(labels)) {
    contradictions.push(
      'narrative text states implementation is not authorized while labels indicate PMO Active/claimable execution'
    );
    remediation.push(
      'Reconcile narrative text with live labels: either remove the not-authorized narrative or remove the claimable/Active label(s)'
    );
  }

  const dispositionMatch = body.match(DISPOSITION_FIELD_RE);
  if (dispositionMatch) {
    const value = dispositionMatch[1];
    const isClosedLabel = labels.includes('pmo:closed');
    if (TERMINAL_WORDS_RE.test(value) && !ACTIVE_WORDS_RE.test(value) && !isClosedLabel) {
      contradictions.push(
        `terminal narrative ("${value.trim()}") conflicts with live state (pmo:closed label absent)`
      );
      remediation.push('Add pmo:closed or correct the Disposition/Status narrative field');
    }
    if (isClosedLabel && ACTIVE_WORDS_RE.test(value) && !TERMINAL_WORDS_RE.test(value)) {
      contradictions.push(
        `pmo:closed label conflicts with non-terminal narrative ("${value.trim()}")`
      );
      remediation.push('Remove pmo:closed or correct the Disposition/Status narrative field');
    }
  }

  const stageMatch = body.match(STAGE_FIELD_RE);
  if (stageMatch) {
    const stageValue = stageMatch[1].trim().toLowerCase();
    const expectation = STAGE_LABEL_MAP[stageValue];
    if (expectation) {
      const missingRequired = (expectation.requires || []).filter(
        (label) => !labels.includes(label)
      );
      const presentForbidden = (expectation.forbids || []).filter((label) =>
        labels.includes(label)
      );
      if (missingRequired.length || presentForbidden.length) {
        contradictions.push(
          `Pipeline/Active/Engineering lifecycle language ("${stageMatch[1].trim()}") is inconsistent with labels`
        );
        remediation.push(
          `Align labels with the stated lifecycle stage: require ${missingRequired.join(', ') || 'none'}; remove ${presentForbidden.join(', ') || 'none'}`
        );
      }
    }
  }

  return {
    consistent: contradictions.length === 0,
    contradictions,
    remediation
  };
}

/**
 * Evaluate the full executable child contract for an Issue: queue
 * invariants, lifecycle-state consistency, and package completeness.
 * Fails closed — any contradictory or incomplete state blocks
 * claimability and returns actionable evidence.
 *
 * @param {{ body?: string, labels?: Array<string|{name?: string}> }} issue
 */
export function evaluateExecutableChildContract(issue = {}) {
  const queue = analyzeQueueLabels({ labels: issue.labels, role: 'task' });
  const lifecycle = detectLifecycleContradiction(issue);
  const pkg = validatePackageCompleteness(issue);

  const errors = [...queue.errors, ...lifecycle.contradictions, ...pkg.errors];
  const remediation = [
    ...queue.remediation,
    ...lifecycle.remediation,
    ...pkg.remediation
  ];

  let status;
  if (queue.errors.length) {
    status = CONTRACT_STATUS.INVALID_QUEUE_STATE;
  } else if (!lifecycle.consistent) {
    status = CONTRACT_STATUS.LIFECYCLE_CONTRADICTION;
  } else if (!pkg.complete) {
    status = CONTRACT_STATUS.PACKAGE_INCOMPLETE;
  } else {
    status = CONTRACT_STATUS.PACKAGE_COMPLETE;
  }

  return {
    status,
    claimable: status === CONTRACT_STATUS.PACKAGE_COMPLETE,
    queue,
    lifecycle,
    package: pkg,
    errors: [...new Set(errors)],
    remediation: [...new Set(remediation)]
  };
}
