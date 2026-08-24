/**
 * Agent-generated Engineering candidate intake for #3670.
 * A bounded intake path for agent-observed technical debt, test
 * weaknesses, documentation drift, recurring operational defects,
 * security concerns, architectural inconsistencies, CI shortcomings,
 * and product improvement candidates, routed into the existing
 * Engineering qualification authority rather than a competing
 * backlog. Candidate generation can never assign PMO Active priority,
 * grant implementation Go, grant Project Graduation, or change a
 * Product Authority decision.
 * Pure functions only — no GitHub API side effects.
 */

import { extractFieldValue } from './executable-child-contract.mjs';

/**
 * Required fields for an agent-generated candidate, per #3670: the
 * observation must be evidence-backed with a stated deficiency,
 * intended outcome, candidate remediation direction, known
 * constraints/risks, and provenance of the observation.
 */
export const CANDIDATE_FIELDS = Object.freeze([
  { key: 'evidence', labels: ['evidence'] },
  { key: 'statedDeficiency', labels: ['stated deficiency', 'problem', 'deficiency'] },
  { key: 'intendedOutcome', labels: ['intended outcome'] },
  {
    key: 'remediationDirection',
    labels: ['candidate remediation direction', 'remediation direction']
  },
  {
    key: 'constraintsRisks',
    labels: [
      'constraints/risks',
      'constraints and risks',
      'known constraints, dependencies, risks'
    ]
  },
  { key: 'provenance', labels: ['provenance', 'observation source'] }
]);

function hasRealContent(value) {
  if (!value) return false;
  return /[A-Za-z0-9]/.test(value.replace(/_+/g, ''));
}

export function parseCandidateFields(body) {
  const present = [];
  const missing = [];
  const values = {};

  for (const field of CANDIDATE_FIELDS) {
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
 * A candidate is package-complete only once every required field is
 * present with real content — no bare, unevidenced observations enter
 * the qualification model.
 *
 * @param {{ body?: string }} candidate
 */
export function validateCandidatePackage(candidate = {}) {
  const { present, missing, values } = parseCandidateFields(candidate.body || '');
  const errors = [];
  const remediation = [];

  if (missing.length) {
    errors.push(`missing required candidate field(s): ${missing.join(', ')}`);
    remediation.push(
      `Add labeled fields for: ${missing.join(', ')} (see docs/reference/pmo/engineering-candidate-intake-contract.md)`
    );
  }

  return { complete: missing.length === 0, present, missing, values, errors, remediation };
}

function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Deterministic duplicate detection: two candidates are duplicates
 * when they share normalized stated-deficiency text or normalized
 * provenance, so repeated observations reconcile instead of spamming
 * new Issues.
 *
 * @param {{ body?: string }} candidateA
 * @param {{ body?: string }} candidateB
 */
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

/**
 * @param {{ id: string|number, body?: string }} candidate
 * @param {Array<{ id: string|number, body?: string }>} existingCandidates
 */
export function findDuplicateCandidates(candidate, existingCandidates = []) {
  const duplicates = [];
  for (const existing of existingCandidates) {
    const result = isDuplicateCandidate(candidate, existing);
    if (result.duplicate) {
      duplicates.push({ id: existing.id, reason: result.reason });
    }
  }
  return duplicates;
}

/** Actions agent-generated candidate intake may perform without escalation. */
const PERMITTED_CANDIDATE_ACTIONS = new Set([
  'submit-candidate',
  'route-to-engineering-qualification'
]);

/** Actions candidate intake never grants, regardless of package completeness. */
const PROHIBITED_CANDIDATE_ACTIONS = new Set([
  'assign-pmo-active-priority',
  'grant-implementation-go',
  'grant-project-graduation',
  'change-product-authority-decision'
]);

/**
 * Candidate generation may submit and route evidence-backed
 * candidates into Engineering qualification, but may never assign
 * PMO Active priority, grant implementation Go, grant Project
 * Graduation, or change a Product Authority decision. An unrecognized
 * action fails closed rather than defaulting to permitted.
 *
 * @param {string} action
 */
export function assertCandidateAuthorityBoundary(action) {
  if (PROHIBITED_CANDIDATE_ACTIONS.has(action)) {
    return {
      permitted: false,
      reason: `"${action}" is outside agent-generated candidate intake authority`
    };
  }
  if (PERMITTED_CANDIDATE_ACTIONS.has(action)) {
    return { permitted: true, reason: 'within bounded candidate-intake authority' };
  }
  return {
    permitted: false,
    reason: `unrecognized action "${action}"; fails closed outside bounded candidate-intake authority`
  };
}

/**
 * Evaluate whether a candidate is ready to route into Engineering
 * qualification: package-complete and not a duplicate of an existing
 * candidate. A candidate remains non-executable regardless of
 * intake readiness — intake never grants priority or Go.
 *
 * @param {{ candidate: { id?: string|number, body?: string }, existingCandidates?: Array<{ id: string|number, body?: string }> }} input
 */
export function evaluateCandidateIntake({ candidate = {}, existingCandidates = [] } = {}) {
  const pkg = validateCandidatePackage(candidate);
  const duplicates = findDuplicateCandidates(candidate, existingCandidates);

  const errors = [...pkg.errors];
  const remediation = [...pkg.remediation];
  if (duplicates.length) {
    errors.push(
      `duplicate of existing candidate(s): ${duplicates.map((d) => `#${d.id} (${d.reason})`).join(', ')}`
    );
    remediation.push('Reconcile with the existing duplicate candidate instead of opening a new one');
  }

  return {
    intakeReady: pkg.complete && duplicates.length === 0,
    package: pkg,
    duplicates,
    errors,
    remediation
  };
}
