/**
 * Agent-generated Engineering candidate intake for #3670.
 * Routes evidence-backed improvement candidates into existing Engineering qualification authority.
 * Pure functions only — no GitHub API side effects.
 */

import { extractFieldValue } from './executable-child-contract.mjs';

export const CANDIDATE_FIELDS = Object.freeze([
  { key: 'evidence', label: 'Evidence', labels: ['evidence'] },
  { key: 'statedDeficiency', label: 'Stated deficiency', labels: ['stated deficiency', 'problem', 'deficiency'] },
  { key: 'intendedOutcome', label: 'Intended outcome', labels: ['intended outcome'] },
  { key: 'remediationDirection', label: 'Candidate remediation direction', labels: ['candidate remediation direction', 'remediation direction'] },
  { key: 'constraintsRisks', label: 'Constraints/risks', labels: ['constraints/risks', 'constraints and risks', 'known constraints, dependencies, risks'] },
  { key: 'provenance', label: 'Provenance', labels: ['provenance', 'observation source'] }
]);

const PLACEHOLDERS = new Set(['tbd', 'todo', 'n/a', 'na', 'none', 'unknown', 'pending', 'placeholder']);

function hasRealContent(value) {
  const normalized = String(value || '').trim().toLowerCase().replace(/[._-]+/g, ' ');
  if (!/[a-z0-9]/i.test(normalized)) return false;
  return !PLACEHOLDERS.has(normalized);
}

export function parseCandidateFields(body) {
  const present = [];
  const missing = [];
  const values = {};
  for (const field of CANDIDATE_FIELDS) {
    const value = extractFieldValue(body, field.labels);
    values[field.key] = value;
    if (hasRealContent(value)) present.push(field.key);
    else missing.push(field.key);
  }
  return { present, missing, values };
}

export function validateCandidatePackage(candidate = {}) {
  const { present, missing, values } = parseCandidateFields(candidate.body || '');
  const errors = [];
  const remediation = [];
  if (missing.length) {
    const missingLabels = missing.map((key) => CANDIDATE_FIELDS.find((field) => field.key === key)?.label || key);
    errors.push(`missing required candidate field(s): ${missingLabels.join(', ')}`);
    remediation.push(`Add labeled fields for: ${missingLabels.join(', ')} (see docs/reference/pmo/engineering-candidate-intake-contract.md)`);
  }
  return { complete: missing.length === 0, present, missing, values, errors, remediation };
}

function normalize(text) {
  return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function isDuplicateCandidate(candidateA = {}, candidateB = {}) {
  const a = parseCandidateFields(candidateA.body || '').values;
  const b = parseCandidateFields(candidateB.body || '').values;
  if (a.statedDeficiency && b.statedDeficiency && normalize(a.statedDeficiency) === normalize(b.statedDeficiency)) {
    return { duplicate: true, reason: 'identical stated deficiency text' };
  }
  if (a.provenance && b.provenance && normalize(a.provenance) === normalize(b.provenance)) {
    return { duplicate: true, reason: 'identical provenance/observation source' };
  }
  return { duplicate: false, reason: null };
}

export function findDuplicateCandidates(candidate, existingCandidates = []) {
  const duplicates = [];
  for (const existing of existingCandidates) {
    if (candidate?.id != null && existing?.id != null && String(candidate.id) === String(existing.id)) continue;
    const result = isDuplicateCandidate(candidate, existing);
    if (result.duplicate) duplicates.push({ id: existing.id, reason: result.reason });
  }
  return duplicates;
}

const PERMITTED_CANDIDATE_ACTIONS = new Set(['submit-candidate', 'route-to-engineering-qualification']);
const PROHIBITED_CANDIDATE_ACTIONS = new Set([
  'assign-pmo-active-priority',
  'grant-implementation-go',
  'grant-project-graduation',
  'change-product-authority-decision'
]);

export function assertCandidateAuthorityBoundary(action) {
  if (PROHIBITED_CANDIDATE_ACTIONS.has(action)) {
    return { permitted: false, reason: `"${action}" is outside agent-generated candidate intake authority` };
  }
  if (PERMITTED_CANDIDATE_ACTIONS.has(action)) return { permitted: true, reason: 'within bounded candidate-intake authority' };
  return { permitted: false, reason: `unrecognized action "${action}"; fails closed outside bounded candidate-intake authority` };
}

export function evaluateCandidateIntake({ candidate = {}, existingCandidates = [] } = {}) {
  const pkg = validateCandidatePackage(candidate);
  const duplicates = findDuplicateCandidates(candidate, existingCandidates);
  const errors = [...pkg.errors];
  const remediation = [...pkg.remediation];
  if (duplicates.length) {
    errors.push(`duplicate of existing candidate(s): ${duplicates.map((d) => `#${d.id} (${d.reason})`).join(', ')}`);
    remediation.push('Reconcile with the existing duplicate candidate instead of opening a new one');
  }
  return { intakeReady: pkg.complete && duplicates.length === 0, package: pkg, duplicates, errors, remediation };
}
